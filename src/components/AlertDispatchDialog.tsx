import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import type { PersonEntry } from "@/lib/directoryStore";
import {
  type AlertChannel,
  type ChannelsReady,
  declareAlert,
  getChannels,
  rememberAlertId,
} from "@/lib/alertsApi";

interface Props {
  open: boolean;
  personnel: PersonEntry[];
  accidentType: string;
  accidentLabel: string;
  opo: string;
  location: string;
  startedAt: string;
  declaredBy: string;
  onClose: () => void;
  onSent: (alertId: number, count: number) => void;
}

const CH: { id: AlertChannel; label: string; hint: string; icon: string }[] = [
  { id: "call", label: "Звонок", hint: "разбудит ночью", icon: "PhoneCall" },
  { id: "sms",  label: "SMS",    hint: "без интернета", icon: "MessageSquare" },
  { id: "max",  label: "MAX",    hint: "в группу отряда", icon: "Send" },
];

export default function AlertDispatchDialog(p: Props) {
  const [ready, setReady] = useState<ChannelsReady>({ max: false, sms: false, call: false });
  const [channels, setChannels] = useState<AlertChannel[]>(["call", "sms", "max"]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!p.open) return;
    setErr("");
    getChannels().then(c => {
      setReady(c);
      setChannels((["call", "sms", "max"] as AlertChannel[]).filter(x => c[x]));
    });
    // По умолчанию отмечены все, у кого есть телефон
    setPicked(new Set(p.personnel.filter(x => x.phone.trim()).map(x => x.id)));
  }, [p.open, p.personnel]);

  const withPhone = useMemo(() => p.personnel.filter(x => x.phone.trim()), [p.personnel]);
  const noPhone = useMemo(() => p.personnel.filter(x => !x.phone.trim()), [p.personnel]);
  const anyChannel = ready.max || ready.sms || ready.call;

  if (!p.open) return null;

  const toggle = (id: string) => {
    const s = new Set(picked);
    if (s.has(id)) s.delete(id); else s.add(id);
    setPicked(s);
  };

  const toggleChannel = (id: AlertChannel) => {
    if (!ready[id]) return;
    setChannels(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));
  };

  const send = async () => {
    const list = withPhone.filter(x => picked.has(x.id));
    if (list.length === 0) { setErr("Не выбран ни один сотрудник"); return; }
    if (channels.length === 0) { setErr("Не выбран ни один способ оповещения"); return; }

    setSending(true);
    setErr("");
    try {
      const d = await declareAlert({
        accidentType: p.accidentType,
        accidentLabel: p.accidentLabel,
        opo: p.opo,
        location: p.location,
        startedAt: p.startedAt,
        declaredBy: p.declaredBy,
        channels,
        recipients: list.map(x => ({ id: x.id, name: x.name, rank: x.rank, phone: x.phone })),
        baseUrl: window.location.origin,
      });
      rememberAlertId(d.alertId);
      p.onSent(d.alertId, d.recipients);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось разослать оповещение");
    }
    setSending(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={e => { if (e.target === e.currentTarget && !sending) p.onClose(); }}
    >
      <div className="panel-card w-full max-w-2xl max-h-[88vh] flex flex-col" style={{ background: "hsl(var(--card))" }}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
              Оповещение личного состава
            </h2>
            <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              {p.accidentLabel} · {p.opo}{p.location ? ` · ${p.location}` : ""}
            </div>
          </div>
          <button onClick={p.onClose} disabled={sending} className="p-1.5 rounded hover:bg-secondary transition-colors disabled:opacity-40">
            <Icon name="X" size={18} style={{ color: "hsl(var(--muted-foreground))" }} />
          </button>
        </div>

        {!anyChannel ? (
          <div className="p-8 text-center">
            <Icon name="SatelliteDish" size={36} className="mx-auto mb-4" style={{ color: "hsl(var(--muted-foreground))" }} />
            <div className="text-sm font-semibold mb-2">Каналы оповещения не подключены</div>
            <div className="text-xs leading-relaxed max-w-md mx-auto" style={{ color: "hsl(var(--muted-foreground))" }}>
              Чтобы система могла вызывать личный состав, нужны ключи доступа к сервису
              звонков, SMS-шлюзу или боту MAX. Обратитесь к тому, кто настраивал АРМ.
            </div>
            <button
              onClick={p.onClose}
              className="mt-5 px-5 py-2 rounded text-sm border border-border hover:bg-secondary transition-colors"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <>
            {/* Каналы */}
            <div className="px-5 py-3 border-b border-border">
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                Способ оповещения
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CH.map(c => {
                  const on = channels.includes(c.id);
                  const avail = ready[c.id];
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleChannel(c.id)}
                      disabled={!avail || sending}
                      title={avail ? "" : "Канал не настроен"}
                      className="flex items-center gap-2 px-3 py-2 rounded border transition-all text-left disabled:opacity-35"
                      style={{
                        borderColor: on ? "hsl(var(--primary))" : "hsl(var(--border))",
                        background: on ? "hsl(var(--primary) / 0.12)" : "transparent",
                      }}
                    >
                      <Icon name={c.icon} size={16} style={{ color: on ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.label}</div>
                        <div className="text-[10px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {avail ? c.hint : "не настроен"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Получатели */}
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
                Кого вызывать — выбрано {picked.size} из {withPhone.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPicked(new Set(withPhone.map(x => x.id)))}
                  className="text-xs px-2.5 py-1 rounded hover:bg-secondary transition-colors"
                  style={{ color: "hsl(var(--primary))" }}
                >
                  Все
                </button>
                <button
                  onClick={() => setPicked(new Set())}
                  className="text-xs px-2.5 py-1 rounded hover:bg-secondary transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Никого
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {withPhone.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Ни у кого в справочнике не указан телефон.<br />
                  Заполните телефоны в разделе «Справочники» → «Личный состав».
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {withPhone.map(x => {
                    const on = picked.has(x.id);
                    return (
                      <label
                        key={x.id}
                        className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-secondary/30 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(x.id)}
                          disabled={sending}
                          className="accent-primary w-4 h-4 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{x.name}</div>
                          {x.rank && (
                            <div className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{x.rank}</div>
                          )}
                        </div>
                        <span className="mono text-xs flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {x.phone}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {noPhone.length > 0 && (
                <div className="px-5 py-3 text-xs border-t border-border" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <Icon name="Info" size={12} className="inline mr-1.5 -mt-0.5" />
                  Без телефона и потому не вызываются: {noPhone.map(x => x.name).join(", ")}
                </div>
              )}
            </div>

            {/* Низ */}
            <div className="px-5 py-4 border-t border-border space-y-3">
              {err && (
                <div
                  className="text-sm px-3 py-2 rounded flex items-center gap-2"
                  style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}
                >
                  <Icon name="AlertCircle" size={15} />
                  {err}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={p.onClose}
                  disabled={sending}
                  className="px-5 py-2.5 rounded text-sm border border-border hover:bg-secondary transition-colors disabled:opacity-40"
                >
                  Не оповещать
                </button>
                <button
                  onClick={send}
                  disabled={sending || picked.size === 0}
                  className="flex-1 py-2.5 rounded font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ fontFamily: "Oswald", fontSize: 14, background: "hsl(0 90% 48%)", color: "white" }}
                >
                  {sending ? (
                    <><Icon name="Loader2" size={16} className="animate-spin" /> Оповещаем…</>
                  ) : (
                    <><Icon name="Siren" size={16} /> Вызвать {picked.size} чел.</>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
