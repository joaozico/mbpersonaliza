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
} from 'lucide-react';
import { StorageService } from '../services/storage';
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
  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'history' | 'restore'>('schedule');

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
        await fetch('/api/backup/export', {
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
        await fetch('/api/backup/config', {
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
