// Справочник ОПО, личного состава и подразделений — хранится в localStorage

export interface PersonEntry {
  id: string;
  name: string;       // ФИО
  rank: string;       // Должность
  phone: string;      // Телефон
}

export interface OpoEntry {
  id: string;
  name: string;       // Наименование ОПО
  horizon: string;    // Горизонт / уровень
  area: string;       // Участок
}

export interface DivisionEntry {
  id: string;         // Идентификатор подразделения
  name: string;       // Наименование подразделения
  location: string;   // Местоположение
  lastContact: string; // Последняя проверка связи
}

export interface Directory {
  personnel: PersonEntry[];
  opo: OpoEntry[];
  divisions: DivisionEntry[];
}

const KEY = "vgsch_directory";
const VERSION_KEY = "vgsch_directory_version";
const CURRENT_VERSION = "3"; // увеличь при смене DEFAULT

const DEFAULT: Directory = {
  personnel: [],
  opo: [
    { id: "o1", name: "Шахта «Учебная»", horizon: "", area: "" },
  ],
  divisions: [],
};

export function loadDirectory(): Directory {
  try {
    // Если версия изменилась — сбрасываем на новые дефолты
    if (localStorage.getItem(VERSION_KEY) !== CURRENT_VERSION) {
      localStorage.removeItem(KEY);
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      return structuredClone(DEFAULT);
    }
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<Directory>;
    return {
      personnel: parsed.personnel ?? DEFAULT.personnel,
      opo: parsed.opo ?? DEFAULT.opo,
      divisions: parsed.divisions ?? DEFAULT.divisions,
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function saveDirectory(dir: Directory) {
  localStorage.setItem(KEY, JSON.stringify(dir));
  window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: JSON.stringify(dir) }));
}

export function subscribeDirectory(cb: (d: Directory) => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === KEY && e.newValue) {
      try { cb(JSON.parse(e.newValue)); } catch { /* skip */ }
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function opoLabel(o: OpoEntry) {
  return `${o.name}, ${o.horizon}, ${o.area}`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}