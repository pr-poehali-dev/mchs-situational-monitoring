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
  { name: "Москва",              lat: 55.7558, lon: 37.6173, tz: "Europe/Moscow" },
  { name: "Санкт-Петербург",    lat: 59.9343, lon: 30.3351, tz: "Europe/Moscow" },
  { name: "Новосибирск",         lat: 54.9833, lon: 82.8964, tz: "Asia/Novosibirsk" },
  { name: "Екатеринбург",        lat: 56.8431, lon: 60.6454, tz: "Asia/Yekaterinburg" },
  { name: "Кемерово",            lat: 55.3908, lon: 86.0847, tz: "Asia/Krasnoyarsk" },
  { name: "Ростов-на-Дону",     lat: 47.2224, lon: 39.7187, tz: "Europe/Moscow" },
  { name: "Воркута",             lat: 67.4992, lon: 64.0552, tz: "Europe/Moscow" },
  { name: "Инта",                lat: 66.0339, lon: 60.1203, tz: "Europe/Moscow" },
  { name: "Шахты",               lat: 47.7083, lon: 40.2167, tz: "Europe/Moscow" },
  { name: "Прокопьевск",         lat: 53.8872, lon: 86.7355, tz: "Asia/Krasnoyarsk" },
  { name: "Сибай",               lat: 52.7167, lon: 58.6667, tz: "Asia/Yekaterinburg" },
  { name: "Соль-Илецк",          lat: 51.1614, lon: 54.9986, tz: "Asia/Yekaterinburg" },
  { name: "Гай",                 lat: 51.4667, lon: 58.4500, tz: "Asia/Yekaterinburg" },
  { name: "Пласт",               lat: 54.3667, lon: 60.8167, tz: "Asia/Yekaterinburg" },
  { name: "пос. Межозерный",     lat: 54.0600, lon: 59.8700, tz: "Asia/Yekaterinburg" },
  { name: "Копейск",             lat: 55.1167, lon: 61.6167, tz: "Asia/Yekaterinburg" },
];

