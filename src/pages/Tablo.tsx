import { useState, useEffect } from "react";
import {
  type AccidentState,
  ACCIDENT_TYPES,
  WEATHER_CONDITIONS,
  DEFAULT_STATE,
  loadAccident,
  saveAccident,
  subscribeAccident,
} from "@/lib/accidentStore";

const WIND_DIRS = ["С","СВ","В","ЮВ","Ю","ЮЗ","З","СЗ"];

const CITY_STORAGE_KEY = "vgsch_weather_city";
const CITIES_GEO: { name: string; lat: number; lon: number; tz: string }[] = [
  { name: "Москва",           lat: 55.7558, lon: 37.6173, tz: "Europe/Moscow" },
  { name: "Санкт-Петербург", lat: 59.9343, lon: 30.3351, tz: "Europe/Moscow" },
  { name: "Новосибирск",      lat: 54.9833, lon: 82.8964, tz: "Asia/Novosibirsk" },
  { name: "Екатеринбург",     lat: 56.8431, lon: 60.6454, tz: "Asia/Yekaterinburg" },
  { name: "Кемерово",         lat: 55.3908, lon: 86.0847, tz: "Asia/Krasnoyarsk" },
  { name: "Ростов-на-Дону",  lat: 47.2224, lon: 39.7187, tz: "Europe/Moscow" },
  { name: "Воркута",          lat: 67.4992, lon: 64.0552, tz: "Europe/Moscow" },
  { name: "Инта",             lat: 66.0339, lon: 60.1203, tz: "Europe/Moscow" },
  { name: "Шахты",            lat: 47.7083, lon: 40.2167, tz: "Europe/Moscow" },
  { name: "Прокопьевск",      lat: 53.8872, lon: 86.7355, tz: "Asia/Krasnoyarsk" },
  { name: "Сибай",            lat: 52.7167, lon: 58.6667, tz: "Asia/Yekaterinburg" },
  { name: "Соль-Илецк",       lat: 51.1614, lon: 54.9986, tz: "Asia/Yekaterinburg" },
  { name: "Гай",              lat: 51.4667, lon: 58.4500, tz: "Asia/Yekaterinburg" },
  { name: "Пласт",            lat: 54.3667, lon: 60.8167, tz: "Asia/Yekaterinburg" },
  { name: "пос. Межозерный",  lat: 54.0600, lon: 59.8700, tz: "Asia/Yekaterinburg" },
  { name: "Копейск",          lat: 55.1167, lon: 61.6167, tz: "Asia/Yekaterinburg" },
];

interface Weather {
  temp: number; windSpeed: number; windDir: number;
  humidity: number; pressure: number; desc: string; icon: string; updated: string;
}

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return time;
}

