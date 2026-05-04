import { useState, useEffect, useRef } from "react";

// ─── Координаты объекта (можно поменять под реальное расположение шахты) ─────
const OBJ_LAT = 55.7558;
const OBJ_LON = 37.6173;
const OBJ_TZ  = "Europe/Moscow"; // для московского времени

// ─── Types ────────────────────────────────────────────────────────────────────

type AccidentType = "fire" | "explosion" | "flood" | "collapse" | "water_break";

interface AccidentState {
  active: boolean;
  type: AccidentType;
  opo: string;
  location: string;
  commanderSquad: string;   // командир отряда
  commanderPlatoon: string; // командир взвода / пункта
  commanderUnit: string;    // командир отделения
  commDuty: string;         // дежурный у средств связи
  startedAt: string;        // время объявления
  startedAtMsk: string;
}

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

// ─── Справочники ─────────────────────────────────────────────────────────────

const ACCIDENT_TYPES: { id: AccidentType; label: string; color: string; bg: string }[] = [
  { id: "fire",        label: "ПОЖАР",           color: "#ff4422", bg: "rgba(255,68,34,0.12)" },
  { id: "explosion",   label: "ВЗРЫВ",           color: "#ff8800", bg: "rgba(255,136,0,0.12)" },
  { id: "flood",       label: "ЗАТОПЛЕНИЕ",      color: "#2299ff", bg: "rgba(34,153,255,0.12)" },
  { id: "collapse",    label: "ОБРУШЕНИЕ",       color: "#cc8800", bg: "rgba(204,136,0,0.12)" },
  { id: "water_break", label: "ПРОРЫВ ВОДЫ",     color: "#00aacc", bg: "rgba(0,170,204,0.12)" },
];

const WIND_DIRS = ["С","СВ","В","ЮВ","Ю","ЮЗ","З","СЗ"];

const OPO_LIST = [
  "Шахта «Северная», гор. -320 м",
  "Шахта «Северная», гор. -480 м",
  "Шахта «Северная», гор. -620 м",
  "Шахта «Заречная», гор. -350 м",
  "Шахта «Заречная», гор. -500 м",
  "Разрез «Центральный», карьер",
  "Обогатительная фабрика №2",
];

