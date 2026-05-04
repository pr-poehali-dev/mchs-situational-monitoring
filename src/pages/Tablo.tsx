import { useState, useEffect } from "react";

// ─── Types & Data (независимы от Index) ──────────────────────────────────────

interface Unit {
  id: string;
  name: string;
  type: string;
  status: "active" | "warning" | "critical" | "idle";
  location: string;
  crew: number;
  lastContact: string;
}

interface GasSensor {
  id: string;
  location: string;
  horizon: string;
  ch4: number;
  co: number;
  o2: number;
  status: "normal" | "warning" | "critical";
  updated: string;
}

const INITIAL_UNITS: Unit[] = [
  { id: "ВГСО-1", name: "ВГСО-1 Центральный", type: "Горноспасательный отряд", status: "active",   location: "Шахта «Северная»",       crew: 10, lastContact: "00:42" },
  { id: "ВГСО-2", name: "ВГСО-2 Восточный",   type: "Горноспасательный отряд", status: "active",   location: "База ВГСЧ",               crew: 8,  lastContact: "01:15" },
  { id: "ДКС-1",  name: "ДКС-1",              type: "Дежурная кам. смена",      status: "warning",  location: "Гор. -480 м, уч. №3",     crew: 6,  lastContact: "02:03" },
  { id: "ПГСО-3", name: "ПГСО-3",             type: "Профил. горноспас. отряд", status: "idle",     location: "База",                    crew: 5,  lastContact: "00:10" },
  { id: "МС-1",   name: "МС-1",               type: "Медицинская служба",       status: "active",   location: "Медпункт шахты",          crew: 3,  lastContact: "00:58" },
  { id: "ВГСО-5", name: "ВГСО-5 Аварийный",   type: "Горноспасательный отряд", status: "critical", location: "Гор. -620 м — задымление", crew: 9, lastContact: "03:21" },
  { id: "ГТС-2",  name: "ГТС-2",              type: "Газотехн. служба",         status: "idle",     location: "База",                    crew: 4,  lastContact: "00:05" },
  { id: "ВГСО-4", name: "ВГСО-4 Южный",       type: "Горноспасательный отряд", status: "active",   location: "Шахта «Заречная»",        crew: 11, lastContact: "01:47" },
];

const INITIAL_SENSORS: GasSensor[] = [
  { id: "ДГ-01", location: "Уч. №1, гор. -320 м", horizon: "-320", ch4: 0.12, co: 4,  o2: 20.4, status: "normal",   updated: "08:47:05" },
  { id: "ДГ-02", location: "Уч. №3, гор. -480 м", horizon: "-480", ch4: 0.48, co: 14, o2: 20.1, status: "warning",  updated: "08:47:08" },
  { id: "ДГ-03", location: "Уч. №7, гор. -620 м", horizon: "-620", ch4: 1.14, co: 38, o2: 19.2, status: "critical", updated: "08:47:11" },
  { id: "ДГ-04", location: "Уч. №2, гор. -320 м", horizon: "-320", ch4: 0.08, co: 2,  o2: 20.6, status: "normal",   updated: "08:47:03" },
  { id: "ДГ-05", location: "Уч. №5, гор. -480 м", horizon: "-480", ch4: 0.31, co: 8,  o2: 20.3, status: "normal",   updated: "08:47:07" },
  { id: "ДГ-06", location: "Уч. №9, гор. -620 м", horizon: "-620", ch4: 0.62, co: 21, o2: 19.7, status: "warning",  updated: "08:47:10" },
];

const STATUS_LABELS = { active: "Активен", warning: "Внимание", critical: "Срочно", idle: "Резерв" };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function useLiveUnits() {
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS);
  useEffect(() => {
    const t = setInterval(() => {
      // В продакшне здесь будет fetch от API
      setUnits(prev => [...prev]);
    }, 5000);
    return () => clearInterval(t);
  }, []);
  return units;
}

