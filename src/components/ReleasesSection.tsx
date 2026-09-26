import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
const API = "https://functions.poehali.dev/releases";
const TOKEN_KEY = "vgsch-admin-token";

type Release = {
  id: number;
  version: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  sha256: string;
  notes: string;
  mandatory: boolean;
  published: boolean;
  downloads: number;
  createdAt: string;
};

const fmtSize = (b: number) => {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} МБ`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} КБ`;
  return `${b} Б`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export default function ReleasesSection() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!API) { setLoading(false); return; }
    try {
      const r = await fetch(API);
      const d = await r.json();
      setReleases(d.releases ?? []);
    } catch {
      setMsg({ type: "err", text: "Не удалось загрузить список версий" });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveToken = (v: string) => {
    setToken(v);
    localStorage.setItem(TOKEN_KEY, v);
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".exe")) {
      setMsg({ type: "err", text: "Нужен файл установщика с расширением .exe" });
      return;
    }
    setFile(f);
    setMsg(null);
    const m = f.name.match(/(\d+\.\d+\.\d+)/);
    if (m && !version) setVersion(m[1]);
  };

  const upload = async () => {
    if (!token.trim()) { setMsg({ type: "err", text: "Введите код администратора" }); return; }
    if (!/^\d+\.\d+\.\d+$/.test(version.trim())) {
      setMsg({ type: "err", text: "Версия должна быть в формате 1.0.0" });
      return;
    }
    if (!file) { setMsg({ type: "err", text: "Выберите файл установщика" }); return; }

    setUploading(true);
    setProgress(5);
    setMsg(null);

    try {
      const b64 = await new Promise<string>((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(String(rd.result).split(",")[1]);
        rd.onerror = () => rej(new Error("read"));
        rd.readAsDataURL(file);
      });
      setProgress(40);

      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token.trim() },
        body: JSON.stringify({
          version: version.trim(),
          notes: notes.trim(),
          mandatory,
          fileName: file.name,
          fileBase64: b64,
        }),
      });
      setProgress(90);
      const d = await r.json();

      if (!r.ok) {
        setMsg({ type: "err", text: d.error ?? "Ошибка публикации" });
      } else {
        setMsg({ type: "ok", text: `Версия ${d.version} опубликована — программы получат обновление` });
        setFile(null);
        setVersion("");
        setNotes("");
        setMandatory(false);
        if (fileRef.current) fileRef.current.value = "";
        await load();
      }
    } catch {
      setMsg({ type: "err", text: "Не удалось загрузить файл — проверьте связь" });
    }
    setProgress(100);
    setUploading(false);
    setTimeout(() => setProgress(0), 600);
  };

  const remove = async (v: string) => {
    if (!token.trim()) { setMsg({ type: "err", text: "Введите код администратора" }); return; }
    if (!confirm(`Удалить версию ${v}? Программы перестанут её получать.`)) return;
    const r = await fetch(`${API}?version=${encodeURIComponent(v)}`, {
      method: "DELETE",
      headers: { "X-Admin-Token": token.trim() },
    });
    const d = await r.json();
    if (!r.ok) setMsg({ type: "err", text: d.error ?? "Ошибка удаления" });
    else { setMsg({ type: "ok", text: `Версия ${v} удалена` }); await load(); }
  };

  const latest = releases.find(r => r.published);
  const downloadLink = `${window.location.origin}/download`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ type: "err", text: "Не удалось скопировать — выделите ссылку вручную" });
    }
  };

  return (
    <div className="fade-in space-y-4">
      {/* Текущая версия */}
      <div className="panel-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
            Актуальная версия программы
          </h2>
          {latest && (
            <span className="tag" style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
              {latest.downloads} загрузок
            </span>
          )}
        </div>
        <div className="p-4">
          {latest ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded" style={{ background: "hsl(var(--primary) / 0.15)" }}>
                <Icon name="Package" size={24} style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold mono">v{latest.version}</span>
                  {latest.mandatory && (
                    <span className="tag" style={{ background: "hsl(var(--destructive) / 0.2)", color: "hsl(var(--destructive))" }}>
                      обязательное
                    </span>
                  )}
                </div>
                <div className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {latest.fileName} · {fmtSize(latest.fileSize)} · от {fmtDate(latest.createdAt)}
                </div>
              </div>
              <a
                href={latest.fileUrl}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded transition-all"
                style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.3)" }}
              >
                <Icon name="Download" size={14} />
                <span className="uppercase tracking-wide font-semibold" style={{ fontFamily: "Oswald", fontSize: 11 }}>Скачать</span>
              </a>
            </div>
          ) : (
            <div className="text-sm text-center py-4" style={{ color: "hsl(var(--muted-foreground))" }}>
              {loading ? "Загрузка…" : "Версий пока нет — загрузите первый установщик ниже"}
            </div>
          )}
        </div>
      </div>

      {/* Ссылка для дежурных */}
      <div className="panel-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
            Ссылка для дежурных
          </h2>
          <a
            href="/download"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors hover:bg-secondary"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <Icon name="ExternalLink" size={12} />
            Открыть
          </a>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
            Отправьте эту ссылку дежурным — на странице всегда будет последняя версия
            программы с инструкцией по установке.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={downloadLink}
              onFocus={e => e.currentTarget.select()}
              className="flex-1 bg-secondary border border-border rounded px-3 py-2 text-sm mono outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-4 rounded transition-all"
              style={{
                background: copied ? "hsl(var(--status-active) / 0.2)" : "hsl(var(--primary) / 0.15)",
                color: copied ? "hsl(var(--status-active))" : "hsl(var(--primary))",
                border: `1px solid ${copied ? "hsl(var(--status-active) / 0.4)" : "hsl(var(--primary) / 0.3)"}`,
              }}
            >
              <Icon name={copied ? "Check" : "Copy"} size={14} />
              <span className="uppercase tracking-wide font-semibold text-xs" style={{ fontFamily: "Oswald" }}>
                {copied ? "Скопировано" : "Копировать"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Загрузка новой версии */}
      <div className="panel-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
            Загрузить новую версию
          </h2>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
              Код администратора
            </label>
            <input
              type="password"
              value={token}
              onChange={e => saveToken(e.target.value)}
              placeholder="введите код для публикации"
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded p-6 text-center cursor-pointer transition-colors"
            style={{
              borderColor: dragOver ? "hsl(var(--primary))" : "hsl(var(--border))",
              background: dragOver ? "hsl(var(--primary) / 0.05)" : "transparent",
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".exe"
              className="hidden"
              onChange={e => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <Icon name="FileCheck2" size={22} style={{ color: "hsl(var(--primary))" }} />
                <div className="text-left">
                  <div className="text-sm font-medium">{file.name}</div>
                  <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{fmtSize(file.size)}</div>
                </div>
              </div>
            ) : (
              <>
                <Icon name="Upload" size={26} style={{ color: "hsl(var(--muted-foreground))" }} className="mx-auto mb-2" />
                <div className="text-sm">Перетащите сюда <b>VGSCH-ARM-Setup-….exe</b></div>
                <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  или нажмите, чтобы выбрать файл
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                Версия
              </label>
              <input
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="1.0.1"
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm mono outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                Что нового
              </label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="напр. исправлена печать путёвки"
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={e => setMandatory(e.target.checked)}
              className="accent-primary w-4 h-4"
            />
            <span>Обязательное обновление — программа не даст работать на старой версии</span>
          </label>

          {progress > 0 && (
            <div className="h-1.5 rounded overflow-hidden" style={{ background: "hsl(var(--secondary))" }}>
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${progress}%`, background: "hsl(var(--primary))" }}
              />
            </div>
          )}

          {msg && (
            <div
              className="text-sm px-3 py-2 rounded flex items-center gap-2"
              style={{
                background: msg.type === "ok" ? "hsl(var(--status-active) / 0.15)" : "hsl(var(--destructive) / 0.15)",
                color: msg.type === "ok" ? "hsl(var(--status-active))" : "hsl(var(--destructive))",
              }}
            >
              <Icon name={msg.type === "ok" ? "CheckCircle2" : "AlertCircle"} size={15} />
              {msg.text}
            </div>
          )}

          <button
            onClick={upload}
            disabled={uploading}
            className="w-full py-2.5 rounded font-semibold uppercase tracking-wide transition-all disabled:opacity-50"
            style={{ fontFamily: "Oswald", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            {uploading ? "Загрузка…" : "Опубликовать обновление"}
          </button>
        </div>
      </div>

      {/* История версий */}
      <div className="panel-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
            История версий
          </h2>
          <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
            {releases.length}
          </span>
        </div>

        {releases.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            {loading ? "Загрузка…" : "Пока нет опубликованных версий"}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {releases.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                <span className="mono text-sm font-bold w-20">v{r.version}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{r.notes || "—"}</div>
                  <div className="text-xs mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {fmtSize(r.fileSize)} · {fmtDate(r.createdAt)} · {r.downloads} загрузок
                  </div>
                </div>
                {r.mandatory && (
                  <span className="tag" style={{ background: "hsl(var(--destructive) / 0.2)", color: "hsl(var(--destructive))" }}>
                    обяз.
                  </span>
                )}
                <a
                  href={r.fileUrl}
                  className="p-2 rounded hover:bg-secondary transition-colors"
                  title="Скачать установщик"
                >
                  <Icon name="Download" size={15} style={{ color: "hsl(var(--muted-foreground))" }} />
                </a>
                <button
                  onClick={() => remove(r.version)}
                  className="p-2 rounded hover:bg-secondary transition-colors"
                  title="Удалить версию"
                >
                  <Icon name="Trash2" size={15} style={{ color: "hsl(var(--destructive))" }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Подсказка */}
      <div className="panel-card p-4 text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
        <div className="font-semibold mb-1.5" style={{ color: "hsl(var(--foreground))" }}>Как выпустить обновление</div>
        1. Укажите новую версию в файле <b className="mono">desktop\APP_VERSION</b><br />
        2. Запустите <b className="mono">desktop\csharp\build.bat installer</b><br />
        3. Загрузите полученный <b className="mono">VGSCH-ARM-Setup-….exe</b> в форму выше<br />
        4. Программы на рабочих местах предложат обновиться при следующем запуске
      </div>
    </div>
  );
}