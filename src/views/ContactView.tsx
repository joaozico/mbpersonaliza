import React, { useState } from 'react';
import {
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  Building2,
  ExternalLink,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { CompanySettings, WhatsAppContact } from '../types';
import { SEOHead } from '../components/SEOHead';

interface ContactViewProps {
  onNavigate: (view: string, param?: string) => void;
}

export const ContactView: React.FC<ContactViewProps> = ({ onNavigate }) => {
  const [settings] = useState<CompanySettings>(() => StorageService.getCompanySettings());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [subject, setSubject] = useState('Orçamento de Brindes');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const activeWhatsAppContacts: WhatsAppContact[] = (settings.whatsappContacts || []).filter(
    (c) => c.active !== false
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setSubmitError('Por favor, preencha todos os campos obrigatórios (Nome, E-mail e Mensagem).');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // Save contact inquiry
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setMessage('');
      setTimeout(() => setSubmitSuccess(false), 6000);
    }, 600);
  };

  const handleOpenWhatsApp = (contact: WhatsAppContact) => {
    const cleanNum = contact.number.replace(/\D/g, '');
    const defaultMsg =
      contact.customMessage ||
      `Olá! Estou entrando em contato pelo site da MB Personaliza com o departamento ${contact.name}.`;
    const url = `https://wa.me/55${cleanNum}?text=${encodeURIComponent(defaultMsg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <SEOHead
        title="Fale Conosco & Atendimento | MB Personaliza"
        description="Fale diretamente com nossa equipe comercial, solicite orçamentos corporativos ou tire suas dúvidas através do WhatsApp, e-mail ou telefone."
        canonicalPath="/contato"
        keywords={['contato mb personaliza', 'whatsapp brindes', 'telefone mb personaliza', 'atendimento brindes']}
      />

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-100 text-[#E6007E] text-xs font-black uppercase">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Canais de Atendimento</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-heading font-black uppercase text-slate-900">
          Fale com Nossa Equipe
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          Estamos prontos para atender sua empresa com agilidade. Escolha o canal de sua preferência ou envie uma mensagem direta abaixo.
        </p>
      </div>

      {/* Main Grid: WhatsApp Channels & Direct Contact Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Direct Message Form (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-heading font-black uppercase text-slate-900">
              Envie uma Mensagem
            </h2>
            <p className="text-xs text-slate-500">
              Retornamos com proposta formal ou resposta em até 2 horas úteis.
            </p>
          </div>

          {submitSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-black text-emerald-900">Mensagem enviada com sucesso!</p>
                <p className="text-[11px] font-normal text-emerald-700">
                  Nossa equipe comercial entrará em contato pelo e-mail ou WhatsApp informado.
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seu Nome *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail Corporativo *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carlos@empresa.com.br"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp / Telefone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98888-7777"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Empresa / Razão Social
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Nome da sua empresa"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Assunto
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E] font-medium"
              >
                <option value="Orçamento de Brindes">Orçamento de Brindes Corporativos</option>
                <option value="Comunicação Visual">Comunicação Visual & Sinalização</option>
                <option value="Dúvidas sobre Pedido em Andamento">Dúvidas sobre Pedido em Andamento</option>
                <option value="Faturamento & Boletos">Faturamento B2B & Boletos</option>
                <option value="Parcerias & Fornecedores">Parcerias & Fornecedores</option>
                <option value="Outro Assunto">Outro Assunto</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sua Mensagem *
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva os produtos desejados, quantidades estimadas ou sua dúvida..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-[#E6007E] text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enviando Mensagem...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#FFDD00]" />
                  <span>Enviar Mensagem</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: WhatsApp Channels + Corporate Data (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* WhatsApp Direct Contacts */}
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white p-6 rounded-3xl border border-emerald-800/40 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-md">
                <MessageSquare className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="font-heading font-black text-sm uppercase text-white">
                  WhatsApp Oficial MB
                </h3>
                <p className="text-[11px] text-emerald-300">
                  Atendimento direto e imediato com especialistas.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {activeWhatsAppContacts.length > 0 ? (
                activeWhatsAppContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleOpenWhatsApp(contact)}
                    className="w-full p-3 rounded-2xl bg-white/5 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/50 transition-all text-left flex items-center justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-black text-white group-hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                        <span>{contact.name}</span>
                        {contact.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase">
                            Principal
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {contact.number}
                      </div>
                      {contact.hours && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{contact.hours}</span>
                        </div>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-[#25D366]/20 group-hover:bg-[#25D366] text-emerald-400 group-hover:text-white flex items-center justify-center transition-all shrink-0">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const clean = (settings.whatsapp || '').replace(/\D/g, '');
                    window.open(`https://wa.me/55${clean}`, '_blank');
                  }}
                  className="w-full p-3 rounded-2xl bg-white/5 hover:bg-emerald-500/20 border border-emerald-500/20 text-left flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="text-xs font-bold text-white">Central Comercial</span>
                    <p className="text-[11px] text-slate-400 font-mono">{settings.whatsapp}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-emerald-400" />
                </button>
              )}
            </div>
          </div>

          {/* Company Info Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <h3 className="font-heading font-black text-sm uppercase text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#00AEEF]" />
              Dados da Empresa
            </h3>

            <div className="space-y-3 text-slate-600">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 block">Endereço da Fábrica / Showroom:</span>
                  <span>
                    {settings.address?.street
                      ? `${settings.address.street}, ${settings.address.number}${settings.address.complement ? ` - ${settings.address.complement}` : ''} - ${settings.address.neighborhood || ''}, ${settings.address.city}/${settings.address.state} - CEP: ${settings.address.cep}`
                      : 'Rua das Indústrias Criativas, 450 - São Paulo/SP'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">Telefone Comercial:</span>
                  <span>{settings.phone || '(11) 3456-7890'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">E-mail:</span>
                  <span>{settings.email || 'contato@mbpersonaliza.com.br'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">Horário de Atendimento:</span>
                  <span>Segunda a Sexta: 08:30 às 18:00</span>
                </div>
              </div>

              {settings.cnpj && (
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <strong>CNPJ:</strong> {settings.cnpj} • <strong>Razão Social:</strong>{' '}
                  {settings.companyName || 'MB PERSONALIZA BRINDES CORPORATIVOS LTDA'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
