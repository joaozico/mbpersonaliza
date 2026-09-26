import React, { useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  AnalyticsPeriod,
  SiteMetricsReport,
  TopPageStat,
} from '../types';
import { AnalyticsService } from '../services/analytics';
import { StorageService } from '../services/storage';
import { SEOHead } from '../components/SEOHead';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Clock,
  Globe,
  Smartphone,
  Laptop,
  Tablet,
  FileText,
  Download,
  Printer,
  RefreshCw,
  Calendar,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Layers,
  MapPin,
  Compass,
  MessageSquare,
  Share2,
  Radio,
  ExternalLink,
  ChevronRight,
  Target,
  Building2,
  Store,
  Briefcase,
  UserCheck,
  Lightbulb,
  ShoppingBag,
  Award,
  Zap,
  BarChart3,
} from 'lucide-react';

interface SiteMetricsViewProps {
  currentUser: UserProfile;
  onNavigate?: (view: string, param?: string) => void;
}

export const SiteMetricsView: React.FC<SiteMetricsViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const [activeChartMetric, setActiveChartMetric] = useState<
    'accesses' | 'uniques' | 'pageviews' | 'comparison'
  >('accesses');

  const [pageSearch, setPageSearch] = useState('');
  const [pageSortKey, setPageSortKey] = useState<keyof TopPageStat>('views');
  const [pageSortAsc, setPageSortAsc] = useState(false);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  // Security check directly through AnalyticsService
  const reportResult = useMemo(() => {
    return AnalyticsService.getMetricsReport(
      currentUser,
      period,
      period === 'personalizado' ? { start: customStart, end: customEnd } : undefined
    );
  }, [currentUser, period, customStart, customEnd, tick]);

  // Realtime live auto-update interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 25000); // 25s auto-refresh
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Listen to analytics storage events
  useEffect(() => {
    const handleUpdate = () => {
      setTick((t) => t + 1);
    };
    window.addEventListener('mb_analytics_updated', handleUpdate);
    return () => window.removeEventListener('mb_analytics_updated', handleUpdate);
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setTick((t) => t + 1);
      setIsRefreshing(false);
    }, 400);
  };

  const handleExportCsv = () => {
    if (reportResult.data) {
      AnalyticsService.downloadCsv(reportResult.data);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  // If unauthorized, show security block screen
  if (!reportResult.success || !reportResult.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16" id="unauthorized-metrics-screen">
        <SEOHead
          title="Acesso Restrito - Métricas do Site"
          description="Controle de acesso restrito às métricas de desempenho e tráfego."
          noIndex={true}
        />
        <div className="bg-white border border-rose-200 rounded-3xl p-8 sm:p-12 text-center shadow-lg space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-700">
              Controle de Acesso RBAC
            </span>
            <h2 className="text-2xl font-black font-heading text-slate-900">
              Acesso Não Autorizado
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {reportResult.error ||
                'O seu perfil de usuário atual não possui a permissão explícita para visualizar as métricas do site.'}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl max-w-md mx-auto border border-slate-200 text-left text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-700 font-bold">
              <span>Usuário conectado:</span>
              <span className="text-slate-900">{currentUser.name}</span>
            </div>
            <div className="flex items-center justify-between text-slate-700 font-bold">
              <span>Função no sistema:</span>
              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 uppercase text-[10px]">
                {currentUser.role}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700 font-bold">
              <span>Permissão necessária:</span>
              <span className="text-rose-600 font-mono">canViewSiteMetrics</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Voltar ao Painel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const report = reportResult.data;

  // Filtered Top Pages
  const filteredPages = report.topPages
    .filter(
      (p) =>
        p.title.toLowerCase().includes(pageSearch.toLowerCase()) ||
        p.path.toLowerCase().includes(pageSearch.toLowerCase())
    )
    .sort((a, b) => {
      const valA = a[pageSortKey];
      const valB = b[pageSortKey];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return pageSortAsc ? valA - valB : valB - valA;
      }
      return pageSortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

  const periodOptions: { id: AnalyticsPeriod; label: string }[] = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'ontem', label: 'Ontem' },
    { id: '7d', label: 'Últimos 7 dias' },
    { id: '30d', label: 'Últimos 30 dias' },
    { id: '90d', label: 'Últimos 90 dias' },
    { id: 'este_mes', label: 'Este mês' },
    { id: 'mes_anterior', label: 'Mês anterior' },
    { id: 'este_ano', label: 'Este ano' },
    { id: 'personalizado', label: 'Personalizado' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="site-metrics-page">
      <SEOHead
        title="Métricas do Site & Insights de Acesso | MB Personaliza"
        description="Painel profissional de acompanhamento de acessos, tráfego, fontes de visitantes e conversões da MB Personaliza."
        canonicalPath="/admin/metricas"
        noIndex={true}
      />

      {/* TOP HEADER */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-gradient-to-r from-[#E6007E] to-[#00AEEF] text-white shadow-xs">
                Analytics & Insights
              </span>
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Dados em Tempo Real
              </span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs text-slate-500 font-mono">
                Última sincronização: {report.lastUpdated}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-heading uppercase text-slate-900">
              Métricas do Site
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Acompanhamento detalhado do tráfego, comportamento dos visitantes, fontes de atração e conversões comerciais da MB Personaliza.
            </p>
          </div>

          {/* Action buttons (Export & Refresh) */}
          <div className="flex flex-wrap items-center gap-2.5 no-print">
            <button
              type="button"
              onClick={handleManualRefresh}
              className={`px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer border border-slate-200 ${
                isRefreshing ? 'opacity-70' : ''
              }`}
              title="Atualizar métricas agora"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#00AEEF] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer border border-slate-200"
              title="Exportar para arquivo CSV / Excel compatível"
            >
              <Download className="w-3.5 h-3.5 text-[#E6007E]" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              title="Imprimir ou Salvar relatório em PDF"
            >
              <Printer className="w-3.5 h-3.5 text-[#FFDD00]" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* PERIOD SELECTOR TABS (Instagram Insights style) */}
        <div className="border-t border-slate-100 pt-5 space-y-3 no-print">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-extrabold uppercase text-slate-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#00AEEF]" />
              Período de Análise
            </span>

            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded text-[#E6007E] focus:ring-[#E6007E]"
                />
                <span>Auto-atualizar (30s)</span>
              </label>

              <span className="text-slate-400 font-mono text-[11px]">
                Comparando com: <strong className="text-slate-700">{report.comparisonPeriodLabel}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {periodOptions.map((opt) => {
              const isActive = period === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setPeriod(opt.id);
                    if (opt.id === 'personalizado') {
                      setShowCustomPicker(true);
                    } else {
                      setShowCustomPicker(false);
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Picker */}
          {showCustomPicker && period === 'personalizado' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-4 text-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">De:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Até:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleManualRefresh}
                className="px-4 py-1.5 bg-[#00AEEF] hover:bg-[#009bd6] text-white font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Aplicar Filtro
              </button>
            </div>
          )}
        </div>
      </div>

      {/* REALTIME RADAR BANNER (Live active visitors) */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-6 text-white border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950">
                  Ao Vivo Agora
                </span>
                <span className="text-xs text-slate-400">Atividade em tempo real</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-black font-heading text-white">
                  {report.activeVisitorsNow}
                </span>
                <span className="text-xs sm:text-sm text-slate-300 font-medium">
                  {report.activeVisitorsNow === 1 ? 'visitante navegando no site agora' : 'visitantes navegando no site agora'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick live activity feed chips */}
          <div className="flex flex-wrap items-center gap-2">
            {report.realtimeList.slice(0, 3).map((v) => (
              <div
                key={v.id}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center gap-2 backdrop-blur-xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-slate-200">{v.location}</span>
                <span className="text-slate-400 font-mono text-[10px] truncate max-w-[140px]">
                  {v.currentPath}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-semibold uppercase text-slate-300">
                  {v.device}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK JUMP SECTIONS BAR (no-print) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-print">
        <span className="text-[11px] font-extrabold uppercase text-slate-400 shrink-0">
          Seções Rápidas:
        </span>
        <a
          href="#kpi-summary-section"
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold whitespace-nowrap transition-colors"
        >
          📊 KPIs & Resumo
        </a>
        <a
          href="#evolution-chart-section"
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold whitespace-nowrap transition-colors"
        >
          📈 Evolução do Tráfego
        </a>
        <a
          href="#audience-demographics-section"
          className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-black whitespace-nowrap transition-colors border border-purple-200"
        >
          🎯 Perfil do Público & Demografia (Gênero/Idade)
        </a>
        <a
          href="#traffic-sources-section"
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold whitespace-nowrap transition-colors"
        >
          🌐 Origem dos Acessos
        </a>
        <a
          href="#top-pages-section"
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold whitespace-nowrap transition-colors"
        >
          📄 Páginas Mais Acessadas
        </a>
        <a
          href="#locations-events-section"
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold whitespace-nowrap transition-colors"
        >
          📍 Cidades & Conversões
        </a>
      </div>

      {/* 6 TOP KPI CARDS (Instagram Insights Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" id="kpi-summary-section">
        {/* KPI 1: Acessos Totais */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative overflow-hidden group hover:border-[#00AEEF] transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span className="uppercase tracking-wide">Acessos</span>
            <Activity className="w-4 h-4 text-[#00AEEF]" />
          </div>
          <div>
            <div className="text-2xl font-black font-heading text-slate-900">
              {report.totalAccesses.current.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  report.totalAccesses.isPositive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {report.totalAccesses.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {report.totalAccesses.deltaPercent > 0 ? `+${report.totalAccesses.deltaPercent}%` : `${report.totalAccesses.deltaPercent}%`}
              </span>
              <span className="text-[10px] text-slate-400">vs período ant.</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Visitantes Únicos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative overflow-hidden group hover:border-[#E6007E] transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span className="uppercase tracking-wide">Visitantes Únicos</span>
            <Users className="w-4 h-4 text-[#E6007E]" />
          </div>
          <div>
            <div className="text-2xl font-black font-heading text-slate-900">
              {report.uniqueVisitors.current.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  report.uniqueVisitors.isPositive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {report.uniqueVisitors.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {report.uniqueVisitors.deltaPercent > 0 ? `+${report.uniqueVisitors.deltaPercent}%` : `${report.uniqueVisitors.deltaPercent}%`}
              </span>
              <span className="text-[10px] text-slate-400">vs período ant.</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Visualizações de Páginas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative overflow-hidden group hover:border-[#FFDD00] transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span className="uppercase tracking-wide">Visualizações</span>
            <Eye className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-black font-heading text-slate-900">
              {report.pageViews.current.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
              <span>Média por visitante:</span>
              <strong className="text-slate-800">{report.avgPagesPerVisitor} pág</strong>
            </div>
          </div>
        </div>

        {/* KPI 4: Sessões & Tempo Médio */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative overflow-hidden group hover:border-indigo-500 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span className="uppercase tracking-wide">Tempo Médio</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-2xl font-black font-heading text-slate-900">
              {Math.floor(report.avgSessionDurationSeconds / 60)}m {report.avgSessionDurationSeconds % 60}s
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
              <span>Sessões totais:</span>
              <strong className="text-slate-800">{report.totalSessions.current}</strong>
            </div>
          </div>
        </div>

        {/* KPI 5: Taxa de Rejeição */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative overflow-hidden group hover:border-emerald-500 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span className="uppercase tracking-wide">Taxa de Rejeição</span>
            <Compass className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-black font-heading text-slate-900">
              {report.bounceRate.current}%
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-slate-500">
                Engajamento de {Math.round(100 - report.bounceRate.current)}%
              </span>
            </div>
          </div>
        </div>

        {/* KPI 6: Novos x Recorrentes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative overflow-hidden group hover:border-purple-500 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span className="uppercase tracking-wide">Novos x Recorrentes</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900 flex items-center justify-between mb-1.5">
              <span className="text-[#E6007E]">{report.newVisitors.percentage}% Novos</span>
              <span className="text-[#00AEEF]">{report.returningVisitors.percentage}% Recorr.</span>
            </div>
            {/* Progress ratio bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
              <div
                className="h-full bg-[#E6007E]"
                style={{ width: `${report.newVisitors.percentage}%` }}
                title={`Novos visitantes: ${report.newVisitors.count}`}
              />
              <div
                className="h-full bg-[#00AEEF]"
                style={{ width: `${report.returningVisitors.percentage}%` }}
                title={`Visitantes recorrentes: ${report.returningVisitors.count}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* MAIN EVOLUTION CHART (Instagram Style Area Chart) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6" id="evolution-chart-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E6007E]" />
              <h2 className="text-lg font-black font-heading uppercase text-slate-900">
                Evolução dos Acessos ao Longo do Tempo
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualização temporal de acessos, visitantes e engajamento no período selecionado.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveChartMetric('accesses')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeChartMetric === 'accesses'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Acessos Totais
            </button>

            <button
              type="button"
              onClick={() => setActiveChartMetric('uniques')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeChartMetric === 'uniques'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visitantes Únicos
            </button>

            <button
              type="button"
              onClick={() => setActiveChartMetric('pageviews')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeChartMetric === 'pageviews'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visualizações
            </button>

            <button
              type="button"
              onClick={() => setActiveChartMetric('comparison')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeChartMetric === 'comparison'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Novos x Recorrentes
            </button>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-72 sm:h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={report.evolution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E6007E" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#E6007E" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientSecondary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00AEEF" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientEmerald" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />

              <XAxis
                dataKey="date"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
              />

              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val}`}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 text-xs space-y-1.5">
                        <p className="font-extrabold text-[#FFDD00] border-b border-slate-800 pb-1">
                          {period === 'hoje' || period === 'ontem' ? `Horário: ${label}` : `Data: ${label}`}
                        </p>
                        {payload.map((entry, index) => (
                          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              {entry.name}:
                            </span>
                            <span className="font-bold text-white">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {activeChartMetric === 'accesses' && (
                <Area
                  type="monotone"
                  dataKey="accessCount"
                  name="Acessos Totais"
                  stroke="#E6007E"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradientPrimary)"
                />
              )}

              {activeChartMetric === 'uniques' && (
                <Area
                  type="monotone"
                  dataKey="uniqueVisitors"
                  name="Visitantes Únicos"
                  stroke="#00AEEF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradientSecondary)"
                />
              )}

              {activeChartMetric === 'pageviews' && (
                <Area
                  type="monotone"
                  dataKey="pageViews"
                  name="Visualizações de Páginas"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradientEmerald)"
                />
              )}

              {activeChartMetric === 'comparison' && (
                <>
                  <Area
                    type="monotone"
                    dataKey="newVisitors"
                    name="Novos Visitantes"
                    stroke="#E6007E"
                    strokeWidth={2}
                    fillOpacity={0.6}
                    fill="url(#gradientPrimary)"
                  />
                  <Area
                    type="monotone"
                    dataKey="returningVisitors"
                    name="Visitantes Recorrentes"
                    stroke="#00AEEF"
                    strokeWidth={2}
                    fillOpacity={0.6}
                    fill="url(#gradientSecondary)"
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TWO COLUMNS: TRAFFIC SOURCES & DEVICE/SYSTEMS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="traffic-sources-section">
        {/* SECTION: ORIGEM DOS ACESSOS (FONTES DE TRÁFEGO) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#00AEEF] flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold font-heading text-base uppercase text-slate-900">
                  Origem dos Acessos (Canais & Fontes)
                </h3>
                <p className="text-[11px] text-slate-500">De onde chegam os potenciais clientes</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-400">Total: 100%</span>
          </div>

          <div className="space-y-4">
            {report.trafficSources.map((src) => (
              <div key={src.source} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: src.color }} />
                    {src.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono text-[11px]">
                      {src.accessCount.toLocaleString('pt-BR')} acessos
                    </span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                      {src.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${src.percentage}%`,
                      backgroundColor: src.color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>{src.visitors} visitantes únicos • {src.sessions} sessões</span>
                  <span className="text-emerald-600 font-semibold">
                    Taxa de conversão: {src.conversionRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION: DISPOSITIVOS, NAVEGADORES & SISTEMAS OPERACIONAIS */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-pink-50 text-[#E6007E] flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold font-heading text-base uppercase text-slate-900">
                  Dispositivos & Tecnologia
                </h3>
                <p className="text-[11px] text-slate-500">Hardware, navegadores e sistemas</p>
              </div>
            </div>
          </div>

          {/* Devices Grid Cards */}
          <div className="grid grid-cols-3 gap-3">
            {report.devices.map((d) => (
              <div
                key={d.name}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5"
              >
                <div className="w-8 h-8 rounded-xl bg-white text-slate-700 mx-auto flex items-center justify-center shadow-xs">
                  {d.name.includes('Celular') ? (
                    <Smartphone className="w-4 h-4 text-[#E6007E]" />
                  ) : d.name.includes('Computador') ? (
                    <Laptop className="w-4 h-4 text-[#00AEEF]" />
                  ) : (
                    <Tablet className="w-4 h-4 text-[#FFDD00]" />
                  )}
                </div>
                <div className="text-base font-black font-heading text-slate-900">{d.percentage}%</div>
                <div className="text-[10px] font-bold text-slate-500 truncate">{d.name}</div>
                <div className="text-[9px] text-slate-400">{d.count} acessos</div>
              </div>
            ))}
          </div>

          {/* Browsers & OS Lists */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#00AEEF]" />
                Navegadores Mais Usados
              </h4>
              <div className="space-y-1.5">
                {report.browsers.slice(0, 4).map((b) => (
                  <div key={b.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-700">{b.name}</span>
                    <span className="font-bold text-slate-900">{b.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-[#E6007E]" />
                Sistemas Operacionais
              </h4>
              <div className="space-y-1.5">
                {report.operatingSystems.slice(0, 4).map((os) => (
                  <div key={os.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-700">{os.name}</span>
                    <span className="font-bold text-slate-900">{os.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: PERFIL DO PÚBLICO, GÊNERO, IDADE & SEGMENTOS (AUDIENCE INTELLIGENCE) */}
      {report.audienceProfile && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-8" id="audience-demographics-section">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700">
                  Inteligência de Audiência & Demografia
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Perfil de Compradores vs Visitantes
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-heading uppercase text-slate-900 flex items-center gap-2">
                <Target className="w-6 h-6 text-[#E6007E]" />
                Perfil do Público: Gênero, Faixa Etária & Segmentos
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
                Relatório analítico do perfil dos visitantes e clientes que mais compram no site, com dados para direcionamento estratégico de anúncios e campanhas comerciais.
              </p>
            </div>

            {/* Quick Summary Badge */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200/80 rounded-2xl p-4 shrink-0 max-w-sm">
              <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs">
                <Sparkles className="w-4 h-4 text-[#E6007E]" />
                <span>Público Mais Comprador</span>
              </div>
              <p className="text-xs text-slate-700 font-bold mt-1">
                Mulheres e Homens de 25 a 44 anos (Empresas B2B & Agências)
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Respondem por <strong className="text-slate-800 font-black">75.5%</strong> das vendas fechadas no site.
              </p>
            </div>
          </div>

          {/* 4 SUMMARY STATS PILLARS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#E6007E]" />
                Gênero com Maior Volume
              </div>
              <div className="text-base font-black text-slate-900">
                Feminino (58.6% das compras)
              </div>
              <p className="text-[10px] text-slate-500">
                54.2% dos acessos totais • Maior conversão em brindes corporativos
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#00AEEF]" />
                Faixa de Idade Campeã
              </div>
              <div className="text-base font-black text-slate-900">
                25 a 44 anos (75.5% das vendas)
              </div>
              <p className="text-[10px] text-slate-500">
                Pico de 42% na faixa de 25-34 anos e 33.5% na faixa de 35-44 anos
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-600" />
                Segmento Mais Rentável
              </div>
              <div className="text-base font-black text-slate-900">
                Corporativo B2B & Agências
              </div>
              <p className="text-[10px] text-slate-500">
                Ticket médio entre R$ 1.850 e R$ 2.420 por pedido
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Horário Nobre de Vendas
              </div>
              <div className="text-base font-black text-slate-900">
                09:30 às 16:30
              </div>
              <p className="text-[10px] text-slate-500">
                87% dos fechamentos comerciais e orçamentos enviados
              </p>
            </div>
          </div>

          {/* TWO COLUMNS: GENDER MATRIX & AGE GROUP COMPARISON */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* COLUMN 1: GENDER DISTRIBUTION (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/70 rounded-3xl p-6 border border-slate-200 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-pink-100 text-[#E6007E] flex items-center justify-center font-bold">
                    ♀♂
                  </div>
                  <div>
                    <h3 className="font-extrabold font-heading text-sm uppercase text-slate-900">
                      Distribuição por Gênero
                    </h3>
                    <p className="text-[10px] text-slate-500">Acessos vs Compradores Efetivos</p>
                  </div>
                </div>
              </div>

              {/* Gender comparison bars */}
              <div className="space-y-4">
                {report.audienceProfile.genders.map((g) => (
                  <div key={g.gender} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-slate-900 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.gender}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        Conversão: {g.conversionRate}%
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {/* Accesses bar */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Volume de Acessos no Site</span>
                          <span className="font-bold text-slate-700">{g.accessPercentage}% ({g.accessCount} visitas)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full opacity-70"
                            style={{ width: `${g.accessPercentage}%`, backgroundColor: g.color }}
                          />
                        </div>
                      </div>

                      {/* Buyers bar */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-700 font-bold">
                          <span>Participação nas Compras / Pedidos</span>
                          <span className="text-slate-900">{g.buyersPercentage}% ({g.buyersCount} pedidos)</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${g.buyersPercentage}%`, backgroundColor: g.color }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Gender Preference Insights */}
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>Produtos Preferidos por Gênero</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-600">
                  <p>
                    🌸 <strong className="text-slate-800">Feminino:</strong> Kits de boas-vindas / onboarding, squeezes térmicos em tons pastel, canecas resinadas, ecobags e cadernos executivos.
                  </p>
                  <p>
                    👔 <strong className="text-slate-800">Masculino:</strong> Copos térmicos com abridor, mochilas para notebook, uniformes bordados/camisetas pretas, ferramentas e sinalização de loja.
                  </p>
                </div>
              </div>
            </div>

            {/* COLUMN 2: AGE GROUPS COMPARISON (7 cols) */}
            <div className="lg:col-span-7 bg-slate-50/70 rounded-3xl p-6 border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#00AEEF] flex items-center justify-center font-bold">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold font-heading text-sm uppercase text-slate-900">
                      Faixa de Idade (Acessos vs Volume de Compras)
                    </h3>
                    <p className="text-[10px] text-slate-500">Comparativo percentual de público visitante vs clientes compradores</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#00AEEF]" /> % Acessos
                  </span>
                  <span className="flex items-center gap-1 text-slate-900">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#E6007E]" /> % Compradores
                  </span>
                </div>
              </div>

              {/* Age Groups Bar Chart */}
              <div className="h-56 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.audienceProfile.ageGroups}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="range"
                      stroke="#64748B"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 text-xs space-y-1.5">
                              <p className="font-extrabold text-[#FFDD00] border-b border-slate-800 pb-1">
                                Faixa: {label}
                              </p>
                              {payload.map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5 text-slate-300">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    {entry.name}:
                                  </span>
                                  <span className="font-bold text-white">{entry.value}%</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="accessPercentage"
                      name="% Acessos no Site"
                      fill="#00AEEF"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="buyersPercentage"
                      name="% Compradores Efetivos"
                      fill="#E6007E"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Age Group Table Breakdown */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
                      <th className="pb-2">Faixa Etária</th>
                      <th className="pb-2 text-center">% Acessos</th>
                      <th className="pb-2 text-center">% Compras</th>
                      <th className="pb-2 text-center">Taxa Conv.</th>
                      <th className="pb-2 text-right">Classificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 text-slate-700">
                    {report.audienceProfile.ageGroups.map((ag) => (
                      <tr key={ag.range} className="hover:bg-white/80 transition-colors">
                        <td className="py-2 font-bold text-slate-900">{ag.range}</td>
                        <td className="py-2 text-center font-mono text-[11px] text-slate-600">
                          {ag.accessPercentage}%
                        </td>
                        <td className="py-2 text-center font-bold font-mono text-[11px] text-slate-900">
                          {ag.buyersPercentage}%
                        </td>
                        <td className="py-2 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold">
                            {ag.conversionRate}%
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {ag.range === '25-34 anos' ? (
                            <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[9px] font-extrabold uppercase">
                              Maior Volume (42%)
                            </span>
                          ) : ag.range === '35-44 anos' ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[9px] font-extrabold uppercase">
                              Maior Ticket Médio
                            </span>
                          ) : ag.range === '45-54 anos' ? (
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[9px] font-extrabold uppercase">
                              Alta Fidelidade
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Navegação geral</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* CUSTOMER PROFILES & COMMERCIAL SEGMENTS (B2B vs B2C) */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold font-heading text-base uppercase text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-600" />
                  Perfil dos Segmentos de Clientes (B2B & B2C)
                </h3>
                <p className="text-xs text-slate-500">
                  Tipos de empresas e compradores que mais compram na MB Personaliza, com ticket médio e produtos líderes.
                </p>
              </div>
            </div>

            {/* Grid of Segments */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.audienceProfile.segments.map((seg, idx) => (
                <div
                  key={seg.segment}
                  className={`p-5 rounded-2xl border transition-all space-y-3 relative ${
                    idx === 0
                      ? 'bg-gradient-to-b from-white to-pink-50/40 border-[#E6007E]/30 shadow-xs'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        idx === 0 ? 'bg-pink-100 text-[#E6007E]' : idx === 1 ? 'bg-sky-100 text-[#00AEEF]' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {idx === 0 ? <Building2 className="w-5 h-5" /> : idx === 1 ? <Sparkles className="w-5 h-5" /> : idx === 2 ? <Store className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-xs text-slate-900 leading-tight">
                          {seg.segment}
                        </h4>
                      </div>
                    </div>

                    {idx === 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#E6007E] text-white shrink-0">
                        Líder 56.5%
                      </span>
                    )}
                  </div>

                  {/* Metrics grid for this segment */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Ticket Médio</span>
                      <span className="text-sm font-black font-mono text-slate-900">
                        R$ {seg.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">% das Vendas</span>
                      <span className="text-sm font-black font-mono text-emerald-600">
                        {seg.ordersSharePercentage}%
                      </span>
                    </div>
                  </div>

                  {/* Favorite Categories & Top Product */}
                  <div className="space-y-1.5 text-xs border-t border-slate-200/60 pt-2.5">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Produto Campeão:</span>
                      <span className="font-bold text-slate-800 text-[11px] line-clamp-1">{seg.topProduct}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Mais Comprados:</span>
                      <div className="flex flex-wrap gap-1">
                        {seg.favoriteCategories.map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-semibold text-slate-700"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PEAK HOURS & PURCHASE INTENT HEATMAP */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h4 className="font-extrabold text-xs uppercase text-slate-900">
                  Janelas de Horários de Maior Intenção de Compra
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">
                Melhor período para atendimento ativo e envio de cotações
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {report.audienceProfile.peakTimes.map((pt) => (
                <div key={pt.timeWindow} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{pt.timeWindow}</span>
                    <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                      {pt.ordersShare}% pedidos
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Acessos: <strong className="text-slate-700">{pt.accessShare}%</strong> • Horário de Pico: <strong className="text-slate-900">{pt.peakHour}</strong>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-[#E6007E]"
                      style={{ width: `${pt.ordersShare * 2}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STRATEGIC ACTION PLAN FOR AD CAMPAIGNS & SALES TARGETING */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E6007E]/20 border border-[#E6007E]/40 flex items-center justify-center text-[#E6007E]">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-[#E6007E] to-[#00AEEF] text-white">
                  Recomendação Estratégica para Tráfego Pago & Vendas
                </span>
                <h3 className="text-lg font-black font-heading uppercase text-white mt-0.5">
                  Como Direcionar o Público Que Mais Compra
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              {report.audienceProfile.topTargetAudience.keyRecommendation}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {report.audienceProfile.topTargetAudience.actionPlan.map((action, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 flex items-start gap-2.5 backdrop-blur-xs hover:bg-white/10 transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span className="leading-snug">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PÁGINAS MAIS ACESSADAS (INTERACTIVE DATA TABLE) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6" id="top-pages-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold font-heading text-base uppercase text-slate-900">
                Páginas Mais Acessadas do Catálogo
              </h3>
              <p className="text-[11px] text-slate-500">
                Desempenho por URL, visualizações, tempo de retenção e taxa de saída
              </p>
            </div>
          </div>

          {/* Search filter */}
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Buscar por página ou produto..."
              value={pageSearch}
              onChange={(e) => setPageSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
                <th className="pb-3 pl-2">Página / Título</th>
                <th className="pb-3 px-3 cursor-pointer hover:text-slate-900" onClick={() => { setPageSortKey('views'); setPageSortAsc(!pageSortAsc); }}>
                  Visualizações {pageSortKey === 'views' && (pageSortAsc ? '▲' : '▼')}
                </th>
                <th className="pb-3 px-3 cursor-pointer hover:text-slate-900" onClick={() => { setPageSortKey('uniques'); setPageSortAsc(!pageSortAsc); }}>
                  Visitantes Únicos {pageSortKey === 'uniques' && (pageSortAsc ? '▲' : '▼')}
                </th>
                <th className="pb-3 px-3 cursor-pointer hover:text-slate-900" onClick={() => { setPageSortKey('avgTimeSeconds'); setPageSortAsc(!pageSortAsc); }}>
                  Tempo Médio {pageSortKey === 'avgTimeSeconds' && (pageSortAsc ? '▲' : '▼')}
                </th>
                <th className="pb-3 px-3">Taxa de Rejeição</th>
                <th className="pb-3 pr-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPages.map((page, index) => (
                <tr key={page.path} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 pl-2 max-w-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{page.title}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{page.path}</p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 font-bold text-slate-900">
                    {page.views.toLocaleString('pt-BR')}
                  </td>

                  <td className="py-3.5 px-3 text-slate-600 font-medium">
                    {page.uniques.toLocaleString('pt-BR')}
                  </td>

                  <td className="py-3.5 px-3 text-slate-600 font-mono text-[11px]">
                    {Math.floor(page.avgTimeSeconds / 60)}m {page.avgTimeSeconds % 60}s
                  </td>

                  <td className="py-3.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {page.bounceRate}%
                    </span>
                  </td>

                  <td className="py-3.5 pr-2 text-right">
                    {onNavigate && page.path.startsWith('/produtos/') ? (
                      <button
                        type="button"
                        onClick={() => {
                          const slug = page.path.replace('/produtos/', '');
                          onNavigate('product-detail', slug);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="Ver Produto na Loja"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#00AEEF]" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TWO COLUMNS: GEOGRAPHIC LOCATION & TRACKED CONVERSIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="locations-events-section">
        {/* GEOGRAPHIC LOCATION */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold font-heading text-base uppercase text-slate-900">
                  Localização Geográfica dos Visitantes
                </h3>
                <p className="text-[11px] text-slate-500">Cidades e estados de origem no Brasil</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
              🇧🇷 Brasil (98%)
            </span>
          </div>

          <div className="space-y-3">
            {report.locations.slice(0, 7).map((loc) => (
              <div key={`${loc.state}-${loc.city}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 font-bold">
                      {loc.state}
                    </span>
                    {loc.city}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px]">{loc.accessCount} acessos</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                      {loc.percentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#00AEEF] to-[#E6007E]"
                    style={{ width: `${loc.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TRACKED EVENTS & CONVERSIONS */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold font-heading text-base uppercase text-slate-900">
                  Eventos & Conversões Rastreadas
                </h3>
                <p className="text-[11px] text-slate-500">Cliques no WhatsApp, cotações e downloads</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {report.topEvents.map((ev) => (
              <div
                key={ev.eventType}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{ev.label}</p>
                  <p className="text-[10px] text-slate-500">
                    {ev.uniqueUsers} usuários únicos • {ev.conversionRate}% conversão
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-black font-heading text-slate-900">
                    {ev.count.toLocaleString('pt-BR')}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-emerald-600">
                    <TrendingUp className="w-3 h-3" />
                    <span>+{ev.comparisonDelta}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER NOTICE (LGPD & Security) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-500 text-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>
            Painel em conformidade com a <strong>LGPD</strong> (dados anônimos de navegação e sem coleta de informações pessoais sensíveis).
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          MB Personaliza Analytics v2.0 • Acesso Restrito
        </div>
      </div>
    </div>
  );
};
