import { useState } from "react";
import Icon from "@/components/ui/icon";
import WeatherCustomUrl from "@/components/WeatherCustomUrl";
import {
  WEATHER_SOURCES,
  getCustomUrl,
  getWeatherSource,
  setWeatherSettings,
  type WeatherSourceId,
} from "@/lib/weatherApi";

const SOURCE_INFO: Record<WeatherSourceId, string> = {
  wttr: "Рекомендуется. Работает без ключей и регистрации.",
  openmeteo: "Запасной источник. Может быть недоступен из некоторых сетей.",
  custom: "Адрес своей метеослужбы или метеостанции предприятия.",
};

const CITY_STORAGE_KEY = "vgsch_weather_city";

interface City { name: string; lat: number; lon: number; tz: string }

export default function SettingsSection({ cities }: { cities: City[] }) {
  const [source, setSource] = useState<WeatherSourceId>(getWeatherSource);
  const [customUrl, setCustomUrl] = useState(getCustomUrl);
  const [editUrl, setEditUrl] = useState(false);
  const savedCity = localStorage.getItem(CITY_STORAGE_KEY);
  const city = cities.find(c => c.name === savedCity) ?? cities[0];

  const choose = (id: WeatherSourceId) => {
    setSource(id);
    if (id === "custom" && !getCustomUrl()) {
      setEditUrl(true);
      return;
    }
    setEditUrl(false);
    setWeatherSettings(id);
  };

  const savedSource = getWeatherSource();

  return (
    <div className="fade-in max-w-3xl space-y-4">
      <div className="panel-card">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <Icon name="CloudSun" size={16} style={{ color: "hsl(var(--primary))" }} />
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
            Источник погоды
          </h2>
        </div>

        <div className="p-5 space-y-2">
          <p className="text-xs mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
            Откуда главная панель и оперативное табло берут погоду. Если выбранный источник не ответит,
            программа сама попробует wttr.in и Open-Meteo.
          </p>

          {WEATHER_SOURCES.map(s => {
            const active = source === s.id;
            return (
              <button
                key={s.id}
                onClick={() => choose(s.id)}
                className="w-full text-left rounded px-4 py-3 flex items-start gap-3 transition-colors"
                style={{
                  background: active ? "hsl(var(--primary) / 0.12)" : "hsl(var(--secondary))",
                  border: `1px solid ${active ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                }}
              >
                <span
                  className="mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ border: `2px solid ${active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}` }}
                >
                  {active && <span className="w-2 h-2 rounded-full" style={{ background: "hsl(var(--primary))" }} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-medium block" style={{ color: "hsl(var(--foreground))" }}>
                    {s.name}
                    {s.id === "wttr" && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--primary))" }}>
                        по умолчанию
                      </span>
                    )}
                  </span>
                  <span className="text-xs block mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {SOURCE_INFO[s.id]}
                  </span>
                  {s.id === "custom" && customUrl && !editUrl && (
                    <span className="mono text-[11px] block mt-1.5 truncate" style={{ color: "hsl(var(--muted-foreground))" }} title={customUrl}>
                      {customUrl}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {source === "custom" && !editUrl && customUrl && (
            <button
              onClick={() => setEditUrl(true)}
              className="text-xs hover:underline"
              style={{ color: "hsl(var(--primary))" }}
            >
              Изменить ссылку
            </button>
          )}

          {source === "custom" && editUrl && (
            <div className="pt-1">
              <div className="text-xs mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                Проверка идёт по городу «{city.name}», выбранному на главной панели.
              </div>
              <WeatherCustomUrl
                lat={city.lat}
                lon={city.lon}
                tz={city.tz}
                onSaved={() => { setCustomUrl(getCustomUrl()); setEditUrl(false); }}
              />
            </div>
          )}

          {source === "custom" && savedSource !== "custom" && (
            <div className="text-xs pt-1" style={{ color: "hsl(var(--status-warning))" }}>
              Пока ссылка не проверена и не сохранена, погода берётся из {WEATHER_SOURCES.find(s => s.id === savedSource)?.name}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
