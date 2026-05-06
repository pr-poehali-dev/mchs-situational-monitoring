// Справочник ОПО, личного состава и подразделений — хранится в localStorage

export type PersonRole = "commanderSquad" | "commanderPlatoon" | "commanderUnit" | "commDuty" | "";

export const PERSON_ROLES: { id: PersonRole; label: string }[] = [
  { id: "",                label: "— не назначена —"        },
  { id: "commanderSquad",  label: "Ответственный по отряду" },
  { id: "commanderPlatoon",label: "Ответственный по взводу/пункту" },
  { id: "commanderUnit",   label: "Командир отделения"      },
  { id: "commDuty",        label: "Дежурный у средств связи"},
];

export interface PersonEntry {
  id: string;
  name: string;       // ФИО
  rank: string;       // Должность
  phone: string;      // Телефон
  role: PersonRole;   // Роль в оперативном дежурстве
}

export interface OpoEntry {
  id: string;
  name: string;       // Наименование ОПО
  horizon: string;    // Горизонт / уровень
  area: string;       // Участок
  sortOrder: number;  // Порядок отображения
}

export interface DivisionEntry {
  id: string;
  name: string;
  location: string;
  lastContact: string;
}

export interface DispositionRow {
  id: string;
  opoName: string;
  explosion: string;
  fire: string;
  collapse: string;
  flood: string;
  phone: string;
  callsign: string;
}

export interface DispositionMeta {
  commanderName: string;
  vgsoName: string;
  year: string;
}

export interface Directory {
  personnel: PersonEntry[];
  opo: OpoEntry[];
  divisions: DivisionEntry[];
  dispositionRows: DispositionRow[];
  dispositionMeta: DispositionMeta;
}

const KEY = "vgsch_directory";
const VERSION_KEY = "vgsch_directory_version";
const CURRENT_VERSION = "5";

const DEFAULT: Directory = {
  personnel: [],
  opo: [
    { id: "o1", name: "Шахта «Учебная»", horizon: "", area: "", sortOrder: 0 },
  ],
  divisions: [],
  dispositionRows: [],
  dispositionMeta: { commanderName: "", vgsoName: "", year: String(new Date().getFullYear()) },
};

function migratePerson(p: Partial<PersonEntry>): PersonEntry {
  return {
    id: p.id ?? uid(),
    name: p.name ?? "",
    rank: p.rank ?? "",
    phone: p.phone ?? "",
    role: p.role ?? "",
  };
}

function migrateOpo(o: Partial<OpoEntry>, idx: number): OpoEntry {
  return {
    id: o.id ?? uid(),
    name: o.name ?? "",
    horizon: o.horizon ?? "",
    area: o.area ?? "",
    sortOrder: o.sortOrder ?? idx,
  };
}

export function loadDirectory(): Directory {
  try {
    if (localStorage.getItem(VERSION_KEY) !== CURRENT_VERSION) {
      // Миграция без сброса данных
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) as Partial<Directory> : null;
      const migrated: Directory = {
        personnel: (parsed?.personnel ?? DEFAULT.personnel).map(migratePerson),
        opo: (parsed?.opo ?? DEFAULT.opo).map(migrateOpo),
        divisions: parsed?.divisions ?? DEFAULT.divisions,
        dispositionRows: parsed?.dispositionRows ?? DEFAULT.dispositionRows,
        dispositionMeta: parsed?.dispositionMeta ?? DEFAULT.dispositionMeta,
      };
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<Directory>;
    return {
      personnel: (parsed.personnel ?? DEFAULT.personnel).map(migratePerson),
      opo: (parsed.opo ?? DEFAULT.opo).map(migrateOpo),
      divisions: parsed.divisions ?? DEFAULT.divisions,
      dispositionRows: parsed.dispositionRows ?? DEFAULT.dispositionRows,
      dispositionMeta: parsed.dispositionMeta ?? DEFAULT.dispositionMeta,
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
  const parts = [o.name, o.horizon, o.area].filter(Boolean);
  return parts.join(", ");
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/** Возвращает ФИО первого сотрудника с указанной ролью */
export function getPersonByRole(personnel: PersonEntry[], role: PersonRole): string {
  return personnel.find(p => p.role === role)?.name ?? "";
}
