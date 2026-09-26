import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

const API = "https://functions.poehali.dev/releases";

type Release = {
  version: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  notes: string;
  createdAt: string;
};

const fmtSize = (b: number) => {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} МБ`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} КБ`;
  return `${b} Б`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

export default function DownloadPage() {
  const [rel, setRel] = useState<Release | null>(null);
  const [history, setHistory] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(API);
        const d = await r.json();
        const list: Release[] = d.releases ?? [];
        setRel(list[0] ?? null);
        setHistory(list.slice(1, 6));
      } catch {
        setError(true);
      }
      setLoading(false);
    })();
  }, []);

  const startDownload = () => {
    if (!rel) return;
    fetch(`${API}?action=download&version=${encodeURIComponent(rel.version)}`, { method: "POST" }).catch(() => {});
    window.location.href = rel.fileUrl;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "hsl(var(--background))" }}>
      <div className="w-full max-w-xl space-y-4">

        {/* Шапка */}
        <div className="text-center mb-8">
          <img
            src="https://cdn.poehali.dev/projects/e8b93a3a-e9ed-40ee-8196-78090d463984/bucket/cdb862bf-f0a2-4d2b-899b-eb676c919290.png"
            alt="ВГСЧ"
            className="w-20 h-20 mx-auto mb-4"
          />
          <h1
            className="text-2xl font-bold uppercase tracking-widest"
            style={{ fontFamily: "Oswald", color: "hsl(var(--foreground))" }}
          >
            АРМ Дежурного ВГСЧ
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
            Программа для рабочего места дежурного
          </p>
        </div>

        {/* Скачивание */}
        <div className="panel-card p-6">
          {loading ? (
            <div className="text-center py-6 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Загрузка…
            </div>
          ) : error || !rel ? (
            <div className="text-center py-6">
              <Icon name="PackageX" size={32} style={{ color: "hsl(var(--muted-foreground))" }} className="mx-auto mb-3" />
              <div className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                Программа пока не опубликована
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-5">
                <div
                  className="flex items-center justify-center w-14 h-14 rounded flex-shrink-0"
                  style={{ background: "hsl(var(--primary) / 0.15)" }}
                >
                  <Icon name="MonitorDown" size={28} style={{ color: "hsl(var(--primary))" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-bold mono">Версия {rel.version}</div>
                  <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {fmtSize(rel.fileSize)} · от {fmtDate(rel.createdAt)} · Windows 10/11
                  </div>
                </div>
              </div>

              {rel.notes && (
                <div
                  className="text-sm mb-5 px-3 py-2.5 rounded"
                  style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))" }}
                >
                  <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Что нового
                  </span>
                  {rel.notes}
                </div>
              )}

              <button
                onClick={startDownload}
                className="w-full py-3.5 rounded font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:opacity-90"
                style={{
                  fontFamily: "Oswald",
                  fontSize: 15,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                <Icon name="Download" size={19} />
                Скачать программу
              </button>

              <div className="text-xs text-center mt-3" style={{ color: "hsl(var(--muted-foreground))" }}>
                {rel.fileName}
              </div>
            </>
          )}
        </div>

        {/* Как установить */}
        {rel && (
          <div className="panel-card p-5 text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
            <div className="font-semibold mb-2 uppercase tracking-wide text-xs" style={{ color: "hsl(var(--foreground))", fontFamily: "Oswald" }}>
              Как установить
            </div>
            <div className="space-y-1.5">
              <div>1. Скачайте файл и запустите его</div>
              <div>2. Windows может спросить разрешение — нажмите «Да»</div>
              <div>3. Нажимайте «Далее» до конца установки</div>
              <div>4. Ярлык появится на рабочем столе</div>
            </div>
            <div className="mt-3 pt-3 border-t border-border text-xs">
              Программа работает без интернета. Новые версии она предложит установить сама.
            </div>
          </div>
        )}

        {/* Прошлые версии */}
        {history.length > 0 && (
          <div className="panel-card">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
                Прошлые версии
              </h2>
            </div>
            <div className="divide-y divide-border">
              {history.map(h => (
                <a
                  key={h.version}
                  href={h.fileUrl}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors"
                >
                  <span className="mono text-sm w-16">v{h.version}</span>
                  <span className="text-xs flex-1 truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {h.notes || "—"}
                  </span>
                  <Icon name="Download" size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs pt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
          <a href="/" className="hover:underline">Открыть АРМ в браузере</a>
        </div>
      </div>
    </div>
  );
}
