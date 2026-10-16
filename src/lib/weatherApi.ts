export interface WeatherRaw {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  /** Давление, гПа */
  surface_pressure: number;
  weather_code: number;
  source: string;
}

export type WeatherFail = "offline" | "blocked" | "timeout" | "server" | "unknown";

export interface WeatherError {
  kind: WeatherFail;
  detail: string;
}

export type WeatherSourceId = "wttr" | "openmeteo" | "custom";

export const WEATHER_SOURCES: { id: WeatherSourceId; name: string }[] = [
  { id: "wttr", name: "wttr.in" },
  { id: "openmeteo", name: "Open-Meteo" },
  { id: "custom", name: "Своя ссылка" },
];

export const DEFAULT_WEATHER_SOURCE: WeatherSourceId = "wttr";
export const WEATHER_SOURCE_KEY = "vgsch_weather_source";
export const WEATHER_CUSTOM_URL_KEY = "vgsch_weather_custom_url";
export const WEATHER_SETTINGS_EVENT = "vgsch-weather-settings";

const TIMEOUT_MS = 10000;

class ProviderError extends Error {
  kind: WeatherFail;
  constructor(kind: WeatherFail, message: string) {
    super(message);
    this.kind = kind;
  }
}

async function getJson(url: string): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
  } catch (e) {
    const err = e as { name?: string };
    throw err.name === "AbortError"
      ? new ProviderError("timeout", "нет ответа за 10 с")
      : new ProviderError("blocked", "запрос не выпущен из сети или сервер не разрешает обращения из программ");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ProviderError("server", `ошибка ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("server", `вместо данных пришла страница: «${text.slice(0, 60).replace(/\s+/g, " ")}»`);
  }
}

// ─── Open-Meteo ──────────────────────────────────────────────────────────────

function parseOpenMeteo(data: unknown, source: string): WeatherRaw | null {
  const c = (data as { current?: Record<string, number> })?.current;
  if (!c || typeof c.temperature_2m !== "number") return null;
  return {
    temperature_2m: c.temperature_2m,
    relative_humidity_2m: c.relative_humidity_2m ?? 0,
    wind_speed_10m: c.wind_speed_10m ?? 0,
    wind_direction_10m: c.wind_direction_10m ?? 0,
    surface_pressure: c.surface_pressure ?? c.pressure_msl ?? 0,
    weather_code: c.weather_code ?? 3,
    source,
  };
}

async function fromOpenMeteo(lat: number, lon: number, tz: string): Promise<WeatherRaw> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code` +
    `&wind_speed_unit=ms&timezone=${encodeURIComponent(tz)}`;
  const w = parseOpenMeteo(await getJson(url), "Open-Meteo");
  if (!w) throw new ProviderError("server", "пустой ответ");
  return w;
}

// ─── wttr.in ─────────────────────────────────────────────────────────────────

const WTTR_TO_WMO: Record<number, number> = {
  113: 0, 116: 2, 119: 3, 122: 3, 143: 45, 248: 45, 260: 48,
  176: 80, 263: 51, 266: 53, 281: 56, 284: 57, 293: 61, 296: 61,
  299: 63, 302: 63, 305: 65, 308: 65, 311: 66, 314: 67, 317: 66,
  179: 71, 182: 66, 185: 56, 227: 73, 230: 75, 320: 71, 323: 71, 326: 71,
  329: 73, 332: 73, 335: 75, 338: 75, 350: 77, 353: 80, 356: 81,
  359: 82, 362: 85, 365: 86, 368: 85, 371: 86, 374: 77, 377: 77,
  200: 95, 386: 95, 389: 95, 392: 95, 395: 95,
};

function parseWttr(data: unknown, source: string): WeatherRaw | null {
  const c = (data as { current_condition?: Record<string, string>[] })?.current_condition?.[0];
  if (!c || c.temp_C === undefined) return null;
  return {
    temperature_2m: Number(c.temp_C),
    relative_humidity_2m: Number(c.humidity),
    wind_speed_10m: Math.round((Number(c.windspeedKmph) / 3.6) * 10) / 10,
    wind_direction_10m: Number(c.winddirDegree),
    surface_pressure: Number(c.pressure),
    weather_code: WTTR_TO_WMO[Number(c.weatherCode)] ?? 3,
    source,
  };
}

async function fromWttr(lat: number, lon: number): Promise<WeatherRaw> {
  const w = parseWttr(await getJson(`https://wttr.in/${lat},${lon}?format=j1`), "wttr.in");
  if (!w) throw new ProviderError("server", "пустой ответ");
  return w;
}

// ─── Своя ссылка ─────────────────────────────────────────────────────────────

/** OpenWeatherMap и совместимые: main.temp, wind.speed, weather[0].id */
function parseOwm(data: unknown, source: string): WeatherRaw | null {
  const d = data as {
    main?: { temp?: number; humidity?: number; pressure?: number };
    wind?: { speed?: number; deg?: number };
    weather?: { id?: number }[];
  };
  if (typeof d?.main?.temp !== "number") return null;
  const id = d.weather?.[0]?.id ?? 800;
  const code =
    id >= 200 && id < 300 ? 95 :
    id >= 300 && id < 400 ? 51 :
    id >= 500 && id < 600 ? 61 :
    id >= 600 && id < 700 ? 71 :
    id >= 700 && id < 800 ? 45 :
    id === 800 ? 0 : id === 801 ? 1 : id === 802 ? 2 : 3;
  return {
    temperature_2m: d.main.temp,
    relative_humidity_2m: d.main.humidity ?? 0,
    wind_speed_10m: d.wind?.speed ?? 0,
    wind_direction_10m: d.wind?.deg ?? 0,
    surface_pressure: d.main.pressure ?? 0,
    weather_code: code,
    source,
  };
}

/** Простой плоский ответ: { temp, humidity, wind_speed, wind_dir, pressure } */
function parseFlat(data: unknown, source: string): WeatherRaw | null {
  const d = data as Record<string, unknown>;
  if (!d || typeof d !== "object") return null;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = d[k];
      if (v !== undefined && v !== null && v !== "" && !isNaN(Number(v))) return Number(v);
    }
    return undefined;
  };
  const temp = pick("temp", "temperature", "t", "temp_c", "tempC");
  if (temp === undefined) return null;
  const pressMm = pick("pressure_mm", "pressureMm");
  const pressHpa = pick("pressure", "pressure_hpa", "pressureHpa");
  return {
    temperature_2m: temp,
    relative_humidity_2m: pick("humidity", "hum", "rh") ?? 0,
    wind_speed_10m: pick("wind_speed", "windSpeed", "wind", "wind_ms") ?? 0,
    wind_direction_10m: pick("wind_dir", "windDir", "wind_direction", "wind_deg") ?? 0,
    surface_pressure: pressMm !== undefined ? pressMm / 0.750062 : pressHpa ?? 0,
    weather_code: pick("weather_code", "code") ?? 3,
    source,
  };
}

