import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionId = "dashboard" | "tablo" | "statuses" | "journal" | "alerts" | "analytics" | "archive" | "systems";

interface Unit {
  id: string;
  name: string;
  type: string;
  status: "active" | "warning" | "critical" | "idle";
  location: string;
  crew: number;
  lastContact: string;
}

interface LogEntry {
  id: string;
  time: string;
  type: "info" | "warning" | "critical" | "action";
  operator: string;
  message: string;
  unit?: string;
}

interface Alert {
  id: string;
  time: string;
  level: "critical" | "warning";
  title: string;
  description: string;
  read: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const UNITS: Unit[] = [
  { id: "U-01", name: "ПЧ-1 Центральная", type: "Пожарная часть", status: "active", location: "Ленина, 12", crew: 8, lastContact: "00:42" },
  { id: "U-02", name: "ПЧ-3 Заречная", type: "Пожарная часть", status: "active", location: "Советская, 45", crew: 6, lastContact: "01:15" },
  { id: "U-03", name: "СПАСО-1", type: "Спасательный отряд", status: "warning", location: "Выезд", crew: 12, lastContact: "02:03" },
  { id: "U-04", name: "АХ-7", type: "Аварийно-химич.", status: "idle", location: "База", crew: 4, lastContact: "00:10" },
  { id: "U-05", name: "МО-2", type: "Медотряд", status: "active", location: "ЦРБ", crew: 3, lastContact: "00:58" },
  { id: "U-06", name: "ПЧ-8 Северная", type: "Пожарная часть", status: "critical", location: "Выезд — ДТП", crew: 7, lastContact: "03:21" },
  { id: "U-07", name: "ВО-3", type: "Водолазный отряд", status: "idle", location: "База", crew: 5, lastContact: "00:05" },
  { id: "U-08", name: "СПАСО-4", type: "Спасательный отряд", status: "active", location: "ПСП Горы", crew: 9, lastContact: "01:47" },
];

const LOGS: LogEntry[] = [
  { id: "L-001", time: "08:47:12", type: "critical", operator: "Иванов А.С.", message: "Зафиксировано ДТП с пострадавшими на км 34 трассы М-4", unit: "U-06" },
  { id: "L-002", time: "08:45:03", type: "action", operator: "Иванов А.С.", message: "ПЧ-8 Северная направлена на место ДТП", unit: "U-06" },
  { id: "L-003", time: "08:42:18", type: "warning", operator: "Петрова М.И.", message: "СПАСО-1 запрашивает дополнительные ресурсы на объекте Заречная", unit: "U-03" },
  { id: "L-004", time: "08:39:55", type: "info", operator: "Сидоров К.В.", message: "Плановая проверка связи — все подразделения на связи" },
  { id: "L-005", time: "08:35:40", type: "action", operator: "Иванов А.С.", message: "Смена принята, журнал открыт" },
  { id: "L-006", time: "08:20:11", type: "info", operator: "Петрова М.И.", message: "МО-2 прибыл в ЦРБ, пациент передан врачам", unit: "U-05" },
  { id: "L-007", time: "08:15:07", type: "warning", operator: "Сидоров К.В.", message: "Нарушение связи с АХ-7, восстановлено через 4 мин." },
  { id: "L-008", time: "07:58:33", type: "action", operator: "Сидоров К.В.", message: "Запрос в ЦУКС по инциденту № 2024-0312" },
  { id: "L-009", time: "07:44:19", type: "info", operator: "Ночная смена", message: "Смена сдана без происшествий" },
  { id: "L-010", time: "07:30:00", type: "info", operator: "Система", message: "Автоматическая синхронизация с БД МЧС выполнена успешно" },
];

const ALERTS: Alert[] = [
  { id: "A-001", time: "08:47", level: "critical", title: "ДТП с пострадавшими", description: "Трасса М-4, км 34. 3 пострадавших. ПЧ-8 направлена.", read: false },
  { id: "A-002", time: "08:42", level: "warning", title: "Запрос ресурсов СПАСО-1", description: "Требуется дополнительное оборудование на объекте.", read: false },
  { id: "A-003", time: "08:15", level: "warning", title: "Нарушение связи АХ-7", description: "Связь прервана на 4 минуты, восстановлена.", read: true },
];

const STATUS_COLORS = {
  active: "status-active",
  warning: "status-warning",
  critical: "status-critical",
  idle: "status-idle",
};

const STATUS_LABELS = {
  active: "Активен",
  warning: "Внимание",
  critical: "Срочно",
  idle: "В резерве",
};

const LOG_COLORS = {
  info: "hsl(210 20% 60%)",
  warning: "hsl(45 95% 55%)",
  critical: "hsl(0 80% 60%)",
  action: "hsl(14 90% 52%)",
};

const LOG_LABELS = {
  info: "ИНФО",
  warning: "ВНИМАНИЕ",
  critical: "КРИТИЧНО",
  action: "ДЕЙСТВИЕ",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="mono text-lg font-medium" style={{ color: "hsl(var(--primary))" }}>
      {pad(time.getHours())}:{pad(time.getMinutes())}:{pad(time.getSeconds())}
    </span>
  );
}

