import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const API_AUTH = "https://functions.poehali.dev/a107ed61-6e78-4be1-a0d4-8f1c8cb47f65";
const API_DRIVERS = "https://functions.poehali.dev/82ddde5e-b691-46bc-9ec9-f7e0c3ad15fd";
const API_MODS = "https://functions.poehali.dev/5802c95f-82d3-4d86-aaef-85301ecd0cc7";

type Role = "superadmin" | "admin" | "moderator";
type Tab = "drivers" | "moderators" | "audit";

interface User {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  permissions?: Record<string, boolean | number> | null;
}

interface Driver {
  id: number;
  full_name: string;
  phone: string;
  vehicle_class: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  status: string;
  is_online: boolean;
  commission_rate: number;
  commission_type: string;
  balance: number;
  total_rides: number;
  total_earned: number;
  total_commission: number;
  rating: number;
  created_at: string;
  controller_name: string | null;
}

interface Moderator {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  created_by_name: string | null;
  can_view_drivers: boolean;
  can_add_drivers: boolean;
  can_edit_drivers: boolean;
  can_block_drivers: boolean;
  can_view_commission: boolean;
  can_edit_commission: boolean;
  commission_rate_min: number;
  commission_rate_max: number;
  can_view_controllers: boolean;
  can_manage_controllers: boolean;
  can_view_transactions: boolean;
  can_export_reports: boolean;
  can_manage_moderators: boolean;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Ожидание", cls: "status-pending" },
  active:    { label: "Активен",  cls: "status-active" },
  suspended: { label: "Приостановлен", cls: "status-suspended" },
  blocked:   { label: "Заблокирован", cls: "status-blocked" },
};

const CLASS_MAP: Record<string, string> = {
  economy: "Эконом", comfort: "Комфорт", business: "Бизнес", minivan: "Минивэн",
};

