import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { strickerRouter } from "./src/server/strickerRouter";
import { strickerSyncWorker } from "./src/server/strickerSyncWorker";
import { paymentRouter } from "./src/server/paymentRouter";
import { systemRouter, maintenanceApiMiddleware } from "./src/server/systemRouter";
import { financialRouter } from "./src/server/financialRouter";
import { backupRouter } from "./src/server/backupRouter";
import { backupSchedulerWorker } from "./src/server/backupSchedulerWorker";
import { costPricingRouter } from "./src/server/costPricingRouter";
import { couponRouter } from "./src/server/couponRouter";
import { uploadRouter } from "./src/server/uploadRouter";

import { databaseRouter } from "./src/server/databaseRouter";
import { authRouter } from "./src/server/authRouter";
import { analyticsRouter } from "./src/server/analyticsRouter";
import { isDbUnavailableError } from "./src/server/dbErrorHelper";
import { attachSessionUser, requirePermission } from "./src/middleware/auth";
import { seedInitialDataIfEmpty } from "./src/db/repository";
import { closePool } from "./src/db";

async function startServer() {
  const app = express();
  app.set("trust proxy", true);
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Aumentar limite de payload para suportar upload de artefatos/mockups de até 50MB
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Servir arquivos estáticos de uploads persistentes
  const uploadsPath = path.join(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadsPath));

  // Inicia worker de sincronização periódica Stricker em segundo plano
  strickerSyncWorker.start();

  // Inicia worker de exportação agendada e recuperação de desastres
  backupSchedulerWorker.start();

  // Inicializa seed de dados essenciais no PostgreSQL se vazio
  seedInitialDataIfEmpty().catch((err) => {
    console.warn('[Server] PostgreSQL initial check/seed:', err);
  });

  // API Health
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      app: "MB Personaliza",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Middleware de sessão autenticada (PostgreSQL auth_sessions — nunca confia em headers x-user-*)
  app.use(attachSessionUser);

  // Autenticação, Cadastro e Sessão (PostgreSQL)
  app.use("/api/auth", authRouter);

  // Verificação protegida para geração/visualização do Catálogo PDF
  app.get(
    "/api/catalog-pdf/access",
    requirePermission("canAccessCatalogPdf"),
    (req, res) => {
      res.json({
        success: true,
        allowed: true,
        user: req.authUser,
      });
    }
  );

  // PostgreSQL Cloud SQL Database API Routes
  app.use("/api/db", databaseRouter);

  // Módulo de Upload de Arquivos Persistentes
  app.use("/api/upload", uploadRouter);

  // Modo de Manutenção & Configurações do Sistema
  app.use("/api/system", systemRouter);

  // Middleware de proteção de APIs em modo de manutenção
  app.use(maintenanceApiMiddleware);

  // Payment Gateways & Webhooks (Mercado Pago & PagBank)
  app.use("/api/payments", paymentRouter);

  // Módulo Financeiro — Controle de Acesso e APIs Seguras
  app.use("/api/financial", financialRouter);

  // Backup & Recuperação de Desastres (JSON Seguro e Agendado)
  app.use("/api/backup", backupRouter);

  // Módulo de Orçamento de Custos e Precificação de Produtos
  app.use("/api/cost-pricing", costPricingRouter);

  // Módulo de Cupons de Desconto & Campanhas Promocionais
  app.use("/api/coupons", couponRouter);

  // Analytics & Métricas do Site (PostgreSQL)
  app.use("/api/analytics", analyticsRouter);

  // Stricker / SPOT Webservice API Proxy Routes
  app.use("/api/stricker", strickerRouter);
  // Postman & Official Endpoint Compatibility Aliases
  app.use("/api/v1SSL", strickerRouter);
  app.use("/api/v1", strickerRouter);
  app.use("/downloads/v1SSL", strickerRouter);
  app.use("/downloads/v1", strickerRouter);

  // Global API error handler (fail-closed HTTP 503 when PostgreSQL unavailable)
  app.use("/api", (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (isDbUnavailableError(err)) {
      return res.status(503).json({
        success: false,
        code: "DB_UNAVAILABLE",
        error: err?.message || "Banco de dados PostgreSQL indisponível.",
      });
    }
    return res.status(err?.status || 500).json({
      success: false,
      error: err?.message || "Erro interno no servidor.",
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`MB Personaliza Server running on http://localhost:${PORT}`);
  });

  // Graceful Shutdown para garantir parada segura em containers Docker / KVM VPS
  const gracefulShutdown = async (signal: string) => {
    console.log(`[Server] Sinal ${signal} recebido. Encerrando processos e conexões...`);
    try {
      strickerSyncWorker.stop();
      backupSchedulerWorker.stop();
      await closePool();
    } catch (err) {
      console.error('[Server] Erro durante o encerramento gracioso:', err);
    }

    server.close(() => {
      console.log('[Server] Servidor HTTP finalizado com sucesso.');
      process.exit(0);
    });

    // Timeout de segurança caso algum socket fique preso
    setTimeout(() => {
      console.warn('[Server] Forçando encerramento após timeout de 10s.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer();
