import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Icon from "@/components/ui/icon";

const API = "https://functions.poehali.dev/alerts";

type State =
  | { s: "loading" }
  | { s: "ok"; name: string; already: boolean; label: string; opo: string; location: string }
  | { s: "error"; text: string };

export default function AlertConfirm() {
  const { token: pathToken } = useParams();
  const [sp] = useSearchParams();
  const token = pathToken ?? sp.get("t") ?? "";

  const [st, setSt] = useState<State>({ s: "loading" });

  useEffect(() => {
    if (!token) {
      setSt({ s: "error", text: "Ссылка неполная — откройте её из сообщения целиком" });
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API}?action=confirm&token=${encodeURIComponent(token)}&via=link`, {
          method: "POST",
        });
        const d = await r.json();
        if (!r.ok) {
          setSt({ s: "error", text: d.error ?? "Не удалось подтвердить вызов" });
          return;
        }
        setSt({
          s: "ok",
          name: d.name ?? "",
          already: !!d.alreadyConfirmed,
          label: d.accidentLabel ?? "",
          opo: d.opo ?? "",
          location: d.location ?? "",
        });
      } catch {
        setSt({ s: "error", text: "Нет связи с сервером. Проверьте интернет и обновите страницу." });
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "hsl(var(--background))" }}>
      <div className="w-full max-w-md">

        {st.s === "loading" && (
          <div className="panel-card p-10 text-center">
            <Icon name="Loader2" size={34} className="mx-auto mb-4 animate-spin" style={{ color: "hsl(var(--primary))" }} />
            <div className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Подтверждаем вызов…</div>
          </div>
        )}

        {st.s === "error" && (
          <div className="panel-card p-8 text-center">
            <Icon name="TriangleAlert" size={40} className="mx-auto mb-4" style={{ color: "hsl(var(--destructive))" }} />
            <div className="text-lg font-bold mb-2" style={{ fontFamily: "Oswald" }}>Не получилось</div>
            <div className="text-sm mb-5" style={{ color: "hsl(var(--muted-foreground))" }}>{st.text}</div>
            <div className="text-xs px-3 py-2.5 rounded" style={{ background: "hsl(var(--secondary))" }}>
              Свяжитесь с дежурным у средств связи по телефону
            </div>
          </div>
        )}

        {st.s === "ok" && (
          <>
            <div
              className="panel-card p-8 text-center"
              style={{ borderColor: "hsl(var(--status-active) / 0.5)" }}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: "hsl(var(--status-active) / 0.15)" }}
              >
                <Icon name="Check" size={44} style={{ color: "hsl(var(--status-active))" }} />
              </div>

              <div
                className="text-2xl font-bold uppercase tracking-wide mb-1.5"
                style={{ fontFamily: "Oswald", color: "hsl(var(--status-active))" }}
              >
                Вызов принят
              </div>

              {st.name && (
                <div className="text-base mb-1">{st.name}</div>
              )}

              <div className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                {st.already ? "Вы уже подтверждали этот вызов" : "Дежурный видит ваше подтверждение"}
              </div>
            </div>

            <div className="panel-card p-5 mt-3">
              <div
                className="text-xs uppercase tracking-widest mb-3"
                style={{ fontFamily: "Oswald", color: "hsl(var(--muted-foreground))" }}
              >
                Данные аварии
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>Вид аварии</span>
                  <span className="font-bold text-right" style={{ color: "hsl(var(--destructive))" }}>{st.label}</span>
                </div>
                {st.opo && (
                  <div className="flex justify-between gap-3">
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>Объект</span>
                    <span className="text-right">{st.opo}</span>
                  </div>
                )}
                {st.location && (
                  <div className="flex justify-between gap-3">
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>Место</span>
                    <span className="text-right">{st.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div
              className="text-center text-sm font-semibold uppercase tracking-wide mt-4 px-4 py-3 rounded"
              style={{ fontFamily: "Oswald", background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}
            >
              Немедленно явиться в расположение
            </div>
          </>
        )}
      </div>
    </div>
  );
}