function getSelectedCity() {
  const name = localStorage.getItem(CITY_STORAGE_KEY) ?? "Москва";
  return CITIES_GEO.find(c => c.name === name) ?? CITIES_GEO[0];
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
    const onStorage = () => {
      const v = localStorage.getItem(CITY_STORAGE_KEY) ?? "Москва";
      setCityName(v);
    };
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
          updated: `${city.name}, обн. ${new Date().toLocaleTimeString("ru-RU", { timeZone: city.tz, hour: "2-digit", minute: "2-digit" })}`,
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

// ─── Печать ──────────────────────────────────────────────────────────────────

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
  <tr><td>По отряду</td><td>${acc.commanderSquad}</td></tr>
  <tr><td>По взводу / пункту</td><td>${acc.commanderPlatoon}</td></tr>
  <tr><td>Командир отделения</td><td>${acc.commanderUnit}</td></tr>
  <tr><td>Дежурный у средств связи</td><td>${acc.commDuty}</td></tr>
</table>
${weather ? `<div class="sec">Погодные условия</div><table>
  <tr><td>Температура</td><td>${weather.temp > 0 ? "+" : ""}${weather.temp} °C</td></tr>
  <tr><td>Ветер</td><td>${weather.windSpeed} м/с, ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}</td></tr>
  <tr><td>Влажность</td><td>${weather.humidity}%</td></tr>
  <tr><td>Давление</td><td>${weather.pressure} мм рт. ст.</td></tr>
  <tr><td>Описание</td><td>${weather.desc}</td></tr>
  ${acc.weatherCondition ? `<tr><td>Особые условия</td><td><b>${WEATHER_CONDITIONS.find(w => w.id === acc.weatherCondition)?.icon ?? ""} ${WEATHER_CONDITIONS.find(w => w.id === acc.weatherCondition)?.label ?? ""}</b></td></tr>` : ""}
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
  const isSameTz = Intl.DateTimeFormat().resolvedOptions().timeZone === OBJ_TZ;

  const cancel = () => { setAcc({ ...DEFAULT_STATE }); saveAccident({ ...DEFAULT_STATE }); };
  const atype  = ACCIDENT_TYPES.find(t => t.id === acc.type)!;

  const C = {
    bg:      acc.active ? (flashRed ? "hsl(0 70% 8%)" : "hsl(0 60% 5%)") : "hsl(220 20% 4%)",
    border:  acc.active ? (flashRed ? "#ff3300" : "#881100") : "hsl(220 12% 14%)",
    accent:  acc.active ? "#ff4422" : "hsl(14 90% 52%)",
  };

  // Стиль метки-заголовка
  const lbl = (color = "hsl(210 10% 45%)"): React.CSSProperties => ({
    fontSize: 11, color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600,
    marginBottom: 4, fontFamily: "IBM Plex Sans, sans-serif",
  });

  return (
    <div
      className="min-h-screen flex flex-col select-none overflow-hidden"
      style={{
        background: C.bg,
        backgroundImage: "linear-gradient(hsl(220 18% 9% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(220 18% 9% / 0.4) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        fontFamily: "IBM Plex Sans, sans-serif",
        color: "hsl(210 20% 92%)",
        transition: "background 0.4s",
      }}
    >

      {/* ══ ШАПКА: лого + время + погода ════════════════════════════════════════ */}
      <header className="flex items-center justify-between px-8 py-4 flex-shrink-0 border-b"
        style={{ borderColor: C.border, background: "hsl(220 20% 3% / 0.95)", transition: "border-color 0.4s" }}>

        {/* Лого */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded flex items-center justify-center font-bold text-white flex-shrink-0"
            style={{ background: C.accent, fontFamily: "Oswald, sans-serif", fontSize: 20, transition: "background 0.4s" }}>
            В
          </div>
          <div>
            <div style={{ fontSize: 10, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.12em" }}>ФГУП ВГСЧ МЧС России</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.1, transition: "color 0.4s" }}>
              Оперативное табло
            </div>
          </div>
        </div>

        {/* Время местное */}
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div style={lbl()}>Местное время</div>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 38, fontWeight: 700, lineHeight: 1, color: "hsl(210 20% 95%)" }}>
              {localTimeStr}
            </div>
            <div style={{ fontSize: 11, color: "hsl(210 10% 50%)", marginTop: 2, textTransform: "capitalize" }}>{localDateStr}</div>
          </div>

          {!isSameTz && (
            <>
              <div style={{ width: 1, height: 50, background: "hsl(220 12% 18%)" }} />
              <div className="text-center">
                <div style={lbl()}>Москва (МСК)</div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 38, fontWeight: 700, lineHeight: 1, color: C.accent }}>
                  {mskTime}
                </div>
                <div style={{ fontSize: 11, color: "hsl(210 10% 50%)", marginTop: 2 }}>UTC+3</div>
              </div>
            </>
          )}

          {/* Погода */}
          {weather && (
            <>
              <div style={{ width: 1, height: 50, background: "hsl(220 12% 18%)" }} />
              <div>
                <div style={lbl()}>Погода (обн. {weather.updated})</div>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 32 }}>{weather.icon}</span>
                  <div>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                      {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                    </div>
                    <div style={{ fontSize: 12, color: "hsl(210 10% 55%)", marginTop: 2 }}>
                      💨 {weather.windSpeed} м/с {WIND_DIRS[Math.round(weather.windDir / 45) % 8]}
                      &nbsp;·&nbsp; 💧 {weather.humidity}%
                      &nbsp;·&nbsp; {weather.pressure} мм
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ══ БЛОК АВАРИИ ══════════════════════════════════════════════════════════ */}
      {acc.active ? (
        <div className="flex-1 flex flex-col px-8 py-6 gap-6">

          {/* Строка 1: ВИД + МЕСТО — крупно, во всю ширину */}
          <div className="rounded-xl px-10 py-8 flex items-center gap-10"
            style={{
              background: flashRed ? "hsl(0 80% 18%)" : "hsl(0 75% 12%)",
              border: `3px solid ${flashRed ? "#ff3300" : "#881100"}`,
              boxShadow: flashRed ? "0 0 60px hsl(0 80% 25%)" : "0 0 30px hsl(0 70% 15%)",
              transition: "all 0.4s",
            }}>

            {/* ⚠ АВАРИЯ */}
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 64, fontWeight: 900,
              color: flashRed ? "#ff6644" : "#ff4422", letterSpacing: "0.06em", lineHeight: 1, flexShrink: 0 }}>
              ⚠ АВАРИЯ
            </div>

            <div style={{ width: 3, height: 80, background: "hsl(0 50% 35%)", flexShrink: 0 }} />

            {/* Вид аварии */}
            <div style={{ flexShrink: 0 }}>
              <div style={lbl("hsl(0 30% 55%)")}>Вид аварии</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 56, fontWeight: 900,
                color: atype.color, textTransform: "uppercase", lineHeight: 1, letterSpacing: "0.04em" }}>
                {atype.label}
              </div>
            </div>

            <div style={{ width: 3, height: 80, background: "hsl(0 50% 35%)", flexShrink: 0 }} />

            {/* Место аварии */}
            <div className="flex-1 min-w-0">
              <div style={lbl("hsl(0 30% 55%)")}>ОПО / Место аварии</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 34, fontWeight: 700,
                color: "hsl(0 10% 92%)", lineHeight: 1.2 }}>
                {acc.opo}
              </div>
              {acc.location && (
                <div style={{ fontSize: 22, color: "hsl(0 20% 70%)", marginTop: 6 }}>
                  📍 {acc.location}
                </div>
              )}
            </div>

            {/* Время объявления */}
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <div style={lbl("hsl(0 30% 55%)")}>Объявлено</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 40, fontWeight: 700,
                color: "#ff9977", lineHeight: 1 }}>
                {acc.startedAt}
              </div>
              <div style={{ fontSize: 14, color: "hsl(0 20% 50%)", marginTop: 4 }}>МСК: {acc.startedAtMsk}</div>
            </div>
          </div>

          {/* Строка 2: Ответственные + Погода */}
          <div className="grid grid-cols-2 gap-6 flex-1">

            {/* Ответственные лица */}
            <div className="rounded-xl p-8"
              style={{ background: "hsl(220 16% 9%)", border: "1px solid hsl(220 12% 18%)" }}>
              <div style={lbl()}>Ответственные лица</div>
              <div className="grid grid-cols-2 gap-6 mt-4">
                {[
                  { label: "По отряду",            value: acc.commanderSquad },
                  { label: "По взводу / пункту",   value: acc.commanderPlatoon },
                  { label: "Командир отделения",   value: acc.commanderUnit },
                  { label: "Деж. у средств связи", value: acc.commDuty },
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ fontSize: 12, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                      {r.label}
                    </div>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700, color: "#ffddbb", lineHeight: 1.1 }}>
                      {r.value || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Погода + кнопки */}
            <div className="flex flex-col gap-4">
              {weather && (
                <div className="rounded-xl p-8 flex-1"
                  style={{ background: "hsl(220 16% 9%)", border: "1px solid hsl(220 12% 18%)" }}>
                  <div style={lbl()}>Погодные условия</div>
                  <div className="flex items-center gap-4 mt-4">
                    <span style={{ fontSize: 48 }}>{weather.icon}</span>
                    <div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>
                        {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                      </div>
                      <div style={{ fontSize: 16, color: "hsl(210 10% 55%)", marginTop: 6 }}>{weather.desc}</div>
                    </div>
                    {/* Ручное условие из АРМ */}
                    {acc.weatherCondition && (() => {
                      const wc = WEATHER_CONDITIONS.find(w => w.id === acc.weatherCondition);
                      return wc ? (
                        <div className="ml-4 rounded-lg px-5 py-3 flex items-center gap-3"
                          style={{ background: "hsl(45 80% 20%)", border: "1px solid hsl(45 80% 35%)" }}>
                          <span style={{ fontSize: 32 }}>{wc.icon}</span>
                          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 700, color: "hsl(45 90% 70%)", textTransform: "uppercase" }}>
                            {wc.label}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    {[
                      { l: "Ветер", v: `${weather.windSpeed} м/с ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}` },
                      { l: "Влажность", v: `${weather.humidity}%` },
                      { l: "Давление", v: `${weather.pressure} мм` },
                    ].map(r => (
                      <div key={r.l} className="rounded-lg p-3 text-center"
                        style={{ background: "hsl(220 14% 13%)" }}>
                        <div style={{ fontSize: 11, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.l}</div>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 700, marginTop: 2 }}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Кнопки управления */}
              <div className="flex gap-3">
                <button onClick={() => printAccident(acc, weather)}
                  className="flex-1 py-4 rounded-xl font-bold uppercase tracking-widest transition-all hover:opacity-90"
                  style={{ background: "hsl(0 50% 22%)", border: "1px solid hsl(0 50% 35%)",
                    color: "#ffcccc", fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: "0.1em" }}>
                  🖨 Распечатать
                </button>
                <button onClick={cancel}
                  className="flex-1 py-4 rounded-xl transition-all hover:opacity-90"
                  style={{ background: "hsl(220 14% 13%)", border: "1px solid hsl(220 12% 22%)",
                    color: "hsl(210 10% 55%)", fontSize: 15 }}>
                  Отбой аварии
                </button>
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* ══ ШТАТНЫЙ РЕЖИМ ════════════════════════════════════════════════════ */
        <div className="flex-1 flex flex-col gap-5 p-8">

          {/* Статус — штатный */}
          <div className="rounded-2xl px-10 py-5 flex items-center justify-between"
            style={{ background: "hsl(220 14% 9%)", border: "1px solid hsl(220 12% 16%)" }}>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: "hsl(142 70% 45%)" }} />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, color: "hsl(142 70% 45%)",
                textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Штатный режим — аварий нет
              </span>
            </div>
            <div style={{ fontSize: 13, color: "hsl(210 10% 40%)" }}>
              Управление аварией — в АРМ дежурного
            </div>
          </div>

          {/* Главный блок: ответственные + погода */}
          <div className="grid grid-cols-2 gap-5 flex-1">

            {/* Ответственные лица — всегда */}
            <div className="rounded-2xl p-8"
              style={{ background: "hsl(220 14% 9%)", border: "1px solid hsl(220 12% 16%)" }}>
              <div style={{ fontSize: 11, color: "hsl(210 10% 40%)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 20 }}>
                Ответственные лица
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                {[
                  { label: "По отряду",            value: acc.commanderSquad },
                  { label: "По взводу / пункту",   value: acc.commanderPlatoon },
                  { label: "Командир отделения",   value: acc.commanderUnit },
                  { label: "Деж. у средств связи", value: acc.commDuty },
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ fontSize: 11, color: "hsl(210 10% 42%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                      {r.label}
                    </div>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 30, fontWeight: 700, color: r.value ? "#e8d5b0" : "hsl(210 10% 30%)", lineHeight: 1.1 }}>
                      {r.value || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Погода в штатном режиме */}
            {weather && (
              <div className="rounded-2xl p-8"
                style={{ background: "hsl(220 14% 9%)", border: "1px solid hsl(220 12% 16%)" }}>
                <div style={{ fontSize: 11, color: "hsl(210 10% 40%)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 20 }}>
                  Погодные условия · {weather.updated}
                </div>
                <div className="flex items-center gap-5 mb-6">
                  <span style={{ fontSize: 56 }}>{weather.icon}</span>
                  <div>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 56, fontWeight: 700, lineHeight: 1 }}>
                      {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                    </div>
                    <div style={{ fontSize: 18, color: "hsl(210 10% 55%)", marginTop: 6 }}>{weather.desc}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { l: "Ветер", v: `${weather.windSpeed} м/с ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}` },
                    { l: "Влажность", v: `${weather.humidity}%` },
                    { l: "Давление", v: `${weather.pressure} мм` },
                  ].map(r => (
                    <div key={r.l} className="rounded-xl p-4 text-center"
                      style={{ background: "hsl(220 14% 13%)" }}>
                      <div style={{ fontSize: 11, color: "hsl(210 10% 45%)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.l}</div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, fontWeight: 700, marginTop: 4 }}>{r.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ ПОДПИСЬ ══════════════════════════════════════════════════════════════ */}
      <footer className="flex-shrink-0 px-8 py-3 flex items-center justify-end border-t"
        style={{ borderColor: "hsl(220 12% 12%)", background: "hsl(220 20% 3% / 0.95)" }}>
        <div style={{ fontSize: 11, color: "hsl(210 10% 30%)", letterSpacing: "0.04em" }}>
          Разработчик:&nbsp;
          <span style={{ color: "hsl(14 80% 45%)", fontWeight: 600 }}>
            СДС филиала «Копейский ВГСО»&nbsp;С.Г.&nbsp;Ипатов
          </span>
        </div>
      </footer>
    </div>
  );
}