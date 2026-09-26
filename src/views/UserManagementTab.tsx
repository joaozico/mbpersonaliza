import React, { useState } from 'react';
import { UserProfile, UserRole, RolePermissions } from '../types';
import { StorageService } from '../services/storage';
import {
  Users,
  Shield,
  UserPlus,
  Edit2,
  Trash2,
  CheckCircle2,
  SlidersHorizontal,
  Search,
  Check,
  X,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';

interface UserManagementTabProps {
  currentUser: UserProfile;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'permissions' | 'customers'>('employees');

  const [employees, setEmployees] = useState<UserProfile[]>(() => StorageService.getEmployees());
  const [customers, setCustomers] = useState<UserProfile[]>(() => StorageService.getCustomers());
  const [permissionsMatrix, setPermissionsMatrix] = useState<Record<UserRole, RolePermissions>>(() =>
    StorageService.getPermissionsMatrix()
  );

  // Search filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal State for New/Edit Employee
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('vendedor');
  const [formDepartment, setFormDepartment] = useState('Comercial');
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');

  // Feedback notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const refreshData = () => {
    setEmployees(StorageService.getEmployees());
    setCustomers(StorageService.getCustomers());
    setPermissionsMatrix(StorageService.getPermissionsMatrix());
  };

  // Open modal for new employee
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('123456');
    setFormPhone('(11) 98888-7777');
    setFormRole('vendedor');
    setFormDepartment('Comercial');
    setFormStatus('ativo');
    setIsModalOpen(true);
  };

  // Open modal for editing employee
  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword(user.password || '');
    setFormPhone(user.phone || '');
    setFormRole(user.role);
    setFormDepartment(user.department || '');
    setFormStatus(user.status || 'ativo');
    setIsModalOpen(true);
  };

  // Save employee
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formEmail.trim()) {
      showNotification('error', 'Nome e e-mail são obrigatórios.');
      return;
    }

    const userData: UserProfile = {
      id: editingUser ? editingUser.id : `emp-${Date.now()}`,
      name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      password: formPassword.trim() || '123456',
      phone: formPhone.trim(),
      role: formRole,
      department: formDepartment.trim(),
      status: formStatus,
      createdAt: editingUser ? editingUser.createdAt : new Date().toISOString(),
      lastLogin: editingUser ? editingUser.lastLogin : undefined,
      customPermissions: editingUser?.customPermissions,
    };

    StorageService.saveUser(userData);
    refreshData();
    setIsModalOpen(false);
    showNotification('success', `Colaborador ${userData.name} salvo com sucesso!`);
  };

  // Toggle status
  const handleToggleStatus = (userId: string) => {
    const updated = StorageService.toggleUserStatus(userId);
    if (updated) {
      refreshData();
      showNotification('success', `Status de ${updated.name} alterado para ${updated.status?.toUpperCase()}.`);
    }
  };

  // Delete user
  const handleDeleteUser = (user: UserProfile) => {
    if (user.id === currentUser.id) {
      showNotification('error', 'Você não pode excluir o usuário atualmente logado.');
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
      StorageService.deleteUser(user.id);
      refreshData();
      showNotification('success', `Usuário ${user.name} removido com sucesso.`);
    }
  };

  // Permission matrix toggle
  const handleTogglePermission = (role: UserRole, permissionKey: keyof RolePermissions) => {
    const currentPerms = permissionsMatrix[role] || {
      canViewDashboard: true,
      canManageProducts: false,
      canManageCategories: false,
      canManageStock: false,
      canManageQuotes: false,
      canManageOrders: false,
      canManageUsers: false,
      canManageCompanySettings: false,
      canViewReports: false,
      canEditPrices: false,
      canDeleteData: false,
    };

    const updatedMatrix: Record<UserRole, RolePermissions> = {
      ...permissionsMatrix,
      [role]: {
        ...currentPerms,
        [permissionKey]: !currentPerms[permissionKey],
      },
    };

    setPermissionsMatrix(updatedMatrix);
  };

  const handleSavePermissionsMatrix = () => {
    StorageService.savePermissionsMatrix(permissionsMatrix);
    showNotification('success', 'Matriz de permissões salva com sucesso!');
  };

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Filtered customers
  const filteredCustomers = customers.filter((cust) => {
    return (
      cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cust.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cust.company && cust.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cust.cpfCnpj && cust.cpfCnpj.includes(searchTerm))
    );
  });

  const rolesToDisplay: { role: UserRole; name: string }[] = [
    { role: 'admin', name: 'Administrador' },
    { role: 'gerente', name: 'Gerente Geral' },
    { role: 'vendedor', name: 'Vendedor / Comercial' },
    { role: 'estoquista', name: 'Almoxarife / Estoque' },
  ];

  const permissionsList: { key: keyof RolePermissions; label: string; desc: string }[] = [
    { key: 'canViewDashboard', label: 'Acesso ao Painel Admin', desc: 'Acessar a área de gestão interna' },
    { key: 'canViewSiteMetrics', label: 'Visualizar Métricas do Site', desc: 'Acessar painel analítico de tráfego e acessos (Estilo Instagram Insights)' },
    { key: 'canManageProducts', label: 'Produtos & Catálogo', desc: 'Criar, editar e excluir itens' },
    { key: 'canManageCategories', label: 'Categorias & Subcategorias', desc: 'Estruturação do catálogo' },
    { key: 'canEditPrices', label: 'Preços & Faixas de Desconto', desc: 'Alterar tabelas e promoções' },
    { key: 'canManageStock', label: 'Controle de Estoque', desc: 'Lançamentos de entrada e saída' },
    { key: 'canManageQuotes', label: 'Gestão de Orçamentos', desc: 'Precificar e responder cotações' },
    { key: 'canManageOrders', label: 'Gestão de Pedidos', desc: 'Alterar status de produção e envio' },
    { key: 'canManageUsers', label: 'Gestão de Usuários', desc: 'Cadastrar colaboradores e acessos' },
    { key: 'canManageCompanySettings', label: 'Dados & Logo da Empresa', desc: 'Editar configurações da MB' },
    { key: 'canCustomizeLayout', label: 'Personalizar Layout do Sistema', desc: 'Configurar cores, textos, banners, blocos e ordem da loja' },
    { key: 'canViewReports', label: 'Relatórios & Exportações', desc: 'Exportar dados analíticos e pedidos' },
    { key: 'canDeleteData', label: 'Exclusão de Registros', desc: 'Apagar pedidos, orçamentos ou itens' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 flex items-center justify-center text-[#FFDD00] shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-black uppercase text-slate-900">
              Gestão de Usuários & Controle de Acessos
            </h2>
            <p className="text-xs text-slate-500">
              Controle de colaboradores internos da MB Personaliza, clientes cadastrados e matriz de permissões.
            </p>
          </div>
        </div>

        {activeSubTab === 'employees' && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 text-xs font-extrabold text-white bg-[#E6007E] hover:bg-[#c9006e] rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Colaborador</span>
          </button>
        )}

        {activeSubTab === 'permissions' && (
          <button
            type="button"
            onClick={handleSavePermissionsMatrix}
            className="px-4 py-2.5 text-xs font-extrabold text-white bg-slate-900 hover:bg-[#E6007E] rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Check className="w-4 h-4 text-[#FFDD00]" />
            <span>Salvar Matriz de Permissões</span>
          </button>
        )}
      </div>

      {/* Notification banner */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('employees')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'employees'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Equipe & Colaboradores ({employees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('permissions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'permissions'
              ? 'bg-[#E6007E] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Matriz de Permissões por Cargo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('customers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'customers'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-[#00AEEF]" />
          <span>Clientes Cadastrados ({customers.length})</span>
        </button>
      </div>

      {/* SUBTAB 1: EMPLOYEES LIST */}
      {activeSubTab === 'employees' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filter toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filtrar Função:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 font-medium"
              >
                <option value="all">Todas as Funções</option>
                <option value="admin">Administrador</option>
                <option value="gerente">Gerente</option>
                <option value="vendedor">Vendedor / Comercial</option>
                <option value="estoquista">Almoxarife / Estoque</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Colaborador / Contato</th>
                  <th className="py-3.5 px-4">Função / Nível</th>
                  <th className="py-3.5 px-4">Departamento</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Último Login</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const roleBadgeConfig = {
                    admin: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Administrador' },
                    gerente: { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Gerente Geral' },
                    vendedor: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Comercial / Vendas' },
                    estoquista: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Almoxarife / Estoque' },
                    cliente: { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Cliente' },
                  }[emp.role];

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                            {emp.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              {emp.name}
                              {emp.id === currentUser.id && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                                  Você
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500">{emp.email}</p>
                            {emp.phone && <p className="text-[10px] text-slate-400">{emp.phone}</p>}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${roleBadgeConfig.bg}`}
                        >
                          {roleBadgeConfig.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-700 font-medium">{emp.department || 'Geral'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(emp.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border cursor-pointer transition-colors ${
                            emp.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              emp.status === 'ativo' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {emp.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {emp.lastLogin ? new Date(emp.lastLogin).toLocaleDateString('pt-BR') : 'Sem registro'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar Colaborador"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {emp.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(emp)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir Colaborador"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PERMISSIONS MATRIX */}
      {activeSubTab === 'permissions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-6 space-y-6">
          <div>
            <h3 className="text-base font-extrabold uppercase text-slate-900">
              Matriz Global de Permissões de Acesso
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Defina o que cada cargo interno pode visualizar e executar no painel administrativo da MB Personaliza.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-2xl">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Módulo / Permissão</th>
                  {rolesToDisplay.map((r) => (
                    <th key={r.role} className="py-3.5 px-4 text-center">
                      <span className="block font-black text-slate-900">{r.name}</span>
                      <span className="text-[10px] text-slate-500 normal-case font-normal">
                        ({r.role})
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {permissionsList.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/75">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{row.label}</p>
                      <p className="text-[11px] text-slate-400">{row.desc}</p>
                    </td>

                    {rolesToDisplay.map((r) => {
                      const rolePerms = permissionsMatrix[r.role];
                      const isAllowed = rolePerms ? Boolean(rolePerms[row.key]) : false;
                      const isAdminRole = r.role === 'admin';

                      return (
                        <td key={r.role} className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            disabled={isAdminRole}
                            onClick={() => handleTogglePermission(r.role, row.key)}
                            className={`w-9 h-9 rounded-xl inline-flex items-center justify-center transition-all ${
                              isAllowed
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            } ${isAdminRole ? 'opacity-90 cursor-not-allowed' : 'cursor-pointer shadow-xs'}`}
                            title={isAllowed ? 'Permitido' : 'Bloqueado'}
                          >
                            {isAllowed ? (
                              <Check className="w-5 h-5 font-black stroke-[3]" />
                            ) : (
                              <X className="w-4 h-4 font-bold" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={handleSavePermissionsMatrix}
              className="px-6 py-3 text-xs font-extrabold text-white bg-slate-900 hover:bg-[#E6007E] rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 text-[#FFDD00]" />
              <span>Salvar Alterações de Permissões</span>
            </button>
          </div>
        </div>
      )}

      {/* SUBTAB 3: CUSTOMERS LIST */}
      {activeSubTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar cliente por razão social, nome, CPF/CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <span className="text-xs font-bold text-slate-500">
              {filteredCustomers.length} clientes encontrados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Cliente / Razão Social</th>
                  <th className="py-3.5 px-4">CPF / CNPJ</th>
                  <th className="py-3.5 px-4">Contato / WhatsApp</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Cadastrado em</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-pink-100 text-[#E6007E] font-extrabold text-xs flex items-center justify-center shrink-0">
                          {cust.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900">{cust.company || cust.name}</p>
                          <p className="text-[11px] text-slate-500">{cust.email}</p>
                          {cust.company && <p className="text-[10px] text-slate-400">Contato: {cust.name}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-700">{cust.cpfCnpj || 'Não informado'}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-slate-700">{cust.phone || '-'}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(cust.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border cursor-pointer transition-colors ${
                          cust.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            cust.status === 'ativo' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {cust.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(cust.createdAt).toLocaleDateString('pt-BR')}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cust)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Editar Cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT EMPLOYEE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                {editingUser ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}
              </h3>
              <p className="text-xs text-slate-500">
                Preencha os dados e perfil de acesso do funcionário na MB Personaliza.
              </p>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="Ex: Carlos Alberto"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Login</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                    placeholder="carlos@mbpersonaliza.com.br"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Senha de Acesso</label>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E] font-mono"
                    placeholder="••••••"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cargo / Função</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E] font-bold"
                  >
                    <option value="admin">Administrador (Total)</option>
                    <option value="gerente">Gerente Geral</option>
                    <option value="vendedor">Vendedor / Comercial</option>
                    <option value="estoquista">Almoxarife / Estoquista</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Departamento / Setor</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                    placeholder="Comercial, Diretoria, Logística..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / Ramal</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                    placeholder="(11) 98888-7777"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status da Conta</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ativo' | 'inativo')}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  >
                    <option value="ativo">Ativo (Pode logar)</option>
                    <option value="inativo">Inativo (Bloqueado)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-[#E6007E] hover:bg-[#c9006e] rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
