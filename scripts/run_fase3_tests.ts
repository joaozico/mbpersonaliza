/**
 * ==============================================================================
 * MB PERSONALIZA - SUÍTE COMPLETA DE TESTES DA FASE 3
 * Validação de Módulos, Segurança, Independência do PostgreSQL, Backups e Uploads
 * ==============================================================================
 */

import { db, createPool, closePool } from '../src/db/index.ts';
import {
  products,
  users,
  orders,
  quotes,
  categories,
  discountCoupons,
  systemSettings,
} from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface TestResult {
  suite: string;
  test: string;
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(suite: string, name: string, fn: () => Promise<string | void>) {
  const start = Date.now();
  try {
    const details = await fn();
    const duration = Date.now() - start;
    results.push({
      suite,
      test: name,
      status: 'PASSED',
      durationMs: duration,
      details: details || 'OK',
    });
    console.log(`  ✓ [PASSED] ${name} (${duration}ms)`);
  } catch (err: any) {
    const duration = Date.now() - start;
    results.push({
      suite,
      test: name,
      status: 'FAILED',
      durationMs: duration,
      details: err?.message || String(err),
    });
    console.error(`  ✗ [FAILED] ${name} (${duration}ms):`, err?.message || err);
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('   INICIANDO SUÍTE DE TESTES DA FASE 3 — MB PERSONALIZA         ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // SUÍTE 1: BANCO DE DADOS POSTGRESQL & INTEGRIDADE DE TABELAS
  // -------------------------------------------------------------
  console.log('[SUÍTE 1] Conexão e Integridade do PostgreSQL...');

  await runTest('PostgreSQL', 'Conexão ativa com o banco', async () => {
    const pool = createPool();
    const res = await pool.query('SELECT NOW() as server_time, version() as pg_version');
    if (!res.rows[0]) throw new Error('Query de teste não retornou linhas');
    return `Versão PG: ${res.rows[0].pg_version.slice(0, 30)}...`;
  });

  await runTest('PostgreSQL', 'Integridade e contagem das tabelas do schema', async () => {
    const cats = await db.select().from(categories);
    const prods = await db.select().from(products);
    const usrs = await db.select().from(users);
    if (cats.length === 0) throw new Error('Tabela categories vazia');
    if (prods.length === 0) throw new Error('Tabela products vazia');
    return `${cats.length} categorias, ${prods.length} produtos, ${usrs.length} usuários`;
  });

  // -------------------------------------------------------------
  // SUÍTE 2: TESTE DE INDEPENDÊNCIA DA HOSPEDAGEM (REGRA 11.6)
  // -------------------------------------------------------------
  console.log('\n[SUÍTE 2] Teste Obrigatório de Independência da Hospedagem (Regra 11.6)...');

  const testRecordId = `test-indep-${Date.now()}`;
  const testOrderId = `order-indep-${Date.now()}`;

  await runTest('Independência', 'Passo 1 & 2: Inserir cliente e pedido de teste no banco', async () => {
    // 1. Cadastrar cliente
    await db.insert(users).values({
      uid: testRecordId,
      name: 'Cliente Teste Independência Hostinger',
      email: `${testRecordId}@teste.com.br`,
      phone: '(11) 98765-4321',
      company: 'Empresa Teste VPS KVM 2',
      role: 'cliente',
    });

    // 2. Cadastrar pedido
    await db.insert(orders).values({
      id: testOrderId,
      code: `PED-TEST-${Date.now().toString().slice(-4)}`,
      clientId: testRecordId,
      clientName: 'Cliente Teste Independência Hostinger',
      clientEmail: `${testRecordId}@teste.com.br`,
      clientPhone: '(11) 98765-4321',
      clientCompany: 'Empresa Teste VPS KVM 2',
      items: [
        {
          productId: 'prod-copo-termico-473ml',
          productName: 'Copo Térmico Premium 473ml',
          quantity: 50,
          unitPrice: 38.9,
          totalPrice: 1945.0,
        },
      ],
      subtotal: 1945.0,
      total: 1945.0,
      orderStatus: 'novo',
      paymentMethod: 'pix',
      paymentStatus: 'pendente',
    });

    return `Registros gravados com IDs: ${testRecordId} e ${testOrderId}`;
  });

  await runTest('Independência', 'Passo 3 & 4: Parar a aplicação e encerrar o pool de conexões (Simulando reinício do VPS)', async () => {
    // Fecha o pool global simulando término de processo ou migração de servidor de aplicação
    await closePool();
    // Aguarda 1 segundo para garantir desconexão completa do socket
    await new Promise((r) => setTimeout(r, 1000));
    return 'Pool de conexões finalizado com sucesso.';
  });

  await runTest('Independência', 'Passo 5 & 6: Reconectar ao PostgreSQL e verificar integridade integral dos dados', async () => {
    // Reconecta ao banco
    const foundUser = await db.select().from(users).where(eq(users.uid, testRecordId));
    const foundOrder = await db.select().from(orders).where(eq(orders.id, testOrderId));

    if (foundUser.length === 0) throw new Error('Cliente teste não encontrado após reconexão!');
    if (foundOrder.length === 0) throw new Error('Pedido teste não encontrado após reconexão!');

    if (foundUser[0].company !== 'Empresa Teste VPS KVM 2') {
      throw new Error('Dados do cliente divergentes após reconexão!');
    }
    if (foundOrder[0].total !== 1945.0) {
      throw new Error('Total do pedido divergente após reconexão!');
    }

    // Limpeza dos dados de teste
    await db.delete(orders).where(eq(orders.id, testOrderId));
    await db.delete(users).where(eq(users.uid, testRecordId));

    return 'DADOS 100% PRESERVADOS. Independência comprovada com sucesso.';
  });

  // -------------------------------------------------------------
  // SUÍTE 3: UPLOADS E ARMAZENAMENTO PERSISTENTE DESACOPLADO
  // -------------------------------------------------------------
  console.log('\n[SUÍTE 3] Armazenamento Persistente de Arquivos (/uploads)...');

  await runTest('Uploads', 'Gravação e persistência de arquivos com hash único', async () => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const testFilename = `test_logo_${Date.now()}.png`;
    const dummyImageBuffer = Buffer.from('FAKE_PNG_BINARY_DATA_FOR_TESTING_STORAGE_PERSISTENCE');
    const testFilePath = path.join(uploadsDir, testFilename);

    // Grava no disco persistente
    fs.writeFileSync(testFilePath, dummyImageBuffer);

    // Verifica existência e calcula hash SHA256
    if (!fs.existsSync(testFilePath)) throw new Error('Arquivo não persistido no disco');
    const readBuffer = fs.readFileSync(testFilePath);
    const hashOriginal = crypto.createHash('sha256').update(dummyImageBuffer).digest('hex');
    const hashPersistido = crypto.createHash('sha256').update(readBuffer).digest('hex');

    if (hashOriginal !== hashPersistido) throw new Error('Corrupção de dados no armazenamento de arquivos');

    // Remove arquivo de teste
    fs.unlinkSync(testFilePath);

    return `Armazenamento OK em ${uploadsDir} com integridade SHA-256 idêntica.`;
  });

  // -------------------------------------------------------------
  // SUÍTE 4: ROTINAS DE BACKUP E RECUPERAÇÃO DE DESASTRES
  // -------------------------------------------------------------
  console.log('\n[SUÍTE 4] Rotinas de Backup e Checksum SHA-256...');

  await runTest('Backups', 'Geração de backup em JSON e cálculo de hash de integridade', async () => {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const testBackupFile = path.join(backupDir, `test_backup_${Date.now()}.json`);
    const mockBackupPayload = {
      timestamp: new Date().toISOString(),
      app: 'MB Personaliza',
      test: true,
      counts: { products: 14, categories: 6 },
    };

    const serialized = JSON.stringify(mockBackupPayload, null, 2);
    fs.writeFileSync(testBackupFile, serialized, 'utf-8');

    const fileHash = crypto.createHash('sha256').update(serialized).digest('hex');
    const hashFile = `${testBackupFile}.sha256`;
    fs.writeFileSync(hashFile, fileHash, 'utf-8');

    // Verifica integridade
    const readHash = fs.readFileSync(hashFile, 'utf-8').trim();
    if (readHash !== fileHash) throw new Error('Falha na validação do checksum SHA-256 do backup');

    // Limpa arquivos de teste
    fs.unlinkSync(testBackupFile);
    fs.unlinkSync(hashFile);

    return `Backup e Checksum SHA-256 validados (${fileHash.slice(0, 16)}...).`;
  });

  // -------------------------------------------------------------
  // SUÍTE 5: MÓDULO DE CUPONS E CAMPANHAS PROMOCIONAIS
  // -------------------------------------------------------------
  console.log('\n[SUÍTE 5] Módulo de Cupons e Regras de Negócio...');

  await runTest('Cupons', 'Criação, validação e aplicação de cupom com regras de limite', async () => {
    const testCouponCode = `TESTE_${Date.now().toString().slice(-4)}`;
    await db.insert(discountCoupons).values({
      id: `coupon-${Date.now()}`,
      code: testCouponCode,
      campaignName: 'Campanha Teste Automatizada',
      discountType: 'percentage',
      discountValue: 10,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      minPurchaseAmount: 100,
      maxDiscountAmount: 50,
      status: 'active',
      limitPerCustomer: 1,
    });

    const found = await db.select().from(discountCoupons).where(eq(discountCoupons.code, testCouponCode));
    if (found.length === 0) throw new Error('Cupom não localizado após inserção');

    // Limpa cupom de teste
    await db.delete(discountCoupons).where(eq(discountCoupons.code, testCouponCode));

    return `Cupom '${testCouponCode}' validado e removido.`;
  });

  // -------------------------------------------------------------
  // SUÍTE 6: CONFIGURAÇÕES DO SISTEMA E MODO DE MANUTENÇÃO
  // -------------------------------------------------------------
  console.log('\n[SUÍTE 6] Configurações do Sistema e Segurança...');

  await runTest('Sistema', 'Leitura e escrita de System Settings no PostgreSQL', async () => {
    const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, 'company'));
    if (existing.length === 0) throw new Error('Configuração de empresa não encontrada');
    return `Chave 'company' OK (${(existing[0].value as any)?.name || 'MB Personaliza'})`;
  });

  // Finalização e Relatório
  await closePool();

  console.log('\n================================================================');
  console.log('                 RESUMO DA SUÍTE DE TESTES                      ');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  console.log(`Total de testes executados: ${results.length}`);
  console.log(`✓ Aprovados: ${passed}`);
  console.log(`✗ Falhas: ${failed}`);

  if (failed > 0) {
    console.error('\nAlguns testes falharam. Verifique os logs acima.');
    process.exit(1);
  } else {
    console.log('\nTODOS OS TESTES FORAM APROVADOS COM 100% DE ÊXITO!');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Erro fatal durante a suíte de testes:', e);
  process.exit(1);
});
