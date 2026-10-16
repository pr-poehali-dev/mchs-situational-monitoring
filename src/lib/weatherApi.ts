export interface WeatherRaw {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  surface_pressure: number;
  weather_code: number;
  source: string;
}

export type WeatherFail = "offline" | "blocked" | "timeout" | "server" | "unknown";

export interface WeatherError {
  kind: WeatherFail;
  detail: string;
}

export type WeatherSourceId = "auto" | "openmeteo" | "wttr";

export const WEATHER_SOURCES: { id: WeatherSourceId; name: string }[] = [
  { id: "auto", name: "Автовыбор" },
  { id: "openmeteo", name: "Open-Meteo" },
  { id: "wttr", name: "wttr.in" },
];

export const WEATHER_SOURCE_KEY = "vgsch_weather_source";

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
      : new ProviderError("blocked", "запрос не выпущен из сети");
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

async function fromOpenMeteo(lat: number, lon: number, tz: string): Promise<WeatherRaw> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code` +
    `&wind_speed_unit=ms&timezone=${encodeURIComponent(tz)}`;
  const data = (await getJson(url)) as { current?: Omit<WeatherRaw, "source"> };
  const c = data?.current;
  if (!c || typeof c.temperature_2m !== "number") throw new ProviderError("server", "пустой ответ");
  return { ...c, source: "Open-Meteo" };
}

const WTTR_TO_WMO: Record<number, number> = {
  113: 0, 116: 2, 119: 3, 122: 3, 143: 45, 248: 45, 260: 48,
  176: 80, 263: 51, 266: 53, 281: 56, 284: 57, 293: 61, 296: 61,
  299: 63, 302: 63, 305: 65, 308: 65, 311: 66, 314: 67, 317: 66,
  179: 71, 182: 66, 185: 56, 227: 73, 230: 75, 320: 71, 323: 71, 326: 71,
  329: 73, 332: 73, 335: 75, 338: 75, 350: 77, 353: 80, 356: 81,
  359: 82, 362: 85, 365: 86, 368: 85, 371: 86, 374: 77, 377: 77,
  200: 95, 386: 95, 389: 95, 392: 95, 395: 95,
};

async function fromWttr(lat: number, lon: number): Promise<WeatherRaw> {
  const data = (await getJson(`https://wttr.in/${lat},${lon}?format=j1&lang=ru`)) as {
    current_condition?: Record<string, string>[];
  };
  const c = data?.current_condition?.[0];
  if (!c || c.temp_C === undefined) throw new ProviderError("server", "пустой ответ");
  return {
    temperature_2m: Number(c.temp_C),
    relative_humidity_2m: Number(c.humidity),
    wind_speed_10m: Math.round((Number(c.windspeedKmph) / 3.6) * 10) / 10,
    wind_direction_10m: Number(c.winddirDegree),
    surface_pressure: Number(c.pressure),
    weather_code: WTTR_TO_WMO[Number(c.weatherCode)] ?? 3,
    source: "wttr.in",
  };
}

type ProviderId = Exclude<WeatherSourceId, "auto">;

const PROVIDERS: Record<ProviderId, (lat: number, lon: number, tz: string) => Promise<WeatherRaw>> = {
  openmeteo: fromOpenMeteo,
  wttr: fromWttr,
};

export function getWeatherSource(): WeatherSourceId {
  const v = localStorage.getItem(WEATHER_SOURCE_KEY) as WeatherSourceId | null;
  return v && WEATHER_SOURCES.some(s => s.id === v) ? v : "auto";
}

export async function fetchWeatherRaw(lat: number, lon: number, tz: string): Promise<WeatherRaw> {
  if (!navigator.onLine) {
    throw { kind: "offline", detail: "Компьютер не подключён к сети" } as WeatherError;
  }

  const pref = getWeatherSource();
  const all = Object.keys(PROVIDERS) as ProviderId[];
  const order = pref === "auto" ? all : [pref, ...all.filter(p => p !== pref)];

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

export function weatherFailText(e: WeatherError): { title: string; hint: string } {
  switch (e.kind) {
    case "offline":
      return { title: "Нет интернета", hint: "Погода обновится, как только появится связь" };
    case "blocked":
      return {
        title: "Метеослужбы недоступны из этой сети",
        hint: "Попросите администратора открыть доступ к api.open-meteo.com и wttr.in",
      };
    case "timeout":
      return { title: "Метеослужбы не отвечают", hint: "Связь медленная или сервисы перегружены" };
    case "server":
      return { title: "Метеослужбы вернули ошибку", hint: "Опрошены все источники — ни один не дал данных" };
    default:
      return { title: "Погода недоступна", hint: "Попробуйте выбрать другой источник" };
  }
}
