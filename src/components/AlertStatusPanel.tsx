import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { type AlertInfo, type AlertRecipient, getAlertStatus } from "@/lib/alertsApi";

interface Props {
  alertId?: number;
  compact?: boolean;
}

const sinceText = (iso: string) => {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec} с назад`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} мин назад`;
  return `${Math.floor(m / 60)} ч ${m % 60} мин назад`;
};

export default function AlertStatusPanel({ alertId, compact }: Props) {
  const [alert, setAlert] = useState<AlertInfo | null>(null);
  const [list, setList] = useState<AlertRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getAlertStatus(alertId);
      setAlert(d.alert);
      setList(d.recipients ?? []);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
  }, [alertId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return null;
  if (offline || !alert) return null;

  const confirmed = list.filter(r => r.confirmed);
  const waiting = list.filter(r => !r.confirmed);
  const pct = alert.total > 0 ? Math.round((confirmed.length / alert.total) * 100) : 0;
  const allOk = confirmed.length === alert.total && alert.total > 0;

  return (
    <div className="panel-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: "Oswald" }}>
          <Icon name="UserCheck" size={15} style={{ color: "hsl(var(--primary))" }} />
          Явка по вызову
        </h2>
        <span
          className="tag"
          style={{
            background: allOk ? "hsl(var(--status-active) / 0.2)" : "hsl(var(--status-warning) / 0.2)",
            color: allOk ? "hsl(var(--status-active))" : "hsl(var(--status-warning))",
          }}
        >
          {confirmed.length} из {alert.total}
        </span>
      </div>

      {/* Полоса прогресса */}
      <div className="px-4 pt-3">
        <div className="h-2 rounded overflow-hidden" style={{ background: "hsl(var(--secondary))" }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: allOk ? "hsl(var(--status-active))" : "hsl(var(--status-warning))",
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          <span>Подтвердили вызов</span>
          <span className="mono">{pct}%</span>
        </div>
      </div>

      {/* Не ответили — самое важное для дежурного */}
      {waiting.length > 0 && (
        <div className="px-4 py-3">
          <div
            className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5"
            style={{ color: "hsl(var(--status-warning))" }}
          >
            <Icon name="Clock" size={12} />
            Не ответили — {waiting.length}
          </div>
          <div className={compact ? "space-y-1 max-h-32 overflow-y-auto scrollbar-thin" : "space-y-1"}>
            {waiting.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-sm py-1">
                <span className="flex-1 min-w-0 truncate">{r.name}</span>
                {r.callStatus === "failed" && (
                  <span className="tag text-[10px]" style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}>
                    звонок не прошёл
                  </span>
                )}
                {r.smsStatus === "failed" && r.callStatus !== "failed" && (
                  <span className="tag text-[10px]" style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}>
                    SMS не дошла
                  </span>
                )}
                <a
                  href={`tel:+${r.phone}`}
                  className="mono text-xs px-2 py-0.5 rounded hover:bg-secondary transition-colors flex-shrink-0"
                  style={{ color: "hsl(var(--primary))" }}
                  title="Позвонить вручную"
                >
                  {r.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Подтвердили */}
      {confirmed.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div
            className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5"
            style={{ color: "hsl(var(--status-active))" }}
          >
            <Icon name="Check" size={12} />
            Приняли вызов — {confirmed.length}
          </div>
          <div className={compact ? "space-y-1 max-h-32 overflow-y-auto scrollbar-thin" : "space-y-1"}>
            {confirmed.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-sm py-1">
                <Icon name="CircleCheck" size={13} style={{ color: "hsl(var(--status-active))" }} className="flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate">{r.name}</span>
                {r.confirmedAt && (
                  <span className="text-xs mono flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {sinceText(r.confirmedAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {allOk && (
        <div
          className="px-4 py-2.5 text-sm text-center font-semibold uppercase tracking-wide border-t border-border"
          style={{ fontFamily: "Oswald", color: "hsl(var(--status-active))" }}
        >
          Весь вызванный состав подтвердил явку
        </div>
      )}
    </div>
  );
}