export function getCustomUrl(): string {
  return localStorage.getItem(WEATHER_CUSTOM_URL_KEY) ?? "";
}

export function buildCustomUrl(template: string, lat: number, lon: number, tz: string): string {
  return template
    .trim()
    .replace(/\{lat\}/gi, String(lat))
    .replace(/\{lon\}/gi, String(lon))
    .replace(/\{tz\}/gi, encodeURIComponent(tz));
}

export function validateCustomUrl(template: string): string | null {
  const t = template.trim();
  if (!t) return "Введите ссылку";
  try {
    const u = new URL(buildCustomUrl(t, 55, 61, "Asia/Yekaterinburg"));
    if (u.protocol !== "https:" && u.protocol !== "http:") return "Ссылка должна начинаться с https://";
  } catch {
    return "Это не похоже на ссылку";
  }
  return null;
}

async function fromCustomTemplate(template: string, lat: number, lon: number, tz: string): Promise<WeatherRaw> {
  if (!template.trim()) throw new ProviderError("unknown", "ссылка не задана");
  const url = buildCustomUrl(template, lat, lon, tz);
  let host: string;
  try { host = new URL(url).hostname; } catch { throw new ProviderError("unknown", "ссылка введена с ошибкой"); }

  const data = await getJson(url);
  const w =
    parseOpenMeteo(data, host) ??
    parseWttr(data, host) ??
    parseOwm(data, host) ??
    parseFlat(data, host);
  if (!w) throw new ProviderError("server", "формат ответа не распознан");
  return w;
}

