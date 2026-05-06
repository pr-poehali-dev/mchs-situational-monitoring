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

  const C = {
    bg:      acc.active ? (flashRed ? "hsl(0 65% 14%)" : "hsl(0 55% 10%)") : "hsl(213 55% 15%)",
    border:  acc.active ? (flashRed ? "#ff4400" : "#aa1100") : "hsl(213 45% 30%)",
    accent:  acc.active ? "#ff5533" : "hsl(24 95% 52%)",
  };

  // Стиль метки-заголовка (подпись над значением)
  const lbl = (color = "hsl(210 10% 52%)"): React.CSSProperties => ({
    fontSize: 12, color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
    marginBottom: 6, fontFamily: "IBM Plex Sans, sans-serif",
  });

  return (
    <div
      className="min-h-screen flex flex-col select-none overflow-hidden"
      style={{
        background: C.bg,
        backgroundImage: "linear-gradient(hsl(213 40% 22% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(213 40% 22% / 0.5) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        fontFamily: "IBM Plex Sans, sans-serif",
        color: "hsl(45 60% 90%)",
        transition: "background 0.4s",
      }}
    >

      {/* ══ ШАПКА ════════════════════════════════════════════════════════════════ */}
      <header className="flex items-center justify-between px-8 py-4 flex-shrink-0 border-b"
        style={{ borderColor: C.border, background: "hsl(213 58% 12% / 0.97)", transition: "border-color 0.4s" }}>

        {/* Лого */}
        <div className="flex items-center gap-4">
          <img src="https://cdn.poehali.dev/projects/e8b93a3a-e9ed-40ee-8196-78090d463984/bucket/cdb862bf-f0a2-4d2b-899b-eb676c919290.png" alt="ВГСЧ"
            style={{ width: 52, height: 52, flexShrink: 0, boxShadow: `0 0 14px ${C.accent}55`, transition: "box-shadow 0.4s" }} />
          <div>
            <div style={{ fontSize: 11, color: "hsl(213 15% 46%)", textTransform: "uppercase", letterSpacing: "0.12em" }}>ФГУП ВГСЧ МЧС России</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.1, transition: "color 0.4s" }}>
              Оперативное табло
            </div>
          </div>
        </div>

        {/* Время */}
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div style={lbl()}>{ isSameTz ? "Местное время" : "Время" }</div>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 42, fontWeight: 700, lineHeight: 1, color: "hsl(210 20% 96%)" }}>
              {localTimeStr}
            </div>
            <div style={{ fontSize: 11, color: "hsl(210 10% 50%)", marginTop: 3, textTransform: "capitalize" }}>{localDateStr}</div>
          </div>

          {!isSameTz && (
            <>
              <div style={{ width: 1, height: 52, background: "hsl(213 30% 26%)" }} />
              <div className="text-center">
                <div style={lbl()}>Москва (МСК)</div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 42, fontWeight: 700, lineHeight: 1, color: C.accent }}>
                  {mskTime}
                </div>
                <div style={{ fontSize: 11, color: "hsl(210 10% 50%)", marginTop: 3 }}>UTC+3</div>
              </div>
            </>
          )}

          {weather && (
            <>
              <div style={{ width: 1, height: 52, background: "hsl(213 30% 26%)" }} />
              <div>
                <div style={lbl()}>Погода · {weather.updated}</div>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 34 }}>{weather.icon}</span>
                  <div>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
                      {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                    </div>
                    <div style={{ fontSize: 12, color: "hsl(213 15% 54%)", marginTop: 2 }}>
                      💨 {weather.windSpeed} м/с {WIND_DIRS[Math.round(weather.windDir / 45) % 8]} &nbsp;·&nbsp; 💧 {weather.humidity}% &nbsp;·&nbsp; {weather.pressure} мм
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
        <div className="flex-1 flex flex-col px-6 py-4 gap-4 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Строка 1: ВИД + МЕСТО */}
          <div className="rounded-xl px-7 py-5 flex items-center gap-7 flex-shrink-0"
            style={{
              background: flashRed ? "hsl(0 80% 18%)" : "hsl(0 75% 12%)",
              border: `3px solid ${flashRed ? "#ff3300" : "#881100"}`,
              boxShadow: flashRed ? "0 0 50px hsl(0 80% 22%)" : "0 0 24px hsl(0 70% 12%)",
              transition: "all 0.4s",
            }}>

            {/* ⚠ АВАРИЯ */}
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 48, fontWeight: 900,
              color: flashRed ? "#ff6644" : "#ff4422", letterSpacing: "0.06em", lineHeight: 1, flexShrink: 0 }}>
              ⚠ АВАРИЯ
            </div>

            <div style={{ width: 3, height: 60, background: "hsl(0 50% 35%)", flexShrink: 0 }} />

            {/* Вид аварии */}
            <div style={{ flexShrink: 0 }}>
              <div style={lbl("hsl(0 30% 55%)")}>Вид аварии</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 40, fontWeight: 900,
                color: atype.color, textTransform: "uppercase", lineHeight: 1, letterSpacing: "0.04em" }}>
                {atype.label}
              </div>
            </div>

            <div style={{ width: 3, height: 60, background: "hsl(0 50% 35%)", flexShrink: 0 }} />

            {/* Место аварии */}
            <div className="flex-1 min-w-0">
              <div style={lbl("hsl(0 30% 60%)")}>ОПО / Место аварии</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 30, fontWeight: 700,
                color: "hsl(0 10% 95%)", lineHeight: 1.15 }}>
                {acc.opo}
              </div>
              {acc.location && (
                <div style={{ fontSize: 18, color: "hsl(0 20% 72%)", marginTop: 5 }}>
                  📍 {acc.location}
                </div>
              )}
            </div>

            {/* Время объявления */}
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <div style={lbl("hsl(0 30% 55%)")}>Объявлено</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 32, fontWeight: 700,
                color: "#ff9977", lineHeight: 1 }}>
                {acc.startedAt}
              </div>
              <div style={{ fontSize: 13, color: "hsl(0 20% 50%)", marginTop: 3 }}>МСК: {acc.startedAtMsk}</div>
            </div>
          </div>

          {/* Строка 2: Погода + Ответственные */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

            {/* Погода */}
            <div className="rounded-xl p-5 flex flex-col"
              style={{ background: "hsl(213 50% 20%)", border: "1px solid hsl(213 45% 32%)" }}>
              <div style={{ fontSize: 12, color: "hsl(24 80% 56%)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>Погодные условия</div>
              <div className="flex items-center gap-4 flex-wrap">
                {weather && (
                  <>
                    <span style={{ fontSize: 40 }}>{weather.icon}</span>
                    <div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 40, fontWeight: 700, lineHeight: 1 }}>
                        {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                      </div>
                      <div style={{ fontSize: 14, color: "hsl(213 15% 55%)", marginTop: 4 }}>{weather.desc}</div>
                    </div>
                  </>
                )}
                {acc.weatherCondition && (() => {
                  const wc = WEATHER_CONDITIONS.find(w => w.id === acc.weatherCondition);
                  return wc ? (
                    <div className="rounded-lg px-4 py-2 flex items-center gap-2"
                      style={{ background: "hsl(24 70% 18%)", border: "2px solid hsl(24 80% 40%)" }}>
                      <span style={{ fontSize: 32 }}>{wc.icon}</span>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, fontWeight: 700, color: "hsl(24 90% 65%)", textTransform: "uppercase" }}>
                        {wc.label}
                      </div>
                    </div>
                  ) : null;
                })()}
                {!weather && !acc.weatherCondition && (
                  <div style={{ color: "hsl(213 15% 40%)", fontSize: 15 }}>Нет данных</div>
                )}
              </div>
              {weather && (
                <div className="grid grid-cols-3 gap-3 mt-auto pt-4">
                  {[
                    { l: "Ветер", v: `${weather.windSpeed} м/с ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}` },
                    { l: "Влажность", v: `${weather.humidity}%` },
                    { l: "Давление", v: `${weather.pressure} мм` },
                  ].map(r => (
                    <div key={r.l} className="rounded-lg p-3 text-center"
                      style={{ background: "hsl(213 45% 26%)" }}>
                      <div style={{ fontSize: 10, color: "hsl(213 15% 48%)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.l}</div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 700, marginTop: 2 }}>{r.v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ответственные лица */}
            <div className="rounded-xl p-5 flex flex-col"
              style={{ background: "hsl(213 52% 18%)", border: "2px solid hsl(24 80% 42%)" }}>
              <div style={{ fontSize: 15, color: "#ff9944", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10, fontWeight: 800, fontFamily: "Oswald, sans-serif" }}>
                👤 Ответственные лица
              </div>
              <div className="flex flex-col flex-1" style={{ gap: 0 }}>
                {[
                  { label: "Ответственный по отряду",          value: acc.commanderSquad   },
                  { label: "Ответственный по взводу / пункту", value: acc.commanderPlatoon },
                  { label: "Командир дежурного отделения",     value: acc.commanderUnit    },
                  { label: "Дежурный у средств связи",         value: acc.commDuty         },
                ].map((r, i) => (
                  <div key={r.label} className="flex items-center gap-3 py-3"
                    style={{ borderBottom: i < 3 ? "1px solid hsl(213 40% 26%)" : "none", flex: 1 }}>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 900, color: "hsl(24 70% 45%)", lineHeight: 1, flexShrink: 0, width: 30, textAlign: "center" }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 11, color: "hsl(213 15% 55%)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 3, fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 30, fontWeight: 700, color: r.value ? "hsl(210 10% 98%)" : "hsl(213 15% 38%)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.value || "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={cancel}
                className="mt-2 py-2.5 rounded-lg transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: "hsl(213 45% 26%)", border: "1px solid hsl(213 40% 36%)", color: "hsl(213 20% 68%)", fontSize: 13 }}>
                Отбой аварии
              </button>
            </div>

          </div>
        </div>

      ) : (
        /* ══ ШТАТНЫЙ РЕЖИМ ════════════════════════════════════════════════════ */
        <div className="flex-1 flex flex-col gap-5 p-8 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Статус — штатный */}
          <div className="rounded-2xl px-10 py-5 flex items-center justify-between flex-shrink-0"
            style={{ background: "hsl(213 50% 20%)", border: "1px solid hsl(213 45% 32%)" }}>
            <div className="flex items-center gap-4">
              <div className="w-4 h-4 rounded-full" style={{ background: "hsl(142 70% 45%)", boxShadow: "0 0 10px hsl(142 70% 45% / 0.6)" }} />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, color: "hsl(142 70% 50%)",
                textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Штатный режим — аварий нет
              </span>
            </div>
            <div style={{ fontSize: 15, color: "hsl(213 15% 48%)" }}>
              Управление аварией — в АРМ дежурного
            </div>
          </div>

          {/* Погода + Ответственные */}
          <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">

            {/* Погода */}
            <div className="rounded-2xl p-7 flex flex-col"
              style={{ background: "hsl(213 50% 20%)", border: "1px solid hsl(213 45% 32%)" }}>
              <div style={{ fontSize: 13, color: "hsl(24 80% 58%)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 20, fontWeight: 700 }}>
                Погодные условия{weather ? ` · ${weather.updated}` : ""}
              </div>
              <div className="flex items-center gap-6 mb-6 flex-wrap">
                {weather && (
                  <>
                    <span style={{ fontSize: 60 }}>{weather.icon}</span>
                    <div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 60, fontWeight: 700, lineHeight: 1 }}>
                        {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                      </div>
                      <div style={{ fontSize: 18, color: "hsl(213 15% 60%)", marginTop: 6 }}>{weather.desc}</div>
                    </div>
                  </>
                )}
                {acc.weatherCondition && (() => {
                  const wc = WEATHER_CONDITIONS.find(w => w.id === acc.weatherCondition);
                  return wc ? (
                    <div className="rounded-xl px-6 py-4 flex items-center gap-3"
                      style={{ background: "hsl(24 70% 18%)", border: "2px solid hsl(24 80% 40%)" }}>
                      <span style={{ fontSize: 44 }}>{wc.icon}</span>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, fontWeight: 700, color: "hsl(24 90% 62%)", textTransform: "uppercase" }}>
                        {wc.label}
                      </div>
                    </div>
                  ) : null;
                })()}
                {!weather && !acc.weatherCondition && (
                  <div style={{ color: "hsl(213 15% 35%)", fontSize: 18 }}>Нет данных</div>
                )}
              </div>
              {weather && (
                <div className="grid grid-cols-3 gap-4 mt-auto">
                  {[
                    { l: "Ветер", v: `${weather.windSpeed} м/с ${WIND_DIRS[Math.round(weather.windDir / 45) % 8]}` },
                    { l: "Влажность", v: `${weather.humidity}%` },
                    { l: "Давление", v: `${weather.pressure} мм` },
                  ].map(r => (
                    <div key={r.l} className="rounded-xl p-4 text-center"
                      style={{ background: "hsl(213 45% 26%)" }}>
                      <div style={{ fontSize: 11, color: "hsl(213 15% 50%)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{r.l}</div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700 }}>{r.v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ответственные лица */}
            <div className="rounded-2xl p-7 flex flex-col"
              style={{ background: "hsl(213 52% 18%)", border: "2px solid hsl(24 80% 42%)" }}>
              <div style={{ fontSize: 16, color: C.accent, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 18, fontWeight: 800, fontFamily: "Oswald, sans-serif" }}>
                👤 Ответственные лица
              </div>
              <div className="flex flex-col flex-1" style={{ gap: 0 }}>
                {[
                  { label: "Ответственный по отряду",          value: acc.commanderSquad   },
                  { label: "Ответственный по взводу / пункту", value: acc.commanderPlatoon },
                  { label: "Командир дежурного отделения",     value: acc.commanderUnit    },
                  { label: "Дежурный у средств связи",         value: acc.commDuty         },
                ].map((r, i) => (
                  <div key={r.label} className="flex items-center gap-4 py-4"
                    style={{ borderBottom: i < 3 ? "1px solid hsl(213 40% 26%)" : "none", flex: 1 }}>
                    <div style={{
                      fontFamily: "Oswald, sans-serif", fontSize: 32, fontWeight: 900,
                      color: "hsl(24 70% 45%)", lineHeight: 1, flexShrink: 0, width: 34, textAlign: "center",
                    }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 12, color: "hsl(213 15% 55%)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5, fontWeight: 600 }}>{r.label}</div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 36, fontWeight: 700, color: r.value ? "hsl(210 10% 98%)" : "hsl(213 15% 36%)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
      <footer className="flex-shrink-0 px-8 py-3 flex items-center justify-end border-t"
        style={{ borderColor: "hsl(213 40% 28%)", background: "hsl(213 58% 13% / 0.97)" }}>
        <div style={{ fontSize: 11, color: "hsl(213 15% 30%)", letterSpacing: "0.04em" }}>
          Разработчик:&nbsp;
          <span style={{ color: "hsl(24 95% 52%)", fontWeight: 600 }}>
            СДС филиала «Копейский ВГСО»&nbsp;С.Г.&nbsp;Ипатов
          </span>
        </div>
      </footer>
    </div>
  );
}