// Журнал событий — хранится в localStorage, синхронизируется между вкладками

export interface LogEntry {
  id: string;
  time: string;
  date: string;
  type: "info" | "warning" | "critical" | "action";
  operator: string;
  message: string;
  unit?: string;
}

const STORAGE_KEY = "vgsch_journal";
const MAX_ENTRIES = 200;

function nowTime(): string {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function nowDate(): string {
  return new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addLogEntry(entry: Omit<LogEntry, "id" | "time" | "date">): LogEntry {
  const logs = loadLog();
  const newEntry: LogEntry = {
    id: `L-${Date.now()}`,
    time: nowTime(),
    date: nowDate(),
    ...entry,
  };
  const updated = [newEntry, ...logs].slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(updated) }));
  return newEntry;
}

export function subscribeLog(onChange: (logs: LogEntry[]) => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try { onChange(JSON.parse(e.newValue)); } catch { /* ignore */ }
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