export default function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem("admin_token") || "");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "admin@taxigo.ru", password: "" });

  const [tab, setTab] = useState<Tab>("drivers");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversTotal, setDriversTotal] = useState(0);
  const [driversPage, setDriversPage] = useState(1);
  const [driversSearch, setDriversSearch] = useState("");
  const [driversStatus, setDriversStatus] = useState("");
  const [driversLoading, setDriversLoading] = useState(false);

  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [modsLoading, setModsLoading] = useState(false);

  // Modals
  const [commissionModal, setCommissionModal] = useState<Driver | null>(null);
  const [commissionForm, setCommissionForm] = useState({ rate: 15, type: "percent", reason: "" });

  const [addModModal, setAddModModal] = useState(false);
  const [modForm, setModForm] = useState({
    full_name: "", email: "", password: "", role: "moderator" as Role,
    permissions: {
      can_view_drivers: true, can_add_drivers: false, can_edit_drivers: false, can_block_drivers: false,
      can_view_commission: true, can_edit_commission: false, commission_rate_min: 0, commission_rate_max: 100,
      can_view_controllers: false, can_manage_controllers: false,
      can_view_transactions: true, can_export_reports: false, can_manage_moderators: false,
    }
  });

  const [editPermsMod, setEditPermsMod] = useState<Moderator | null>(null);
  const [permsForm, setPermsForm] = useState<Record<string, boolean | number>>({});

  const authHeader = () => ({ "Content-Type": "application/json", "Authorization": `Bearer ${token}` });

  const checkToken = useCallback(async (t: string) => {
    const r = await fetch(`${API_AUTH}/me`, { headers: { "Authorization": `Bearer ${t}` } });
    if (r.ok) {
      const data = await r.json();
      setUser(data);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (token) checkToken(token).then(ok => { if (!ok) { setToken(""); localStorage.removeItem("admin_token"); } });
  }, []);

  const login = async () => {
    setAuthLoading(true); setAuthError("");
    const r = await fetch(`${API_AUTH}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm)
    });
    const data = await r.json();
    setAuthLoading(false);
    if (!r.ok) { setAuthError(data.error || "Ошибка входа"); return; }
    setToken(data.token);
    localStorage.setItem("admin_token", data.token);
    setUser({ id: data.user_id, full_name: data.full_name, email: loginForm.email, role: data.role });
  };

  const logout = async () => {
    await fetch(`${API_AUTH}/logout`, { method: "POST", headers: authHeader() });
    setToken(""); setUser(null); localStorage.removeItem("admin_token");
  };

  const loadDrivers = useCallback(async () => {
    if (!token) return;
    setDriversLoading(true);
    const qs = new URLSearchParams({ page: String(driversPage), search: driversSearch, status: driversStatus });
    const r = await fetch(`${API_DRIVERS}?${qs}`, { headers: authHeader() });
    if (r.ok) {
      const d = await r.json();
      setDrivers(d.drivers || []);
      setDriversTotal(d.total || 0);
    }
    setDriversLoading(false);
  }, [token, driversPage, driversSearch, driversStatus]);

  const loadModerators = useCallback(async () => {
    if (!token) return;
    setModsLoading(true);
    const r = await fetch(`${API_MODS}`, { headers: authHeader() });
    if (r.ok) { const d = await r.json(); setModerators(d.users || []); }
    setModsLoading(false);
  }, [token]);

  useEffect(() => { if (user && tab === "drivers") loadDrivers(); }, [user, tab, driversPage, driversSearch, driversStatus]);
  useEffect(() => { if (user && tab === "moderators") loadModerators(); }, [user, tab]);

  const updateCommission = async () => {
    if (!commissionModal) return;
    const r = await fetch(`${API_DRIVERS}/${commissionModal.id}/commission`, {
      method: "PUT", headers: authHeader(),
      body: JSON.stringify({ commission_rate: commissionForm.rate, commission_type: commissionForm.type, reason: commissionForm.reason })
    });
    if (r.ok) { setCommissionModal(null); loadDrivers(); }
  };

  const updateStatus = async (driverId: number, status: string) => {
    await fetch(`${API_DRIVERS}/${driverId}/status`, {
      method: "PUT", headers: authHeader(),
      body: JSON.stringify({ status })
    });
    loadDrivers();
  };

  const createModerator = async () => {
    const r = await fetch(`${API_MODS}`, {
      method: "POST", headers: authHeader(),
      body: JSON.stringify(modForm)
    });
    if (r.ok) { setAddModModal(false); loadModerators(); }
  };

  const savePermissions = async () => {
    if (!editPermsMod) return;
    await fetch(`${API_MODS}/${editPermsMod.id}/permissions`, {
      method: "PUT", headers: authHeader(),
      body: JSON.stringify({ permissions: permsForm })
    });
    setEditPermsMod(null);
    loadModerators();
  };

  const toggleMod = async (id: number) => {
    await fetch(`${API_MODS}/${id}/toggle`, { method: "PUT", headers: authHeader() });
    loadModerators();
  };

  const can = (perm: string) => {
    if (!user) return false;
    if (user.role === "superadmin" || user.role === "admin") return true;
    return !!(user.permissions?.[perm]);
  };

  // ─── LOGIN SCREEN ────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="admin-login-wrap">
        <div className="admin-login-card">
          <div className="admin-login-logo">
            <span className="logo-dot-lg" />
            <span className="admin-logo-text">TaxiGo</span>
            <span className="admin-logo-sub">Admin</span>
          </div>
          <h1 className="admin-login-title">Вход в панель</h1>
          <p className="admin-login-hint">Только авторизованным администраторам</p>

          {authError && <div className="admin-error-msg">{authError}</div>}

          <div className="admin-field">
            <label>Email</label>
            <input
              type="email"
              className="admin-input"
              value={loginForm.email}
              onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && login()}
            />
          </div>
          <div className="admin-field">
            <label>Пароль</label>
            <input
              type="password"
              className="admin-input"
              placeholder="••••••••"
              value={loginForm.password}
              onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && login()}
            />
          </div>
          <button className="admin-btn-primary" onClick={login} disabled={authLoading}>
            {authLoading ? "Вход…" : "Войти"}
          </button>
          <p className="admin-demo-hint">Demo: admin@taxigo.ru / Admin123!</p>
        </div>
      </div>
    );
  }

  // ─── MAIN PANEL ──────────────────────────────────────────────────────
  return (
    <div className="admin-root">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="logo-dot" />
          <span className="logo-text">TaxiGo</span>
          <span className="admin-badge">Admin</span>
        </div>

        <nav className="admin-nav">
          {can("can_view_drivers") && (
            <button className={`admin-nav-item ${tab === "drivers" ? "active" : ""}`} onClick={() => setTab("drivers")}>
              <Icon name="Car" size={18} />
              <span>Водители</span>
            </button>
          )}
          {can("can_manage_moderators") && (
            <button className={`admin-nav-item ${tab === "moderators" ? "active" : ""}`} onClick={() => setTab("moderators")}>
              <Icon name="Users" size={18} />
              <span>Модераторы</span>
            </button>
          )}
          <button className={`admin-nav-item ${tab === "audit" ? "active" : ""}`} onClick={() => setTab("audit")}>
            <Icon name="ScrollText" size={18} />
            <span>Аудит</span>
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="admin-user-avatar">{user.full_name.slice(0, 2).toUpperCase()}</div>
            <div>
              <p className="admin-user-name">{user.full_name}</p>
              <p className={`admin-role-badge role-${user.role}`}>
                {user.role === "superadmin" ? "Суперадмин" : user.role === "admin" ? "Администратор" : "Модератор"}
              </p>
            </div>
          </div>
          <button className="admin-logout-btn" onClick={logout}>
            <Icon name="LogOut" size={16} />
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="admin-content">

        {/* ── DRIVERS TAB ── */}
        {tab === "drivers" && (
          <div className="admin-section">
            <div className="admin-section-header">
              <div>
                <h2 className="admin-section-title">Водители</h2>
                <p className="admin-section-sub">{driversTotal} зарегистрировано</p>
              </div>
              {can("can_add_drivers") && (
                <button className="admin-btn-primary small">
                  <Icon name="Plus" size={16} /> Добавить
                </button>
              )}
            </div>

            <div className="admin-filters">
              <div className="admin-search-wrap">
                <Icon name="Search" size={15} className="admin-search-icon" />
                <input
                  className="admin-search"
                  placeholder="Поиск по имени, телефону, номеру…"
                  value={driversSearch}
                  onChange={e => { setDriversSearch(e.target.value); setDriversPage(1); }}
                />
              </div>
              <select className="admin-select" value={driversStatus} onChange={e => { setDriversStatus(e.target.value); setDriversPage(1); }}>
                <option value="">Все статусы</option>
                <option value="active">Активные</option>
                <option value="pending">Ожидание</option>
                <option value="suspended">Приостановленные</option>
                <option value="blocked">Заблокированные</option>
              </select>
            </div>

            {driversLoading ? (
              <div className="admin-loading">
                <div className="admin-spinner" />
                <span>Загрузка…</span>
              </div>
            ) : drivers.length === 0 ? (
              <div className="admin-empty">
                <Icon name="Car" size={40} className="text-white/20" />
                <p>Водители не найдены</p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Водитель</th>
                      <th>Авто</th>
                      <th>Статус</th>
                      <th>Комиссия</th>
                      <th>Поездок</th>
                      <th>Рейтинг</th>
                      {(can("can_edit_commission") || can("can_block_drivers")) && <th>Действия</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map(d => (
                      <tr key={d.id} className="admin-table-row">
                        <td>
                          <div className="driver-cell">
                            <div className="driver-avatar">{d.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                            <div>
                              <p className="driver-name">{d.full_name}</p>
                              <p className="driver-phone">{d.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="cell-main">{d.vehicle_make} {d.vehicle_model}</p>
                          <p className="cell-sub">{d.vehicle_plate} · {CLASS_MAP[d.vehicle_class] || d.vehicle_class}</p>
                        </td>
                        <td>
                          <span className={`status-pill ${STATUS_MAP[d.status]?.cls}`}>
                            {d.is_online && d.status === "active" && <span className="online-dot-sm" />}
                            {STATUS_MAP[d.status]?.label || d.status}
                          </span>
                        </td>
                        <td>
                          <p className="commission-val">{d.commission_rate}%</p>
                          <p className="cell-sub">{d.commission_type === "percent" ? "Процент" : d.commission_type === "fixed_per_ride" ? "Фикс./поездка" : "Смешанный"}</p>
                        </td>
                        <td>
                          <p className="cell-main">{d.total_rides}</p>
                          <p className="cell-sub">{d.total_earned?.toLocaleString("ru")} ₽</p>
                        </td>
                        <td>
                          <div className="rating-cell">
                            <Icon name="Star" size={13} className="text-taxi" />
                            <span>{d.rating}</span>
                          </div>
                        </td>
                        {(can("can_edit_commission") || can("can_block_drivers")) && (
                          <td>
                            <div className="action-btns">
                              {can("can_edit_commission") && (
                                <button className="action-btn edit" title="Изменить комиссию"
                                  onClick={() => { setCommissionModal(d); setCommissionForm({ rate: d.commission_rate, type: d.commission_type, reason: "" }); }}>
                                  <Icon name="Percent" size={14} />
                                </button>
                              )}
                              {can("can_block_drivers") && d.status === "active" && (
                                <button className="action-btn danger" title="Заблокировать" onClick={() => updateStatus(d.id, "blocked")}>
                                  <Icon name="Ban" size={14} />
                                </button>
                              )}
                              {can("can_block_drivers") && d.status === "blocked" && (
                                <button className="action-btn success" title="Активировать" onClick={() => updateStatus(d.id, "active")}>
                                  <Icon name="CheckCircle" size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {driversTotal > 20 && (
              <div className="admin-pagination">
                <button className="page-btn" disabled={driversPage === 1} onClick={() => setDriversPage(p => p - 1)}>
                  <Icon name="ChevronLeft" size={16} />
                </button>
                <span className="page-info">Стр. {driversPage} из {Math.ceil(driversTotal / 20)}</span>
                <button className="page-btn" disabled={driversPage >= Math.ceil(driversTotal / 20)} onClick={() => setDriversPage(p => p + 1)}>
                  <Icon name="ChevronRight" size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MODERATORS TAB ── */}
        {tab === "moderators" && (
          <div className="admin-section">
            <div className="admin-section-header">
              <div>
                <h2 className="admin-section-title">Администраторы и модераторы</h2>
                <p className="admin-section-sub">Управление доступом и правами</p>
              </div>
              <button className="admin-btn-primary small" onClick={() => setAddModModal(true)}>
                <Icon name="UserPlus" size={16} /> Добавить
              </button>
            </div>

            {modsLoading ? (
              <div className="admin-loading"><div className="admin-spinner" /><span>Загрузка…</span></div>
            ) : moderators.length === 0 ? (
              <div className="admin-empty"><Icon name="Users" size={40} className="text-white/20" /><p>Нет пользователей</p></div>
            ) : (
              <div className="mods-grid">
                {moderators.map(m => (
                  <div key={m.id} className={`mod-card ${!m.is_active ? "inactive" : ""}`}>
                    <div className="mod-card-header">
                      <div className="mod-avatar">{m.full_name.slice(0, 2).toUpperCase()}</div>
                      <div className="mod-info">
                        <p className="mod-name">{m.full_name}</p>
                        <p className="mod-email">{m.email}</p>
                        <span className={`admin-role-badge role-${m.role}`}>
                          {m.role === "admin" ? "Администратор" : "Модератор"}
                        </span>
                      </div>
                      <div className="mod-actions">
                        {m.role === "moderator" && (
                          <button className="action-btn edit" title="Права" onClick={() => {
                            setEditPermsMod(m);
                            setPermsForm({
                              can_view_drivers: m.can_view_drivers, can_add_drivers: m.can_add_drivers,
                              can_edit_drivers: m.can_edit_drivers, can_block_drivers: m.can_block_drivers,
                              can_view_commission: m.can_view_commission, can_edit_commission: m.can_edit_commission,
                              commission_rate_min: m.commission_rate_min, commission_rate_max: m.commission_rate_max,
                              can_view_controllers: m.can_view_controllers, can_manage_controllers: m.can_manage_controllers,
                              can_view_transactions: m.can_view_transactions, can_export_reports: m.can_export_reports,
                              can_manage_moderators: m.can_manage_moderators,
                            });
                          }}>
                            <Icon name="Settings" size={14} />
                          </button>
                        )}
                        <button className={`action-btn ${m.is_active ? "danger" : "success"}`} title={m.is_active ? "Деактивировать" : "Активировать"} onClick={() => toggleMod(m.id)}>
                          <Icon name={m.is_active ? "UserX" : "UserCheck"} size={14} />
                        </button>
                      </div>
                    </div>

                    {m.role === "moderator" && (
                      <div className="mod-perms">
                        {[
                          { key: "can_view_drivers", label: "Просмотр водителей" },
                          { key: "can_add_drivers", label: "Добавление водителей" },
                          { key: "can_edit_commission", label: "Изменение комиссий" },
                          { key: "can_block_drivers", label: "Блокировка водителей" },
                          { key: "can_manage_moderators", label: "Управление модераторами" },
                        ].map(({ key, label }) => (
                          <span key={key} className={`perm-tag ${m[key as keyof Moderator] ? "on" : "off"}`}>
                            <Icon name={m[key as keyof Moderator] ? "Check" : "X"} size={10} />
                            {label}
                          </span>
                        ))}
                        {m.can_edit_commission && (
                          <span className="perm-tag rate-range">
                            <Icon name="Percent" size={10} />
                            {m.commission_rate_min}%–{m.commission_rate_max}%
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mod-footer">
                      <span>Создан: {m.created_by_name || "Система"}</span>
                      <span>{m.last_login_at ? `Вход: ${new Date(m.last_login_at).toLocaleDateString("ru")}` : "Не входил"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AUDIT TAB ── */}
        {tab === "audit" && (
          <div className="admin-section">
            <div className="admin-section-header">
              <div>
                <h2 className="admin-section-title">Журнал действий</h2>
                <p className="admin-section-sub">История изменений в системе</p>
              </div>
            </div>
            <div className="admin-empty">
              <Icon name="ScrollText" size={40} className="text-white/20" />
              <p>Журнал будет доступен после первых действий в системе</p>
            </div>
          </div>
        )}
      </main>

      {/* ── COMMISSION MODAL ── */}
      {commissionModal && (
        <div className="modal-overlay" onClick={() => setCommissionModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Изменить комиссию</h3>
              <button className="modal-close" onClick={() => setCommissionModal(null)}><Icon name="X" size={18} /></button>
            </div>
            <p className="modal-sub">{commissionModal.full_name}</p>

            <div className="admin-field">
              <label>Тип комиссии</label>
              <select className="admin-input" value={commissionForm.type} onChange={e => setCommissionForm(f => ({ ...f, type: e.target.value }))}>
                <option value="percent">Процент от поездки</option>
                <option value="fixed_per_ride">Фиксированная за поездку</option>
                <option value="mixed">Смешанная</option>
              </select>
            </div>

            <div className="admin-field">
              <label>Ставка (%)</label>
              <div className="rate-input-wrap">
                <input
                  type="number"
                  className="admin-input"
                  min={0} max={100} step={0.5}
                  value={commissionForm.rate}
                  onChange={e => setCommissionForm(f => ({ ...f, rate: +e.target.value }))}
                />
                <span className="rate-badge">{commissionForm.rate}%</span>
              </div>
              <input type="range" className="range-slider mt-2" min={0} max={100} step={0.5}
                value={commissionForm.rate}
                onChange={e => setCommissionForm(f => ({ ...f, rate: +e.target.value }))}
              />
              {user.role === "moderator" && user.permissions && (
                <p className="rate-hint">Допустимо: {user.permissions.commission_rate_min}% – {user.permissions.commission_rate_max}%</p>
              )}
            </div>

            <div className="admin-field">
              <label>Причина изменения</label>
              <input className="admin-input" placeholder="Необязательно" value={commissionForm.reason}
                onChange={e => setCommissionForm(f => ({ ...f, reason: e.target.value }))} />
            </div>

            <div className="modal-footer">
              <button className="admin-btn-secondary" onClick={() => setCommissionModal(null)}>Отмена</button>
              <button className="admin-btn-primary" onClick={updateCommission}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MODERATOR MODAL ── */}
      {addModModal && (
        <div className="modal-overlay" onClick={() => setAddModModal(false)}>
          <div className="modal-card wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Добавить пользователя</h3>
              <button className="modal-close" onClick={() => setAddModModal(false)}><Icon name="X" size={18} /></button>
            </div>

            <div className="modal-two-col">
              <div className="admin-field">
                <label>Имя</label>
                <input className="admin-input" placeholder="Иван Иванов" value={modForm.full_name}
                  onChange={e => setModForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="admin-field">
                <label>Email</label>
                <input className="admin-input" type="email" placeholder="user@mail.ru" value={modForm.email}
                  onChange={e => setModForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="admin-field">
                <label>Пароль</label>
                <input className="admin-input" type="password" value={modForm.password}
                  onChange={e => setModForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="admin-field">
                <label>Роль</label>
                <select className="admin-input" value={modForm.role}
                  onChange={e => setModForm(f => ({ ...f, role: e.target.value as Role }))}>
                  <option value="moderator">Модератор</option>
                  {(user.role === "superadmin" || user.role === "admin") && <option value="admin">Администратор</option>}
                  {user.role === "superadmin" && <option value="superadmin">Суперадмин</option>}
                </select>
              </div>
            </div>

            {modForm.role === "moderator" && (
              <div className="perms-editor">
                <p className="perms-title">Права доступа</p>
                <div className="perms-grid">
                  {[
                    { key: "can_view_drivers", label: "Просмотр водителей" },
                    { key: "can_add_drivers", label: "Добавление водителей" },
                    { key: "can_edit_drivers", label: "Редактирование водителей" },
                    { key: "can_block_drivers", label: "Блокировка водителей" },
                    { key: "can_view_commission", label: "Просмотр комиссий" },
                    { key: "can_edit_commission", label: "Изменение комиссий" },
                    { key: "can_view_controllers", label: "Просмотр контролёров" },
                    { key: "can_manage_controllers", label: "Управление контролёрами" },
                    { key: "can_view_transactions", label: "Просмотр транзакций" },
                    { key: "can_export_reports", label: "Экспорт отчётов" },
                    { key: "can_manage_moderators", label: "Управление модераторами" },
                  ].map(({ key, label }) => (
                    <label key={key} className="perm-toggle">
                      <input type="checkbox" checked={!!modForm.permissions[key as keyof typeof modForm.permissions]}
                        onChange={e => setModForm(f => ({ ...f, permissions: { ...f.permissions, [key]: e.target.checked } }))} />
                      <span className="perm-toggle-label">{label}</span>
                    </label>
                  ))}
                </div>
                {modForm.permissions.can_edit_commission && (
                  <div className="commission-range-editor">
                    <div className="admin-field">
                      <label>Мин. ставка (%)</label>
                      <input type="number" className="admin-input" min={0} max={100}
                        value={modForm.permissions.commission_rate_min as number}
                        onChange={e => setModForm(f => ({ ...f, permissions: { ...f.permissions, commission_rate_min: +e.target.value } }))} />
                    </div>
                    <div className="admin-field">
                      <label>Макс. ставка (%)</label>
                      <input type="number" className="admin-input" min={0} max={100}
                        value={modForm.permissions.commission_rate_max as number}
                        onChange={e => setModForm(f => ({ ...f, permissions: { ...f.permissions, commission_rate_max: +e.target.value } }))} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="modal-footer">
              <button className="admin-btn-secondary" onClick={() => setAddModModal(false)}>Отмена</button>
              <button className="admin-btn-primary" onClick={createModerator}>Создать</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PERMISSIONS MODAL ── */}
      {editPermsMod && (
        <div className="modal-overlay" onClick={() => setEditPermsMod(null)}>
          <div className="modal-card wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Права: {editPermsMod.full_name}</h3>
              <button className="modal-close" onClick={() => setEditPermsMod(null)}><Icon name="X" size={18} /></button>
            </div>

            <div className="perms-editor">
              <div className="perms-grid">
                {[
                  { key: "can_view_drivers", label: "Просмотр водителей" },
                  { key: "can_add_drivers", label: "Добавление водителей" },
                  { key: "can_edit_drivers", label: "Редактирование водителей" },
                  { key: "can_block_drivers", label: "Блокировка водителей" },
                  { key: "can_view_commission", label: "Просмотр комиссий" },
                  { key: "can_edit_commission", label: "Изменение комиссий" },
                  { key: "can_view_controllers", label: "Просмотр контролёров" },
                  { key: "can_manage_controllers", label: "Управление контролёрами" },
                  { key: "can_view_transactions", label: "Просмотр транзакций" },
                  { key: "can_export_reports", label: "Экспорт отчётов" },
                  { key: "can_manage_moderators", label: "Управление модераторами" },
                ].map(({ key, label }) => (
                  <label key={key} className="perm-toggle">
                    <input type="checkbox" checked={!!permsForm[key]}
                      onChange={e => setPermsForm(f => ({ ...f, [key]: e.target.checked }))} />
                    <span className="perm-toggle-label">{label}</span>
                  </label>
                ))}
              </div>
              {permsForm.can_edit_commission && (
                <div className="commission-range-editor">
                  <div className="admin-field">
                    <label>Мин. ставка (%)</label>
                    <input type="number" className="admin-input" min={0} max={100}
                      value={permsForm.commission_rate_min as number}
                      onChange={e => setPermsForm(f => ({ ...f, commission_rate_min: +e.target.value }))} />
                  </div>
                  <div className="admin-field">
                    <label>Макс. ставка (%)</label>
                    <input type="number" className="admin-input" min={0} max={100}
                      value={permsForm.commission_rate_max as number}
                      onChange={e => setPermsForm(f => ({ ...f, commission_rate_max: +e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="admin-btn-secondary" onClick={() => setEditPermsMod(null)}>Отмена</button>
              <button className="admin-btn-primary" onClick={savePermissions}>Сохранить права</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
