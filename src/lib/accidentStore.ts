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
  updatedAt: number; // timestamp для обнаружения изменений
}

export const ACCIDENT_TYPES: { id: AccidentType; label: string; color: string; bg: string }[] = [
  { id: "fire",        label: "ПОЖАР",        color: "#ff4422", bg: "rgba(255,68,34,0.12)" },
  { id: "explosion",   label: "ВЗРЫВ",        color: "#ff8800", bg: "rgba(255,136,0,0.12)" },
  { id: "flood",       label: "ЗАТОПЛЕНИЕ",   color: "#2299ff", bg: "rgba(34,153,255,0.12)" },
  { id: "collapse",    label: "ОБРУШЕНИЕ",    color: "#cc8800", bg: "rgba(204,136,0,0.12)" },
  { id: "water_break", label: "ПРОРЫВ ВОДЫ",  color: "#00aacc", bg: "rgba(0,170,204,0.12)" },
];

export const OPO_LIST = [
  "Шахта «Северная», гор. -320 м",
  "Шахта «Северная», гор. -480 м",
  "Шахта «Северная», гор. -620 м",
  "Шахта «Заречная», гор. -350 м",
  "Шахта «Заречная», гор. -500 м",
  "Разрез «Центральный», карьер",
  "Обогатительная фабрика №2",
];

export const PERSONNEL = [
  "Иванов А.С.", "Петрова М.И.", "Сидоров К.В.", "Козлов Р.Д.",
  "Лебедев В.Н.", "Морозов П.А.", "Новиков С.Г.", "Захаров Д.Е.",
];

const STORAGE_KEY = "vgsch_accident_state";

export const DEFAULT_STATE: AccidentState = {
  active: false,
  type: "fire",
  opo: OPO_LIST[0],
  location: "",
  commanderSquad: PERSONNEL[0],
  commanderPlatoon: PERSONNEL[1],
  commanderUnit: PERSONNEL[2],
  commDuty: PERSONNEL[3],
  startedAt: "",
  startedAtMsk: "",
  updatedAt: 0,
};

export function loadAccident(): AccidentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveAccident(state: AccidentState) {
  const toSave = { ...state, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  // Принудительно тригеррим storage-событие для одного домена
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(toSave) }));
}

export function clearAccident() {
  const cleared = { ...DEFAULT_STATE, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(cleared) }));
}

export function subscribeAccident(onChange: (s: AccidentState) => void) {
  // Подписка на изменения из другого окна через storage-событие
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        onChange({ ...DEFAULT_STATE, ...JSON.parse(e.newValue) });
      } catch { /* ignore */ }
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}