function useMoscowTime() {
  const [msk, setMsk] = useState("");
  useEffect(() => {
    const update = () => setMsk(new Date().toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return msk;
}

const WMO: Record<number, [string, string]> = {
  0:["Ясно","☀️"],1:["Малооблачно","🌤️"],2:["Переменная облачность","⛅"],3:["Пасмурно","☁️"],
  45:["Туман","🌫️"],48:["Изморозь","🌫️"],51:["Морось","🌦️"],53:["Морось","🌦️"],55:["Сильная морось","🌧️"],
  61:["Дождь","🌧️"],63:["Умеренный дождь","🌧️"],65:["Ливень","🌧️"],71:["Снег","🌨️"],73:["Умеренный снег","❄️"],
  75:["Метель","🌨️"],80:["Ливень","🌦️"],81:["Сильный ливень","🌧️"],95:["Гроза","⛈️"],96:["Гроза с градом","⛈️"],
};

function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [cityName, setCityName] = useState(() => localStorage.getItem(CITY_STORAGE_KEY) ?? "Москва");

  useEffect(() => {
    const onStorage = () => { const v = localStorage.getItem(CITY_STORAGE_KEY) ?? "Москва"; setCityName(v); };
    window.addEventListener("storage", onStorage);
    const poll = setInterval(onStorage, 3000);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(poll); };
  }, []);

  useEffect(() => {
    const city = CITIES_GEO.find(c => c.name === cityName) ?? CITIES_GEO[0];
    const fetch_w = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&wind_speed_unit=ms&timezone=${city.tz}`;
        const res = await fetch(url);
        const data = await res.json();
        const c = data.current;
        const [desc, icon] = WMO[c.weather_code as number] ?? ["Нет данных","🌡️"];
        setWeather({
          temp: Math.round(c.temperature_2m), windSpeed: Math.round(c.wind_speed_10m),
          windDir: c.wind_direction_10m, humidity: c.relative_humidity_2m,
          pressure: Math.round(c.surface_pressure * 0.750062), desc, icon,
          updated: `${city.name} · ${new Date().toLocaleTimeString("ru-RU", { timeZone: city.tz, hour: "2-digit", minute: "2-digit" })}`,
        });
      } catch {
        setWeather({ temp: 0, windSpeed: 0, windDir: 0, humidity: 0, pressure: 0, desc: "Нет связи", icon: "❌", updated: "--:--" });
      }
    };
    fetch_w();
    const t = setInterval(fetch_w, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cityName]);

  return weather;
}

// ─── Цвета темы (светло-синяя, как щит ВГСЧ) ────────────────────────────────
// Спокойный режим — светлый синий фон, тёмный текст
// Аварийный — красный фон с мигалкой

const T = {
  // Фоны
  pageBg:     "hsl(210 55% 92%)",          // очень светло-голубой
  headerBg:   "hsl(210 60% 38%)",          // насыщенный синий как щит
  cardBg:     "hsl(210 45% 96%)",          // белёсый
  cardBg2:    "hsl(210 50% 88%)",          // чуть темнее для акцента
  weatherBg:  "hsl(210 40% 93%)",

  // Текст
  textMain:   "hsl(210 30% 15%)",          // почти чёрный синеватый
  textSub:    "hsl(210 20% 40%)",          // серо-синий
  textMuted:  "hsl(210 15% 58%)",          // приглушённый

  // Границы
  border:     "hsl(210 35% 78%)",
  borderHdr:  "hsl(210 50% 28%)",

  // Акценты
  accent:     "hsl(210 90% 30%)",          // тёмно-синий акцент
  orange:     "hsl(28 90% 48%)",           // оранжевый для ответственных
  green:      "hsl(142 60% 36%)",          // зелёный для штатного

  // Header (светлый текст на синем фоне)
  hdrText:    "hsl(210 80% 97%)",
  hdrSub:     "hsl(210 40% 78%)",
};

// Аварийные цвета
const RED = {
  pageBg1: "hsl(0 70% 14%)",
  pageBg2: "hsl(0 60% 10%)",
  border1:  "#ff3300",
  border2:  "#991100",
  accent:   "#ff5533",
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TabloPage() {
  const time    = useClock();
  const mskTime = useMoscowTime();
  const weather = useWeather();

  const [acc, setAcc] = useState<AccidentState>(loadAccident);
  useEffect(() => subscribeAccident(setAcc), []);

  const [flashRed, setFlashRed] = useState(false);
  useEffect(() => {
    if (!acc.active) { setFlashRed(false); return; }
    const t = setInterval(() => setFlashRed(f => !f), 700);
    return () => clearInterval(t);
  }, [acc.active]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const localTimeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const localDateStr = time.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
  const isSameTz = Intl.DateTimeFormat().resolvedOptions().timeZone === "Europe/Moscow";

  const cancel = () => { setAcc({ ...DEFAULT_STATE }); saveAccident({ ...DEFAULT_STATE }); };
  const atype  = ACCIDENT_TYPES.find(t => t.id === acc.type)!;

  const pageBg = acc.active
    ? (flashRed ? RED.pageBg1 : RED.pageBg2)
    : T.pageBg;

  // Сетка: светлая на синем фоне, не видна если страница светлая
  const gridLine = acc.active
    ? "hsl(0 40% 20% / 0.4)"
    : "hsl(210 40% 82% / 0.7)";

  // Метка над значением
  const lbl = (color = T.textMuted): React.CSSProperties => ({
    fontSize: 11, color, textTransform: "uppercase", letterSpacing: "0.1em",
    fontWeight: 700, marginBottom: 4, fontFamily: "IBM Plex Sans, sans-serif",
  });

  return (
    <div
      className="h-screen flex flex-col select-none overflow-hidden"
      style={{
        background: pageBg,
        backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        fontFamily: "IBM Plex Sans, sans-serif",
        color: acc.active ? "hsl(45 60% 90%)" : T.textMain,
        transition: "background 0.4s, color 0.4s",
      }}
    >

      {/* ══ ШАПКА ════════════════════════════════════════════════════════════════ */}
      <header
        className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b"
        style={{
          background: acc.active ? "hsl(0 70% 12%)" : T.headerBg,
          borderColor: acc.active ? (flashRed ? RED.border1 : RED.border2) : T.borderHdr,
          transition: "background 0.4s, border-color 0.4s",
        }}
      >
        {/* Лого */}
        <div className="flex items-center gap-3">
          <img
            src="https://cdn.poehali.dev/projects/e8b93a3a-e9ed-40ee-8196-78090d463984/bucket/cdb862bf-f0a2-4d2b-899b-eb676c919290.png"
            alt="ВГСЧ"
            style={{ width: 44, height: 44, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 10, color: T.hdrSub, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              ФГУП ВГСЧ МЧС России
            </div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700, color: T.hdrText, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.1 }}>
              Оперативное табло
            </div>
          </div>
        </div>

        {/* Время + погода */}
        <div className="flex items-center gap-6">

          {/* Местное время */}
          <div className="text-center">
            <div style={lbl(T.hdrSub)}>{isSameTz ? "Местное время" : "Время"}</div>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 34, fontWeight: 700, lineHeight: 1, color: T.hdrText }}>
              {localTimeStr}
            </div>
            <div style={{ fontSize: 10, color: T.hdrSub, marginTop: 2, textTransform: "capitalize" }}>{localDateStr}</div>
          </div>

          {!isSameTz && (
            <>
              <div style={{ width: 1, height: 44, background: T.borderHdr }} />
              <div className="text-center">
                <div style={lbl(T.hdrSub)}>Москва МСК</div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 34, fontWeight: 700, lineHeight: 1, color: "hsl(45 90% 70%)" }}>
                  {mskTime}
                </div>
                <div style={{ fontSize: 10, color: T.hdrSub, marginTop: 2 }}>UTC+3</div>
              </div>
            </>
          )}

          {weather && (
            <>
              <div style={{ width: 1, height: 44, background: T.borderHdr }} />
              <div>
                <div style={lbl(T.hdrSub)}>Погода · {weather.updated}</div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 28 }}>{weather.icon}</span>
                  <div>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, fontWeight: 700, lineHeight: 1, color: T.hdrText }}>
                      {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                    </div>
                    <div style={{ fontSize: 11, color: T.hdrSub, marginTop: 2 }}>
                      💨 {weather.windSpeed} м/с {WIND_DIRS[Math.round(weather.windDir / 45) % 8]}  ·  💧 {weather.humidity}%  ·  {weather.pressure} мм
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ══ ТЕЛО ═════════════════════════════════════════════════════════════════ */}
      {acc.active ? (

        /* ─── АВАРИЙНЫЙ РЕЖИМ ────────────────────────────────────────────────── */
        <div className="flex-1 flex flex-col px-5 py-3 gap-3 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Строка 1: ВИД + МЕСТО + ВРЕМЯ */}
          <div
            className="rounded-xl px-6 py-4 flex items-center gap-6 flex-shrink-0"
            style={{
              background: flashRed ? "hsl(0 80% 18%)" : "hsl(0 75% 12%)",
              border: `3px solid ${flashRed ? RED.border1 : RED.border2}`,
              boxShadow: flashRed ? "0 0 50px hsl(0 80% 22%)" : "0 0 20px hsl(0 70% 12%)",
              transition: "all 0.4s",
            }}
          >
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 42, fontWeight: 900,
              color: flashRed ? "#ff6644" : "#ff4422", letterSpacing: "0.06em", lineHeight: 1, flexShrink: 0 }}>
              ⚠ АВАРИЯ
            </div>

            <div style={{ width: 3, height: 54, background: "hsl(0 50% 35%)", flexShrink: 0 }} />

            <div style={{ flexShrink: 0 }}>
              <div style={lbl("hsl(0 30% 55%)")}>Вид аварии</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 36, fontWeight: 900,
                color: atype.color, textTransform: "uppercase", lineHeight: 1, letterSpacing: "0.04em" }}>
                {atype.label}
              </div>
            </div>

            <div style={{ width: 3, height: 54, background: "hsl(0 50% 35%)", flexShrink: 0 }} />

            <div className="flex-1 min-w-0">
              <div style={lbl("hsl(0 30% 60%)")}>ОПО / Место аварии</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700,
                color: "hsl(0 10% 95%)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {acc.opo}
              </div>
              {acc.location && (
                <div style={{ fontSize: 15, color: "hsl(0 20% 72%)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  📍 {acc.location}
                </div>
              )}
            </div>

            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <div style={lbl("hsl(0 30% 55%)")}>Объявлено</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 28, fontWeight: 700, color: "#ff9977", lineHeight: 1 }}>
                {acc.startedAt}
              </div>
              <div style={{ fontSize: 12, color: "hsl(0 20% 50%)", marginTop: 2 }}>МСК: {acc.startedAtMsk}</div>
            </div>
          </div>

          {/* Строка 2: Погода + Ответственные */}
          <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

            {/* Погода */}
            <div className="rounded-xl p-4 flex flex-col"
              style={{ background: "hsl(213 50% 20%)", border: "1px solid hsl(213 45% 32%)" }}>
              <div style={{ fontSize: 11, color: "hsl(24 80% 56%)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10 }}>
                Погодные условия
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {weather && (
                  <>
                    <span style={{ fontSize: 36 }}>{weather.icon}</span>
                    <div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
                        {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                      </div>
                      <div style={{ fontSize: 13, color: "hsl(213 15% 55%)", marginTop: 3 }}>{weather.desc}</div>
                    </div>
                  </>
                )}
                {acc.weatherCondition && (() => {
                  const wc = WEATHER_CONDITIONS.find(w => w.id === acc.weatherCondition);
                  return wc ? (
                    <div className="rounded-lg px-3 py-2 flex items-center gap-2"
                      style={{ background: "hsl(24 70% 18%)", border: "2px solid hsl(24 80% 40%)" }}>
                      <span style={{ fontSize: 28 }}>{wc.icon}</span>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 700, color: "hsl(24 90% 65%)", textTransform: "uppercase" }}>
                        {wc.label}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
              {weather && (
                <div className="grid grid-cols-3 gap-2 mt-auto pt-3">
                  {[
                    { l: "Ветер", v: `${weather.windSpeed} м/с ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}` },
                    { l: "Влажность", v: `${weather.humidity}%` },
                    { l: "Давление", v: `${weather.pressure} мм` },
                  ].map(r => (
                    <div key={r.l} className="rounded-lg p-2 text-center" style={{ background: "hsl(213 45% 26%)" }}>
                      <div style={{ fontSize: 10, color: "hsl(213 15% 48%)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.l}</div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700, marginTop: 2 }}>{r.v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ответственные */}
            <div className="rounded-xl p-4 flex flex-col"
              style={{ background: "hsl(213 52% 18%)", border: "2px solid hsl(24 80% 42%)" }}>
              <div style={{ fontSize: 13, color: "#ff9944", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8, fontWeight: 800, fontFamily: "Oswald, sans-serif" }}>
                👤 Ответственные лица
              </div>
              <div className="flex flex-col flex-1" style={{ gap: 0 }}>
                {[
                  { label: "Ответственный по отряду",          value: acc.commanderSquad },
                  { label: "Ответственный по взводу / пункту", value: acc.commanderPlatoon },
                  { label: "Командир дежурного отделения",     value: acc.commanderUnit },
                  { label: "Дежурный у средств связи",         value: acc.commDuty },
                ].map((r, i) => (
                  <div key={r.label} className="flex items-center gap-2 py-2"
                    style={{ borderBottom: i < 3 ? "1px solid hsl(213 40% 26%)" : "none", flex: 1 }}>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, fontWeight: 900, color: "hsl(24 70% 45%)", lineHeight: 1, flexShrink: 0, width: 26, textAlign: "center" }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 10, color: "hsl(213 15% 55%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2, fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 700, color: r.value ? "hsl(210 10% 98%)" : "hsl(213 15% 38%)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.value || "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={cancel}
                className="mt-2 py-2 rounded-lg transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: "hsl(213 45% 26%)", border: "1px solid hsl(213 40% 36%)", color: "hsl(213 20% 68%)", fontSize: 13 }}>
                Отбой аварии
              </button>
            </div>
          </div>
        </div>

      ) : (

        /* ─── ШТАТНЫЙ РЕЖИМ ──────────────────────────────────────────────────── */
        <div className="flex-1 flex flex-col gap-3 px-5 py-3 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Статус — штатный */}
          <div className="rounded-xl px-7 py-3 flex items-center justify-between flex-shrink-0"
            style={{ background: T.cardBg2, border: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: T.green, boxShadow: `0 0 8px ${T.green}` }} />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, color: T.green, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Штатный режим — аварий нет
              </span>
            </div>
            <div style={{ fontSize: 13, color: T.textSub }}>
              Управление аварией — в АРМ дежурного
            </div>
          </div>

          {/* Погода + Ответственные */}
          <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

            {/* Погода */}
            <div className="rounded-xl p-5 flex flex-col"
              style={{ background: T.cardBg, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.orange, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14, fontWeight: 700 }}>
                Погодные условия{weather ? ` · ${weather.updated}` : ""}
              </div>
              <div className="flex items-center gap-5 mb-4 flex-wrap">
                {weather && (
                  <>
                    <span style={{ fontSize: 52 }}>{weather.icon}</span>
                    <div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 52, fontWeight: 700, lineHeight: 1, color: T.textMain }}>
                        {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                      </div>
                      <div style={{ fontSize: 15, color: T.textSub, marginTop: 4 }}>{weather.desc}</div>
                    </div>
                  </>
                )}
                {acc.weatherCondition && (() => {
                  const wc = WEATHER_CONDITIONS.find(w => w.id === acc.weatherCondition);
                  return wc ? (
                    <div className="rounded-xl px-5 py-3 flex items-center gap-3"
                      style={{ background: "hsl(28 70% 92%)", border: "2px solid hsl(28 80% 68%)" }}>
                      <span style={{ fontSize: 38 }}>{wc.icon}</span>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, fontWeight: 700, color: T.orange, textTransform: "uppercase" }}>
                        {wc.label}
                      </div>
                    </div>
                  ) : null;
                })()}
                {!weather && !acc.weatherCondition && (
                  <div style={{ color: T.textMuted, fontSize: 16 }}>Нет данных</div>
                )}
              </div>
              {weather && (
                <div className="grid grid-cols-3 gap-3 mt-auto">
                  {[
                    { l: "Ветер", v: `${weather.windSpeed} м/с ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}` },
                    { l: "Влажность", v: `${weather.humidity}%` },
                    { l: "Давление", v: `${weather.pressure} мм` },
                  ].map(r => (
                    <div key={r.l} className="rounded-xl p-3 text-center"
                      style={{ background: T.cardBg2, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{r.l}</div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, fontWeight: 700, color: T.textMain }}>{r.v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ответственные */}
            <div className="rounded-xl p-5 flex flex-col"
              style={{ background: T.cardBg, border: `2px solid hsl(28 60% 72%)` }}>
              <div style={{ fontSize: 14, color: T.orange, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12, fontWeight: 800, fontFamily: "Oswald, sans-serif" }}>
                👤 Ответственные лица
              </div>
              <div className="flex flex-col flex-1" style={{ gap: 0 }}>
                {[
                  { label: "Ответственный по отряду",          value: acc.commanderSquad },
                  { label: "Ответственный по взводу / пункту", value: acc.commanderPlatoon },
                  { label: "Командир дежурного отделения",     value: acc.commanderUnit },
                  { label: "Дежурный у средств связи",         value: acc.commDuty },
                ].map((r, i) => (
                  <div key={r.label} className="flex items-center gap-3 py-3"
                    style={{ borderBottom: i < 3 ? `1px solid ${T.border}` : "none", flex: 1 }}>
                    <div style={{
                      fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 900,
                      color: T.orange, lineHeight: 1, flexShrink: 0, width: 30, textAlign: "center",
                    }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 3, fontWeight: 600 }}>{r.label}</div>
                      <div style={{
                        fontFamily: "Oswald, sans-serif",
                        fontSize: 28,
                        fontWeight: 700,
                        color: r.value ? T.textMain : T.textMuted,
                        lineHeight: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {r.value || "— не назначен —"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══ ПОДПИСЬ ══════════════════════════════════════════════════════════════ */}
      <footer
        className="flex-shrink-0 px-6 py-2 flex items-center justify-end border-t"
        style={{
          borderColor: acc.active ? "hsl(0 30% 24%)" : T.border,
          background: acc.active ? "hsl(0 60% 10%)" : T.headerBg,
          transition: "background 0.4s",
        }}
      >
        <div style={{ fontSize: 11, color: T.hdrSub, letterSpacing: "0.04em" }}>
          Разработчик:&nbsp;
          <span style={{ color: T.hdrText, fontWeight: 600 }}>
            СДС филиала «Копейский ВГСО»&nbsp;С.Г.&nbsp;Ипатов
          </span>
        </div>
      </footer>
    </div>
  );
}