function StatusDot({ status }: { status: Unit["status"] }) {
  return (
    <span className={`status-dot ${STATUS_COLORS[status]} ${status === "critical" ? "pulse-ring" : ""}`} />
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

function Dashboard() {
  const counts = {
    active: UNITS.filter(u => u.status === "active").length,
    warning: UNITS.filter(u => u.status === "warning").length,
    critical: UNITS.filter(u => u.status === "critical").length,
    idle: UNITS.filter(u => u.status === "idle").length,
  };

  return (
    <div className="fade-in space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Активны", value: counts.active, color: "var(--status-active)", icon: "CheckCircle" },
          { label: "Внимание", value: counts.warning, color: "var(--status-warning)", icon: "AlertTriangle" },
          { label: "Критично", value: counts.critical, color: "var(--status-critical)", icon: "AlertCircle" },
          { label: "В резерве", value: counts.idle, color: "var(--status-idle)", icon: "Pause" },
        ].map(item => (
          <div key={item.label} className="panel-card p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{item.label}</span>
              <Icon name={item.icon} fallback="Circle" size={14} style={{ color: `hsl(${item.color})` }} />
            </div>
            <span className="text-3xl font-bold" style={{ fontFamily: "Oswald, sans-serif", color: `hsl(${item.color})` }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="panel-card col-span-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Подразделения</h2>
            <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>{UNITS.length} единиц</span>
          </div>
          <div className="overflow-auto max-h-72 scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "hsl(var(--muted-foreground))" }} className="text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">ID</th>
                  <th className="text-left px-4 py-2 font-medium">Подразделение</th>
                  <th className="text-left px-4 py-2 font-medium">Статус</th>
                  <th className="text-left px-4 py-2 font-medium">Местоположение</th>
                  <th className="text-left px-4 py-2 font-medium">Связь</th>
                </tr>
              </thead>
              <tbody>
                {UNITS.map(u => (
                  <tr key={u.id} className="border-t border-border hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-2 mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{u.id}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{u.type}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <StatusDot status={u.status} />
                        <span className="text-xs" style={{ color: u.status === "critical" ? "hsl(var(--status-critical))" : u.status === "warning" ? "hsl(var(--status-warning))" : u.status === "active" ? "hsl(var(--status-active))" : "hsl(var(--status-idle))" }}>
                          {STATUS_LABELS[u.status]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs">{u.location}</td>
                    <td className="px-4 py-2 mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{u.lastContact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Уведомления</h2>
            <span className="tag blink" style={{ background: "hsl(var(--status-critical) / 0.15)", color: "hsl(var(--status-critical))" }}>
              {ALERTS.filter(a => !a.read).length} новых
            </span>
          </div>
          <div className="divide-y divide-border">
            {ALERTS.map(a => (
              <div key={a.id} className={`px-4 py-3 ${a.read ? "opacity-50" : ""}`}>
                <div className="flex items-start gap-2">
                  <span className={`status-dot mt-1.5 ${a.level === "critical" ? "status-critical" : "status-warning"} ${a.level === "critical" && !a.read ? "pulse-ring" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold leading-tight">{a.title}</div>
                    <div className="text-xs mt-0.5 leading-tight" style={{ color: "hsl(var(--muted-foreground))" }}>{a.description}</div>
                    <div className="mono text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{a.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Последние события</h2>
          <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>Сегодня</span>
        </div>
        <div className="divide-y divide-border">
          {LOGS.slice(0, 5).map(l => (
            <div key={l.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
              <span className="mono text-xs pt-0.5 flex-shrink-0 w-16" style={{ color: "hsl(var(--muted-foreground))" }}>{l.time}</span>
              <span className="tag text-xs flex-shrink-0" style={{ background: `${LOG_COLORS[l.type]}20`, color: LOG_COLORS[l.type] }}>{LOG_LABELS[l.type]}</span>
              <span className="text-xs flex-1">{l.message}</span>
              <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{l.operator}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tablo() {
  const critical = UNITS.filter(u => u.status === "critical");
  const active = UNITS.filter(u => u.status === "active");
  const warning = UNITS.filter(u => u.status === "warning");

  return (
    <div className="fade-in grid-scan min-h-screen p-6 space-y-6" style={{ background: "hsl(220 20% 4%)" }}>
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>ЦУКС МЧС России</div>
          <h1 className="text-4xl font-bold" style={{ fontFamily: "Oswald", color: "hsl(var(--primary))" }}>
            ОПЕРАТИВНОЕ ТАБЛО
          </h1>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Время</div>
          <Clock />
        </div>
      </div>

      {critical.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-3 blink" style={{ color: "hsl(var(--status-critical))" }}>
            ■ ЭКСТРЕННОЕ РЕАГИРОВАНИЕ
          </div>
          <div className="grid grid-cols-3 gap-3">
            {critical.map(u => (
              <div key={u.id} className="panel-card p-4 pulse-ring" style={{ borderColor: "hsl(var(--status-critical))" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="mono text-xs" style={{ color: "hsl(var(--status-critical))" }}>{u.id}</span>
                  <span className="tag" style={{ background: "hsl(var(--status-critical) / 0.2)", color: "hsl(var(--status-critical))" }}>СРОЧНО</span>
                </div>
                <div className="text-xl font-bold" style={{ fontFamily: "Oswald" }}>{u.name}</div>
                <div className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{u.location}</div>
                <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <span>Состав: {u.crew} чел.</span>
                  <span className="mono">Связь: {u.lastContact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {warning.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "hsl(var(--status-warning))" }}>
            ▲ ПОВЫШЕННАЯ ГОТОВНОСТЬ
          </div>
          <div className="grid grid-cols-4 gap-3">
            {warning.map(u => (
              <div key={u.id} className="panel-card p-3" style={{ borderColor: "hsl(var(--status-warning) / 0.4)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <StatusDot status={u.status} />
                  <span className="mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{u.id}</span>
                </div>
                <div className="font-semibold" style={{ fontFamily: "Oswald" }}>{u.name}</div>
                <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{u.location}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "hsl(var(--status-active))" }}>
          ● ШТАТНЫЙ РЕЖИМ
        </div>
        <div className="grid grid-cols-5 gap-2">
          {active.map(u => (
            <div key={u.id} className="panel-card p-3">
              <div className="flex items-center gap-2 mb-1">
                <StatusDot status={u.status} />
                <span className="mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{u.id}</span>
              </div>
              <div className="font-semibold text-sm" style={{ fontFamily: "Oswald" }}>{u.name}</div>
              <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{u.location}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-6 pt-4 border-t border-border">
        {[
          { label: "Подразделений всего", value: UNITS.length },
          { label: "В работе", value: active.length + warning.length + critical.length },
          { label: "Дежурный оператор", value: "Иванов А.С." },
          { label: "Смена", value: "08:00 — 20:00" },
        ].map(s => (
          <div key={s.label}>
            <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</div>
            <div className="font-semibold" style={{ fontFamily: "Oswald" }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Statuses() {
  const [units, setUnits] = useState(UNITS);

  const cycleStatus = (id: string) => {
    const order: Unit["status"][] = ["active", "warning", "critical", "idle"];
    setUnits(prev => prev.map(u => {
      if (u.id !== id) return u;
      const next = order[(order.indexOf(u.status) + 1) % order.length];
      return { ...u, status: next };
    }));
  };

  return (
    <div className="fade-in space-y-4">
      <div className="panel-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Управление статусами подразделений</h2>
          <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Нажмите на статус для переключения</p>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {units.map(u => (
            <div key={u.id} className="panel-card p-3 flex items-center gap-3">
              <StatusDot status={u.status} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{u.name}</div>
                <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{u.type} · {u.location}</div>
              </div>
              <button
                onClick={() => cycleStatus(u.id)}
                className="tag text-xs cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  background: `hsl(var(--${u.status === "active" ? "status-active" : u.status === "warning" ? "status-warning" : u.status === "critical" ? "status-critical" : "status-idle"}) / 0.15)`,
                  color: u.status === "active" ? "hsl(var(--status-active))" : u.status === "warning" ? "hsl(var(--status-warning))" : u.status === "critical" ? "hsl(var(--status-critical))" : "hsl(var(--status-idle))"
                }}
              >
                {STATUS_LABELS[u.status]}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Средства связи</h2>
        </div>
        <div className="p-4 grid grid-cols-3 gap-3">
          {[
            { name: "Радиостанция P-168", status: "active", freq: "146.500 МГц", lastCheck: "08:39" },
            { name: "ГЛОНАСС-терминал", status: "active", freq: "Спутник", lastCheck: "08:40" },
            { name: "КВ-станция", status: "warning", freq: "7.050 МГц", lastCheck: "08:15" },
            { name: "Телефония ЦУКС", status: "active", freq: "Цифровой", lastCheck: "08:42" },
            { name: "УКВ-ретранслятор", status: "idle", freq: "432.100 МГц", lastCheck: "07:55" },
            { name: "АПОИ", status: "active", freq: "TCP/IP", lastCheck: "08:47" },
          ].map(c => (
            <div key={c.name} className="panel-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <StatusDot status={c.status as Unit["status"]} />
                <span className="font-medium text-sm">{c.name}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                <span>{c.freq}</span>
                <span className="mono">{c.lastCheck}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Journal() {
  const [filter, setFilter] = useState<"all" | LogEntry["type"]>("all");
  const filtered = filter === "all" ? LOGS : LOGS.filter(l => l.type === filter);

  return (
    <div className="fade-in space-y-4">
      <div className="flex items-center gap-2">
        {(["all", "info", "action", "warning", "critical"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="tag text-xs cursor-pointer transition-all"
            style={{
              background: filter === f
                ? f === "all" ? "hsl(var(--primary))" : `${LOG_COLORS[f as LogEntry["type"]]}30`
                : "hsl(var(--muted))",
              color: filter === f
                ? f === "all" ? "hsl(var(--primary-foreground))" : LOG_COLORS[f as LogEntry["type"]]
                : "hsl(var(--muted-foreground))"
            }}
          >
            {f === "all" ? "Все" : LOG_LABELS[f as LogEntry["type"]]}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{filtered.length} записей</span>
      </div>

      <div className="panel-card">
        <div className="divide-y divide-border">
          {filtered.map(l => (
            <div key={l.id} className="flex items-start gap-4 px-4 py-3 hover:bg-secondary/30 transition-colors">
              <span className="mono text-xs pt-0.5 flex-shrink-0 w-18" style={{ color: "hsl(var(--muted-foreground))" }}>{l.time}</span>
              <span className="tag text-xs flex-shrink-0 w-24 text-center" style={{ background: `${LOG_COLORS[l.type]}20`, color: LOG_COLORS[l.type] }}>
                {LOG_LABELS[l.type]}
              </span>
              <div className="flex-1 text-sm">{l.message}</div>
              <div className="flex-shrink-0 text-right">
                {l.unit && <div className="mono text-xs" style={{ color: "hsl(var(--primary))" }}>{l.unit}</div>}
                <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{l.operator}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Alerts() {
  const [alerts, setAlerts] = useState(ALERTS);

  const markRead = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));

  return (
    <div className="fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
          {alerts.filter(a => !a.read).length} непрочитанных из {alerts.length}
        </div>
        <button onClick={markAllRead} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition-colors">
          Прочитать все
        </button>
      </div>

      <div className="space-y-2">
        {alerts.map(a => (
          <div key={a.id} className={`panel-card p-4 transition-opacity ${a.read ? "opacity-50" : ""}`}
            style={{ borderLeftWidth: 3, borderLeftColor: a.level === "critical" ? "hsl(var(--status-critical))" : "hsl(var(--status-warning))" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className={`status-dot mt-1.5 ${a.level === "critical" ? "status-critical" : "status-warning"} ${!a.read && a.level === "critical" ? "pulse-ring" : ""}`} />
                <div>
                  <div className="font-semibold text-sm">{a.title}</div>
                  <div className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{a.description}</div>
                  <div className="mono text-xs mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>{a.time}</div>
                </div>
              </div>
              {!a.read && (
                <button onClick={() => markRead(a.id)} className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary transition-colors flex-shrink-0">
                  Прочитано
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="panel-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ fontFamily: "Oswald" }}>Настройка уведомлений</h3>
        <div className="grid grid-cols-2 gap-0">
          {[
            { label: "ДТП с пострадавшими", enabled: true },
            { label: "Пожар 2 и выше категории", enabled: true },
            { label: "Разлив АХОВ", enabled: true },
            { label: "Отказ связи более 10 мин.", enabled: false },
            { label: "Запрос ресурсов", enabled: true },
            { label: "Синхронизация БД МЧС", enabled: false },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-2 px-2 border-b border-border">
              <span className="text-sm">{item.label}</span>
              <div className={`w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${item.enabled ? "bg-green-700" : "bg-secondary"}`}>
                <div className={`w-3 h-3 rounded-full bg-white m-0.5 transition-transform ${item.enabled ? "translate-x-4" : ""}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Analytics() {
  const hours = [
    { hour: "08:00", incidents: 2 },
    { hour: "09:00", incidents: 5 },
    { hour: "10:00", incidents: 3 },
    { hour: "11:00", incidents: 7 },
    { hour: "12:00", incidents: 4 },
    { hour: "13:00", incidents: 6 },
    { hour: "14:00", incidents: 8 },
    { hour: "15:00", incidents: 3 },
  ];
  const maxVal = Math.max(...hours.map(h => h.incidents));

  return (
    <div className="fade-in space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Инцидентов за смену", value: "14", delta: "+2", up: false },
          { label: "Среднее время реагирования", value: "7.4 мин", delta: "-0.8", up: true },
          { label: "Закрыто инцидентов", value: "11", delta: "79%", up: true },
        ].map(s => (
          <div key={s.label} className="panel-card p-4">
            <div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</div>
            <div className="text-3xl font-bold" style={{ fontFamily: "Oswald" }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: s.up ? "hsl(var(--status-active))" : "hsl(var(--status-critical))" }}>
              {s.delta} к прошлой смене
            </div>
          </div>
        ))}
      </div>

      <div className="panel-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ fontFamily: "Oswald" }}>
          Активность по часам смены
        </h3>
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {hours.map(h => (
            <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 h-full">
              <div className="flex-1 w-full flex items-end">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${(h.incidents / maxVal) * 100}%`,
                    background: "hsl(var(--primary) / 0.7)"
                  }}
                />
              </div>
              <div className="text-xs mono" style={{ color: "hsl(var(--muted-foreground))", fontSize: 9 }}>{h.hour}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            <div className="w-3 h-2 rounded-sm" style={{ background: "hsl(var(--primary))" }} /> Инциденты
          </div>
        </div>
      </div>

      <div className="panel-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ fontFamily: "Oswald" }}>
          Нагрузка по подразделениям
        </h3>
        <div className="space-y-2">
          {UNITS.slice(0, 5).map((u, i) => {
            const pct = [85, 62, 44, 30, 18][i];
            return (
              <div key={u.id} className="flex items-center gap-3">
                <span className="text-xs w-28 truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{u.name}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "hsl(var(--secondary))" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "hsl(var(--primary))" }} />
                </div>
                <span className="mono text-xs w-8 text-right" style={{ color: "hsl(var(--muted-foreground))" }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Archive() {
  const [dateFrom, setDateFrom] = useState("2026-05-01");
  const [dateTo, setDateTo] = useState("2026-05-04");

  const inputStyle: React.CSSProperties = {
    background: "hsl(var(--secondary))",
    border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))",
    padding: "6px 10px",
    borderRadius: 4,
    fontSize: 13,
    fontFamily: "IBM Plex Mono, monospace",
  };

  return (
    <div className="fade-in space-y-4">
      <div className="panel-card p-4">
        <div className="flex items-end gap-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "hsl(var(--muted-foreground))" }}>Дата с</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "hsl(var(--muted-foreground))" }}>Дата по</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
          </div>
          <button className="px-4 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
            Применить
          </button>
          <button className="px-4 py-1.5 rounded text-sm border border-border hover:bg-secondary transition-colors">
            Экспорт
          </button>
        </div>
      </div>

      <div className="panel-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Архив операций</h2>
          <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
            {dateFrom} — {dateTo}
          </span>
        </div>
        <div className="divide-y divide-border">
          {[
            { date: "2026-05-04", shift: "08:00–20:00", operator: "Иванов А.С.", incidents: 14, closed: 11 },
            { date: "2026-05-03", shift: "20:00–08:00", operator: "Петрова М.И.", incidents: 8, closed: 8 },
            { date: "2026-05-03", shift: "08:00–20:00", operator: "Сидоров К.В.", incidents: 11, closed: 9 },
            { date: "2026-05-02", shift: "20:00–08:00", operator: "Козлов Р.Д.", incidents: 5, closed: 5 },
            { date: "2026-05-02", shift: "08:00–20:00", operator: "Иванов А.С.", incidents: 17, closed: 15 },
            { date: "2026-05-01", shift: "20:00–08:00", operator: "Петрова М.И.", incidents: 9, closed: 9 },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-6 px-4 py-3 hover:bg-secondary/30 transition-colors text-sm">
              <span className="mono text-xs w-24 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{row.date}</span>
              <span className="mono text-xs w-24 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{row.shift}</span>
              <span className="flex-1">{row.operator}</span>
              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Инцидентов: <b style={{ color: "hsl(var(--foreground))" }}>{row.incidents}</b></span>
              <span className="text-xs" style={{ color: row.closed === row.incidents ? "hsl(var(--status-active))" : "hsl(var(--status-warning))" }}>
                Закрыто: {row.closed}
              </span>
              <button className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary transition-colors flex-shrink-0">
                Открыть
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Systems() {
  const systems = [
    { name: "АИУС МЧС России", type: "Оперативная БД", status: "active" as const, lastSync: "08:47:10", version: "v4.2.1", latency: "42 мс" },
    { name: "ЦУКС Федеральный", type: "API-интеграция", status: "active" as const, lastSync: "08:47:05", version: "REST 2.1", latency: "120 мс" },
    { name: "ЕСИМО", type: "Гидрометеоданные", status: "active" as const, lastSync: "08:40:00", version: "v2.0", latency: "85 мс" },
    { name: "Система 112", type: "Приём вызовов", status: "warning" as const, lastSync: "08:32:15", version: "v3.5", latency: ">500 мс" },
    { name: "ГИС МЧС", type: "Геоинформация", status: "active" as const, lastSync: "08:45:00", version: "v1.8", latency: "210 мс" },
    { name: "КСЭОН", type: "Оповещение", status: "idle" as const, lastSync: "07:00:00", version: "v3.0", latency: "—" },
  ];

  return (
    <div className="fade-in space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {systems.map(s => (
          <div key={s.name} className="panel-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-sm">{s.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{s.type}</div>
              </div>
              <StatusDot status={s.status} />
            </div>
            <div className="space-y-1.5 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              <div className="flex justify-between">
                <span>Последняя синхр.</span>
                <span className="mono">{s.lastSync}</span>
              </div>
              <div className="flex justify-between">
                <span>Версия</span>
                <span className="mono">{s.version}</span>
              </div>
              <div className="flex justify-between">
                <span>Задержка</span>
                <span className="mono" style={{ color: s.latency === "—" ? "hsl(var(--status-idle))" : s.latency.includes(">") ? "hsl(var(--status-warning))" : parseInt(s.latency) > 200 ? "hsl(var(--status-warning))" : "hsl(var(--status-active))" }}>{s.latency}</span>
              </div>
            </div>
            <button className="mt-3 w-full text-xs py-1.5 rounded border border-border hover:bg-secondary transition-colors">
              Синхронизировать
            </button>
          </div>
        ))}
      </div>

      <div className="panel-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ fontFamily: "Oswald" }}>Журнал синхронизации</h3>
        <div className="divide-y divide-border">
          {[
            { time: "08:47:10", system: "АИУС МЧС", event: "Синхронизация выполнена. Получено 3 новых записи.", ok: true },
            { time: "08:45:00", system: "ГИС МЧС", event: "Обновлены координаты 8 подразделений.", ok: true },
            { time: "08:40:00", system: "ЕСИМО", event: "Получен метеобюллетень № 142.", ok: true },
            { time: "08:32:15", system: "Система 112", event: "Превышение порога задержки (520 мс). Повтор через 5 мин.", ok: false },
            { time: "08:30:00", system: "АИУС МЧС", event: "Синхронизация выполнена.", ok: true },
          ].map((row, i) => (
            <div key={i} className="flex items-start gap-3 py-2 text-xs">
              <span className="mono w-16 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{row.time}</span>
              <span className="w-28 flex-shrink-0 font-medium" style={{ color: "hsl(var(--primary))" }}>{row.system}</span>
              <span className="flex-1">{row.event}</span>
              <span className="flex-shrink-0" style={{ color: row.ok ? "hsl(var(--status-active))" : "hsl(var(--status-warning))" }}>{row.ok ? "OK" : "WARN"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV: { id: SectionId; label: string; icon: string; badge?: number }[] = [
  { id: "dashboard", label: "Главная панель", icon: "LayoutDashboard" },
  { id: "tablo", label: "Табло", icon: "Monitor" },
  { id: "statuses", label: "Статусы", icon: "Activity" },
  { id: "journal", label: "Журнал событий", icon: "ScrollText" },
  { id: "alerts", label: "Уведомления", icon: "Bell", badge: 2 },
  { id: "analytics", label: "Аналитика", icon: "BarChart3" },
  { id: "archive", label: "Архив", icon: "Archive" },
  { id: "systems", label: "Внешние системы", icon: "Network" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Index() {
  const [section, setSection] = useState<SectionId>("dashboard");
  const current = NAV.find(n => n.id === section)!;

  const renderSection = () => {
    switch (section) {
      case "dashboard": return <Dashboard />;
      case "tablo": return <Tablo />;
      case "statuses": return <Statuses />;
      case "journal": return <Journal />;
      case "alerts": return <Alerts />;
      case "analytics": return <Analytics />;
      case "archive": return <Archive />;
      case "systems": return <Systems />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border" style={{ background: "hsl(220 16% 6%)" }}>
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--primary))" }}>
              <Icon name="Shield" size={14} className="text-white" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest" style={{ fontFamily: "Oswald", color: "hsl(var(--primary))" }}>
                АРМ ДЕЖУРНОГО
              </div>
              <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 9 }}>МЧС России</div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <Clock />
          <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Иванов А.С.</div>
          <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 10 }}>Смена: 08:00–20:00</div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`nav-item w-full text-left ${section === n.id ? "active" : ""}`}
            >
              <Icon name={n.icon} fallback="Circle" size={15} />
              <span className="flex-1">{n.label}</span>
              {n.badge && (
                <span className="text-xs px-1.5 py-0.5 rounded-full blink"
                  style={{ background: "hsl(var(--status-critical) / 0.2)", color: "hsl(var(--status-critical))", fontSize: 10 }}>
                  {n.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            <span className="status-dot status-active" />
            <span>Система в работе</span>
          </div>
          <div className="mono mt-0.5" style={{ color: "hsl(var(--muted-foreground))", fontSize: 10 }}>
            БД синхр.: 08:47
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0" style={{ background: "hsl(220 16% 6%)" }}>
          <div className="flex items-center gap-3">
            <Icon name={current.icon} fallback="Circle" size={16} style={{ color: "hsl(var(--muted-foreground))" }} />
            <h1 className="font-semibold uppercase tracking-widest text-sm" style={{ fontFamily: "Oswald" }}>
              {current.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              <span className="status-dot status-active" />
              <span>АИУС онлайн</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="text-xs mono" style={{ color: "hsl(var(--muted-foreground))" }}>
              {new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}