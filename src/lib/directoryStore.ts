// Справочник ОПО и личного состава — хранится в localStorage

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

export interface Directory {
  personnel: PersonEntry[];
  opo: OpoEntry[];
}

const KEY = "vgsch_directory";

const DEFAULT: Directory = {
  personnel: [
    { id: "p1", name: "Иванов А.С.",   rank: "Командир отряда",         phone: "+7 (912) 001-01-01" },
    { id: "p2", name: "Петрова М.И.",  rank: "Командир взвода",          phone: "+7 (912) 001-01-02" },
    { id: "p3", name: "Сидоров К.В.",  rank: "Командир отделения",       phone: "+7 (912) 001-01-03" },
    { id: "p4", name: "Козлов Р.Д.",   rank: "Дежурный у средств связи", phone: "+7 (912) 001-01-04" },
    { id: "p5", name: "Лебедев В.Н.",  rank: "Командир отряда",          phone: "+7 (912) 001-01-05" },
    { id: "p6", name: "Морозов П.А.",  rank: "Командир взвода",          phone: "+7 (912) 001-01-06" },
    { id: "p7", name: "Новиков С.Г.",  rank: "Командир отделения",       phone: "+7 (912) 001-01-07" },
    { id: "p8", name: "Захаров Д.Е.",  rank: "Дежурный у средств связи", phone: "+7 (912) 001-01-08" },
  ],
  opo: [
    { id: "o1", name: "Шахта «Северная»",       horizon: "-320 м", area: "Участок №1" },
    { id: "o2", name: "Шахта «Северная»",       horizon: "-480 м", area: "Участок №3" },
    { id: "o3", name: "Шахта «Северная»",       horizon: "-620 м", area: "Участок №7" },
    { id: "o4", name: "Шахта «Заречная»",       horizon: "-350 м", area: "Участок №2" },
    { id: "o5", name: "Шахта «Заречная»",       horizon: "-500 м", area: "Участок №5" },
    { id: "o6", name: "Разрез «Центральный»",   horizon: "Карьер", area: "Западный борт" },
    { id: "o7", name: "Обогатит. фабрика №2",   horizon: "Поверхность", area: "Корпус А" },
  ],
};

export function loadDirectory(): Directory {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<Directory>;
    return {
      personnel: parsed.personnel ?? DEFAULT.personnel,
      opo: parsed.opo ?? DEFAULT.opo,
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
