import { useState, useEffect, useRef } from "react";

const DEFAULT_RADIUS = 25;
const ADMIN_PASSWORD = "Eureka";
const STORAGE_KEY_EMPLOYEES = "punchcard_employees";
const STORAGE_KEY_LOG = "punchcard_log";
const STORAGE_KEY_FENCE = "punchcard_fence";

const DEFAULT_EMPLOYEES = [
  { id: 1, name: "Maria Santos", role: "Barista", avatar: "MS" },
  { id: 2, name: "James Okafor", role: "Cashier", avatar: "JO" },
  { id: 3, name: "Priya Nair", role: "Supervisor", avatar: "PN" },
  { id: 4, name: "Leo Brandt", role: "Cook", avatar: "LB" },
  { id: 5, name: "Aisha Cole", role: "Barista", avatar: "AC" },
];

function makeAvatar(name) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatDuration(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function formatShortDuration(ms) {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function GeoRadar({ status }) {
  const color = status === "inside" ? "#4ade80" : status === "outside" ? "#f87171" : status === "loading" ? "#facc15" : "#6b7280";
  return (
    <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
      {(status === "inside" || status === "loading") && (
        <><div style={{ ...S.pulse, borderColor: color, animationDelay: "0s" }} /><div style={{ ...S.pulse, borderColor: color, animationDelay: "0.6s" }} /></>
      )}
      <div style={{ ...S.radarDot, background: color }} />
    </div>
  );
}

// ─── Admin Panel ────────────────────────────────────────────────────────────
function AdminPanel({ employees, log, fence, onUpdateEmployees, onClearLog, onClose, onEditFence }) {
  const [view, setView] = useState("employees"); // employees | log | settings
  const [showAdd, setShowAdd] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const emp = { id: Date.now(), name: newName.trim(), role: newRole.trim() || "Staff", avatar: makeAvatar(newName) };
    onUpdateEmployees([...employees, emp]);
    setNewName(""); setNewRole(""); setShowAdd(false);
  };

  const handleEditSave = () => {
    if (!editEmp.name.trim()) return;
    onUpdateEmployees(employees.map((e) => e.id === editEmp.id ? { ...editEmp, avatar: makeAvatar(editEmp.name) } : e));
    setEditEmp(null);
  };

  const handleDelete = (id) => {
    onUpdateEmployees(employees.filter((e) => e.id !== id));
    setConfirmDelete(null);
  };

  // Group log by employee
  const logByEmp = {};
  log.forEach((entry) => {
    const key = entry.employee.id;
    if (!logByEmp[key]) logByEmp[key] = { employee: entry.employee, shifts: [], total: 0 };
    logByEmp[key].shifts.push(entry);
    logByEmp[key].total += entry.duration;
  });

  return (
    <div style={S.adminOverlay}>
      <div style={S.adminPanel}>
        {/* Header */}
        <div style={S.adminHeader}>
          <div style={S.adminTitle}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <span>Admin</span>
          </div>
          <button style={S.adminClose} onClick={onClose}>✕ Exit Admin</button>
        </div>

        {/* Nav */}
        <div style={S.adminNav}>
          {[["employees","👥 Employees"], ["log","📋 Shift Log"], ["settings","🔧 Settings"]].map(([v, label]) => (
            <button key={v} style={{ ...S.adminNavBtn, ...(view === v ? S.adminNavActive : {}) }} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>

        <div style={S.adminBody}>
          {/* ── Employees ── */}
          {view === "employees" && (
            <div>
              <div style={S.adminSectionHeader}>
                <span style={S.adminSectionTitle}>Team ({employees.length})</span>
                <button style={S.addBtn} onClick={() => setShowAdd(true)}>+ Add Employee</button>
              </div>

              {showAdd && (
                <div style={S.addForm}>
                  <div style={S.addFormTitle}>New Employee</div>
                  <input placeholder="Full name *" value={newName} onChange={(e) => setNewName(e.target.value)} style={S.input} />
                  <input placeholder="Role (e.g. Barista)" value={newRole} onChange={(e) => setNewRole(e.target.value)} style={S.input} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...S.formBtn, ...S.formBtnPrimary }} onClick={handleAdd}>Add</button>
                    <button style={S.formBtn} onClick={() => { setShowAdd(false); setNewName(""); setNewRole(""); }}>Cancel</button>
                  </div>
                </div>
              )}

              <div style={S.empList}>
                {employees.map((emp) => (
                  <div key={emp.id} style={S.empRow}>
                    {editEmp?.id === emp.id ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        <input value={editEmp.name} onChange={(e) => setEditEmp({ ...editEmp, name: e.target.value })} style={S.input} placeholder="Full name" />
                        <input value={editEmp.role} onChange={(e) => setEditEmp({ ...editEmp, role: e.target.value })} style={S.input} placeholder="Role" />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={{ ...S.formBtn, ...S.formBtnPrimary }} onClick={handleEditSave}>Save</button>
                          <button style={S.formBtn} onClick={() => setEditEmp(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={S.empRowAvatar}>{emp.avatar}</div>
                        <div style={{ flex: 1 }}>
                          <div style={S.empRowName}>{emp.name}</div>
                          <div style={S.empRowRole}>{emp.role}</div>
                        </div>
                        <button style={S.iconBtn} onClick={() => setEditEmp({ ...emp })} title="Edit">✏️</button>
                        <button style={{ ...S.iconBtn, color: "#f87171" }} onClick={() => setConfirmDelete(emp)} title="Remove">🗑</button>
                      </>
                    )}
                  </div>
                ))}
                {employees.length === 0 && <div style={S.emptyMsg}>No employees yet. Add one above.</div>}
              </div>

              {confirmDelete && (
                <div style={S.confirmBox}>
                  <div style={S.confirmMsg}>Remove <strong style={{ color: "#fff" }}>{confirmDelete.name}</strong>? This cannot be undone.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...S.formBtn, background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }} onClick={() => handleDelete(confirmDelete.id)}>Remove</button>
                    <button style={S.formBtn} onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Shift Log ── */}
          {view === "log" && (
            <div>
              <div style={S.adminSectionHeader}>
                <span style={S.adminSectionTitle}>Shift History ({log.length} shifts)</span>
                {log.length > 0 && <button style={{ ...S.addBtn, background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }} onClick={() => setConfirmClear(true)}>Clear All</button>}
              </div>

              {confirmClear && (
                <div style={S.confirmBox}>
                  <div style={S.confirmMsg}>Clear all shift history? This cannot be undone.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...S.formBtn, background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }} onClick={() => { onClearLog(); setConfirmClear(false); }}>Clear</button>
                    <button style={S.formBtn} onClick={() => setConfirmClear(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {log.length === 0 ? (
                <div style={S.emptyMsg}>No shifts recorded yet.</div>
              ) : (
                <>
                  {/* Summary cards */}
                  <div style={S.summaryGrid}>
                    {Object.values(logByEmp).map(({ employee, shifts, total }) => (
                      <div key={employee.id} style={S.summaryCard}>
                        <div style={S.summaryAvatar}>{employee.avatar}</div>
                        <div>
                          <div style={S.summaryName}>{employee.name}</div>
                          <div style={S.summaryStats}>{shifts.length} shift{shifts.length !== 1 ? "s" : ""} · {formatShortDuration(total)} total</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Full table */}
                  <div style={S.logTableWrap}>
                    <table style={S.table}>
                      <thead>
                        <tr>{["Employee", "Role", "Clock In", "Clock Out", "Duration"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {log.map((entry) => (
                          <tr key={entry.id} style={S.tr}>
                            <td style={S.td}><div style={S.logEmpCell}><div style={S.logAvatar}>{entry.employee.avatar}</div><span>{entry.employee.name}</span></div></td>
                            <td style={{ ...S.td, color: "#6b7280", fontSize: 13 }}>{entry.employee.role}</td>
                            <td style={S.td}>{formatTime(new Date(entry.clockIn))}</td>
                            <td style={S.td}>{formatTime(new Date(entry.clockOut))}</td>
                            <td style={{ ...S.td, color: "#a5b4fc", fontWeight: 600 }}>{formatShortDuration(entry.duration)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Settings ── */}
          {view === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={S.settingsCard}>
                <div style={S.settingsLabel}>Admin Password</div>
                <div style={S.settingsValue}>Change in code: <code style={{ color: "#a5b4fc" }}>ADMIN_PASSWORD</code></div>
                <div style={S.settingsHint}>Currently set to "{ADMIN_PASSWORD}". Update before deploying.</div>
              </div>
              <div style={S.settingsCard}>
                <div style={S.settingsLabel}>Geofence</div>
                <div style={S.settingsValue}>{fence ? `Set · radius ${fence.radius}m` : "Not configured"}</div>
                <div style={S.settingsHint}>Controls where employees are allowed to clock in.</div>
                <button style={{ ...S.formBtn, ...S.formBtnPrimary, marginTop: 10 }} onClick={onEditFence}>
                  📍 {fence ? "Edit Work Location" : "Set Work Location"}
                </button>
                </div>
              <div style={S.settingsCard}>
                <div style={S.settingsLabel}>Data Storage</div>
                <div style={S.settingsValue}>Browser localStorage</div>
                <div style={S.settingsHint}>Employees and shift history persist on this device. Clearing browser data will erase them.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Login ─────────────────────────────────────────────────────────────
function AdminLogin({ onSuccess, onCancel }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const handleSubmit = () => {
    if (pw === ADMIN_PASSWORD) { onSuccess(); }
    else { setError(true); setPw(""); setTimeout(() => setError(false), 1500); }
  };
  return (
    <div style={S.modalOverlay} onClick={onCancel}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalIcon}>🔐</div>
        <div style={S.modalTitle}>Admin Access</div>
        <div style={S.modalMsg}>Enter the admin password to continue.</div>
        <input
          type="password" placeholder="Password" value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          style={{ ...S.input, width: "100%", boxSizing: "border-box", ...(error ? { borderColor: "#f87171" } : {}) }}
          autoFocus
        />
        {error && <div style={{ fontSize: 12, color: "#f87171" }}>Incorrect password</div>}
        <button style={{ ...S.modalBtn, ...S.modalBtnPrimary, marginTop: 4 }} onClick={handleSubmit}>Enter</button>
        <button style={S.modalBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [now, setNow] = useState(new Date());
  const [employees, setEmployees] = useState(() => load(STORAGE_KEY_EMPLOYEES, DEFAULT_EMPLOYEES));
  const [sessions, setSessions] = useState({});
  const [log, setLog] = useState(() => load(STORAGE_KEY_LOG, []));
  const [activeTab, setActiveTab] = useState("clock");
  const [flash, setFlash] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const [fence, setFence] = useState(() => load(STORAGE_KEY_FENCE, null));
  const [userPos, setUserPos] = useState(null);
  const [geoStatus, setGeoStatus] = useState("unknown");
  const [geoError, setGeoError] = useState(null);
  const [showFenceSetup, setShowFenceSetup] = useState(false);
  const [radiusInput, setRadiusInput] = useState(DEFAULT_RADIUS);
  const [blockModal, setBlockModal] = useState(null);
  const watchRef = useRef(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { save(STORAGE_KEY_EMPLOYEES, employees); }, [employees]);
  useEffect(() => { save(STORAGE_KEY_LOG, log); }, [log]);
  useEffect(() => { save(STORAGE_KEY_FENCE, fence); }, [fence]);

  useEffect(() => {
    if (!fence) return;
    setGeoStatus("loading");
    if (!navigator.geolocation) { setGeoStatus("error"); setGeoError("Geolocation not supported."); return; }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        setUserPos({ lat, lon, accuracy }); setGeoError(null);
        setGeoStatus(getDistance(lat, lon, fence.lat, fence.lon) <= fence.radius ? "inside" : "outside");
      },
      (err) => {
        if (err.code === 1) { setGeoStatus("denied"); setGeoError("Location permission denied."); }
        else { setGeoStatus("error"); setGeoError("Unable to get location."); }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, [fence]);

  const setFenceToCurrentLocation = () => {
    if (!navigator.geolocation) { setGeoError("Geolocation not supported."); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setFence({ lat: pos.coords.latitude, lon: pos.coords.longitude, radius: Number(radiusInput) }); setShowFenceSetup(false); setGeoError(null); },
      (err) => { setGeoStatus("error"); setGeoError(err.code === 1 ? "Permission denied." : "Could not get location."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const isClockedIn = (id) => !!sessions[id];

  const handleClock = (employee) => {
    const id = employee.id;
    if (!isClockedIn(id)) {
      if (fence) {
        if (geoStatus === "outside") { setBlockModal(employee); return; }
        if (geoStatus === "denied" || geoStatus === "error") { setBlockModal({ ...employee, geoError: geoError || "Location unavailable." }); return; }
        if (geoStatus === "loading" || geoStatus === "unknown") { setBlockModal({ ...employee, geoError: "Waiting for location. Please try again." }); return; }
      }
      setSessions((prev) => ({ ...prev, [id]: { clockIn: new Date() } }));
      setFlash({ id, type: "in" });
    } else {
      const clockIn = sessions[id].clockIn;
      const clockOut = new Date();
      setLog((prev) => [{ id: Date.now(), employee, clockIn: clockIn.toISOString(), clockOut: clockOut.toISOString(), duration: clockOut - clockIn }, ...prev]);
      setSessions((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setFlash({ id, type: "out" });
    }
    setTimeout(() => setFlash(null), 1200);
  };

  const clockedInCount = Object.keys(sessions).length;
  const distanceToFence = fence && userPos ? Math.round(getDistance(userPos.lat, userPos.lon, fence.lat, fence.lon)) : null;

  return (
    <div style={S.root}>
      <div style={S.bg} />

      {showAdminLogin && <AdminLogin onSuccess={() => { setShowAdminLogin(false); setShowAdmin(true); }} onCancel={() => setShowAdminLogin(false)} />}
      {showAdmin && <AdminPanel employees={employees} log={log} fence={fence} onUpdateEmployees={setEmployees} onClearLog={() => setLog([])} onClose={() => setShowAdmin(false)} onEditFence={() => { setShowAdmin(false); setShowFenceSetup(true); }} />}

      {blockModal && (
        <div style={S.modalOverlay} onClick={() => setBlockModal(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalIcon}>🚫</div>
            <div style={S.modalTitle}>Clock-In Blocked</div>
            <div style={S.modalName}>{blockModal.name}</div>
            <div style={S.modalMsg}>{blockModal.geoError ? blockModal.geoError : `You are ${distanceToFence !== null ? `${distanceToFence}m` : "too far"} from the work location. You must be within ${fence?.radius}m to clock in.`}</div>
            <button style={S.modalBtn} onClick={() => setBlockModal(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {showFenceSetup && (
        <div style={S.modalOverlay} onClick={() => setShowFenceSetup(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalIcon}>📍</div>
            <div style={S.modalTitle}>Set Work Location</div>
            <div style={S.modalMsg}>Stand at your business location, then tap below.</div>
            <div style={S.radiusRow}>
              <label style={S.radiusLabel}>Allowed radius</label>
              <div style={S.radiusInputWrap}>
                <input type="number" min={10} max={5000} value={radiusInput} onChange={(e) => setRadiusInput(e.target.value)} style={S.radiusInput} />
                <span style={S.radiusUnit}>meters</span>
              </div>
            </div>
            {geoError && <div style={S.geoErrMsg}>{geoError}</div>}
            <button style={{ ...S.modalBtn, ...S.modalBtnPrimary }} onClick={setFenceToCurrentLocation}>📡 Use My Current Location</button>
            {fence && <button style={{ ...S.modalBtn, marginTop: 8, background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }} onClick={() => { setFence(null); setGeoStatus("unknown"); setShowFenceSetup(false); }}>Remove Geofence</button>}
          </div>
        </div>
      )}

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logo}><span style={{ fontSize: 24 }}>⏱</span><span style={S.logoText}>PunchCard</span></div>
          <div style={S.badge}><span style={{ ...S.dot, background: clockedInCount > 0 ? "#4ade80" : "#6b7280" }} />{clockedInCount} clocked in</div>
        </div>
        <div style={S.headerRight}>
          <button style={S.adminBtn} onClick={() => setShowAdminLogin(true)}>⚙ Admin</button>
          <div style={S.clock}>
            <div style={S.clockTime}>{formatTime(now)}</div>
            <div style={S.clockDate}>{formatDate(now)}</div>
          </div>
        </div>
      </header>

      {/* Geo Bar */}
      <div style={S.geoBar}>
        <div style={S.geoBarLeft}>
          <GeoRadar status={fence ? geoStatus : "unknown"} />
          <div style={{ fontSize: 13 }}>
            {!fence ? <span style={{ color: "#9ca3af" }}>Geofencing <span style={{ color: "#4b5563", fontStyle: "italic" }}>OFF</span></span>
              : geoStatus === "loading" ? <span style={{ color: "#9ca3af" }}>Acquiring location…</span>
              : geoStatus === "inside" ? <span style={{ color: "#9ca3af" }}><span style={{ color: "#4ade80" }}>Within work zone</span>{distanceToFence !== null && <span style={{ color: "#6b7280", fontSize: 12 }}> · {distanceToFence}m from center</span>}</span>
              : geoStatus === "outside" ? <span style={{ color: "#9ca3af" }}><span style={{ color: "#f87171" }}>Outside work zone</span>{distanceToFence !== null && <span style={{ color: "#6b7280", fontSize: 12 }}> · {distanceToFence}m away</span>}</span>
              : <span style={{ color: "#f87171" }}>Location {geoStatus}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {["clock", "log"].map((tab) => (
          <button key={tab} style={{ ...S.tab, ...(activeTab === tab ? S.tabActive : {}) }} onClick={() => setActiveTab(tab)}>
            {tab === "clock" ? "Time Clock" : `Shift Log ${log.length > 0 ? `(${log.length})` : ""}`}
          </button>
        ))}
      </div>

      <main style={S.main}>
        {activeTab === "clock" ? (
          <div style={S.grid}>
            {employees.map((emp) => {
              const clocked = isClockedIn(emp.id);
              const session = sessions[emp.id];
              const elapsed = session ? now - session.clockIn : null;
              const isFlashing = flash?.id === emp.id;
              const blocked = !clocked && fence && (geoStatus === "outside" || geoStatus === "denied" || geoStatus === "error");
              return (
                <div key={emp.id} style={{ ...S.card, ...(clocked ? S.cardActive : {}), ...(isFlashing ? (flash.type === "in" ? S.cardFlashIn : S.cardFlashOut) : {}) }}>
                  <div style={S.cardTop}>
                    <div style={{ ...S.avatar, ...(clocked ? S.avatarActive : {}) }}>{emp.avatar}</div>
                    <div style={S.empInfo}>
                      <div style={S.empName}>{emp.name}</div>
                      <div style={S.empRole}>{emp.role}</div>
                    </div>
                    <div style={{ ...S.statusPill, ...(clocked ? S.statusIn : S.statusOut) }}>{clocked ? "IN" : "OUT"}</div>
                  </div>
                  {clocked && elapsed !== null && (
                    <div style={S.elapsed}>
                      <span style={S.elapsedLabel}>Shift time</span>
                      <span style={S.elapsedTime}>{formatDuration(elapsed)}</span>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>since {formatTime(session.clockIn)}</span>
                    </div>
                  )}
                  {blocked && <div style={S.geoBlock}><span>🔒</span><span style={{ fontSize: 12, color: "#f87171" }}>{geoStatus === "outside" ? `${distanceToFence !== null ? `${distanceToFence}m away` : "Out of range"}` : "Location unavailable"}</span></div>}
                  <button style={{ ...S.btn, ...(clocked ? S.btnOut : blocked ? S.btnBlocked : S.btnIn) }} onClick={() => handleClock(emp)}>
                    {clocked ? "Clock Out" : blocked ? "Cannot Clock In" : "Clock In"}
                  </button>
                </div>
              );
            })}
            {employees.length === 0 && (
              <div style={{ ...S.card, textAlign: "center", padding: "40px 20px", gridColumn: "1/-1" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
                <div style={{ color: "#4b5563", fontWeight: 600 }}>No employees yet</div>
                <div style={{ color: "#374151", fontSize: 13, marginTop: 6 }}>Go to Admin → Employees to add your team</div>
              </div>
            )}
          </div>
        ) : (
          <div style={S.logWrapper}>
            {log.length === 0 ? (
              <div style={S.emptyLog}><div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>📋</div><div style={{ fontSize: 16, fontWeight: 600, color: "#4b5563" }}>No completed shifts yet</div></div>
            ) : (
              <table style={S.table}>
                <thead><tr>{["Employee","Role","Clock In","Clock Out","Duration"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {log.map((entry) => (
                    <tr key={entry.id} style={S.tr}>
                      <td style={S.td}><div style={S.logEmpCell}><div style={S.logAvatar}>{entry.employee.avatar}</div><span>{entry.employee.name}</span></div></td>
                      <td style={{ ...S.td, color: "#6b7280", fontSize: 13 }}>{entry.employee.role}</td>
                      <td style={S.td}>{formatTime(new Date(entry.clockIn))}</td>
                      <td style={S.td}>{formatTime(new Date(entry.clockOut))}</td>
                      <td style={{ ...S.td, color: "#a5b4fc", fontWeight: 600 }}>{formatShortDuration(entry.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes radarPulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(2.8); opacity: 0; } }
      `}</style>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0f1117", color: "#e8e8e8", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", position: "relative", overflow: "hidden" },
  bg: { position: "fixed", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(16,185,129,0.1) 0%, transparent 55%)", pointerEvents: "none", zIndex: 0 },

  // Admin overlay
  adminOverlay: { position: "fixed", inset: 0, background: "#0c0e14", zIndex: 150, display: "flex", flexDirection: "column", overflow: "hidden" },
  adminPanel: { display: "flex", flexDirection: "column", height: "100%", maxWidth: 860, margin: "0 auto", width: "100%" },
  adminHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  adminTitle: { display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 700, color: "#fff" },
  adminClose: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 8, cursor: "pointer" },
  adminNav: { display: "flex", gap: 4, padding: "16px 28px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  adminNavBtn: { background: "transparent", border: "none", color: "#6b7280", fontSize: 14, fontWeight: 500, padding: "8px 16px", borderRadius: "8px 8px 0 0", cursor: "pointer", borderBottom: "2px solid transparent" },
  adminNavActive: { color: "#fff", borderBottom: "2px solid #6366f1", background: "rgba(99,102,241,0.08)" },
  adminBody: { flex: 1, overflow: "auto", padding: "24px 28px" },
  adminSectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  adminSectionTitle: { fontSize: 15, fontWeight: 600, color: "#e8e8e8" },
  addBtn: { background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer" },
  addForm: { background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "16px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 },
  addFormTitle: { fontSize: 13, fontWeight: 600, color: "#a5b4fc" },
  input: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 14, outline: "none" },
  formBtn: { padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "#e8e8e8", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  formBtnPrimary: { background: "linear-gradient(135deg, #6366f1, #4f46e5)", border: "none", color: "#fff" },
  empList: { display: "flex", flexDirection: "column", gap: 8 },
  empRow: { display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px 16px" },
  empRowAvatar: { width: 38, height: 38, borderRadius: 10, background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#a5b4fc", flexShrink: 0 },
  empRowName: { fontSize: 14, fontWeight: 600, color: "#e8e8e8" },
  empRowRole: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  iconBtn: { background: "transparent", border: "none", fontSize: 16, cursor: "pointer", padding: "4px", opacity: 0.7 },
  confirmBox: { background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 12, padding: "16px", marginTop: 12, display: "flex", flexDirection: "column", gap: 12 },
  confirmMsg: { fontSize: 13, color: "#9ca3af" },
  emptyMsg: { fontSize: 14, color: "#4b5563", textAlign: "center", padding: "32px 0" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 20 },
  summaryCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px", display: "flex", alignItems: "center", gap: 12 },
  summaryAvatar: { width: 36, height: 36, borderRadius: 9, background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#a5b4fc", flexShrink: 0 },
  summaryName: { fontSize: 13, fontWeight: 600, color: "#e8e8e8" },
  summaryStats: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  logTableWrap: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" },
  settingsCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" },
  settingsLabel: { fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 },
  settingsValue: { fontSize: 14, color: "#e8e8e8", fontWeight: 500 },
  settingsHint: { fontSize: 12, color: "#6b7280", marginTop: 6 },

  // Modals
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" },
  modal: { background: "#161820", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "32px 28px", maxWidth: 360, width: "90%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" },
  modalIcon: { fontSize: 40 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#fff" },
  modalName: { fontSize: 14, color: "#a5b4fc", fontWeight: 600 },
  modalMsg: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 1.6 },
  modalBtn: { width: "100%", padding: "11px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "#e8e8e8", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  modalBtnPrimary: { background: "linear-gradient(135deg, #6366f1, #4f46e5)", border: "none", color: "#fff", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" },
  radiusRow: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px" },
  radiusLabel: { fontSize: 13, color: "#9ca3af" },
  radiusInputWrap: { display: "flex", alignItems: "center", gap: 6 },
  radiusInput: { background: "transparent", border: "none", color: "#fff", fontSize: 16, fontWeight: 700, width: 60, textAlign: "right", outline: "none" },
  radiusUnit: { fontSize: 12, color: "#6b7280" },
  geoErrMsg: { fontSize: 12, color: "#f87171", textAlign: "center" },

  // Header
  header: { position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  headerLeft: { display: "flex", alignItems: "center", gap: 16 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoText: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: "#fff" },
  badge: { display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "4px 12px", fontSize: 13, color: "#a0a0b0" },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  adminBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer" },
  clock: { textAlign: "right" },
  clockTime: { fontSize: 24, fontWeight: 700, letterSpacing: "-1px", color: "#fff", fontVariantNumeric: "tabular-nums" },
  clockDate: { fontSize: 12, color: "#6b7280", marginTop: 2 },

  // Geo
  geoBar: { position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 32px", background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  geoBarLeft: { display: "flex", alignItems: "center", gap: 12 },
  geoSetupBtn: { background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" },
  pulse: { position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid", animation: "radarPulse 1.4s ease-out infinite" },
  radarDot: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 12, height: 12, borderRadius: "50%" },

  // Tabs
  tabs: { position: "relative", zIndex: 1, display: "flex", gap: 4, padding: "16px 32px 0" },
  tab: { background: "transparent", border: "none", color: "#6b7280", fontSize: 14, fontWeight: 500, padding: "8px 18px", borderRadius: "8px 8px 0 0", cursor: "pointer", transition: "color 0.2s", borderBottom: "2px solid transparent" },
  tabActive: { color: "#fff", borderBottom: "2px solid #6366f1", background: "rgba(99,102,241,0.08)" },

  // Cards
  main: { position: "relative", zIndex: 1, padding: "28px 32px 40px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "20px 22px", transition: "all 0.3s ease" },
  cardActive: { background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", boxShadow: "0 0 24px rgba(99,102,241,0.12)" },
  cardFlashIn: { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.4)" },
  cardFlashOut: { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.35)" },
  cardTop: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#a0a0b0", flexShrink: 0 },
  avatarActive: { background: "rgba(99,102,241,0.3)", color: "#a5b4fc" },
  empInfo: { flex: 1, minWidth: 0 },
  empName: { fontSize: 15, fontWeight: 600, color: "#e8e8e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  empRole: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  statusPill: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 20, flexShrink: 0 },
  statusIn: { background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" },
  statusOut: { background: "rgba(255,255,255,0.05)", color: "#4b5563", border: "1px solid rgba(255,255,255,0.08)" },
  elapsed: { background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 2 },
  elapsedLabel: { fontSize: 11, color: "#6366f1", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" },
  elapsedTime: { fontSize: 22, fontWeight: 700, color: "#a5b4fc", letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" },
  geoBlock: { display: "flex", alignItems: "center", gap: 8, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 8, padding: "7px 12px", marginBottom: 10, fontSize: 12 },
  btn: { width: "100%", padding: "10px 0", borderRadius: 10, border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer", letterSpacing: "0.02em" },
  btnIn: { background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", boxShadow: "0 4px 14px rgba(99,102,241,0.3)" },
  btnOut: { background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" },
  btnBlocked: { background: "rgba(255,255,255,0.04)", color: "#4b5563", border: "1px solid rgba(255,255,255,0.07)", cursor: "not-allowed" },
  logWrapper: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "14px 20px", fontSize: 14, color: "#c0c0d0", fontVariantNumeric: "tabular-nums" },
  logEmpCell: { display: "flex", alignItems: "center", gap: 10, fontWeight: 500, color: "#e8e8e8" },
  logAvatar: { width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#a0a0b0", flexShrink: 0 },
  emptyLog: { padding: "60px 20px", textAlign: "center" },
};
