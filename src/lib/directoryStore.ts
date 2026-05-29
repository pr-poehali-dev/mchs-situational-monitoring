// Справочник ОПО, личного состава и подразделений — хранится в localStorage

export type PersonRole = "commanderSquad" | "commanderPlatoon" | "commanderUnit" | "commDuty" | "opoDispatcher" | "";

export const PERSON_ROLES: { id: PersonRole; label: string }[] = [
  { id: "",                label: "— не назначена —"               },
  { id: "commanderSquad",  label: "Ответственный по отряду"        },
  { id: "commanderPlatoon",label: "Ответственный по взводу/пункту" },
  { id: "commanderUnit",   label: "Командир отделения"             },
  { id: "commDuty",        label: "Дежурный у средств связи"       },
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

export interface OpoDispatcherEntry {
  id: string;
  name: string;       // ФИО
  rank: string;       // Должность
  phone: string;      // Телефон
  shift: string;      // Смена / примечание
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
  opoDispatchers: OpoDispatcherEntry[];
  divisions: DivisionEntry[];
  dispositionRows: DispositionRow[];
  dispositionMeta: DispositionMeta;
}

const KEY = "vgsch_directory";
const VERSION_KEY = "vgsch_directory_version";
const CURRENT_VERSION = "6";

const DEFAULT: Directory = {
  personnel: [],
  opo: [
    { id: "o1", name: "Шахта «Учебная»", horizon: "", area: "", sortOrder: 0 },
  ],
  opoDispatchers: [],
  divisions: [],
  dispositionRows: [],
  dispositionMeta: { commanderName: "", vgsoName: "", year: String(new Date().getFullYear()) },
};

export function migratePerson(p: Partial<PersonEntry>): PersonEntry {
  return {
    id: p.id ?? uid(),
    name: p.name ?? "",
    rank: p.rank ?? "",
    phone: p.phone ?? "",
    role: p.role ?? "",
  };
}

export function migrateOpo(o: Partial<OpoEntry>, idx: number): OpoEntry {
  return {
    id: o.id ?? uid(),
    name: o.name ?? "",
    horizon: o.horizon ?? "",
    area: o.area ?? "",
    sortOrder: o.sortOrder ?? idx,
  };
}

function migrateOpoDispatcher(d: Partial<OpoDispatcherEntry>): OpoDispatcherEntry {
  return {
    id: d.id ?? uid(),
    name: d.name ?? "",
    rank: d.rank ?? "",
    phone: d.phone ?? "",
    shift: d.shift ?? "",
  };
}

export function loadDirectory(): Directory {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<Directory> : null;
    if (localStorage.getItem(VERSION_KEY) !== CURRENT_VERSION) {
      const migrated: Directory = {
        personnel: (parsed?.personnel ?? DEFAULT.personnel).map(migratePerson),
        opo: (parsed?.opo ?? DEFAULT.opo).map(migrateOpo),
        opoDispatchers: (parsed?.opoDispatchers ?? DEFAULT.opoDispatchers).map(migrateOpoDispatcher),
        divisions: parsed?.divisions ?? DEFAULT.divisions,
        dispositionRows: parsed?.dispositionRows ?? DEFAULT.dispositionRows,
        dispositionMeta: parsed?.dispositionMeta ?? DEFAULT.dispositionMeta,
      };
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
    if (!parsed) return structuredClone(DEFAULT);
    return {
      personnel: (parsed.personnel ?? DEFAULT.personnel).map(migratePerson),
      opo: (parsed.opo ?? DEFAULT.opo).map(migrateOpo),
      opoDispatchers: (parsed.opoDispatchers ?? DEFAULT.opoDispatchers).map(migrateOpoDispatcher),
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

/** Экспорт personnel + opo + opoDispatchers в JSON-файл */
export function exportDirectory(dir: Directory) {
  const data = { personnel: dir.personnel, opo: dir.opo, opoDispatchers: dir.opoDispatchers };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `справочник_${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Импорт из JSON-файла — merge */
export function importDirectory(file: File, currentDir: Directory): Promise<Directory> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as {
          personnel?: Partial<PersonEntry>[];
          opo?: Partial<OpoEntry>[];
          opoDispatchers?: Partial<OpoDispatcherEntry>[];
        };
        const incomingPersonnel = (parsed.personnel ?? []).map(migratePerson);
        const incomingOpo = (parsed.opo ?? []).map(migrateOpo);
        const incomingDispatchers = (parsed.opoDispatchers ?? []).map(migrateOpoDispatcher);

        const personnelMap = new Map(currentDir.personnel.map(p => [p.id, p]));
        for (const p of incomingPersonnel) personnelMap.set(p.id, p);

        const opoMap = new Map(currentDir.opo.map(o => [o.id, o]));
        const maxOrder = currentDir.opo.length > 0 ? Math.max(...currentDir.opo.map(o => o.sortOrder)) : -1;
        let orderOffset = maxOrder + 1;
        for (const o of incomingOpo) {
          if (!opoMap.has(o.id)) { opoMap.set(o.id, { ...o, sortOrder: orderOffset++ }); }
          else { opoMap.set(o.id, o); }
        }

        const dispMap = new Map(currentDir.opoDispatchers.map(d => [d.id, d]));
        for (const d of incomingDispatchers) dispMap.set(d.id, d);

        resolve({
          ...currentDir,
          personnel: Array.from(personnelMap.values()),
          opo: Array.from(opoMap.values()),
          opoDispatchers: Array.from(dispMap.values()),
        });
      } catch {
        reject(new Error("Неверный формат файла"));
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsText(file);
  });
}