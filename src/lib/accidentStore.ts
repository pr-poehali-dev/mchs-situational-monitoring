// Общий стор через localStorage — синхронизирует АРМ ↔ Табло в реальном времени

export type AccidentType = "fire" | "explosion" | "flood" | "collapse" | "water_break";

export interface AccidentState {
  active: boolean;
  type: AccidentType;
  opo: string;
  location: string;
  commanderSquad: string;
  commanderPlatoon: string;
  commanderUnit: string;
  commDuty: string;
  startedAt: string;
  startedAtMsk: string;
  updatedAt: number;
}

export const ACCIDENT_TYPES: { id: AccidentType; label: string; color: string; bg: string }[] = [
  { id: "fire",        label: "ПОЖАР",        color: "#ff4422", bg: "rgba(255,68,34,0.12)" },
  { id: "explosion",   label: "ВЗРЫВ",        color: "#ff8800", bg: "rgba(255,136,0,0.12)" },
  { id: "flood",       label: "ЗАТОПЛЕНИЕ",   color: "#2299ff", bg: "rgba(34,153,255,0.12)" },
  { id: "collapse",    label: "ОБРУШЕНИЕ",    color: "#cc8800", bg: "rgba(204,136,0,0.12)" },
  { id: "water_break", label: "ПРОРЫВ ВОДЫ",  color: "#00aacc", bg: "rgba(0,170,204,0.12)" },
];

const STORAGE_KEY = "vgsch_accident_state";

// Пустые строки вместо undefined — Select всегда имеет валидное значение
export const DEFAULT_STATE: AccidentState = {
  active: false,
  type: "fire",
  opo: "",
  location: "",
  commanderSquad: "",
  commanderPlatoon: "",
  commanderUnit: "",
  commDuty: "",
  startedAt: "",
  startedAtMsk: "",
  updatedAt: 0,
};

function safeMerge(parsed: unknown): AccidentState {
  const p = (parsed && typeof parsed === "object" ? parsed : {}) as Partial<AccidentState>;
  return {
    active:           typeof p.active === "boolean"   ? p.active           : false,
    type:             p.type ?? "fire",
    opo:              p.opo ?? "",
    location:         p.location ?? "",
    commanderSquad:   p.commanderSquad ?? "",
    commanderPlatoon: p.commanderPlatoon ?? "",
    commanderUnit:    p.commanderUnit ?? "",
    commDuty:         p.commDuty ?? "",
    startedAt:        p.startedAt ?? "",
    startedAtMsk:     p.startedAtMsk ?? "",
    updatedAt:        p.updatedAt ?? 0,
  };
}

export function loadAccident(): AccidentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return safeMerge(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveAccident(state: AccidentState) {
  const toSave = { ...state, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(toSave) }));
}

export function clearAccident() {
  const cleared = { ...DEFAULT_STATE, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(cleared) }));
}

export function subscribeAccident(onChange: (s: AccidentState) => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        onChange(safeMerge(JSON.parse(e.newValue)));
      } catch { /* ignore */ }
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
