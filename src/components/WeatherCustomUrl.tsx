import { useState } from "react";
import Icon from "@/components/ui/icon";
import { getCustomUrl, setWeatherSettings, testCustomUrl } from "@/lib/weatherApi";

interface Props {
  lat: number;
  lon: number;
  tz: string;
  onSaved: () => void;
}

const EXAMPLE = "https://wttr.in/{lat},{lon}?format=j1";

export default function WeatherCustomUrl({ lat, lon, tz, onSaved }: Props) {
  const [url, setUrl] = useState(getCustomUrl);
  const [state, setState] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [msg, setMsg] = useState("");
  const saved = getCustomUrl();

  const check = async () => {
    setState("checking");
    setMsg("");
    const r = await testCustomUrl(url, lat, lon, tz);
    if (r.ok) {
      setState("ok");
      setMsg(`Работает: ${r.weather.temperature_2m > 0 ? "+" : ""}${Math.round(r.weather.temperature_2m)}°C, ветер ${Math.round(r.weather.wind_speed_10m)} м/с`);
    } else {
      setState("fail");
      setMsg(r.reason);
    }
  };

  const save = () => {
    setWeatherSettings("custom", url);
    onSaved();
  };

  const input: React.CSSProperties = {
    width: "100%",
    background: "hsl(var(--secondary))",
    color: "hsl(var(--foreground))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 4,
    padding: "6px 8px",
    fontSize: 11,
    fontFamily: "IBM Plex Mono, monospace",
  };

  return (
    <div className="space-y-2 rounded p-2.5" style={{ background: "hsl(var(--secondary) / 0.4)", border: "1px solid hsl(var(--border))" }}>
      <input
        style={input}
        value={url}
        placeholder={EXAMPLE}
        spellCheck={false}
        onChange={e => { setUrl(e.target.value); setState("idle"); setMsg(""); }}
        onKeyDown={e => { if (e.key === "Enter") check(); }}
      />
      <div className="text-[10px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
        Вместо <span className="mono">{"{lat}"}</span>, <span className="mono">{"{lon}"}</span> и <span className="mono">{"{tz}"}</span> подставятся
        координаты и часовой пояс выбранного города. Понимает ответы Open-Meteo, wttr.in, OpenWeatherMap
        и простой формат с полями <span className="mono">temp</span>, <span className="mono">humidity</span>, <span className="mono">wind_speed</span>, <span className="mono">pressure</span>.
      </div>

      {msg && (
        <div
          className="text-xs flex items-start gap-1.5"
          style={{ color: state === "ok" ? "hsl(var(--status-active))" : "hsl(var(--status-critical))" }}
        >
          <Icon name={state === "ok" ? "CircleCheck" : "CircleX"} size={13} className="mt-0.5 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={check}
          disabled={state === "checking" || !url.trim()}
          className="flex-1 text-xs py-1.5 rounded border border-border hover:bg-secondary transition-colors disabled:opacity-40"
          style={{ color: "hsl(var(--foreground))" }}
        >
          {state === "checking" ? "Проверяю…" : "Проверить"}
        </button>
        <button
          onClick={save}
          disabled={state !== "ok" || url.trim() === saved}
          className="flex-1 text-xs py-1.5 rounded transition-opacity disabled:opacity-40"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