const PERSONNEL = [
  "Иванов А.С.", "Петрова М.И.", "Сидоров К.В.", "Козлов Р.Д.",
  "Лебедев В.Н.", "Морозов П.А.", "Новиков С.Г.", "Захаров Д.Е.",
];

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
      const s = new Date().toLocaleTimeString("ru-RU", { timeZone: OBJ_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setMsk(s);
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

  const WMO_DESC: Record<number, [string, string]> = {
    0: ["Ясно", "☀️"], 1: ["Малооблачно", "🌤️"], 2: ["Переменная облачность", "⛅"],
    3: ["Пасмурно", "☁️"], 45: ["Туман", "🌫️"], 48: ["Изморозь", "🌫️"],
    51: ["Морось", "🌦️"], 53: ["Морось", "🌦️"], 55: ["Сильная морось", "🌧️"],
    61: ["Дождь", "🌧️"], 63: ["Умеренный дождь", "🌧️"], 65: ["Ливень", "🌧️"],
    71: ["Снег", "🌨️"], 73: ["Умеренный снег", "❄️"], 75: ["Метель", "🌨️"],
    80: ["Ливень", "🌦️"], 81: ["Сильный ливень", "🌧️"], 95: ["Гроза", "⛈️"],
    96: ["Гроза с градом", "⛈️"],
  };

  const fetch_weather = async () => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${OBJ_LAT}&longitude=${OBJ_LON}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&wind_speed_unit=ms&timezone=${OBJ_TZ}`;
      const res = await fetch(url);
      const data = await res.json();
      const c = data.current;
      const wcode = c.weather_code as number;
      const [desc, icon] = WMO_DESC[wcode] ?? ["Нет данных", "🌡️"];
      const dirIdx = Math.round(c.wind_direction_10m / 45) % 8;
      const now = new Date().toLocaleTimeString("ru-RU", { timeZone: OBJ_TZ, hour: "2-digit", minute: "2-digit" });
      setWeather({
        temp: Math.round(c.temperature_2m),
        windSpeed: Math.round(c.wind_speed_10m),
        windDir: c.wind_direction_10m,
        humidity: c.relative_humidity_2m,
        pressure: Math.round(c.surface_pressure * 0.750062),
        desc,
        icon,
        updated: now,
      });
    } catch {
      setWeather({ temp: 0, windSpeed: 0, windDir: 0, humidity: 0, pressure: 0, desc: "Нет связи", icon: "❌", updated: "--:--" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch_weather();
    const t = setInterval(fetch_weather, 5 * 60 * 1000);
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

// ─── Печать ──────────────────────────────────────────────────────────────────

function printAccident(acc: AccidentState, weather: Weather | null, localTime: string, mskTime: string) {
  const atype = ACCIDENT_TYPES.find(t => t.id === acc.type)!;
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<title>Аварийный листок — ВГСЧ</title>
<style>
  @page { margin: 15mm; size: A4; }
  body { font-family: 'Arial', sans-serif; font-size: 13px; color: #111; }
  h1 { font-size: 22px; text-transform: uppercase; text-align: center; border-bottom: 3px solid #cc0000; padding-bottom: 8px; margin-bottom: 16px; }
  .org { text-align: center; font-size: 11px; color: #555; margin-bottom: 4px; }
  .alarm { background: #cc0000; color: white; font-size: 28px; font-weight: bold; text-align: center; padding: 12px; letter-spacing: 4px; border-radius: 4px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  td { padding: 6px 10px; border: 1px solid #ccc; vertical-align: top; }
  td:first-child { font-weight: bold; width: 42%; background: #f5f5f5; }
  .section { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #555; letter-spacing: 1px; margin: 14px 0 4px; }
  .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
  .sig { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; }
  .sig div { border-top: 1px solid #333; width: 45%; text-align: center; padding-top: 4px; }
</style>
</head>
<body>
<div class="org">ФГУП ВГСЧ МЧС России</div>
<h1>Аварийный листок</h1>
<div class="alarm">⚠ ${atype.label}</div>

<div class="section">Время и место</div>
<table>
  <tr><td>Время объявления (местное)</td><td>${acc.startedAt}</td></tr>
  <tr><td>Время объявления (МСК)</td><td>${acc.startedAtMsk}</td></tr>
  <tr><td>ОПО (объект)</td><td>${acc.opo}</td></tr>
  <tr><td>Место аварии</td><td>${acc.location}</td></tr>
  <tr><td>Вид аварии</td><td><b>${atype.label}</b></td></tr>
</table>

<div class="section">Ответственные лица</div>
<table>
  <tr><td>Командир отряда</td><td>${acc.commanderSquad}</td></tr>
  <tr><td>Командир взвода / пункта</td><td>${acc.commanderPlatoon}</td></tr>
  <tr><td>Командир отделения</td><td>${acc.commanderUnit}</td></tr>
  <tr><td>Дежурный у средств связи</td><td>${acc.commDuty}</td></tr>
</table>

${weather ? `
<div class="section">Погодные условия</div>
<table>
  <tr><td>Температура воздуха</td><td>${weather.temp > 0 ? "+" : ""}${weather.temp} °C</td></tr>
  <tr><td>Скорость ветра</td><td>${weather.windSpeed} м/с, направление: ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}</td></tr>
  <tr><td>Влажность</td><td>${weather.humidity}%</td></tr>
  <tr><td>Давление</td><td>${weather.pressure} мм рт. ст.</td></tr>
  <tr><td>Описание</td><td>${weather.desc}</td></tr>
</table>
` : ""}

<div class="sig">
  <div>Дежурный оператор</div>
  <div>Принял командир</div>
</div>

<div class="footer">
  Распечатано: ${new Date().toLocaleString("ru-RU")} &nbsp;|&nbsp; ФГУП ВГСЧ МЧС России &nbsp;|&nbsp; АРМ Дежурного
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ─── Компоненты ──────────────────────────────────────────────────────────────

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: "hsl(220 14% 12%)",
          border: "1px solid hsl(220 12% 20%)",
          color: "hsl(210 20% 90%)",
          padding: "5px 8px",
          borderRadius: 4,
          fontSize: 12,
          fontFamily: "IBM Plex Sans, sans-serif",
          width: "100%",
          outline: "none",
        }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: "hsl(220 14% 12%)",
          border: "1px solid hsl(220 12% 20%)",
          color: "hsl(210 20% 90%)",
          padding: "5px 8px",
          borderRadius: 4,
          fontSize: 12,
          fontFamily: "IBM Plex Sans, sans-serif",
          width: "100%",
          outline: "none",
        }}
      />
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TabloPage() {
  const time     = useClock();
  const mskTime  = useMoscowTime();
  const { weather, loading: weatherLoading } = useWeather();
  const sensors  = useLiveSensors();
  const alarmRef = useRef<HTMLAudioElement | null>(null);

  const pad = (n: number) => String(n).padStart(2, "0");
  const localTimeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const localDateStr = time.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });

  const localTzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isSameTz = localTzName === OBJ_TZ;

  const [acc, setAcc] = useState<AccidentState>({
    active: false,
    type: "fire",
    opo: OPO_LIST[0],
    location: "",
    commanderSquad: PERSONNEL[0],
    commanderPlatoon: PERSONNEL[1],
    commanderUnit: PERSONNEL[2],
    commDuty: PERSONNEL[3],
    startedAt: "",
    startedAtMsk: "",
  });

  const [flashRed, setFlashRed] = useState(false);

  useEffect(() => {
    if (acc.active) {
      const flash = setInterval(() => setFlashRed(f => !f), 600);
      return () => clearInterval(flash);
    } else {
      setFlashRed(false);
    }
  }, [acc.active]);

  const declareAccident = () => {
    const localNow = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const mskNow   = new Date().toLocaleTimeString("ru-RU", { timeZone: OBJ_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setAcc(prev => ({ ...prev, active: true, startedAt: localNow, startedAtMsk: mskNow }));
  };

  const cancelAccident = () => setAcc(prev => ({ ...prev, active: false }));

  const atype = ACCIDENT_TYPES.find(t => t.id === acc.type)!;

  const gasCrit  = sensors.filter(s => s.status === "critical").length;
  const gasWarn  = sensors.filter(s => s.status === "warning").length;

  const bgMain   = acc.active
    ? (flashRed ? "hsl(0 70% 8%)" : "hsl(0 60% 5%)")
    : "hsl(220 20% 4%)";

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
        style={{ borderColor: acc.active ? "hsl(0 80% 30%)" : "hsl(220 12% 14%)", background: "hsl(220 20% 4% / 0.9)" }}
      >
        {/* Лого */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded flex items-center justify-center font-bold text-white text-lg flex-shrink-0"
            style={{ background: acc.active ? "#cc0000" : "hsl(14 90% 52%)", fontFamily: "Oswald, sans-serif", transition: "background 0.3s" }}>
            В
          </div>
          <div>
            <div style={{ fontSize: 9, color: "hsl(210 10% 50%)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              ФГУП ВГСЧ МЧС России
            </div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, fontWeight: 700, color: acc.active ? "#ff4444" : "hsl(14 90% 52%)", lineHeight: 1.1, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Оперативное табло
            </div>
          </div>
        </div>

        {/* Время */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>
              Местное
            </div>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 26, fontWeight: 700, color: "hsl(210 20% 92%)", lineHeight: 1 }}>
              {localTimeStr}
            </div>
            <div style={{ fontSize: 10, color: "hsl(210 10% 50%)", marginTop: 1 }}>{localDateStr}</div>
          </div>

          {!isSameTz && (
            <>
              <div style={{ width: 1, height: 40, background: "hsl(220 12% 18%)" }} />
              <div className="text-center">
                <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>
                  Москва (МСК)
                </div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 26, fontWeight: 700, color: "hsl(14 90% 52%)", lineHeight: 1 }}>
                  {mskTime}
                </div>
                <div style={{ fontSize: 10, color: "hsl(210 10% 50%)", marginTop: 1 }}>UTC+3</div>
              </div>
            </>
          )}

          {/* Погода */}
          <div style={{ width: 1, height: 40, background: "hsl(220 12% 18%)" }} />
          <div className="text-center">
            <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>
              Погода {weatherLoading ? "…" : `(обн. ${weather?.updated})`}
            </div>
            {weather ? (
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 22 }}>{weather.icon}</span>
                <div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                    {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                  </div>
                  <div style={{ fontSize: 10, color: "hsl(210 10% 55%)" }}>
                    💨 {weather.windSpeed} м/с {WIND_DIRS[Math.round(weather.windDir / 45) % 8]} · 💧{weather.humidity}% · {weather.pressure} мм
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "hsl(210 10% 45%)" }}>Загрузка…</div>
            )}
          </div>

          {/* Газ-сводка */}
          <div style={{ width: 1, height: 40, background: "hsl(220 12% 18%)" }} />
          <div className="text-center">
            <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              АГК / Газ
            </div>
            <div className="flex items-center gap-2">
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, fontWeight: 700, color: gasCrit > 0 ? "#ff4422" : "hsl(210 20% 80%)" }}>{gasCrit}</div>
                <div style={{ fontSize: 9, color: "hsl(210 10% 45%)" }}>крит.</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, fontWeight: 700, color: gasWarn > 0 ? "#ffbb00" : "hsl(210 20% 80%)" }}>{gasWarn}</div>
                <div style={{ fontSize: 9, color: "hsl(210 10% 45%)" }}>внимание</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ══ КРАСНОЕ ТАБЛО АВАРИИ ═══════════════════════════════════════════════ */}
      {acc.active && (
        <div
          className="mx-6 mt-4 rounded-lg px-8 py-5 flex items-center justify-between"
          style={{
            background: flashRed ? "hsl(0 80% 20%)" : "hsl(0 80% 15%)",
            border: `2px solid ${flashRed ? "#ff3300" : "#aa2200"}`,
            boxShadow: flashRed ? "0 0 40px hsl(0 80% 30%)" : "0 0 20px hsl(0 80% 20%)",
            transition: "all 0.3s",
          }}
        >
          <div className="flex items-center gap-6">
            <div
              style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: 42,
                fontWeight: 900,
                color: flashRed ? "#ff6644" : "#ff4422",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              ⚠ АВАРИЯ
            </div>
            <div style={{ width: 2, height: 50, background: "hsl(0 60% 30%)" }} />
            <div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700, color: atype.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {atype.label}
              </div>
              <div style={{ fontSize: 12, color: "hsl(0 20% 75%)", marginTop: 2 }}>{acc.opo}</div>
              {acc.location && <div style={{ fontSize: 11, color: "hsl(0 20% 60%)", marginTop: 1 }}>📍 {acc.location}</div>}
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "hsl(0 20% 55%)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Объявлено</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 20, fontWeight: 700, color: "#ff8866" }}>{acc.startedAt}</div>
              <div style={{ fontSize: 10, color: "hsl(0 20% 50%)" }}>МСК: {acc.startedAtMsk}</div>
            </div>
            <button
              onClick={() => printAccident(acc, weather, localTimeStr, mskTime)}
              style={{
                background: "hsl(0 50% 25%)",
                border: "1px solid hsl(0 50% 40%)",
                color: "#ffcccc",
                padding: "8px 16px",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              🖨 Печать
            </button>
            <button
              onClick={cancelAccident}
              style={{
                background: "hsl(220 14% 12%)",
                border: "1px solid hsl(220 12% 25%)",
                color: "hsl(210 10% 60%)",
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Отбой
            </button>
          </div>
        </div>
      )}

      {/* ══ ОСНОВНОЕ ТЕЛО ══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 gap-4 p-6 overflow-hidden">

        {/* ── Левая: форма аварии ── */}
        <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: 280 }}>
          <div style={{ fontSize: 10, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            Параметры аварии
          </div>

          {/* Вид аварии */}
          <div>
            <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Вид аварии</div>
            <div className="grid grid-cols-1 gap-1.5">
              {ACCIDENT_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setAcc(prev => ({ ...prev, type: t.id }))}
                  style={{
                    background: acc.type === t.id ? t.bg : "hsl(220 14% 10%)",
                    border: `1px solid ${acc.type === t.id ? t.color + "66" : "hsl(220 12% 17%)"}`,
                    color: acc.type === t.id ? t.color : "hsl(210 10% 55%)",
                    padding: "6px 10px",
                    borderRadius: 5,
                    fontSize: 12,
                    fontWeight: acc.type === t.id ? 700 : 400,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "Oswald, sans-serif",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    transition: "all 0.15s",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ОПО и место */}
          <Select label="ОПО (опасный производственный объект)" value={acc.opo} onChange={v => setAcc(p => ({ ...p, opo: v }))} options={OPO_LIST} />
          <Field label="Место аварии (уточнение)" value={acc.location} onChange={v => setAcc(p => ({ ...p, location: v }))} placeholder="Напр.: гор. -620 м, камера №7" />

          <div style={{ fontSize: 9, color: "hsl(210 10% 35%)", borderTop: "1px solid hsl(220 12% 16%)", paddingTop: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Ответственные лица
          </div>

          <Select label="Командир отряда" value={acc.commanderSquad} onChange={v => setAcc(p => ({ ...p, commanderSquad: v }))} options={PERSONNEL} />
          <Select label="Командир взвода / пункта" value={acc.commanderPlatoon} onChange={v => setAcc(p => ({ ...p, commanderPlatoon: v }))} options={PERSONNEL} />
          <Select label="Командир отделения" value={acc.commanderUnit} onChange={v => setAcc(p => ({ ...p, commanderUnit: v }))} options={PERSONNEL} />
          <Select label="Дежурный у средств связи" value={acc.commDuty} onChange={v => setAcc(p => ({ ...p, commDuty: v }))} options={PERSONNEL} />

          {/* Кнопка АВАРИЯ */}
          <div className="mt-2">
            {!acc.active ? (
              <button
                onClick={declareAccident}
                style={{
                  width: "100%",
                  background: "hsl(0 80% 45%)",
                  border: "none",
                  color: "white",
                  padding: "14px",
                  borderRadius: 8,
                  fontSize: 18,
                  fontWeight: 900,
                  fontFamily: "Oswald, sans-serif",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "0 0 20px hsl(0 80% 30%)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = "hsl(0 80% 55%)"; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = "hsl(0 80% 45%)"; }}
              >
                🚨 АВАРИЯ
              </button>
            ) : (
              <button
                onClick={cancelAccident}
                style={{
                  width: "100%",
                  background: "hsl(220 14% 14%)",
                  border: "1px solid hsl(220 12% 25%)",
                  color: "hsl(210 10% 55%)",
                  padding: "10px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "IBM Plex Sans, sans-serif",
                }}
              >
                Отбой аварии
              </button>
            )}
          </div>

          {/* Погода-детали */}
          {weather && (
            <div className="rounded p-3 mt-1" style={{ background: "hsl(220 14% 9%)", border: "1px solid hsl(220 12% 16%)" }}>
              <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Погодные условия</div>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 24 }}>{weather.icon}</span>
                <div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700 }}>{weather.temp > 0 ? "+" : ""}{weather.temp}°C</div>
                  <div style={{ fontSize: 10, color: "hsl(210 10% 50%)" }}>{weather.desc}</div>
                </div>
              </div>
              {[
                { l: "Ветер", v: `${weather.windSpeed} м/с, ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}` },
                { l: "Влажность", v: `${weather.humidity}%` },
                { l: "Давление", v: `${weather.pressure} мм рт.ст.` },
              ].map(r => (
                <div key={r.l} className="flex justify-between" style={{ fontSize: 11, borderBottom: "1px solid hsl(220 12% 14%)", padding: "3px 0" }}>
                  <span style={{ color: "hsl(210 10% 45%)" }}>{r.l}</span>
                  <span>{r.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Центр и правая: ответственные + газ ── */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">

          {/* Ответственные — карточки */}
          {acc.active && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Командир отряда", value: acc.commanderSquad, color: "#ff8844" },
                { label: "Командир взвода / пункта", value: acc.commanderPlatoon, color: "#ffbb44" },
                { label: "Командир отделения", value: acc.commanderUnit, color: "#88ccff" },
                { label: "Дежурный у средств связи", value: acc.commDuty, color: "#88dd88" },
              ].map(card => (
                <div key={card.label} className="rounded p-4" style={{ background: "hsl(220 14% 10%)", border: "1px solid hsl(220 12% 18%)" }}>
                  <div style={{ fontSize: 9, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Газовый контроль */}
          <div className="flex-1 overflow-auto">
            <div style={{ fontSize: 10, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>
              Газовый контроль АГК
            </div>
            <div className="grid grid-cols-3 gap-2">
              {sensors.map(s => {
                const isCrit = s.status === "critical";
                const isWarn = s.status === "warning";
                const accent = isCrit ? "#ff4422" : isWarn ? "#ffbb00" : "#44cc77";
                const bg     = isCrit ? "hsl(0 60% 8%)" : isWarn ? "hsl(40 60% 8%)" : "hsl(220 14% 9%)";
                const border = isCrit ? "hsl(0 60% 30%)" : isWarn ? "hsl(40 60% 28%)" : "hsl(220 12% 16%)";
                return (
                  <div key={s.id} className="rounded p-3" style={{ background: bg, border: `1px solid ${border}` }}>
                    <div className="flex justify-between items-center mb-2">
                      <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, color: accent, fontSize: 14 }}>{s.id}</span>
                      <span style={{ fontSize: 9, color: "hsl(210 10% 40%)", fontFamily: "IBM Plex Mono, monospace" }}>{s.updated}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "hsl(210 10% 50%)", marginBottom: 6 }}>{s.location}</div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { l: "CH₄", v: s.ch4.toFixed(2), u: "%", w: s.ch4 >= 0.5, c: s.ch4 >= 1.0 },
                        { l: "CO",  v: s.co.toFixed(1),  u: "ppm", w: s.co >= 17, c: s.co >= 34 },
                        { l: "O₂",  v: s.o2.toFixed(2),  u: "%", w: s.o2 <= 19, c: s.o2 <= 17 },
                      ].map(g => {
                        const gc = g.c ? "#ff4422" : g.w ? "#ffbb00" : "#44cc77";
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
      </div>
    </div>
  );
}
