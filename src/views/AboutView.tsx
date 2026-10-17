import React from 'react';
import {
  Sparkles,
  Award,
  ShieldCheck,
  Truck,
  Layers,
  Cpu,
  Users,
  CheckCircle2,
  ArrowRight,
  Printer,
  Factory,
  Clock,
  HeartHandshake,
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';

interface AboutViewProps {
  onNavigate: (view: string, param?: string) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate }) => {
  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <SEOHead
        title="Sobre Nós | MB Personaliza — Especialistas em Brindes Corporativos"
        description="Conheça a história, infraestrutura industrial e o compromisso da MB Personaliza com a excelência em brindes corporativos e comunicação visual."
        canonicalPath="/sobre"
        keywords={['sobre mb personaliza', 'fábrica brindes corporativos', 'gravação laser brindes', 'personalização corporativa']}
      />

      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-14 shadow-xl border border-indigo-900/40">
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#FFDD00]" />
            <span>Excelência & Tradição em Personalização</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-heading font-black uppercase tracking-tight text-white leading-tight">
            Transformamos Ideias em Experiências Memoráveis
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            A <strong>MB Personaliza</strong> é referência nacional no fornecimento de brindes corporativos de alto padrão, soluções de comunicação visual e presentes promocionais customizados com tecnologia industrial de última geração.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => onNavigate('catalog')}
              className="px-6 py-3 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-black uppercase rounded-2xl shadow-lg hover:shadow-pink-500/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Explorar Catálogo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('quote')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold uppercase rounded-2xl border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Solicitar Orçamento</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-pink-50 text-[#E6007E] flex items-center justify-center">
            <Award className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-base font-black uppercase font-heading text-slate-900">
            Padrão Industrial Rigoroso
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Todas as peças passam por triagem dimensional, teste de aderência de gravação e controle de acabamento óptico antes de serem embaladas.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#00AEEF] flex items-center justify-center">
            <Cpu className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-base font-black uppercase font-heading text-slate-900">
            Tecnologia de Gravação 4.0
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Parque fabril equipado com lasers de fibra óptica de alta frequência, impressoras UV digitais planas de alta resolução e bordado eletrônico computadorizado.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Truck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-base font-black uppercase font-heading text-slate-900">
            Logística & Pontualidade
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Entregas programadas para campanhas com cronograma crítico, feiras corporativas, eventos de lançamento e kits de onboarding corporativo.
          </p>
        </div>
      </div>

      {/* Story & Infrastructure */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-xs space-y-8">
        <div className="max-w-3xl">
          <span className="text-xs font-bold text-[#E6007E] uppercase tracking-wider">Nossa Trajetória</span>
          <h2 className="text-2xl sm:text-3xl font-black font-heading text-slate-900 uppercase mt-1">
            Compromisso com a Identidade de Cada Marca
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed">
            Desde o início de nossas operações, entendemos que um brinde corporativo não é apenas um objeto: é a extensão tangível da reputação de uma empresa. Por isso, aliamos curadoria estética, matéria-prima durável e atendimento consultivo para entregar soluções que surpreendem quem recebe.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-2xl font-black text-slate-900 font-heading">+500.000</div>
            <div className="text-xs font-bold text-slate-600">Peças Gravadas</div>
            <p className="text-[11px] text-slate-400">Em copos, garrafas, têxteis e eletrônicos.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-2xl font-black text-[#E6007E] font-heading">+2.400</div>
            <div className="text-xs font-bold text-slate-600">Empresas Atendidas</div>
            <p className="text-[11px] text-slate-400">Desde startups até grandes multinacionais.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-2xl font-black text-[#00AEEF] font-heading">99.8%</div>
            <div className="text-xs font-bold text-slate-600">Pontualidade na Entrega</div>
            <p className="text-[11px] text-slate-400">Compromisso rígido com as datas do evento.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-2xl font-black text-emerald-600 font-heading">100%</div>
            <div className="text-xs font-bold text-slate-600">Amostra Virtual Grátis</div>
            <p className="text-[11px] text-slate-400">Aprovação visual com mockup antes de gravar.</p>
          </div>
        </div>
      </div>

      {/* Process Steps */}
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Como Trabalhamos</span>
          <h2 className="text-2xl font-black font-heading text-slate-900 uppercase">
            Do Orçamento à Entrega Final
          </h2>
          <p className="text-xs text-slate-500">
            Fluxo simplificado, transparente e com acompanhamento em tempo real pelo portal do cliente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              step: '01',
              title: 'Escolha & Cotação',
              desc: 'Selecione os produtos no catálogo e envie sua solicitação de orçamento com as quantidades desejadas.',
              icon: Layers,
            },
            {
              step: '02',
              title: 'Mockup & Aprovação',
              desc: 'Nossa equipe de designers gera a prévia visual digital com a aplicação correta da sua logo.',
              icon: Sparkles,
            },
            {
              step: '03',
              title: 'Produção & Controle',
              desc: 'Personalização com máquinas de precisão industrial e inspeção minuciosa de cada lote produzido.',
              icon: Factory,
            },
            {
              step: '04',
              title: 'Expedição & Rastreio',
              desc: 'Embalagem protetora reforçada e envio seguro com código de rastreamento direto para seu endereço.',
              icon: Truck,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-[#E6007E] transition-all"
              >
                <span className="absolute top-4 right-4 text-3xl font-black text-slate-100 group-hover:text-pink-100 transition-colors">
                  {item.step}
                </span>
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[#FFDD00]" />
                </div>
                <h4 className="text-sm font-black uppercase text-slate-900 font-heading mb-1.5">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Box */}
      <div className="bg-gradient-to-r from-[#E6007E] to-[#c9006e] rounded-3xl p-8 sm:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-2xl font-black font-heading uppercase text-white">
            Pronto para Criar Brindes Incríveis para sua Empresa?
          </h3>
          <p className="text-xs sm:text-sm text-pink-100 max-w-xl">
            Converse diretamente com nosso time comercial, solicite uma demonstração de produtos ou peça seu orçamento personalizado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('contact')}
            className="px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl text-xs font-black uppercase shadow-lg transition-all cursor-pointer"
          >
            Fale Conosco
          </button>
          <button
            type="button"
            onClick={() => onNavigate('digital-catalog')}
            className="px-6 py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#FFDD00]" />
            <span>Catálogo PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
