import React, { useState } from 'react';
import { UserRole, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { Shield, User, ChevronDown, Check, Sparkles, RefreshCw } from 'lucide-react';

interface RoleSwitcherProps {
  currentUser: UserProfile;
  onUserChange: (user: UserProfile) => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentUser, onUserChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const roles: { role: UserRole; title: string; desc: string; badgeColor: string }[] = [
    {
      role: 'admin',
      title: 'Administrador (Diretoria)',
      desc: 'Acesso total: Produtos, Precificação, Estoque, Orçamentos, Pedidos e Usuários.',
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      role: 'gerente',
      title: 'Gerente Operacional',
      desc: 'Gestão de catálogo, custos/margens, orçamentos, pedidos e estoque.',
      badgeColor: 'bg-purple-600 text-white',
    },
    {
      role: 'vendedor',
      title: 'Vendedor (Comercial)',
      desc: 'Visualização de catálogo, atendimento a orçamentos e criação de pedidos.',
      badgeColor: 'bg-blue-600 text-white',
    },
    {
      role: 'estoquista',
      title: 'Estoquista (Almoxarifado)',
      desc: 'Controle de saldo, movimentações de entrada/saída e alertas de estoque mínimo.',
      badgeColor: 'bg-amber-600 text-white',
    },
    {
      role: 'cliente',
      title: 'Cliente Cadastrado (Logado)',
      desc: 'Área do cliente para visualizar preços, solicitar orçamentos e pedidos.',
      badgeColor: 'bg-emerald-600 text-white',
    },
    {
      role: 'visitante',
      title: 'Visitante (Não Cadastrado)',
      desc: 'Navegação aberta no catálogo. Preços ocultos até efetuar cadastro/login.',
      badgeColor: 'bg-slate-600 text-white',
    },
  ];

  const handleSelectRole = (role: UserRole) => {
    const newUser = StorageService.switchRole(role);
    onUserChange(newUser);
    setIsOpen(false);
  };

  const handleResetData = () => {
    if (confirm('Deseja redefinir todos os dados de demonstração (produtos, orçamentos e pedidos) para o estado original?')) {
      StorageService.resetAllData();
    }
  };

  return (
    <div className="relative inline-block text-left no-print" id="role-switcher-container">
      <div className="flex items-center gap-1.5 bg-slate-900 text-slate-200 text-xs px-2.5 py-1 rounded-full border border-slate-700 shadow-sm">
        <Shield className="w-3.5 h-3.5 text-[#00AEEF]" />
        <span className="text-slate-400 font-medium">Modo Atual:</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 font-bold text-white hover:text-[#FFDD00] transition-colors focus:outline-none"
          id="btn-role-dropdown"
        >
          <span className="capitalize">{currentUser.role}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E6007E]" />
                  Simulador de Papéis (Fase 1)
                </p>
                <p className="text-[11px] text-slate-500">Alterne entre perfis para testar permissões</p>
              </div>
            </div>

            <div className="py-1 max-h-80 overflow-y-auto">
              {roles.map((r) => {
                const isSelected = currentUser.role === r.role;
                return (
                  <button
                    key={r.role}
                    onClick={() => handleSelectRole(r.role)}
                    className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-start gap-2.5 hover:bg-slate-50 ${
                      isSelected ? 'bg-pink-50/60 border-l-4 border-[#E6007E]' : ''
                    }`}
                    id={`btn-select-role-${r.role}`}
                  >
                    <div className="mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${r.badgeColor}`}>
                        {r.role}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold ${isSelected ? 'text-[#E6007E]' : 'text-slate-800'}`}>
                          {r.title}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#E6007E]" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{r.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-3 pt-2 pb-1 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[10px] text-slate-400">Usuário: {currentUser.name}</span>
              <button
                onClick={handleResetData}
                className="text-[10px] text-slate-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
                title="Resetar dados para padrão de fábrica"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                Resetar Dados
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
