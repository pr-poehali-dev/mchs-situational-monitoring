export interface WeatherRaw {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  surface_pressure: number;
  weather_code: number;
}

export type WeatherFail =
  | "offline"   // нет сети на самом компьютере
  | "blocked"   // запрос не выпустили: фильтр организации, антивирус, прокси
  | "timeout"   // служба не ответила вовремя
  | "server"    // служба ответила ошибкой
  | "unknown";

export interface WeatherError {
  kind: WeatherFail;
  detail: string;
}

const PARAMS =
  "current=temperature_2m,relative_humidity_2m,wind_speed_10m," +
  "wind_direction_10m,surface_pressure,weather_code&wind_speed_unit=ms";

const URL_BASE = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 12000;

export async function fetchWeatherRaw(
  lat: number, lon: number, tz: string,
): Promise<WeatherRaw> {
  if (!navigator.onLine) {
    throw { kind: "offline", detail: "Компьютер не подключён к сети" } as WeatherError;
  }

  const url = `${URL_BASE}?latitude=${lat}&longitude=${lon}&${PARAMS}&timezone=${encodeURIComponent(tz)}`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
  } catch (e) {
    clearTimeout(timer);
    const err = e as { name?: string; message?: string };
    if (err.name === "AbortError") {
      throw { kind: "timeout", detail: "Служба погоды не ответила за 12 секунд" } as WeatherError;
    }
    // Браузер не даёт подробностей о заблокированном запросе — это всегда TypeError
    throw {
      kind: "blocked",
      detail: "Запрос не выпущен из сети: фильтр организации, антивирус или прокси",
    } as WeatherError;
  }
  clearTimeout(timer);

  if (!res.ok) {
    throw { kind: "server", detail: `Служба погоды ответила ошибкой ${res.status}` } as WeatherError;
  }

  const data = await res.json().catch(() => null);
  if (!data?.current) {
    throw { kind: "server", detail: "Служба погоды вернула пустой ответ" } as WeatherError;
  }

  return data.current as WeatherRaw;
}

export function weatherFailText(e: WeatherError): { title: string; hint: string } {
  switch (e.kind) {
    case "offline":
      return { title: "Нет интернета", hint: "Погода обновится, как только появится связь" };
    case "blocked":
      return {
        title: "Погода недоступна из этой сети",
        hint: "Доступ к api.open-meteo.com закрыт. Передайте этот адрес системному администратору — остальные функции АРМ работают.",
      };
    case "timeout":
      return { title: "Служба погоды не отвечает", hint: "Связь медленная или сервис перегружен" };
    case "server":
      return { title: "Служба погоды вернула ошибку", hint: "Это временно — данные появятся при следующем обновлении" };
    default:
      return { title: "Погода недоступна", hint: e.detail };
  }
}
