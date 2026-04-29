import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./SuperAdminPage.css";
import MiniLineChart from "../Components/MiniLineChart.jsx";

const menuItems = [
  { id: "dashboard", label: "Dashboard Global", icon: "▣" },
  { id: "tenants", label: "Gerenciamento de Personais", icon: "◉" },
  { id: "billing", label: "Faturamento por Personal", icon: "₿" },
  { id: "subscriptions", label: "Planos e Assinaturas", icon: "◆" },
  { id: "support", label: "Suporte e Tickets", icon: "✦" },
  { id: "settings", label: "Configuracoes do Sistema", icon: "⚙" },
];

function mapStatus(status) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "SUSPENDED") return "Suspenso";
  return "Inativo";
}

function toRelativeDate(dateInput) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "Agora";
  if (diffMins < 60) return `Ha ${diffMins} min`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `Ha ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `Ha ${diffDays} d`;
}

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

const PAGE_SIZE = 10;

export default function SuperAdminPage({ token, onLogout }) {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingTenantId, setUpdatingTenantId] = useState(null);
  const [deletingTenantId, setDeletingTenantId] = useState(null);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState("");
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState(null);

  const [newTenantForm, setNewTenantForm] = useState({
    businessName: "",
    email: "",
    phone: "",
    subdomain: "",
    status: "ACTIVE",
    defaultPlan: "FREE",
    password: "",
  });

  const [editTenantForm, setEditTenantForm] = useState({
    businessName: "",
    email: "",
    phone: "",
    subdomain: "",
  });

  // Tenant filters & pagination
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [tenantPage, setTenantPage] = useState(1);

  // Data states
  const [metrics, setMetrics] = useState({
    activePersonals: 0,
    totalAlunos: 0,
    mrrCents: 0,
    churnRate: 0,
    newSignupsThisMonth: 0,
  });
  const [growth, setGrowth] = useState({
    labels: [],
    personals: [],
    revenue: [],
  });
  const [activityRows, setActivityRows] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [billingReport, setBillingReport] = useState([]);
  const [plansSummary, setPlansSummary] = useState([]);

  const API_BASE_URL =
    import.meta.env.VITE_SUPERADMIN_API_URL || "http://localhost:3001";

  const requestHeaders = useMemo(() => {
    const h = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const fetchJson = useCallback(
    async (path, options = {}) => {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: { ...requestHeaders, ...(options.headers || {}) },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        if (res.status === 401) {
          localStorage.removeItem("superAdminToken");
          onLogout();
          throw new Error("Sessao expirada. Faca login novamente.");
        }
        throw new Error(
          payload.error || payload.message || "Falha ao carregar dados",
        );
      }
      return res.json();
    },
    [API_BASE_URL, requestHeaders, onLogout],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [metricsData, growthData, activityData, tenantsData] =
        await Promise.all([
          fetchJson("/super-admin/dashboard/metrics"),
          fetchJson("/super-admin/dashboard/growth"),
          fetchJson("/super-admin/activity?limit=20"),
          fetchJson("/super-admin/tenants"),
        ]);
      setMetrics(metricsData);
      setGrowth(growthData || { labels: [], personals: [], revenue: [] });
      setActivityRows(Array.isArray(activityData) ? activityData : []);
      setTenants(Array.isArray(tenantsData) ? tenantsData : []);
    } catch (err) {
      setError(err.message || "Erro ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/super-admin/tenants/billing");
      setBillingReport(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Erro ao carregar faturamento");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/super-admin/plans/summary");
      setPlansSummary(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    if (activeMenu === "dashboard" || activeMenu === "tenants") {
      loadDashboard();
    } else if (activeMenu === "billing") {
      loadBilling();
    } else if (activeMenu === "subscriptions") {
      loadPlans();
    }
    setTenantPage(1);
    setSearchTerm("");
  }, [activeMenu]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Tenants filtering & pagination ---
  const uniquePlans = useMemo(() => {
    const codes = new Set();
    tenants.forEach((t) => {
      const code = t.subscriptions?.[0]?.subscriptionPlan?.code;
      if (code) codes.add(code);
    });
    return ["ALL", ...Array.from(codes)];
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tenants.filter((t) => {
      const plan = t.subscriptions?.[0]?.subscriptionPlan?.code || "";
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (planFilter !== "ALL" && plan !== planFilter) return false;
      if (!term) return true;
      return (
        String(t.businessName || "")
          .toLowerCase()
          .includes(term) ||
        String(t.user?.email || "")
          .toLowerCase()
          .includes(term) ||
        String(t.subdomain || "")
          .toLowerCase()
          .includes(term) ||
        String(plan).toLowerCase().includes(term)
      );
    });
  }, [tenants, searchTerm, statusFilter, planFilter]);

  const totalTenantPages = Math.max(
    1,
    Math.ceil(filteredTenants.length / PAGE_SIZE),
  );
  const pagedTenants = filteredTenants.slice(
    (tenantPage - 1) * PAGE_SIZE,
    tenantPage * PAGE_SIZE,
  );

  // --- Billing search ---
  const filteredBilling = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return billingReport;
    return billingReport.filter(
      (r) =>
        String(r.businessName || "")
          .toLowerCase()
          .includes(term) ||
        String(r.email || "")
          .toLowerCase()
          .includes(term) ||
        String(r.planCode || "")
          .toLowerCase()
          .includes(term),
    );
  }, [billingReport, searchTerm]);

  const billingTotals = useMemo(() => {
    const totalAlunos = billingReport.reduce(
      (s, r) => s + (r.totalAlunos || 0),
      0,
    );
    const mrrCents = billingReport.reduce((s, r) => s + (r.priceCents || 0), 0);
    return { totalAlunos, mrrCents };
  }, [billingReport]);

  // --- Activity search ---
  const filteredActivity = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return activityRows;
    return activityRows.filter(
      (row) =>
        String(row.action || "")
          .toLowerCase()
          .includes(term) ||
        String(row.tenant || "")
          .toLowerCase()
          .includes(term) ||
        String(row.plan || "")
          .toLowerCase()
          .includes(term),
    );
  }, [activityRows, searchTerm]);

  const metricCards = [
    {
      label: "Personais Ativos",
      value: `${metrics.activePersonals || 0}`,
      trend: "Dado em tempo real",
      tone: "positive",
    },
    {
      label: "Alunos na Plataforma",
      value: `${metrics.totalAlunos || 0}`,
      trend: "Dado em tempo real",
      tone: "positive",
    },
    {
      label: "MRR",
      value: formatCurrencyBRL((metrics.mrrCents || 0) / 100),
      trend: "Assinaturas ativas",
      tone: "positive",
    },
    {
      label: "Churn Rate",
      value: `${Number(metrics.churnRate || 0).toFixed(1)}%`,
      trend: "Ultimos 30 dias",
      tone: "neutral",
    },
    {
      label: "Novas Inscricoes (Mes)",
      value: `${metrics.newSignupsThisMonth || 0}`,
      trend: "Mes atual",
      tone: "positive",
    },
  ];

  const handleToggleTenantStatus = async (tenantId, currentStatus) => {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setUpdatingTenantId(tenantId);
    try {
      await fetchJson(`/super-admin/tenants/${tenantId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, status: nextStatus } : t)),
      );
    } catch (err) {
      setError(err.message || "Falha ao atualizar status do personal");
    } finally {
      setUpdatingTenantId(null);
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setError("");
    setCreatingTenant(true);
    setLastCreatedCredentials(null);

    try {
      const payload = {
        businessName: newTenantForm.businessName.trim(),
        email: newTenantForm.email.trim().toLowerCase(),
        phone: newTenantForm.phone.trim() || null,
        subdomain: newTenantForm.subdomain.trim().toLowerCase(),
        status: newTenantForm.status,
        defaultPlan: newTenantForm.defaultPlan,
        password: newTenantForm.password || undefined,
      };

      const created = await fetchJson("/super-admin/tenants", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setLastCreatedCredentials({
        tenantName: created?.tenant?.businessName || payload.businessName,
        email: created?.tenant?.user?.email || payload.email,
        temporaryPassword: created?.temporaryPassword || null,
      });

      setNewTenantForm({
        businessName: "",
        email: "",
        phone: "",
        subdomain: "",
        status: "ACTIVE",
        defaultPlan: "FREE",
        password: "",
      });

      await loadDashboard();
      setActiveMenu("tenants");
    } catch (err) {
      setError(err.message || "Falha ao criar personal");
    } finally {
      setCreatingTenant(false);
    }
  };

  const startEditTenant = (tenant) => {
    setEditingTenantId(tenant.id);
    setEditTenantForm({
      businessName: tenant.businessName || "",
      email: tenant.user?.email || "",
      phone: tenant.phone || "",
      subdomain: tenant.subdomain || "",
    });
  };

  const handleUpdateTenant = async (tenantId) => {
    setError("");
    setUpdatingTenantId(tenantId);

    try {
      await fetchJson(`/super-admin/tenants/${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          businessName: editTenantForm.businessName.trim(),
          email: editTenantForm.email.trim().toLowerCase(),
          phone: editTenantForm.phone.trim() || null,
          subdomain: editTenantForm.subdomain.trim().toLowerCase(),
        }),
      });

      setEditingTenantId("");
      await loadDashboard();
      setActiveMenu("tenants");
    } catch (err) {
      setError(err.message || "Falha ao atualizar personal");
    } finally {
      setUpdatingTenantId(null);
    }
  };

  const handleDeleteTenant = async (tenantId, businessName) => {
    const ok = window.confirm(
      `Deseja desativar/excluir o personal ${businessName}?`,
    );
    if (!ok) return;

    setError("");
    setDeletingTenantId(tenantId);

    try {
      await fetchJson(`/super-admin/tenants/${tenantId}`, {
        method: "DELETE",
      });

      await loadDashboard();
      setActiveMenu("tenants");
    } catch (err) {
      setError(err.message || "Falha ao excluir personal");
    } finally {
      setDeletingTenantId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("superAdminToken");
    onLogout();
  };

  const selectStyle = {
    background: "var(--sm-card)",
    border: "1px solid var(--sm-border)",
    borderRadius: "8px",
    color: "var(--sm-text)",
    padding: "6px 10px",
    fontSize: "0.8rem",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div className="min-h-screen bg-[var(--sm-bg)] text-[var(--sm-text)]">
      <div className="sm-grid-bg min-h-screen">
        {/* HEADER */}
        <header className="border-b border-[var(--sm-border)] bg-[var(--sm-surface)]/80 backdrop-blur-lg">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <div className="sm-logo-wrap">
                <span className="sm-logo-pulse" />
                <span className="sm-logo-mark">SM</span>
              </div>
              <div>
                <p className="sm-brand">SelfMachine</p>
                <p className="text-xs text-[var(--sm-muted)]">
                  Super Admin Control Center
                </p>
              </div>
            </div>

            <div className="hidden w-full max-w-xl items-center md:flex">
              <div className="sm-search-wrap w-full">
                <span className="sm-search-icon">⌕</span>
                <input
                  placeholder="Buscar personal, plano, email..."
                  className="sm-search-input"
                  type="search"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setTenantPage(1);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  fontSize: "0.78rem",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--sm-border)",
                  color: "var(--sm-muted)",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Sair
              </button>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">Super Admin</p>
                <p className="text-xs text-[var(--sm-muted)]">SelfMachine</p>
              </div>
              <span className="sm-avatar">SA</span>
            </div>
          </div>

          <div className="mx-auto px-4 pb-3 md:hidden md:px-6">
            <div className="sm-search-wrap">
              <span className="sm-search-icon">⌕</span>
              <input
                placeholder="Buscar..."
                className="sm-search-input"
                type="search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setTenantPage(1);
                }}
              />
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-4 py-5 md:grid-cols-[260px_1fr] md:px-6">
          {/* SIDEBAR */}
          <aside className="sm-sidebar">
            <p className="mb-4 text-xs uppercase tracking-[0.14em] text-[var(--sm-muted)]">
              Navegacao
            </p>
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMenu(item.id)}
                  className={`sm-nav-btn ${activeMenu === item.id ? "sm-nav-btn-active" : ""}`}
                >
                  <span className="sm-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-6 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-card)] p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--sm-muted)]">
                Sistema
              </p>
              <p className="mt-2 text-sm text-[var(--sm-text)]">
                Ambiente de producao ativo
              </p>
              <button className="sm-warning-btn mt-4" type="button">
                Modo manutencao
              </button>
            </div>
          </aside>

          {/* MAIN */}
          <main className="space-y-5">
            {error ? <div className="sm-empty">{error}</div> : null}

            {/* ===== DASHBOARD ===== */}
            {activeMenu === "dashboard" && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {metricCards.map((card) => (
                    <article key={card.label} className="sm-card">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.1em] text-[var(--sm-muted)]">
                          {card.label}
                        </p>
                        <span className="sm-chip">↗</span>
                      </div>
                      <p className="text-2xl font-semibold tracking-tight">
                        {card.value}
                      </p>
                      <p
                        className={`mt-2 text-xs ${card.tone === "positive" ? "text-[var(--sm-accent)]" : "text-[var(--sm-muted)]"}`}
                      >
                        {card.trend}
                      </p>
                    </article>
                  ))}
                </section>

                <section className="grid gap-5 xl:grid-cols-2">
                  <article className="sm-card">
                    <div className="mb-3">
                      <h3 className="text-base font-semibold">
                        Crescimento de Personais
                      </h3>
                      <p className="text-xs text-[var(--sm-muted)]">
                        Evolucao mensal de tenants ativos
                      </p>
                    </div>
                    <MiniLineChart
                      data={
                        growth.personals.length > 0
                          ? growth.personals
                          : [0, 0, 0]
                      }
                      maxValue={Math.max(
                        ...(growth.personals.length > 0
                          ? growth.personals
                          : [1]),
                      )}
                    />
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--sm-muted)]">
                      {(growth.labels || []).slice(-6).map((m) => (
                        <span key={m} className="sm-month-pill">
                          {m}
                        </span>
                      ))}
                    </div>
                  </article>
                  <article className="sm-card">
                    <div className="mb-3">
                      <h3 className="text-base font-semibold">
                        Crescimento de Receita
                      </h3>
                      <p className="text-xs text-[var(--sm-muted)]">
                        MRR (R$) por mes
                      </p>
                    </div>
                    <MiniLineChart
                      data={
                        growth.revenue.length > 0 ? growth.revenue : [0, 0, 0]
                      }
                      maxValue={Math.max(
                        ...(growth.revenue.length > 0 ? growth.revenue : [1]),
                      )}
                    />
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--sm-muted)]">
                      {(growth.labels || []).slice(-6).map((m) => (
                        <span key={m} className="sm-month-pill">
                          {m}
                        </span>
                      ))}
                    </div>
                  </article>
                </section>

                <section className="sm-card">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">
                        Atividade Recente
                      </h3>
                      <p className="text-xs text-[var(--sm-muted)]">
                        Ultimas movimentacoes da plataforma
                      </p>
                    </div>
                    <button
                      className="sm-primary-btn"
                      type="button"
                      onClick={loadDashboard}
                    >
                      Atualizar
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-[0.08em] text-[var(--sm-muted)]">
                          <th className="px-3 py-2">Acao</th>
                          <th className="px-3 py-2">Personal</th>
                          <th className="px-3 py-2">Plano</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Quando</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredActivity.map((row) => (
                          <tr
                            key={`${row.tenantId}-${row.timestamp}`}
                            className="sm-table-row"
                          >
                            <td className="px-3 py-3">{row.action}</td>
                            <td className="px-3 py-3">{row.tenant}</td>
                            <td className="px-3 py-3">{row.plan ?? "-"}</td>
                            <td className="px-3 py-3">
                              <span
                                className={`sm-status ${row.status === "ACTIVE" ? "sm-status-active" : "sm-status-inactive"}`}
                              >
                                {mapStatus(row.status)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[var(--sm-muted)]">
                              {toRelativeDate(row.timestamp)}
                            </td>
                          </tr>
                        ))}
                        {filteredActivity.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-3 py-6 text-center text-[var(--sm-muted)]"
                            >
                              {loading
                                ? "Carregando..."
                                : "Nenhuma atividade encontrada"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* ===== TENANTS ===== */}
            {activeMenu === "tenants" && (
              <section className="sm-card">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="sm-section-title">
                      Gerenciamento de Personais
                    </h3>
                    <p className="text-xs text-[var(--sm-muted)]">
                      Controle de tenants com ativacao/desativacao.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      style={selectStyle}
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setTenantPage(1);
                      }}
                    >
                      <option value="ALL">Todos os status</option>
                      <option value="ACTIVE">Ativo</option>
                      <option value="INACTIVE">Inativo</option>
                      <option value="SUSPENDED">Suspenso</option>
                    </select>
                    <select
                      style={selectStyle}
                      value={planFilter}
                      onChange={(e) => {
                        setPlanFilter(e.target.value);
                        setTenantPage(1);
                      }}
                    >
                      {uniquePlans.map((p) => (
                        <option key={p} value={p}>
                          {p === "ALL" ? "Todos os planos" : p}
                        </option>
                      ))}
                    </select>
                    <span className="sm-inline-muted">
                      {filteredTenants.length} resultados
                    </span>
                  </div>
                </div>

                <form className="sm-tenant-form" onSubmit={handleCreateTenant}>
                  <div className="sm-tenant-form-header">
                    <h4 className="sm-section-title">Criar novo personal</h4>
                    <span className="sm-inline-muted">
                      Cadastro completo com subdominio
                    </span>
                  </div>

                  <div className="sm-tenant-form-grid">
                    <input
                      className="sm-input"
                      placeholder="Nome do negocio"
                      value={newTenantForm.businessName}
                      onChange={(e) =>
                        setNewTenantForm((prev) => ({
                          ...prev,
                          businessName: e.target.value,
                        }))
                      }
                      required
                    />
                    <input
                      className="sm-input"
                      type="email"
                      placeholder="email@personal.com"
                      value={newTenantForm.email}
                      onChange={(e) =>
                        setNewTenantForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      required
                    />
                    <input
                      className="sm-input"
                      placeholder="Telefone"
                      value={newTenantForm.phone}
                      onChange={(e) =>
                        setNewTenantForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                    <input
                      className="sm-input"
                      placeholder="subdominio (ex: thiagoiazzetti)"
                      value={newTenantForm.subdomain}
                      onChange={(e) =>
                        setNewTenantForm((prev) => ({
                          ...prev,
                          subdomain: e.target.value,
                        }))
                      }
                      required
                    />
                    <select
                      className="sm-input"
                      value={newTenantForm.status}
                      onChange={(e) =>
                        setNewTenantForm((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                    >
                      <option value="ACTIVE">Ativo</option>
                      <option value="INACTIVE">Inativo</option>
                      <option value="SUSPENDED">Suspenso</option>
                    </select>
                    <select
                      className="sm-input"
                      value={newTenantForm.defaultPlan}
                      onChange={(e) =>
                        setNewTenantForm((prev) => ({
                          ...prev,
                          defaultPlan: e.target.value,
                        }))
                      }
                    >
                      <option value="FREE">FREE</option>
                      <option value="PRO">PRO</option>
                      <option value="PREMIUM">PREMIUM</option>
                    </select>
                    <input
                      className="sm-input"
                      placeholder="Senha inicial (opcional)"
                      value={newTenantForm.password}
                      onChange={(e) =>
                        setNewTenantForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="sm-tenant-form-actions">
                    <button
                      type="submit"
                      className="sm-primary-btn"
                      disabled={creatingTenant}
                    >
                      {creatingTenant ? "Criando..." : "Criar personal"}
                    </button>
                  </div>
                </form>

                {lastCreatedCredentials?.temporaryPassword ? (
                  <div className="sm-tenant-created-box">
                    <strong>Personal criado:</strong>{" "}
                    {lastCreatedCredentials.tenantName} |{" "}
                    {lastCreatedCredentials.email} | senha temporaria:{" "}
                    <code>{lastCreatedCredentials.temporaryPassword}</code>
                  </div>
                ) : null}

                {loading ? (
                  <div className="sm-skeleton">Carregando tenants...</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-[0.08em] text-[var(--sm-muted)]">
                            <th className="px-3 py-2">Personal</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Telefone</th>
                            <th className="px-3 py-2">Subdominio</th>
                            <th className="px-3 py-2">Plano</th>
                            <th className="px-3 py-2">Alunos</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Acao</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedTenants.map((tenant) => {
                            const isActive = tenant.status === "ACTIVE";
                            const sub = tenant.subscriptions?.[0];
                            return (
                              <tr key={tenant.id} className="sm-table-row">
                                <td className="px-3 py-3 font-medium">
                                  {tenant.businessName}
                                </td>
                                <td className="px-3 py-3 text-[var(--sm-muted)]">
                                  {tenant.user?.email || "-"}
                                </td>
                                <td className="px-3 py-3 text-[var(--sm-muted)]">
                                  {tenant.phone || "-"}
                                </td>
                                <td className="px-3 py-3 text-[var(--sm-muted)]">
                                  {tenant.subdomain || "-"}
                                </td>
                                <td className="px-3 py-3">
                                  {sub?.subscriptionPlan?.code ? (
                                    <span className="sm-tag">
                                      {sub.subscriptionPlan.code}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--sm-muted)]">
                                      -
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  {tenant._count?.alunos ?? "-"}
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`sm-status ${isActive ? "sm-status-active" : "sm-status-inactive"}`}
                                  >
                                    {mapStatus(tenant.status)}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="sm-tenant-actions-wrap">
                                    <button
                                      type="button"
                                      disabled={updatingTenantId === tenant.id}
                                      onClick={() =>
                                        handleToggleTenantStatus(
                                          tenant.id,
                                          tenant.status,
                                        )
                                      }
                                      className={`sm-tenant-btn ${isActive ? "sm-tenant-btn-danger" : "sm-tenant-btn-success"}`}
                                    >
                                      {updatingTenantId === tenant.id
                                        ? "..."
                                        : isActive
                                          ? "Desligar"
                                          : "Reativar"}
                                    </button>
                                    <button
                                      type="button"
                                      className="sm-tenant-btn sm-tenant-btn-neutral"
                                      onClick={() => startEditTenant(tenant)}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      className="sm-tenant-btn sm-tenant-btn-danger"
                                      disabled={deletingTenantId === tenant.id}
                                      onClick={() =>
                                        handleDeleteTenant(
                                          tenant.id,
                                          tenant.businessName,
                                        )
                                      }
                                    >
                                      {deletingTenantId === tenant.id
                                        ? "..."
                                        : "Excluir"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {pagedTenants.length === 0 && (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-3 py-6 text-center text-[var(--sm-muted)]"
                              >
                                Nenhum personal encontrado com esses filtros
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-[var(--sm-muted)]">
                        Pagina {tenantPage} de {totalTenantPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={tenantPage <= 1}
                          onClick={() => setTenantPage((p) => p - 1)}
                          style={{
                            ...selectStyle,
                            opacity: tenantPage <= 1 ? 0.5 : 1,
                            cursor: tenantPage <= 1 ? "not-allowed" : "pointer",
                          }}
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={tenantPage >= totalTenantPages}
                          onClick={() => setTenantPage((p) => p + 1)}
                          style={{
                            ...selectStyle,
                            opacity: tenantPage >= totalTenantPages ? 0.5 : 1,
                            cursor:
                              tenantPage >= totalTenantPages
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          Proximo
                        </button>
                      </div>
                    </div>

                    {editingTenantId ? (
                      <div className="sm-tenant-edit-box">
                        <div className="sm-tenant-form-header">
                          <h4 className="sm-section-title">Editar personal</h4>
                          <button
                            type="button"
                            className="sm-tenant-btn sm-tenant-btn-neutral"
                            onClick={() => setEditingTenantId("")}
                          >
                            Cancelar
                          </button>
                        </div>
                        <div className="sm-tenant-form-grid">
                          <input
                            className="sm-input"
                            placeholder="Nome do negocio"
                            value={editTenantForm.businessName}
                            onChange={(e) =>
                              setEditTenantForm((prev) => ({
                                ...prev,
                                businessName: e.target.value,
                              }))
                            }
                          />
                          <input
                            className="sm-input"
                            placeholder="Email"
                            type="email"
                            value={editTenantForm.email}
                            onChange={(e) =>
                              setEditTenantForm((prev) => ({
                                ...prev,
                                email: e.target.value,
                              }))
                            }
                          />
                          <input
                            className="sm-input"
                            placeholder="Telefone"
                            value={editTenantForm.phone}
                            onChange={(e) =>
                              setEditTenantForm((prev) => ({
                                ...prev,
                                phone: e.target.value,
                              }))
                            }
                          />
                          <input
                            className="sm-input"
                            placeholder="Subdominio"
                            value={editTenantForm.subdomain}
                            onChange={(e) =>
                              setEditTenantForm((prev) => ({
                                ...prev,
                                subdomain: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="sm-tenant-form-actions">
                          <button
                            type="button"
                            className="sm-primary-btn"
                            disabled={updatingTenantId === editingTenantId}
                            onClick={() => handleUpdateTenant(editingTenantId)}
                          >
                            {updatingTenantId === editingTenantId
                              ? "Salvando..."
                              : "Salvar alteracoes"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            )}

            {/* ===== FATURAMENTO POR PERSONAL ===== */}
            {activeMenu === "billing" && (
              <>
                <section className="grid gap-4 sm:grid-cols-3">
                  <article className="sm-card">
                    <p className="text-xs uppercase tracking-[0.1em] text-[var(--sm-muted)] mb-2">
                      Total de Personais
                    </p>
                    <p className="text-2xl font-semibold">
                      {billingReport.length}
                    </p>
                    <p className="text-xs text-[var(--sm-accent)] mt-1">
                      Cadastrados na plataforma
                    </p>
                  </article>
                  <article className="sm-card">
                    <p className="text-xs uppercase tracking-[0.1em] text-[var(--sm-muted)] mb-2">
                      Total de Alunos
                    </p>
                    <p className="text-2xl font-semibold">
                      {billingTotals.totalAlunos}
                    </p>
                    <p className="text-xs text-[var(--sm-accent)] mt-1">
                      Soma de todos os personais
                    </p>
                  </article>
                  <article className="sm-card">
                    <p className="text-xs uppercase tracking-[0.1em] text-[var(--sm-muted)] mb-2">
                      MRR Total
                    </p>
                    <p className="text-2xl font-semibold">
                      {formatCurrencyBRL(billingTotals.mrrCents / 100)}
                    </p>
                    <p className="text-xs text-[var(--sm-accent)] mt-1">
                      Receita mensal recorrente
                    </p>
                  </article>
                </section>

                <section className="sm-card">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="sm-section-title">
                        Faturamento por Personal
                      </h3>
                      <p className="text-xs text-[var(--sm-muted)]">
                        Plano contratado, valor e quantidade de alunos — use
                        para cobranca individual.
                      </p>
                    </div>
                    <button
                      className="sm-primary-btn"
                      type="button"
                      onClick={loadBilling}
                    >
                      Atualizar
                    </button>
                  </div>

                  {loading ? (
                    <div className="sm-skeleton">Carregando faturamento...</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-[0.08em] text-[var(--sm-muted)]">
                            <th className="px-3 py-2">Personal</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Plano</th>
                            <th className="px-3 py-2">Ciclo</th>
                            <th className="px-3 py-2">Valor do Plano</th>
                            <th className="px-3 py-2">Alunos</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Assinante desde</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBilling.map((r) => (
                            <tr key={r.personalId} className="sm-table-row">
                              <td className="px-3 py-3 font-medium">
                                {r.businessName}
                              </td>
                              <td className="px-3 py-3 text-[var(--sm-muted)]">
                                {r.email}
                              </td>
                              <td className="px-3 py-3">
                                {r.planCode ? (
                                  <div>
                                    <span className="sm-tag">{r.planCode}</span>
                                    <p className="text-xs text-[var(--sm-muted)] mt-1">
                                      {r.planName}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-[var(--sm-muted)]">
                                    Sem plano
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-[var(--sm-muted)]">
                                {r.billingInterval === "MONTHLY"
                                  ? "Mensal"
                                  : r.billingInterval === "YEARLY"
                                    ? "Anual"
                                    : "-"}
                              </td>
                              <td className="px-3 py-3 font-semibold text-[var(--sm-accent)]">
                                {r.priceCents > 0 ? (
                                  formatCurrencyBRL(r.priceCents / 100)
                                ) : (
                                  <span className="text-[var(--sm-muted)]">
                                    -
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  style={{
                                    display: "inline-block",
                                    background: "rgba(255,174,56,0.1)",
                                    border: "1px solid rgba(255,174,56,0.3)",
                                    borderRadius: "999px",
                                    padding: "3px 10px",
                                    fontWeight: 600,
                                    fontSize: "0.82rem",
                                    color: "var(--sm-accent)",
                                  }}
                                >
                                  {r.totalAlunos}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`sm-status ${r.status === "ACTIVE" ? "sm-status-active" : "sm-status-inactive"}`}
                                >
                                  {mapStatus(r.status)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-[var(--sm-muted)]">
                                {r.subscriptionStartedAt
                                  ? new Date(
                                      r.subscriptionStartedAt,
                                    ).toLocaleDateString("pt-BR")
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                          {filteredBilling.length === 0 && (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-3 py-6 text-center text-[var(--sm-muted)]"
                              >
                                {loading
                                  ? "Carregando..."
                                  : "Nenhum registro encontrado"}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ===== PLANOS E ASSINATURAS ===== */}
            {activeMenu === "subscriptions" && (
              <section className="sm-card">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="sm-section-title">Catalogo de Planos</h3>
                    <p className="text-xs text-[var(--sm-muted)]">
                      Visao geral dos planos e quantidade de assinantes ativos
                      por plano.
                    </p>
                  </div>
                  <button
                    className="sm-primary-btn"
                    type="button"
                    onClick={loadPlans}
                  >
                    Atualizar
                  </button>
                </div>

                {loading ? (
                  <div className="sm-skeleton">Carregando planos...</div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
                      {plansSummary.map((plan) => (
                        <div
                          key={plan.id}
                          style={{
                            border: "1px solid var(--sm-border)",
                            borderRadius: "12px",
                            padding: "16px",
                            background: "var(--sm-card)",
                          }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-semibold text-base">
                                {plan.name}
                              </p>
                              <span
                                style={{
                                  display: "inline-block",
                                  background: "rgba(255,174,56,0.1)",
                                  border: "1px solid rgba(255,174,56,0.35)",
                                  borderRadius: "6px",
                                  padding: "2px 8px",
                                  fontSize: "0.72rem",
                                  color: "var(--sm-accent)",
                                  marginTop: "4px",
                                }}
                              >
                                {plan.code}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                padding: "3px 8px",
                                borderRadius: "999px",
                                border: `1px solid ${plan.isActive ? "rgba(255,174,56,0.4)" : "rgba(255,90,90,0.35)"}`,
                                color: plan.isActive
                                  ? "var(--sm-accent)"
                                  : "#ff9393",
                                background: plan.isActive
                                  ? "rgba(255,174,56,0.1)"
                                  : "rgba(255,90,90,0.1)",
                              }}
                            >
                              {plan.isActive ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-[var(--sm-accent)] mb-1">
                            {plan.priceCents > 0
                              ? formatCurrencyBRL(plan.priceCents / 100)
                              : "Gratis"}
                          </p>
                          <p className="text-xs text-[var(--sm-muted)] mb-4">
                            por{" "}
                            {plan.billingInterval === "YEARLY" ? "ano" : "mes"}
                          </p>
                          <div className="flex justify-between text-sm">
                            <div>
                              <p className="text-[var(--sm-muted)] text-xs">
                                Assinantes ativos
                              </p>
                              <p className="font-semibold text-lg">
                                {plan.activeSubscribers}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[var(--sm-muted)] text-xs">
                                MRR deste plano
                              </p>
                              <p className="font-semibold text-lg text-[var(--sm-accent)]">
                                {formatCurrencyBRL(
                                  plan.mrrContributionCents / 100,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {plansSummary.length === 0 && (
                        <div className="col-span-3 text-center text-[var(--sm-muted)] py-8">
                          Nenhum plano cadastrado ainda
                        </div>
                      )}
                    </div>

                    {plansSummary.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-[0.08em] text-[var(--sm-muted)]">
                              <th className="px-3 py-2">Codigo</th>
                              <th className="px-3 py-2">Nome</th>
                              <th className="px-3 py-2">Valor</th>
                              <th className="px-3 py-2">Ciclo</th>
                              <th className="px-3 py-2">Assinantes Ativos</th>
                              <th className="px-3 py-2">MRR</th>
                              <th className="px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plansSummary.map((plan) => (
                              <tr key={plan.id} className="sm-table-row">
                                <td className="px-3 py-3">
                                  <span className="sm-tag">{plan.code}</span>
                                </td>
                                <td className="px-3 py-3 font-medium">
                                  {plan.name}
                                </td>
                                <td className="px-3 py-3 font-semibold text-[var(--sm-accent)]">
                                  {plan.priceCents > 0
                                    ? formatCurrencyBRL(plan.priceCents / 100)
                                    : "Gratis"}
                                </td>
                                <td className="px-3 py-3 text-[var(--sm-muted)]">
                                  {plan.billingInterval === "YEARLY"
                                    ? "Anual"
                                    : "Mensal"}
                                </td>
                                <td className="px-3 py-3 font-semibold">
                                  {plan.activeSubscribers}
                                </td>
                                <td className="px-3 py-3 font-semibold text-[var(--sm-accent)]">
                                  {formatCurrencyBRL(
                                    plan.mrrContributionCents / 100,
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`sm-status ${plan.isActive ? "sm-status-active" : "sm-status-inactive"}`}
                                  >
                                    {plan.isActive ? "Ativo" : "Inativo"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* ===== OUTROS ===== */}
            {activeMenu !== "dashboard" &&
              activeMenu !== "tenants" &&
              activeMenu !== "billing" &&
              activeMenu !== "subscriptions" && (
                <section className="sm-card">
                  <h3 className="sm-section-title">Modulo em construcao</h3>
                  <p className="text-sm text-[var(--sm-muted)]">
                    A estrutura de navegacao esta pronta. Conecte esse modulo ao
                    backend na proxima etapa.
                  </p>
                </section>
              )}
          </main>
        </div>
      </div>
    </div>
  );
}