// ─── Общий вход ──────────────────────────────────────────────────────────────

const PROVIDERS: Record<WeatherSourceId, (lat: number, lon: number, tz: string) => Promise<WeatherRaw>> = {
  wttr: fromWttr,
  openmeteo: fromOpenMeteo,
  custom: (lat, lon, tz) => fromCustomTemplate(getCustomUrl(), lat, lon, tz),
};

export function getWeatherSource(): WeatherSourceId {
  const v = localStorage.getItem(WEATHER_SOURCE_KEY) as WeatherSourceId | null;
  return v && WEATHER_SOURCES.some(s => s.id === v) ? v : DEFAULT_WEATHER_SOURCE;
}

/** Сохраняет выбор и сообщает об этом всем окнам программы (главная панель, табло) */
export function setWeatherSettings(source: WeatherSourceId, customUrl?: string) {
  localStorage.setItem(WEATHER_SOURCE_KEY, source);
  if (customUrl !== undefined) localStorage.setItem(WEATHER_CUSTOM_URL_KEY, customUrl.trim());
  window.dispatchEvent(new Event(WEATHER_SETTINGS_EVENT));
}

/** Отпечаток настроек: изменился — значит, пора перезапросить погоду */
export function weatherSettingsKey(): string {
  return `${getWeatherSource()}|${getCustomUrl()}`;
}

export async function fetchWeatherRaw(lat: number, lon: number, tz: string): Promise<WeatherRaw> {
  if (!navigator.onLine) {
    throw { kind: "offline", detail: "Компьютер не подключён к сети" } as WeatherError;
  }

  // Сначала выбранный источник, затем запасные. Своя ссылка в запасных
  // не участвует — её опрашиваем, только если дежурный выбрал её сам.
  const pref = getWeatherSource();
  const backups: WeatherSourceId[] = ["wttr", "openmeteo"];
  const order = [pref, ...backups.filter(p => p !== pref)];

  const fails: { kind: WeatherFail; text: string }[] = [];
  for (const id of order) {
    try {
      return await PROVIDERS[id](lat, lon, tz);
    } catch (e) {
      const pe = e instanceof ProviderError ? e : new ProviderError("unknown", String(e));
      const name = WEATHER_SOURCES.find(s => s.id === id)?.name ?? id;
      fails.push({ kind: pe.kind, text: `${name}: ${pe.message}` });
      console.warn(`[Погода] ${name} — ${pe.message}`);
    }
  }

  const kinds = new Set(fails.map(f => f.kind));
  const kind: WeatherFail = kinds.size === 1 ? fails[0].kind : kinds.has("blocked") ? "blocked" : "server";
  throw { kind, detail: fails.map(f => f.text).join(" · ") } as WeatherError;
}

/** Проверка своей ссылки до сохранения: данные или понятная причина отказа */
export async function testCustomUrl(
  template: string, lat: number, lon: number, tz: string,
): Promise<{ ok: true; weather: WeatherRaw } | { ok: false; reason: string }> {
  const bad = validateCustomUrl(template);
  if (bad) return { ok: false, reason: bad };
  try {
    return { ok: true, weather: await fromCustomTemplate(template, lat, lon, tz) };
  } catch (e) {
    return { ok: false, reason: e instanceof ProviderError ? e.message : String(e) };
  }
}

export function weatherFailText(e: WeatherError): { title: string; hint: string } {
  switch (e.kind) {
    case "offline":
      return { title: "Нет интернета", hint: "Погода обновится, как только появится связь" };
    case "blocked":
      return {
        title: "Метеослужбы недоступны из этой сети",
        hint: "Попросите администратора открыть доступ к wttr.in и api.open-meteo.com",
      };
    case "timeout":
      return { title: "Метеослужбы не отвечают", hint: "Связь медленная или сервисы перегружены" };
    case "server":
      return { title: "Метеослужбы вернули ошибку", hint: "Опрошены все источники — ни один не дал данных" };
    default:
      return { title: "Погода недоступна", hint: "Попробуйте выбрать другой источник" };
  }
}