function useLiveSensors() {
  const [sensors, setSensors] = useState<GasSensor[]>(INITIAL_SENSORS);
  useEffect(() => {
    const t = setInterval(() => {
      setSensors(prev => prev.map(s => {
        const rnd = (v: number, d: number) => Math.max(0, +(v + (Math.random() - 0.5) * d).toFixed(2));
        const ch4 = rnd(s.ch4, 0.04);
        const co  = rnd(s.co, 1.5);
        const o2  = Math.min(21, Math.max(15, +(s.o2 + (Math.random() - 0.5) * 0.05).toFixed(2)));
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const updated = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const isCrit = ch4 >= 1.0 || co >= 34 || o2 <= 17;
        const isWarn = ch4 >= 0.5 || co >= 17 || o2 <= 19;
        return { ...s, ch4, co, o2, updated, status: isCrit ? "critical" : isWarn ? "warning" : "normal" };
      }));
    }, 3000);
    return () => clearInterval(t);
  }, []);
  return sensors;
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export default function TabloPage() {
  const time = useClock();
  const units = useLiveUnits();
  const sensors = useLiveSensors();

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const dateStr = time.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });

  const critical = units.filter(u => u.status === "critical");
  const warning  = units.filter(u => u.status === "warning");
  const active   = units.filter(u => u.status === "active");
  const idle     = units.filter(u => u.status === "idle");

  const gasCrit = sensors.filter(s => s.status === "critical");
  const gasWarn = sensors.filter(s => s.status === "warning");

  const anyAlarm = critical.length > 0 || gasCrit.length > 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "hsl(220 20% 4%)",
        backgroundImage: "linear-gradient(hsl(220 18% 9% / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(220 18% 9% / 0.6) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        fontFamily: "IBM Plex Sans, sans-serif",
        color: "hsl(210 20% 92%)",
      }}
    >
      {/* ── Шапка ── */}
      <header className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: "hsl(220 12% 16%)" }}>
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ background: "hsl(14 90% 52%)", fontFamily: "Oswald, sans-serif" }}
          >
            В
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: "hsl(210 10% 50%)", fontFamily: "Oswald, sans-serif" }}>
              ФГУП ВГСЧ МЧС России
            </div>
            <div className="text-2xl font-bold uppercase tracking-wide" style={{ fontFamily: "Oswald, sans-serif", color: "hsl(14 90% 52%)" }}>
              Оперативное табло
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* Счётчики статусов */}
          {[
            { label: "Критично", count: critical.length + gasCrit.length, color: "hsl(0 80% 60%)" },
            { label: "Внимание", count: warning.length + gasWarn.length, color: "hsl(45 95% 55%)" },
            { label: "В работе", count: active.length, color: "hsl(142 70% 45%)" },
            { label: "Резерв",   count: idle.length, color: "hsl(210 10% 45%)" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold" style={{ fontFamily: "Oswald, sans-serif", color: s.color }}>{s.count}</div>
              <div className="text-xs uppercase tracking-wide" style={{ color: "hsl(210 10% 50%)" }}>{s.label}</div>
            </div>
          ))}

          <div className="w-px h-12" style={{ background: "hsl(220 12% 16%)" }} />

          {/* Время */}
          <div className="text-right">
            <div className="text-3xl font-bold mono" style={{ color: "hsl(14 90% 52%)", fontFamily: "IBM Plex Mono, monospace" }}>
              {timeStr}
            </div>
            <div className="text-xs mt-0.5 capitalize" style={{ color: "hsl(210 10% 50%)" }}>{dateStr}</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex gap-0">

        {/* ── Левая колонка: подразделения ── */}
        <div className="flex-1 flex flex-col p-6 gap-4 border-r" style={{ borderColor: "hsl(220 12% 16%)" }}>

          {/* Критичные */}
          {critical.length > 0 && (
            <section>
              <div
                className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2"
                style={{ color: "hsl(0 80% 60%)", fontFamily: "Oswald, sans-serif" }}
              >
                <span className={anyAlarm ? "blink" : ""}>■</span>
                <span>Экстренное реагирование</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {critical.map(u => (
                  <div
                    key={u.id}
                    className="rounded p-4"
                    style={{
                      background: "hsl(0 80% 50% / 0.08)",
                      border: "1px solid hsl(0 80% 50% / 0.5)",
                      boxShadow: "0 0 16px hsl(0 80% 50% / 0.12)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="mono text-xs" style={{ color: "hsl(0 80% 60%)" }}>{u.id}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded uppercase tracking-wide blink"
                        style={{ background: "hsl(0 80% 50% / 0.2)", color: "hsl(0 80% 60%)", fontFamily: "IBM Plex Mono, monospace" }}
                      >
                        СРОЧНО
                      </span>
                    </div>
                    <div className="text-xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>{u.name}</div>
                    <div className="text-sm mt-1" style={{ color: "hsl(210 10% 55%)" }}>{u.location}</div>
                    <div className="flex items-center gap-4 mt-2 text-xs mono" style={{ color: "hsl(210 10% 45%)" }}>
                      <span>Состав: {u.crew} чел.</span>
                      <span>Связь: {u.lastContact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Внимание */}
          {warning.length > 0 && (
            <section>
              <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "hsl(45 95% 55%)", fontFamily: "Oswald, sans-serif" }}>
                ▲ Повышенная готовность
              </div>
              <div className="grid grid-cols-3 gap-2">
                {warning.map(u => (
                  <div
                    key={u.id}
                    className="rounded p-3"
                    style={{ background: "hsl(45 95% 55% / 0.06)", border: "1px solid hsl(45 95% 55% / 0.3)" }}
                  >
                    <div className="mono text-xs mb-1" style={{ color: "hsl(45 95% 55%)" }}>{u.id}</div>
                    <div className="font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>{u.name}</div>
                    <div className="text-xs mt-1" style={{ color: "hsl(210 10% 50%)" }}>{u.location}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Активные */}
          <section className="flex-1">
            <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "hsl(142 70% 45%)", fontFamily: "Oswald, sans-serif" }}>
              ● Штатный режим
            </div>
            <div className="grid grid-cols-4 gap-2">
              {active.map(u => (
                <div
                  key={u.id}
                  className="rounded p-3"
                  style={{ background: "hsl(142 70% 45% / 0.05)", border: "1px solid hsl(220 12% 16%)" }}
                >
                  <div className="mono text-xs mb-1" style={{ color: "hsl(142 70% 45%)" }}>{u.id}</div>
                  <div className="font-semibold text-sm" style={{ fontFamily: "Oswald, sans-serif" }}>{u.name}</div>
                  <div className="text-xs mt-1" style={{ color: "hsl(210 10% 50%)" }}>{u.location}</div>
                </div>
              ))}
              {idle.map(u => (
                <div
                  key={u.id}
                  className="rounded p-3 opacity-50"
                  style={{ background: "hsl(220 12% 10%)", border: "1px solid hsl(220 12% 14%)" }}
                >
                  <div className="mono text-xs mb-1" style={{ color: "hsl(210 10% 40%)" }}>{u.id}</div>
                  <div className="font-semibold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "hsl(210 10% 60%)" }}>{u.name}</div>
                  <div className="text-xs mt-1" style={{ color: "hsl(210 10% 40%)" }}>Резерв</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Правая колонка: газовый контроль ── */}
        <div className="w-80 flex flex-col p-5 gap-4 flex-shrink-0">
          <div>
            <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "hsl(210 10% 50%)", fontFamily: "Oswald, sans-serif" }}>
              Газовый контроль АГК
            </div>

            {sensors.map(s => {
              const isCrit = s.status === "critical";
              const isWarn = s.status === "warning";
              const accent = isCrit ? "hsl(0 80% 60%)" : isWarn ? "hsl(45 95% 55%)" : "hsl(142 70% 45%)";
              const bg     = isCrit ? "hsl(0 80% 50% / 0.07)" : isWarn ? "hsl(45 95% 55% / 0.05)" : "hsl(220 12% 10%)";
              const border = isCrit ? "hsl(0 80% 50% / 0.4)" : isWarn ? "hsl(45 95% 55% / 0.3)" : "hsl(220 12% 16%)";

              return (
                <div
                  key={s.id}
                  className="rounded p-3 mb-2"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: accent }}>{s.id}</span>
                      <span className="text-xs ml-2" style={{ color: "hsl(210 10% 50%)" }}>{s.location}</span>
                    </div>
                    <span className="mono text-xs" style={{ color: "hsl(210 10% 40%)" }}>{s.updated}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { label: "CH₄", value: s.ch4, unit: "%", warn: s.ch4 >= 0.5, crit: s.ch4 >= 1.0 },
                      { label: "CO",  value: s.co,  unit: "ppm", warn: s.co >= 17, crit: s.co >= 34 },
                      { label: "O₂",  value: s.o2,  unit: "%", warn: s.o2 <= 19, crit: s.o2 <= 17 },
                    ].map(g => {
                      const c = g.crit ? "hsl(0 80% 60%)" : g.warn ? "hsl(45 95% 55%)" : "hsl(142 70% 45%)";
                      return (
                        <div key={g.label} className="text-center">
                          <div style={{ color: "hsl(210 10% 50%)" }}>{g.label}</div>
                          <div className="font-semibold mono" style={{ color: c }}>{g.value.toFixed(2)}</div>
                          <div style={{ color: "hsl(210 10% 40%)" }}>{g.unit}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Сводка по горизонтам */}
          <div className="rounded p-4" style={{ background: "hsl(220 14% 9%)", border: "1px solid hsl(220 12% 16%)" }}>
            <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "hsl(210 10% 50%)", fontFamily: "Oswald, sans-serif" }}>
              Горизонты
            </div>
            {["-320", "-480", "-620"].map(h => {
              const group = sensors.filter(s => s.horizon === h);
              const avgCh4 = (group.reduce((a, s) => a + s.ch4, 0) / group.length);
              const worst  = group.some(s => s.status === "critical") ? "critical" : group.some(s => s.status === "warning") ? "warning" : "normal";
              const c = worst === "critical" ? "hsl(0 80% 60%)" : worst === "warning" ? "hsl(45 95% 55%)" : "hsl(142 70% 45%)";
              return (
                <div key={h} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm" style={{ borderColor: "hsl(220 12% 16%)" }}>
                  <span className="mono font-semibold" style={{ color: c }}>Гор. {h} м</span>
                  <span className="mono text-xs" style={{ color: "hsl(210 10% 50%)" }}>CH₄ avg: {avgCh4.toFixed(2)}%</span>
                </div>
              );
            })}
          </div>

          {/* Нижняя строка */}
          <div className="mt-auto pt-3 border-t text-xs" style={{ borderColor: "hsl(220 12% 16%)", color: "hsl(210 10% 40%)" }}>
            <div className="flex justify-between">
              <span>Дежурный оператор</span>
              <span style={{ color: "hsl(210 20% 80%)" }}>Иванов А.С.</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Смена</span>
              <span style={{ color: "hsl(210 20% 80%)" }}>08:00 — 20:00</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>АСУ ВГСЧ</span>
              <span style={{ color: "hsl(142 70% 45%)" }}>онлайн</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
