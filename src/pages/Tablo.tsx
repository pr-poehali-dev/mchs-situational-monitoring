import { useState, useEffect } from "react";
import {
  type AccidentState,
  ACCIDENT_TYPES,
  DEFAULT_STATE,
  loadAccident,
  saveAccident,
  subscribeAccident,
} from "@/lib/accidentStore";

// ─── Координаты объекта ───────────────────────────────────────────────────────
const OBJ_LAT = 55.7558;
const OBJ_LON = 37.6173;
const OBJ_TZ  = "Europe/Moscow";

const WIND_DIRS = ["С","СВ","В","ЮВ","Ю","ЮЗ","З","СЗ"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Weather {
  temp: number;
  windSpeed: number;
  windDir: number;
  humidity: number;
  pressure: number;
  desc: string;
  icon: string;
  updated: string;
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

const INITIAL_SENSORS: GasSensor[] = [
  { id: "ДГ-01", location: "Уч. №1, гор. -320 м", horizon: "-320", ch4: 0.12, co: 4,  o2: 20.4, status: "normal",   updated: "08:47:05" },
  { id: "ДГ-02", location: "Уч. №3, гор. -480 м", horizon: "-480", ch4: 0.48, co: 14, o2: 20.1, status: "warning",  updated: "08:47:08" },
  { id: "ДГ-03", location: "Уч. №7, гор. -620 м", horizon: "-620", ch4: 1.14, co: 38, o2: 19.2, status: "critical", updated: "08:47:11" },
  { id: "ДГ-04", location: "Уч. №2, гор. -320 м", horizon: "-320", ch4: 0.08, co: 2,  o2: 20.6, status: "normal",   updated: "08:47:03" },
  { id: "ДГ-05", location: "Уч. №5, гор. -480 м", horizon: "-480", ch4: 0.31, co: 8,  o2: 20.3, status: "normal",   updated: "08:47:07" },
  { id: "ДГ-06", location: "Уч. №9, гор. -620 м", horizon: "-620", ch4: 0.62, co: 21, o2: 19.7, status: "warning",  updated: "08:47:10" },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function useMoscowTime() {
  const [msk, setMsk] = useState("");
  useEffect(() => {
    const update = () => {
      setMsk(new Date().toLocaleTimeString("ru-RU", { timeZone: OBJ_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return msk;
}

function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);

  const WMO: Record<number, [string, string]> = {
    0: ["Ясно","☀️"], 1: ["Малооблачно","🌤️"], 2: ["Переменная облачность","⛅"],
    3: ["Пасмурно","☁️"], 45: ["Туман","🌫️"], 48: ["Изморозь","🌫️"],
    51: ["Морось","🌦️"], 53: ["Морось","🌦️"], 55: ["Сильная морось","🌧️"],
    61: ["Дождь","🌧️"], 63: ["Умеренный дождь","🌧️"], 65: ["Ливень","🌧️"],
    71: ["Снег","🌨️"], 73: ["Умеренный снег","❄️"], 75: ["Метель","🌨️"],
    80: ["Ливень","🌦️"], 81: ["Сильный ливень","🌧️"], 95: ["Гроза","⛈️"], 96: ["Гроза с градом","⛈️"],
  };

  useEffect(() => {
    const fetch_w = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${OBJ_LAT}&longitude=${OBJ_LON}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&wind_speed_unit=ms&timezone=${OBJ_TZ}`;
        const res = await fetch(url);
        const data = await res.json();
        const c = data.current;
        const [desc, icon] = WMO[c.weather_code as number] ?? ["Нет данных","🌡️"];
        setWeather({
          temp: Math.round(c.temperature_2m),
          windSpeed: Math.round(c.wind_speed_10m),
          windDir: c.wind_direction_10m,
          humidity: c.relative_humidity_2m,
          pressure: Math.round(c.surface_pressure * 0.750062),
          desc, icon,
          updated: new Date().toLocaleTimeString("ru-RU", { timeZone: OBJ_TZ, hour: "2-digit", minute: "2-digit" }),
        });
      } catch {
        setWeather({ temp: 0, windSpeed: 0, windDir: 0, humidity: 0, pressure: 0, desc: "Нет связи", icon: "❌", updated: "--:--" });
      } finally {
        setLoading(false);
      }
    };
    fetch_w();
    const t = setInterval(fetch_w, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  return { weather, loading };
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
        const pad = (n: number) => String(n).padStart(2, "0");
        const now = new Date();
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

// ─── Печать ───────────────────────────────────────────────────────────────────

function printAccident(acc: AccidentState, weather: Weather | null) {
  const atype = ACCIDENT_TYPES.find(t => t.id === acc.type)!;
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/>
<title>Аварийный листок — ВГСЧ</title>
<style>
  @page{margin:15mm;size:A4}
  body{font-family:Arial,sans-serif;font-size:13px;color:#111}
  h1{font-size:22px;text-transform:uppercase;text-align:center;border-bottom:3px solid #cc0000;padding-bottom:8px;margin-bottom:16px}
  .org{text-align:center;font-size:11px;color:#555;margin-bottom:4px}
  .alarm{background:#cc0000;color:white;font-size:28px;font-weight:bold;text-align:center;padding:12px;letter-spacing:4px;border-radius:4px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  td{padding:6px 10px;border:1px solid #ccc;vertical-align:top}
  td:first-child{font-weight:bold;width:42%;background:#f5f5f5}
  .sec{font-size:11px;font-weight:bold;text-transform:uppercase;color:#555;letter-spacing:1px;margin:14px 0 4px}
  .footer{margin-top:20px;font-size:10px;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:8px}
  .sig{margin-top:30px;display:flex;justify-content:space-between;font-size:12px}
  .sig div{border-top:1px solid #333;width:45%;text-align:center;padding-top:4px}
</style></head><body>
<div class="org">ФГУП ВГСЧ МЧС России</div>
<h1>Аварийный листок</h1>
<div class="alarm">⚠ ${atype.label}</div>
<div class="sec">Время и место</div>
<table>
  <tr><td>Время объявления (местное)</td><td>${acc.startedAt}</td></tr>
  <tr><td>Время объявления (МСК)</td><td>${acc.startedAtMsk}</td></tr>
  <tr><td>ОПО (объект)</td><td>${acc.opo}</td></tr>
  <tr><td>Место аварии</td><td>${acc.location || "—"}</td></tr>
  <tr><td>Вид аварии</td><td><b>${atype.label}</b></td></tr>
</table>
<div class="sec">Ответственные лица</div>
<table>
  <tr><td>Командир отряда</td><td>${acc.commanderSquad}</td></tr>
  <tr><td>Командир взвода / пункта</td><td>${acc.commanderPlatoon}</td></tr>
  <tr><td>Командир отделения</td><td>${acc.commanderUnit}</td></tr>
  <tr><td>Дежурный у средств связи</td><td>${acc.commDuty}</td></tr>
</table>
${weather ? `<div class="sec">Погодные условия</div><table>
  <tr><td>Температура воздуха</td><td>${weather.temp > 0 ? "+" : ""}${weather.temp} °C</td></tr>
  <tr><td>Ветер</td><td>${weather.windSpeed} м/с, направление: ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}</td></tr>
  <tr><td>Влажность</td><td>${weather.humidity}%</td></tr>
  <tr><td>Давление</td><td>${weather.pressure} мм рт. ст.</td></tr>
  <tr><td>Описание</td><td>${weather.desc}</td></tr>
</table>` : ""}
<div class="sig"><div>Дежурный оператор</div><div>Принял командир</div></div>
<div class="footer">Распечатано: ${new Date().toLocaleString("ru-RU")} | ФГУП ВГСЧ МЧС России | АРМ Дежурного</div>
</body></html>`;
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TabloPage() {
  const time    = useClock();
  const mskTime = useMoscowTime();
  const { weather, loading: weatherLoading } = useWeather();
  const sensors = useLiveSensors();

  // ← читаем из localStorage и подписываемся на изменения из АРМ
  const [acc, setAcc] = useState<AccidentState>(loadAccident);
  useEffect(() => subscribeAccident(setAcc), []);

  const [flashRed, setFlashRed] = useState(false);
  useEffect(() => {
    if (!acc.active) { setFlashRed(false); return; }
    const t = setInterval(() => setFlashRed(f => !f), 600);
    return () => clearInterval(t);
  }, [acc.active]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const localTimeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const localDateStr = time.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
  const isSameTz = Intl.DateTimeFormat().resolvedOptions().timeZone === OBJ_TZ;

  const cancel = () => {
    const cleared = { ...DEFAULT_STATE };
    setAcc(cleared);
    saveAccident(cleared);
  };

  const atype   = ACCIDENT_TYPES.find(t => t.id === acc.type)!;
  const gasCrit = sensors.filter(s => s.status === "critical").length;
  const gasWarn = sensors.filter(s => s.status === "warning").length;
  const bgMain  = acc.active ? (flashRed ? "hsl(0 70% 8%)" : "hsl(0 60% 5%)") : "hsl(220 20% 4%)";

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{
        background: bgMain,
        backgroundImage: "linear-gradient(hsl(220 18% 9% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(220 18% 9% / 0.5) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        fontFamily: "IBM Plex Sans, sans-serif",
        color: "hsl(210 20% 92%)",
        transition: "background 0.3s",
      }}
    >

      {/* ══ ШАПКА ══════════════════════════════════════════════════════════════ */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: acc.active ? "hsl(0 80% 30%)" : "hsl(220 12% 14%)", background: "hsl(220 20% 4% / 0.95)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded flex items-center justify-center font-bold text-white text-lg flex-shrink-0"
            style={{ background: acc.active ? "#cc0000" : "hsl(14 90% 52%)", fontFamily: "Oswald, sans-serif", transition: "background 0.3s" }}>
            В
          </div>
          <div>
            <div style={{ fontSize: 9, color: "hsl(210 10% 50%)", textTransform: "uppercase", letterSpacing: "0.1em" }}>ФГУП ВГСЧ МЧС России</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, fontWeight: 700, color: acc.active ? "#ff4444" : "hsl(14 90% 52%)", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.1 }}>
              Оперативное табло
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Местное время */}
          <div className="text-center">
            <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>Местное</div>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{localTimeStr}</div>
            <div style={{ fontSize: 10, color: "hsl(210 10% 50%)", marginTop: 1 }}>{localDateStr}</div>
          </div>

          {!isSameTz && (
            <>
              <div style={{ width: 1, height: 40, background: "hsl(220 12% 18%)" }} />
              <div className="text-center">
                <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>Москва (МСК)</div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 26, fontWeight: 700, color: "hsl(14 90% 52%)", lineHeight: 1 }}>{mskTime}</div>
                <div style={{ fontSize: 10, color: "hsl(210 10% 50%)", marginTop: 1 }}>UTC+3</div>
              </div>
            </>
          )}

          {/* Погода */}
          <div style={{ width: 1, height: 40, background: "hsl(220 12% 18%)" }} />
          <div>
            <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
              Погода {weatherLoading ? "…" : `(обн. ${weather?.updated})`}
            </div>
            {weather ? (
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 20 }}>{weather.icon}</span>
                <div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                    {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                  </div>
                  <div style={{ fontSize: 10, color: "hsl(210 10% 55%)" }}>
                    💨{weather.windSpeed}м/с {WIND_DIRS[Math.round(weather.windDir / 45) % 8]} · 💧{weather.humidity}% · {weather.pressure}мм
                  </div>
                </div>
              </div>
            ) : <div style={{ fontSize: 12, color: "hsl(210 10% 45%)" }}>Загрузка…</div>}
          </div>

          {/* Газ */}
          <div style={{ width: 1, height: 40, background: "hsl(220 12% 18%)" }} />
          <div>
            <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>АГК / Газ</div>
            <div className="flex gap-3">
              <div className="text-center">
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700, color: gasCrit > 0 ? "#ff4422" : "hsl(210 20% 70%)" }}>{gasCrit}</div>
                <div style={{ fontSize: 9, color: "hsl(210 10% 45%)" }}>крит.</div>
              </div>
              <div className="text-center">
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700, color: gasWarn > 0 ? "#ffbb00" : "hsl(210 20% 70%)" }}>{gasWarn}</div>
                <div style={{ fontSize: 9, color: "hsl(210 10% 45%)" }}>внимание</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ══ КРАСНОЕ ТАБЛО АВАРИИ ═══════════════════════════════════════════════ */}
      {acc.active && (
        <div
          className="mx-6 mt-4 rounded-lg px-8 py-5 flex items-start justify-between gap-6"
          style={{
            background: flashRed ? "hsl(0 80% 20%)" : "hsl(0 80% 15%)",
            border: `2px solid ${flashRed ? "#ff3300" : "#aa2200"}`,
            boxShadow: flashRed ? "0 0 40px hsl(0 80% 30%)" : "0 0 20px hsl(0 80% 20%)",
            transition: "all 0.3s",
          }}
        >
          {/* Вид + место */}
          <div className="flex items-start gap-6">
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 48, fontWeight: 900, color: flashRed ? "#ff6644" : "#ff4422", letterSpacing: "0.06em", lineHeight: 1 }}>
              ⚠ АВАРИЯ
            </div>
            <div style={{ width: 2, height: 55, background: "hsl(0 60% 30%)", marginTop: 4 }} />
            <div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, fontWeight: 700, color: atype.color, textTransform: "uppercase", lineHeight: 1 }}>
                {atype.label}
              </div>
              <div style={{ fontSize: 13, color: "hsl(0 20% 75%)", marginTop: 4 }}>{acc.opo}</div>
              {acc.location && <div style={{ fontSize: 12, color: "hsl(0 20% 60%)", marginTop: 2 }}>📍 {acc.location}</div>}
            </div>
          </div>

          {/* Ответственные */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 flex-1 min-w-0">
            {[
              { label: "Командир отряда",      value: acc.commanderSquad },
              { label: "Командир взвода",       value: acc.commanderPlatoon },
              { label: "Командир отделения",    value: acc.commanderUnit },
              { label: "Деж. у средств связи",  value: acc.commDuty },
            ].map(r => (
              <div key={r.label}>
                <div style={{ fontSize: 9, color: "hsl(0 20% 50%)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{r.label}</div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, fontWeight: 600, color: "#ffccaa" }}>{r.value}</div>
              </div>
            ))}
          </div>

          {/* Время + кнопки */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <div style={{ fontSize: 9, color: "hsl(0 20% 50%)", textTransform: "uppercase" }}>Объявлено</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, fontWeight: 700, color: "#ff8866" }}>{acc.startedAt}</div>
              <div style={{ fontSize: 10, color: "hsl(0 20% 45%)" }}>МСК: {acc.startedAtMsk}</div>
            </div>
            <button
              onClick={() => printAccident(acc, weather)}
              style={{ background: "hsl(0 50% 25%)", border: "1px solid hsl(0 50% 38%)", color: "#ffcccc", padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              🖨 Печать
            </button>
            <button
              onClick={cancel}
              style={{ background: "hsl(220 14% 12%)", border: "1px solid hsl(220 12% 22%)", color: "hsl(210 10% 55%)", padding: "5px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
            >
              Отбой
            </button>
          </div>
        </div>
      )}

      {/* ══ ШТАТНЫЙ РЕЖИМ ══════════════════════════════════════════════════════ */}
      {!acc.active && (
        <div className="mx-6 mt-4 rounded px-6 py-3 flex items-center gap-3"
          style={{ background: "hsl(220 14% 9%)", border: "1px solid hsl(220 12% 16%)" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: "hsl(142 70% 45%)" }} />
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, color: "hsl(142 70% 45%)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Штатный режим — аварий нет
          </span>
          <span style={{ fontSize: 11, color: "hsl(210 10% 40%)", marginLeft: 6 }}>
            Управление аварией — в АРМ дежурного
          </span>
        </div>
      )}

      {/* ══ ГАЗОВЫЙ КОНТРОЛЬ ═══════════════════════════════════════════════════ */}
      <div className="flex-1 p-6">
        <div style={{ fontSize: 10, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 10 }}>
          Газовый контроль АГК
        </div>
        <div className="grid grid-cols-3 gap-3">
          {sensors.map(s => {
            const isCrit = s.status === "critical";
            const isWarn = s.status === "warning";
            const accent = isCrit ? "#ff4422" : isWarn ? "#ffbb00" : "#44cc77";
            const bg     = isCrit ? "hsl(0 60% 8%)" : isWarn ? "hsl(40 60% 8%)" : "hsl(220 14% 9%)";
            const border = isCrit ? "hsl(0 60% 28%)" : isWarn ? "hsl(40 60% 26%)" : "hsl(220 12% 16%)";
            return (
              <div key={s.id} className="rounded p-3" style={{ background: bg, border: `1px solid ${border}` }}>
                <div className="flex justify-between items-center mb-2">
                  <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, color: accent, fontSize: 14 }}>{s.id}</span>
                  <span style={{ fontSize: 10, color: "hsl(210 10% 40%)", fontFamily: "IBM Plex Mono, monospace" }}>{s.updated}</span>
                </div>
                <div style={{ fontSize: 10, color: "hsl(210 10% 50%)", marginBottom: 6 }}>{s.location}</div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { l: "CH₄", v: s.ch4.toFixed(2), u: "%",   warn: s.ch4 >= 0.5, crit: s.ch4 >= 1.0 },
                    { l: "CO",  v: s.co.toFixed(1),  u: "ppm", warn: s.co  >= 17,  crit: s.co  >= 34 },
                    { l: "O₂",  v: s.o2.toFixed(2),  u: "%",   warn: s.o2  <= 19,  crit: s.o2  <= 17 },
                  ].map(g => {
                    const gc = g.crit ? "#ff4422" : g.warn ? "#ffbb00" : "#44cc77";
                    return (
                      <div key={g.l} style={{ textAlign: "center", background: "hsl(220 14% 12%)", borderRadius: 3, padding: "4px 2px" }}>
                        <div style={{ fontSize: 8, color: "hsl(210 10% 45%)" }}>{g.l}</div>
                        <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13, fontWeight: 700, color: gc, lineHeight: 1.1 }}>{g.v}</div>
                        <div style={{ fontSize: 8, color: "hsl(210 10% 40%)" }}>{g.u}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
