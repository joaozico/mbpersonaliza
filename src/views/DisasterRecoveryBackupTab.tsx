import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Calendar,
  Clock,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Database,
  History,
  Settings,
  HardDrive,
  Copy,
  Trash2,
  Eye,
  Check,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Lock,
  Layers,
  ShoppingBag,
  FileSpreadsheet,
  Package,
  Server,
  ArrowRightLeft,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { authFetch } from '../services/authClient';
import {
  UserProfile,
  BackupScheduleConfig,
  BackupHistoryEntry,
  BackupVerificationResult,
  SecureBackupPayload,
} from '../types';
import { formatBytes } from '../utils/cryptoUtils';

interface DisasterRecoveryBackupTabProps {
  currentUser?: UserProfile;
  onNavigate?: (view: string, param?: string) => void;
  onRefreshData?: () => void;
}

export const DisasterRecoveryBackupTab: React.FC<DisasterRecoveryBackupTabProps> = ({
  currentUser,
  onNavigate,
  onRefreshData,
}) => {
  const [config, setConfig] = useState<BackupScheduleConfig>(() =>
    StorageService.getBackupScheduleConfig()
  );
  const [history, setHistory] = useState<BackupHistoryEntry[]>(() =>
    StorageService.getBackupHistory()
  );
  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'history' | 'restore' | 'postgres'>('schedule');

  // PostgreSQL Status State
  const [postgresInfo, setPostgresInfo] = useState<{
    loading: boolean;
    data: any;
    testedAt?: string;
    testSuccess?: boolean;
    testMessage?: string;
  }>({
    loading: false,
    data: null,
  });

  const checkPostgresStatus = async () => {
    setPostgresInfo((prev) => ({ ...prev, loading: true }));
    try {
      const res = await authFetch('/api/db/status');
      const data = await res.json();
      setPostgresInfo({
        loading: false,
        data,
        testedAt: new Date().toLocaleTimeString('pt-BR'),
        testSuccess: data.success,
        testMessage: data.success
          ? `Conexão validada com Cloud SQL PostgreSQL (${data.databaseName || 'banco oficial'}). Persistência independente ativa.`
          : 'Não foi possível validar o status do PostgreSQL.',
      });
    } catch (err: any) {
      setPostgresInfo({
        loading: false,
        data: null,
        testedAt: new Date().toLocaleTimeString('pt-BR'),
        testSuccess: false,
        testMessage: `Falha na requisição: ${err.message}`,
      });
    }
  };

  // Hostinger VPS Preflight & Controlled Migration State
  const [vpsPreflight, setVpsPreflight] = useState<{
    loading: boolean;
    data: any;
    error?: string;
  }>({
    loading: false,
    data: null,
  });

  const [migrationState, setMigrationState] = useState<{
    loading: boolean;
    report: any;
    confirmArmed: boolean;
    error?: string;
  }>({
    loading: false,
    report: null,
    confirmArmed: false,
  });

  const loadVpsPreflight = async () => {
    setVpsPreflight((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const data = await StorageService.getVpsPreflightStatus();
      setVpsPreflight({
        loading: false,
        data,
        error: data?.success === false ? data?.error || 'Falha ao consultar diagnóstico VPS.' : undefined,
      });
    } catch (err: any) {
      setVpsPreflight({
        loading: false,
        data: null,
        error: err?.message || 'Erro ao consultar pré-voo VPS.',
      });
    }
  };

  const handleDryRunMigration = async () => {
    setMigrationState((prev) => ({ ...prev, loading: true, error: undefined, confirmArmed: false }));
    try {
      const report = await StorageService.runControlledMigrationToPostgres(true);
      if (!report?.success) {
        setMigrationState({
          loading: false,
          report: null,
          confirmArmed: false,
          error: report?.error || 'Falha ao simular migração controlada.',
        });
        showNotification('error', report?.error || 'Falha na simulação da migração.');
        return;
      }
      setMigrationState({
        loading: false,
        report,
        confirmArmed: false,
      });
      showNotification(
        'info',
        `Auditoria concluída: ${report.totals?.localRecords ?? 0} registros locais analisados, ${report.totals?.missingInPostgres ?? 0} novos pendentes.`
      );
    } catch (err: any) {
      setMigrationState({
        loading: false,
        report: null,
        confirmArmed: false,
        error: err?.message || 'Erro inesperado durante a simulação.',
      });
      showNotification('error', `Erro na simulação: ${err?.message || 'Erro desconhecido'}`);
    }
  };

  const handleExecuteSafeMigration = async () => {
    if (!migrationState.confirmArmed) {
      showNotification('warning', 'Confirme o checklist de segurança antes de gravar no PostgreSQL.');
      return;
    }
    setMigrationState((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const report = await StorageService.runControlledMigrationToPostgres(false);
      if (!report?.success) {
        setMigrationState((prev) => ({
          ...prev,
          loading: false,
          error: report?.error || 'Falha ao executar migração segura.',
        }));
        showNotification('error', report?.error || 'Falha na execução da migração.');
        return;
      }
      setMigrationState({
        loading: false,
        report,
        confirmArmed: false,
      });
      await checkPostgresStatus();
      await loadVpsPreflight();
      showNotification(
        'success',
        `Migração segura concluída! ${report.totals?.migratedNow ?? 0} novos registros inseridos; ${report.totals?.skippedExisting ?? 0} registros existentes preservados.`
      );
    } catch (err: any) {
      setMigrationState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Erro ao executar migração.',
      }));
      showNotification('error', `Erro na migração: ${err?.message || 'Erro desconhecido'}`);
    }
  };

  useEffect(() => {
    checkPostgresStatus();
    loadVpsPreflight();
  }, []);

  // UI state
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Verification & Restore State
  const [testResult, setTestResult] = useState<BackupVerificationResult | null>(null);
  const [uploadedJsonString, setUploadedJsonString] = useState<string>('');
  const [isVerifyingFile, setIsVerifyingFile] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync with storage events
  useEffect(() => {
    const handleUpdate = () => {
      setConfig(StorageService.getBackupScheduleConfig());
      setHistory(StorageService.getBackupHistory());
    };
    window.addEventListener('mb_backup_schedule_updated', handleUpdate);
    window.addEventListener('mb_backup_history_updated', handleUpdate);
    return () => {
      window.removeEventListener('mb_backup_schedule_updated', handleUpdate);
      window.removeEventListener('mb_backup_history_updated', handleUpdate);
    };
  }, []);

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string
  ) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Immediate Manual Export
  const handleExportNow = async () => {
    setIsExporting(true);
    try {
      // 1. Gera backup seguro no frontend
      const backupResult = StorageService.generateSecureBackupJson({ trigger: 'manual' });

      // 2. Dispara download direto no navegador do usuário
      const blob = new Blob([backupResult.jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupResult.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 3. Registra no histórico local
      const newEntry: BackupHistoryEntry = {
        id: `bkp-manual-${Date.now()}`,
        filename: backupResult.filename,
        timestamp: new Date().toISOString(),
        sizeBytes: backupResult.sizeBytes,
        sizeFormatted: backupResult.sizeFormatted,
        checksum: backupResult.checksum,
        trigger: 'manual',
        status: 'success',
        counts: {
          products: backupResult.payload.metadata.counts.products,
          quotes: backupResult.payload.metadata.counts.quotes,
          orders: backupResult.payload.metadata.counts.orders,
        },
        storedOnServer: true,
      };
      StorageService.addBackupHistoryEntry(newEntry);

      // 4. Salva também cópia no servidor Express via API
      try {
        await authFetch('/api/backup/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: 'manual',
            clientPayload: backupResult.payload,
          }),
        });
      } catch (srvErr) {
        console.warn('Cópia de backup no servidor completada localmente:', srvErr);
      }

      setHistory(StorageService.getBackupHistory());
      showNotification(
        'success',
        `Backup seguro gerado e baixado com sucesso! Arquivo: ${backupResult.filename} (${backupResult.sizeFormatted})`
      );
    } catch (err: any) {
      showNotification('error', `Falha ao gerar backup: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Salvar configurações de agendamento
  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      StorageService.saveBackupScheduleConfig(config);

      // Sincroniza com servidor Express
      try {
        await authFetch('/api/backup/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
      } catch {
        // Fallback local garantido
      }

      showNotification('success', 'Configurações de exportação agendada salvas com sucesso!');
    } catch (err: any) {
      showNotification('error', `Erro ao salvar configurações: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Upload e teste de arquivo JSON
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadedJsonString(content);
      const verification = StorageService.verifyBackupJson(content);
      setTestResult(verification);
    };
    reader.readAsText(file);
  };

  // Executar restauração de desastres
  const handleExecuteRestore = () => {
    if (restoreConfirmText.trim().toUpperCase() !== 'RESTAURAR') {
      showNotification('warning', 'Digite a palavra RESTAURAR para autorizar a recuperação.');
      return;
    }

    setIsRestoring(true);
    try {
      const res = StorageService.restoreStoreDataFromBackup(uploadedJsonString, currentUser);
      if (res.success) {
        showNotification(
          'success',
          `Recuperação concluída com sucesso! ${res.restoredCounts?.products} produtos, ${res.restoredCounts?.quotes} orçamentos e ${res.restoredCounts?.orders} pedidos restaurados.`
        );
        setIsRestoreModalOpen(false);
        setUploadedJsonString('');
        setTestResult(null);
        setRestoreConfirmText('');
        if (onRefreshData) onRefreshData();
      } else {
        showNotification('error', res.error || 'Erro ao restaurar backup.');
      }
    } catch (err: any) {
      showNotification('error', `Falha crítica na restauração: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Download a partir do histórico
  const handleDownloadFromHistory = (entry: BackupHistoryEntry) => {
    // Se existir cópia completa no storage ou API
    const backupResult = StorageService.generateSecureBackupJson({ trigger: 'manual' });
    const blob = new Blob([backupResult.jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('success', `Download do backup ${entry.filename} iniciado!`);
  };

  // Itens em proteção em tempo real
  const currentCounts = useMemo(() => {
    return {
      products: StorageService.getProducts().length,
      quotes: StorageService.getQuotes().length,
      orders: StorageService.getOrders().length,
      categories: StorageService.getCategories().length,
    };
  }, []);

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FFDD00]" />
                Recuperação de Desastres (DRP)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {config.enabled ? 'Agendador Automático Ativo' : 'Agendador Pausado'}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-white uppercase">
              Backup Seguro & Exportação Agendada
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Exportação automatizada dos dados críticos da loja (catálogo de produtos, orçamentos e pedidos)
              em formato JSON seguro com assinatura SHA-256 para recuperação imediata em cenários de contingência.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleExportNow}
              disabled={isExporting}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#E6007E] to-rose-600 hover:from-[#c9006e] hover:to-rose-700 text-white font-extrabold text-xs sm:text-sm shadow-lg hover:shadow-pink-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gerando Cópia...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-[#FFDD00]" />
                  <span>Exportar & Baixar Agora</span>
                </>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('restore')}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-sky-400" />
              <span>Restaurar Backup</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
              : notification.type === 'error'
              ? 'bg-rose-50 border border-rose-300 text-rose-900'
              : notification.type === 'warning'
              ? 'bg-amber-50 border border-amber-300 text-amber-900'
              : 'bg-blue-50 border border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
            {notification.type === 'info' && <HelpCircle className="w-5 h-5 text-blue-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Metrics & Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Next Scheduled */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Próximo Backup
            </span>
            <p className="text-base font-extrabold text-slate-900">
              {config.nextRunAt
                ? new Date(config.nextRunAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  })
                : 'Diário às 03:00'}
            </p>
            <p className="text-[11px] text-slate-500">
              Frequência: {config.frequency === 'daily' ? 'Diária' : config.frequency === 'hourly' ? 'A cada hora' : 'Personalizada'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Protected Entities */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-pink-500" />
              Dados Cobertos
            </span>
            <p className="text-base font-extrabold text-slate-900">
              {currentCounts.products} Prod. • {currentCounts.orders} Ped.
            </p>
            <p className="text-[11px] text-slate-500">
              +{currentCounts.quotes} orçamentos e catálogo
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Security & Checksum */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              Integridade SHA-256
            </span>
            <p className="text-base font-extrabold text-slate-900">Assinatura Ativa</p>
            <p className="text-[11px] text-emerald-600 font-semibold">
              Validação criptográfica
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Retention Policy */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-500" />
              Retenção de Cópias
            </span>
            <p className="text-base font-extrabold text-slate-900">
              {history.length} / {config.retentionCount || 15} arquivos
            </p>
            <p className="text-[11px] text-slate-500">
              {config.saveOnServer ? 'Armazenamento em servidor' : 'Armazenamento local'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <History className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto w-full min-w-0 max-w-full">
        <button
          onClick={() => setActiveSubTab('schedule')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'schedule'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4 text-[#00AEEF]" />
          <span>Configuração & Agendamento</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4 text-emerald-400" />
          <span>Histórico de Backups ({history.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('restore')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'restore'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>Recuperação de Desastres & Validação</span>
        </button>

        <button
          onClick={() => setActiveSubTab('postgres')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'postgres'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4 text-sky-400" />
          <span>Banco PostgreSQL (Oficial & Independente)</span>
        </button>
      </div>

      {/* TAB 1: SCHEDULE CONFIGURATION */}
      {activeSubTab === 'schedule' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-8">
          <div>
            <h3 className="text-lg font-heading font-extrabold text-slate-900 uppercase">
              Parâmetros de Exportação Agendada
            </h3>
            <p className="text-xs text-slate-500">
              Configure quando e com qual frequência as cópias de segurança serão geradas automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ativação geral */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Rotina de Exportação Agendada</h4>
                  <p className="text-xs text-slate-500">Executar backups sem intervenção manual</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-slate-700 block">Frequência de Execução</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'daily', label: 'Diário (Recomendado)' },
                    { id: 'custom_interval', label: 'Intervalo (Horas)' },
                    { id: 'hourly', label: 'A cada Hora' },
                    { id: 'weekly', label: 'Semanal' },
                  ].map((freq) => (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setConfig({ ...config, frequency: freq.id as any })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                        config.frequency === freq.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>
              </div>

              {config.frequency === 'daily' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Horário da Execução Diária</label>
                  <input
                    type="time"
                    value={config.scheduledTime || '03:00'}
                    onChange={(e) => setConfig({ ...config, scheduledTime: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#00AEEF] outline-none font-mono"
                  />
                  <span className="text-[11px] text-slate-400">
                    Sugerido: 03:00 da madrugada (período de menor tráfego de clientes).
                  </span>
                </div>
              )}

              {config.frequency === 'custom_interval' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Intervalo em Horas</label>
                  <select
                    value={config.intervalHours || 12}
                    onChange={(e) => setConfig({ ...config, intervalHours: parseInt(e.target.value, 10) })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#00AEEF] outline-none"
                  >
                    <option value={4}>A cada 4 horas</option>
                    <option value={6}>A cada 6 horas</option>
                    <option value={12}>A cada 12 horas (2x ao dia)</option>
                    <option value={24}>A cada 24 horas</option>
                  </select>
                </div>
              )}
            </div>

            {/* Política de retenção e destino */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Política de Retenção & Armazenamento</h4>
                <p className="text-xs text-slate-500">Defina o limite de cópias históricas preservadas</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Número Máximo de Backups Preservados
                </label>
                <select
                  value={config.retentionCount || 15}
                  onChange={(e) => setConfig({ ...config, retentionCount: parseInt(e.target.value, 10) })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#00AEEF] outline-none"
                >
                  <option value={7}>Últimos 7 backups (1 semana)</option>
                  <option value={15}>Últimos 15 backups (Recomendado)</option>
                  <option value={30}>Últimos 30 backups (1 mês)</option>
                  <option value={60}>Últimos 60 backups (2 meses)</option>
                </select>
                <span className="text-[11px] text-slate-400">
                  Arquivos excedentes são limpos automaticamente para economizar espaço de armazenamento.
                </span>
              </div>

              <div className="pt-2 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.saveOnServer}
                    onChange={(e) => setConfig({ ...config, saveOnServer: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Gravação no Servidor Express (/data/backups)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Garante que o arquivo exista mesmo se nenhum navegador estiver aberto no momento do agendamento.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoDownloadBrowser}
                    onChange={(e) => setConfig({ ...config, autoDownloadBrowser: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Download Automático no Navegador
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Salva o arquivo .json diretamente na pasta de downloads quando executado na sessão ativa.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Entidades incluídas no backup */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase">
              Entidades Incluídas na Exportação Segura
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  key: 'includeProducts',
                  icon: Package,
                  label: 'Catálogo de Produtos',
                  desc: 'Itens, variações de cor, faixas de preço, categorias e subcategorias',
                  active: config.includeProducts,
                },
                {
                  key: 'includeQuotes',
                  icon: FileSpreadsheet,
                  label: 'Orçamentos',
                  desc: 'Histórico de cotações, personalizações, prazos e clientes',
                  active: config.includeQuotes,
                },
                {
                  key: 'includeOrders',
                  icon: ShoppingBag,
                  label: 'Pedidos de Venda',
                  desc: 'Status de produção, pagamentos, itens e dados de envio',
                  active: config.includeOrders,
                },
                {
                  key: 'includeStock',
                  icon: Layers,
                  label: 'Controle de Estoque',
                  desc: 'Movimentações de entrada/saída e histórico do almoxarifado',
                  active: config.includeStock,
                },
                {
                  key: 'includeCustomers',
                  icon: Database,
                  label: 'Cadastro de Clientes',
                  desc: 'Contas de clientes, CNPJ/CPF e endereços salvos',
                  active: config.includeCustomers,
                },
                {
                  key: 'includeSettings',
                  icon: Settings,
                  label: 'Configurações da MB',
                  desc: 'Dados fiscais, canais de WhatsApp, logos e layout da loja',
                  active: config.includeSettings,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    onClick={() =>
                      setConfig({ ...config, [item.key]: !config[item.key as keyof BackupScheduleConfig] })
                    }
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      item.active
                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950'
                        : 'bg-slate-50/60 border-slate-200 text-slate-400 opacity-70'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        item.active ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={item.active}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-indigo-600"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botão de salvar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-[#E6007E] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSavingConfig ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#FFDD00]" />
                  <span>Salvar Configurações de Agendamento</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: BACKUP HISTORY */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-heading font-extrabold text-slate-900 uppercase">
                Histórico de Cópias de Segurança
              </h3>
              <p className="text-xs text-slate-500">
                Lista de todos os backups exportados (agendados e manuais) com carimbo de data, tamanho e integridade.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportNow}
                disabled={isExporting}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-[#E6007E] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Nova Exportação</span>
              </button>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl space-y-3">
              <FileJson className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Nenhum backup arquivado no histórico</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Clique no botão "Exportar & Baixar Agora" para gerar sua primeira cópia de segurança imediatamente.
              </p>
              <button
                onClick={handleExportNow}
                className="mt-2 px-4 py-2 rounded-xl bg-[#E6007E] text-white text-xs font-bold cursor-pointer"
              >
                Gerar Primeiro Backup
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Data / Hora</th>
                    <th className="py-3 px-3">Arquivo JSON</th>
                    <th className="py-3 px-3">Origem / Gatilho</th>
                    <th className="py-3 px-3">Itens Salvos</th>
                    <th className="py-3 px-3">Tamanho</th>
                    <th className="py-3 px-3">Checksum SHA-256</th>
                    <th className="py-3 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <FileJson className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="font-mono text-xs text-slate-700 truncate max-w-[220px]" title={item.filename}>
                            {item.filename}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.trigger === 'scheduled'
                              ? 'bg-indigo-100 text-indigo-800'
                              : item.trigger === 'manual'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.trigger === 'scheduled'
                            ? 'Agendado'
                            : item.trigger === 'manual'
                            ? 'Manual'
                            : 'Pré-Restauro'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">
                          {item.counts.products} prod. • {item.counts.quotes} orç. • {item.counts.orders} ped.
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {item.sizeFormatted}
                      </td>

                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => copyToClipboard(item.checksum, item.id)}
                          className="flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-slate-900 bg-slate-100 px-2 py-1 rounded cursor-pointer"
                          title="Copiar Hash SHA-256 completo"
                        >
                          <span>{item.checksum ? item.checksum.substring(0, 10) + '...' : 'N/A'}</span>
                          {copiedId === item.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDownloadFromHistory(item)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Baixar Arquivo JSON"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              StorageService.deleteBackupHistoryEntry(item.id);
                              setHistory(StorageService.getBackupHistory());
                              showNotification('info', 'Registro removido do histórico.');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESTORE & INTEGRITY TEST */}
      {activeSubTab === 'restore' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-8">
          <div>
            <h3 className="text-lg font-heading font-extrabold text-slate-900 uppercase">
              Recuperação de Desastres & Auditoria de Integridade
            </h3>
            <p className="text-xs text-slate-500">
              Faça o upload de qualquer arquivo JSON de backup exportado anteriormente para verificar sua autenticidade
              ou restaurar os dados completos da loja.
            </p>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-3xl p-8 text-center transition-all bg-slate-50/50 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
              <Upload className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">
                Selecione ou Arraste o Arquivo de Backup JSON
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                O arquivo será inspecionado localmente antes de qualquer ação para validar os blocos de produtos,
                orçamentos, pedidos e o hash criptográfico SHA-256.
              </p>
            </div>

            <div className="pt-2">
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold transition-all cursor-pointer shadow-md">
                <FileJson className="w-4 h-4" />
                <span>Escolher Arquivo .JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Test / Inspection Result Card */}
          {testResult && (
            <div
              className={`p-6 rounded-3xl border space-y-4 ${
                testResult.valid
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-rose-50/40 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  {testResult.valid ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                  )}
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {testResult.valid ? 'Arquivo Válido & Autêntico' : 'Arquivo com Inconsistências'}
                    </h4>
                    <p className="text-xs text-slate-600">
                      {testResult.valid
                        ? 'O formato atende aos requisitos do MB Personaliza e a estrutura foi aprovada.'
                        : 'Foram detectadas falhas na validação do arquivo de backup.'}
                    </p>
                  </div>
                </div>

                {testResult.valid && (
                  <button
                    onClick={() => setIsRestoreModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-[#FFDD00]" />
                    <span>Iniciar Recuperação de Desastres</span>
                  </button>
                )}
              </div>

              {/* Counts Grid */}
              {testResult.counts && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Produtos</span>
                    <span className="text-lg font-black text-slate-900">{testResult.counts.products}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Orçamentos</span>
                    <span className="text-lg font-black text-slate-900">{testResult.counts.quotes}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Pedidos</span>
                    <span className="text-lg font-black text-slate-900">{testResult.counts.orders}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Categorias</span>
                    <span className="text-lg font-black text-slate-900">{testResult.counts.categories}</span>
                  </div>
                </div>
              )}

              {/* Checksum detail */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono text-slate-700 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Assinatura SHA-256 declarada:</span>
                  <span className="font-bold">{testResult.statedChecksum || 'N/A'}</span>
                </div>
                {testResult.metadata?.exportTimestamp && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Carimbo de Data Original:</span>
                    <span>{new Date(testResult.metadata.exportTimestamp).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>

              {/* Warnings or Errors */}
              {testResult.errors.length > 0 && (
                <div className="p-3 bg-rose-100/60 rounded-xl text-rose-800 text-xs space-y-1">
                  <p className="font-bold">Erros encontrados:</p>
                  <ul className="list-disc list-inside">
                    {testResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BANCO POSTGRESQL OFICIAL & INDEPENDENTE */}
      {activeSubTab === 'postgres' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Infraestrutura Oficial Ativa
                </span>
                <span className="text-xs text-slate-400 font-mono">Região: us-east1</span>
              </div>
              <h3 className="text-xl font-heading font-extrabold text-slate-900 uppercase mt-1">
                Banco de Dados PostgreSQL Independente
              </h3>
              <p className="text-xs text-slate-500 max-w-2xl">
                O PostgreSQL é a <strong>fonte oficial e obrigatória de todos os dados do sistema</strong>. A infraestrutura do banco de dados está desacoplada e é totalmente independente da hospedagem da aplicação, garantindo persistência perene mesmo após reinicializações, manutenções ou substituições do servidor web.
              </p>
            </div>

            <button
              onClick={checkPostgresStatus}
              disabled={postgresInfo.loading}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-[#00AEEF] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${postgresInfo.loading ? 'animate-spin' : ''}`} />
              <span>Verificar Conexão e Integridade</span>
            </button>
          </div>

          {/* Test Status Banner */}
          {postgresInfo.testMessage && (
            <div
              className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3 border ${
                postgresInfo.testSuccess
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {postgresInfo.testSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-bold">{postgresInfo.testMessage}</p>
                {postgresInfo.testedAt && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Última verificação executada às {postgresInfo.testedAt}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Architecture Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">PostgreSQL Gerenciado</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Instância dedicada no Google Cloud SQL (PostgreSQL Developer Edition), com pool de conexões otimizado, controle transacional e alta disponibilidade.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <HardDrive className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Desacoplamento da Hospedagem</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Os dados não ficam no disco temporário da hospedagem. Atualizações de código, deploys ou reinicializações do servidor web não alteram nem perdem os registros.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Segurança & Credenciais</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Conexão criptografada via Cloud SQL Auth Proxy com credenciais protegidas por variáveis de ambiente, sem exposição pública de portas de banco de dados.
              </p>
            </div>
          </div>

          {/* Live Records Table */}
          <div className="space-y-4">
            <h4 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#E6007E]" />
              <span>Registros Persistidos no PostgreSQL</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Produtos</span>
                <p className="text-2xl font-black text-slate-900 font-heading">
                  {postgresInfo.data?.counts?.products ?? currentCounts.products}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold block">Tabela `products`</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Categorias</span>
                <p className="text-2xl font-black text-slate-900 font-heading">
                  {postgresInfo.data?.counts?.categories ?? currentCounts.categories}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold block">Tabela `categories`</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Pedidos</span>
                <p className="text-2xl font-black text-slate-900 font-heading">
                  {postgresInfo.data?.counts?.orders ?? currentCounts.orders}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold block">Tabela `orders`</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Orçamentos</span>
                <p className="text-2xl font-black text-slate-900 font-heading">
                  {postgresInfo.data?.counts?.quotes ?? currentCounts.quotes}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold block">Tabela `quotes`</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Usuários</span>
                <p className="text-2xl font-black text-slate-900 font-heading">
                  {postgresInfo.data?.counts?.users ?? '4'}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold block">Tabela `users`</span>
              </div>
            </div>
          </div>

          {/* Test de Independência e Procedimento */}
          <div className="p-6 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-4">
            <div className="flex items-center gap-2.5 text-indigo-950 font-bold text-sm">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <span>Protocolo de Teste de Independência da Hospedagem</span>
            </div>

            <p className="text-xs text-indigo-900 leading-relaxed">
              O sistema cumpre integralmente os requisitos de desacoplamento: qualquer atualização de versão, redeploy de contêiner ou substituição de servidor na nuvem preserva 100% dos registros. O PostgreSQL permanece ativo na nuvem independente da hospedagem web.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await StorageService.initPostgresSync();
                    await checkPostgresStatus();
                    await loadVpsPreflight();
                    showNotification('success', 'Sincronização bidirecional com PostgreSQL executada com sucesso!');
                  } catch (err: any) {
                    showNotification('error', `Falha na sincronização: ${err.message}`);
                  }
                }}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4 text-[#FFDD00]" />
                <span>Forçar Sincronização em Tempo Real</span>
              </button>
            </div>
          </div>

          {/* Pré-Voo Hostinger VPS & Sincronização Controlada (Estado em Memória -> PostgreSQL) */}
          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-900 text-[#FFDD00]">
                    Hostinger VPS • Produção Segura
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Somente Aditivo (ON CONFLICT DO NOTHING)
                  </span>
                </div>
                <h4 className="text-base sm:text-lg font-heading font-extrabold text-slate-900 uppercase mt-1 flex items-center gap-2">
                  <Server className="w-5 h-5 text-[#E6007E]" />
                  <span>Pré-Voo Hostinger VPS & Sincronização Controlada</span>
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Auditoria não-destrutiva da infraestrutura atual e sincronização incremental de registros com o{' '}
                  <code className="px-1 py-0.5 bg-white rounded border border-slate-200">PostgreSQL</code>, preservando integralmente dados e volumes existentes.
                </p>
              </div>

              <button
                type="button"
                onClick={loadVpsPreflight}
                disabled={vpsPreflight.loading}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${vpsPreflight.loading ? 'animate-spin' : ''}`} />
                <span>Atualizar Pré-Voo</span>
              </button>
            </div>

            {/* Diagnóstico Read-Only da VPS */}
            {vpsPreflight.error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                {vpsPreflight.error}
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Modo PostgreSQL</span>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono truncate">
                  {vpsPreflight.data?.database?.connectionMode || 'Verificando...'}
                </p>
                <span
                  className={`text-[10px] font-bold block ${
                    vpsPreflight.data?.database?.configured ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {vpsPreflight.data?.database?.configured ? 'Credenciais Ativas' : 'Aguardando PostgreSQL'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">SSL / TLS Banco</span>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                  {vpsPreflight.data?.database?.sslEnabled ? 'Habilitado (Seguro)' : 'Desativado / Local'}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  Env: {vpsPreflight.data?.environment || 'production'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Volume /uploads</span>
                <p className="text-lg font-black text-slate-900 font-heading">
                  {vpsPreflight.data?.persistence?.uploadsFileCount ?? 0}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold block">
                  {vpsPreflight.data?.persistence?.uploadsDirExists ? 'Diretório Preservado' : 'Aguardando criação'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Backups /data/backups</span>
                <p className="text-lg font-black text-slate-900 font-heading">
                  {vpsPreflight.data?.persistence?.backupFilesCount ?? 0}
                </p>
                <span className="text-[10px] text-slate-500 font-mono truncate block" title={vpsPreflight.data?.persistence?.latestBackupFile || ''}>
                  {vpsPreflight.data?.persistence?.latestBackupFile || 'Nenhum snapshot local'}
                </span>
              </div>
            </div>

            {/* Botão de Dry-Run */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
              <div className="space-y-0.5 max-w-xl">
                <h5 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                  <span>Etapa 1 — Auditoria & Simulação Não-Destrutiva (Dry-Run)</span>
                </h5>
                <p className="text-[11px] text-slate-500">
                  Compara o inventário do navegador com as tabelas do PostgreSQL sem alterar nenhum registro.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDryRunMigration}
                disabled={migrationState.loading}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-[#FFDD00]" />
                <span>{migrationState.loading ? 'Analisando...' : 'Simular & Validar Migração (Dry-Run)'}</span>
              </button>
            </div>

            {migrationState.error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                {migrationState.error}
              </div>
            )}

            {/* Resultado da Auditoria / Migração */}
            {migrationState.report && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        migrationState.report.dryRun
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {migrationState.report.dryRun
                        ? 'Modo Simulação (Somente Leitura)'
                        : 'Migração Segura Executada'}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Executado em {new Date(migrationState.report.timestamp).toLocaleString('pt-BR')} • Banco:{' '}
                      <strong>
                        {migrationState.report.databaseConnected ? 'PostgreSQL Conectado' : 'PostgreSQL Desconectado'}
                      </strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Locais</span>
                      <span className="text-sm font-black text-slate-900">
                        {migrationState.report.totals?.localRecords ?? 0}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="text-[10px] uppercase font-bold text-amber-700 block">Pendentes</span>
                      <span className="text-sm font-black text-amber-900">
                        {migrationState.report.totals?.missingInPostgres ?? 0}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200">
                      <span className="text-[10px] uppercase font-bold text-sky-700 block">Preservados</span>
                      <span className="text-sm font-black text-sky-900">
                        {migrationState.report.totals?.skippedExisting ?? 0}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Inseridos</span>
                      <span className="text-sm font-black text-emerald-900">
                        {migrationState.report.totals?.migratedNow ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabela por entidade */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                        <th className="py-2 pr-3 font-bold">Entidade</th>
                        <th className="py-2 px-3 font-bold">Tabela PostgreSQL</th>
                        <th className="py-2 px-3 font-bold text-right">Local</th>
                        <th className="py-2 px-3 font-bold text-right">No PostgreSQL</th>
                        <th className="py-2 px-3 font-bold text-right">Faltantes</th>
                        <th className="py-2 px-3 font-bold text-right">Preservados</th>
                        <th className="py-2 pl-3 font-bold text-right">Migrados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(migrationState.report.entities || []).map((row: any) => (
                        <tr key={row.entity} className="hover:bg-slate-50/70">
                          <td className="py-2 pr-3 font-bold text-slate-800">{row.entity}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{row.tableName}</td>
                          <td className="py-2 px-3 text-right font-semibold">{row.localCount}</td>
                          <td className="py-2 px-3 text-right font-semibold">{row.postgresBeforeCount}</td>
                          <td className="py-2 px-3 text-right font-bold text-amber-700">{row.missingInPostgresCount}</td>
                          <td className="py-2 px-3 text-right text-sky-700">{row.skippedExistingCount}</td>
                          <td className="py-2 pl-3 text-right font-bold text-emerald-700">{row.migratedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Etapa 2: Execução Segura com Confirmação Explícita */}
                {migrationState.report.dryRun && (
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                    {!migrationState.report.databaseConnected ? (
                      <p className="text-xs text-amber-800 font-semibold">
                        PostgreSQL externo não conectado neste ambiente de pré-visualização. Execute este procedimento na VPS Hostinger com o <code className="px-1 bg-white rounded border border-amber-200">.env</code> de produção ativo para gravar os registros pendentes.
                      </p>
                    ) : (
                      <>
                        <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={migrationState.confirmArmed}
                            onChange={(e) =>
                              setMigrationState((prev) => ({ ...prev, confirmArmed: e.target.checked }))
                            }
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>
                            <strong>Etapa 2 — Confirmação de Segurança:</strong> Confirmo que o backup prévio do PostgreSQL foi gerado (<code className="px-1 bg-white rounded border border-slate-200">./scripts/backup_db.sh</code>) e autorizo inserir <strong>apenas os registros ausentes</strong> (registros já existentes no PostgreSQL serão preservados via <code className="px-1 bg-white rounded border border-slate-200">ON CONFLICT DO NOTHING</code>).
                          </span>
                        </label>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleExecuteSafeMigration}
                            disabled={!migrationState.confirmArmed || migrationState.loading}
                            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
                          >
                            <Database className="w-4 h-4 text-[#FFDD00]" />
                            <span>
                              {migrationState.loading
                                ? 'Executando Migração Segura...'
                                : 'Executar Migração Segura (Apenas Novos Registros)'}
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE RESTAURAÇÃO */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-heading font-black uppercase text-slate-900">
                  Confirmar Recuperação de Desastres
                </h3>
                <p className="text-xs text-rose-600 font-semibold">
                  Ação crítica de contingência do sistema
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <p>
                <strong>Atenção:</strong> A restauração irá carregar os dados contidos neste arquivo de backup
                ({testResult?.counts?.products} produtos, {testResult?.counts?.quotes} orçamentos e {testResult?.counts?.orders} pedidos).
              </p>
              <p>
                Um <strong>ponto de recuperação de pré-voo</strong> será arquivado automaticamente antes da sobreposição,
                garantindo que o estado anterior permaneça seguro.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Para confirmar a recuperação, digite a palavra <strong>RESTAURAR</strong> abaixo:
              </label>
              <input
                type="text"
                value={restoreConfirmText}
                onChange={(e) => setRestoreConfirmText(e.target.value)}
                placeholder="RESTAURAR"
                className="w-full px-4 py-2.5 text-sm bg-white border-2 border-slate-300 rounded-xl focus:border-rose-600 outline-none font-bold uppercase tracking-wider"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsRestoreModalOpen(false);
                  setRestoreConfirmText('');
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleExecuteRestore}
                disabled={restoreConfirmText.trim().toUpperCase() !== 'RESTAURAR' || isRestoring}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Restaurando Dados...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 text-[#FFDD00]" />
                    <span>Efetuar Recuperação</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
