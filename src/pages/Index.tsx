import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import {
  type AccidentState,
  ACCIDENT_TYPES,
  WEATHER_CONDITIONS,
  DEFAULT_STATE,
  loadAccident,
  saveAccident,
  clearAccident,
  subscribeAccident,
} from "@/lib/accidentStore";
import {
  type LogEntry,
  loadLog,
  addLogEntry,
  subscribeLog,
} from "@/lib/logStore";
import {
  type Directory,
  type PersonEntry,
  type PersonRole,
  type OpoEntry,
  type DivisionEntry,
  type DispositionRow,
  PERSON_ROLES,
  loadDirectory,
  saveDirectory,
  subscribeDirectory,
  getPersonByRole,
  opoLabel,
  uid,
} from "@/lib/directoryStore";

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionId = "dashboard" | "journal" | "directory";

interface Unit {
  id: string;
  name: string;
  type: string;
  status: "active" | "warning" | "critical" | "idle";
  location: string;
  crew: number;
  lastContact: string;
}





// ─── Mock Data ────────────────────────────────────────────────────────────────

const UNITS: Unit[] = [
  { id: "ВГСО-1", name: "ВГСО-1 Центральный", type: "Горноспасательный отряд", status: "active", location: "Шахта «Северная»", crew: 10, lastContact: "00:42" },
  { id: "ВГСО-2", name: "ВГСО-2 Восточный", type: "Горноспасательный отряд", status: "active", location: "База ВГСЧ", crew: 8, lastContact: "01:15" },
  { id: "ДКС-1", name: "ДКС-1", type: "Дежурная кам. смена", status: "warning", location: "Гор. -480 м, уч. №3", crew: 6, lastContact: "02:03" },
  { id: "ПГСО-3", name: "ПГСО-3", type: "Профил. горноспас. отряд", status: "idle", location: "База", crew: 5, lastContact: "00:10" },
  { id: "МС-1", name: "МС-1", type: "Медицинская служба", status: "active", location: "Медпункт шахты", crew: 3, lastContact: "00:58" },
  { id: "ВГСО-5", name: "ВГСО-5 Аварийный", type: "Горноспасательный отряд", status: "critical", location: "Гор. -620 м — задымление", crew: 9, lastContact: "03:21" },
  { id: "ГТС-2", name: "ГТС-2", type: "Газотехн. служба", status: "idle", location: "База", crew: 4, lastContact: "00:05" },
  { id: "ВГСО-4", name: "ВГСО-4 Южный", type: "Горноспасательный отряд", status: "active", location: "Шахта «Заречная»", crew: 11, lastContact: "01:47" },
];





const STATUS_COLORS = {
  active: "status-active",
  warning: "status-warning",
  critical: "status-critical",
  idle: "status-idle",
};

const STATUS_LABELS = {
  active: "Активен",
  warning: "Внимание",
  critical: "Срочно",
  idle: "В резерве",
};

const LOG_COLORS = {
  info: "hsl(210 20% 60%)",
  warning: "hsl(45 95% 55%)",
  critical: "hsl(0 80% 60%)",
  action: "hsl(14 90% 52%)",
};

const LOG_LABELS = {
  info: "ИНФО",
  warning: "ВНИМАНИЕ",
  critical: "КРИТИЧНО",
  action: "ДЕЙСТВИЕ",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="mono text-lg font-medium" style={{ color: "hsl(var(--primary))" }}>
      {pad(time.getHours())}:{pad(time.getMinutes())}:{pad(time.getSeconds())}
    </span>
  );
}

function StatusDot({ status }: { status: Unit["status"] }) {
  return (
    <span className={`status-dot ${STATUS_COLORS[status]} ${status === "critical" ? "pulse-ring" : ""}`} />
  );
}

// ─── Print ───────────────────────────────────────────────────────────────────

function printAccident(acc: AccidentState) {
  const atype = ACCIDENT_TYPES.find(t => t.id === acc.type)!;
  const now = new Date();
  const dateStr = now.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  const wc = WEATHER_CONDITIONS.find(w => w.id === acc.weatherCondition);

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/>
<title>Аварийный листок — ВГСЧ</title>
<style>
  @page { size: A4; margin: 20mm 15mm 20mm 25mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0; }

  .app-label {
    text-align: right; font-size: 10px; line-height: 1.6; margin-bottom: 18px;
    border-left: 3px solid #cc0000; padding-left: 8px; float: right; max-width: 230px;
  }
  .clearfix { clear: both; }

  .header { text-align: center; margin-bottom: 20px; }
  .header .org { font-size: 11px; color: #444; margin-bottom: 4px; letter-spacing: 0.05em; text-transform: uppercase; }
  .header h1 {
    font-size: 17px; font-weight: bold; text-transform: uppercase;
    border-top: 3px solid #cc0000; border-bottom: 3px solid #cc0000;
    padding: 8px 0; margin: 0; letter-spacing: 0.06em;
  }

  .alarm-band {
    background: #cc0000; color: #fff; font-size: 22px; font-weight: bold;
    text-align: center; padding: 10px; letter-spacing: 6px;
    text-transform: uppercase; margin: 14px 0;
  }

  .sec {
    font-size: 10px; font-weight: bold; text-transform: uppercase;
    color: #555; letter-spacing: 1px; margin: 14px 0 4px;
    border-bottom: 1px solid #ddd; padding-bottom: 2px;
  }

  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; font-size: 12px; }
  td.lbl { font-weight: bold; width: 44%; background: #f7f7f7; }

  .sig-block { margin-top: 28px; display: flex; justify-content: space-between; gap: 20px; }
  .sig-item { flex: 1; text-align: center; }
  .sig-item .sig-line { border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #555; margin-top: 28px; }
  .sig-item .sig-role { font-size: 11px; font-weight: bold; margin-bottom: 2px; }

  .footer { margin-top: 20px; font-size: 9px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
</style></head><body>

<div class="app-label">
  Приложение № 1<br>
  к Уставу военизированной<br>
  горноспасательной части<br>
  по организации и ведению<br>
  горноспасательных работ,<br>
  утверждённому приказом МЧС России<br>
  от 09.06.2017 № 251
</div>
<div class="clearfix"></div>

<div class="header">
  <div class="org">ФГУП ВГСЧ МЧС России</div>
  <h1>Аварийный листок</h1>
</div>

<div class="alarm-band">⚠ &nbsp; ${atype.label} &nbsp; ⚠</div>

<div class="sec">I. Время и место аварии</div>
<table>
  <tr><td class="lbl">Время объявления (местное)</td><td><b>${acc.startedAt}</b></td></tr>
  <tr><td class="lbl">Время объявления (МСК)</td><td>${acc.startedAtMsk}</td></tr>
  <tr><td class="lbl">Дата</td><td>${dateStr}</td></tr>
  <tr><td class="lbl">Опасный производственный объект (ОПО)</td><td><b>${acc.opo}</b></td></tr>
  <tr><td class="lbl">Место аварии (уточнение)</td><td>${acc.location || "—"}</td></tr>
  <tr><td class="lbl">Вид аварии</td><td><b>${atype.label}</b></td></tr>
</table>

<div class="sec">II. Ответственные лица</div>
<table>
  <tr><td class="lbl">Ответственный по отряду</td><td>${acc.commanderSquad || "—"}</td></tr>
  <tr><td class="lbl">Ответственный по взводу / пункту</td><td>${acc.commanderPlatoon || "—"}</td></tr>
  <tr><td class="lbl">Командир дежурного отделения</td><td>${acc.commanderUnit || "—"}</td></tr>
  <tr><td class="lbl">Дежурный у средств связи</td><td>${acc.commDuty || "—"}</td></tr>
</table>

${wc && wc.id ? `
<div class="sec">III. Особые погодные условия</div>
<table>
  <tr><td class="lbl">Условие</td><td><b>${wc.icon} ${wc.label}</b></td></tr>
</table>` : ""}

<div class="sig-block">
  <div class="sig-item">
    <div class="sig-role">Дежурный оператор</div>
    <div class="sig-line">подпись &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Фамилия И.О.</div>
  </div>
  <div class="sig-item">
    <div class="sig-role">Командир дежурного отделения</div>
    <div class="sig-line">подпись &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Фамилия И.О.</div>
  </div>
  <div class="sig-item">
    <div class="sig-role">Ответственный по отряду</div>
    <div class="sig-line">подпись &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Фамилия И.О.</div>
  </div>
</div>

<div class="footer">Распечатано: ${now.toLocaleString("ru-RU")} &nbsp;|&nbsp; ФГУП ВГСЧ МЧС России &nbsp;|&nbsp; АРМ Дежурного оператора</div>
</body></html>`;

  const win = window.open("", "_blank", "width=820,height=1060");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function printDisposition() {
  const dir = loadDirectory();
  const meta = dir.dispositionMeta;
  const rows = dir.dispositionRows;
  const now = new Date();

  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="7" style="text-align:center;color:#999;padding:20px;">Строки диспозиции не заполнены</td></tr>`
    : rows.map((r, i) => `
      <tr>
        <td style="vertical-align:top;font-size:11px;">${i + 1}. ${r.opoName}</td>
        <td style="vertical-align:top;font-size:11px;white-space:pre-wrap">${r.explosion || ""}</td>
        <td style="vertical-align:top;font-size:11px;white-space:pre-wrap">${r.fire || ""}</td>
        <td style="vertical-align:top;font-size:11px;white-space:pre-wrap">${r.collapse || ""}</td>
        <td style="vertical-align:top;font-size:11px;white-space:pre-wrap">${r.flood || ""}</td>
        <td style="vertical-align:top;font-size:11px;text-align:center">${r.phone || ""}</td>
        <td style="vertical-align:top;font-size:11px;text-align:center">${r.callsign || ""}</td>
      </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/>
<title>Приложение №1 — Диспозиция ВГСО</title>
<style>
  @page { size: A4 landscape; margin: 15mm 10mm 15mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0; }

  .app-label { text-align: right; font-size: 10px; line-height: 1.7; margin-bottom: 10px; }

  .utv { float: right; text-align: left; font-size: 11px; line-height: 1.9; margin-bottom: 6px; }
  .utv .utv-line { display: flex; align-items: flex-end; gap: 4px; }
  .utv .utv-ul { border-bottom: 1px solid #000; min-width: 80px; display: inline-block; }
  .clearfix { clear: both; }

  .disptitle {
    font-family: "Courier New", monospace; font-size: 13px; letter-spacing: 0.15em;
    margin: 8px 0 14px 0; text-align: left;
  }
  .disptitle span { border-bottom: 1px solid #000; display: inline-block; min-width: 120px; }

  table.main {
    width: 100%; border-collapse: collapse; margin-bottom: 14px;
  }
  table.main th, table.main td {
    border: 1px solid #000; padding: 4px 5px; vertical-align: top;
  }
  table.main th {
    background: #f0f0f0; font-size: 10px; text-align: center; font-weight: bold;
  }
  .num { text-align: center; font-weight: bold; background: #f5f5f5; }

  .legend { font-size: 10px; margin-top: 10px; border-top: 1px solid #999; padding-top: 6px; }
  .legend p { margin: 2px 0; }

  .footer { font-size: 9px; color: #aaa; text-align: right; margin-top: 8px; }
</style></head><body>

<div class="app-label">
  Приложение № 1<br>
  к Уставу военизированной горноспасательной части<br>
  по организации и ведению горноспасательных работ,<br>
  утверждённому приказом МЧС России от 09.06.2017 № 251
</div>

<div class="utv">
  <div>Утверждаю:</div>
  <div class="utv-line">Командир <span class="utv-ul">&nbsp;${meta.vgsoName}&nbsp;</span> ВГСО</div>
  <div class="utv-line"><span class="utv-ul">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> <span class="utv-ul">&nbsp;${meta.commanderName}&nbsp;</span></div>
  <div style="display:flex;gap:4px;font-size:10px;color:#555"><span>Подпись</span><span style="padding-left:36px">Фамилия И.О.</span></div>
  <div class="utv-line">«___» <span class="utv-ul">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> ${meta.year} г.</div>
</div>
<div class="clearfix"></div>

<div class="disptitle">
  Диспозиция выездов подразделений&nbsp;&nbsp;
  <span>&nbsp;${meta.vgsoName || ""}&nbsp;</span>&nbsp;
  ВГСО в ${meta.year} г.
</div>

<table class="main">
  <thead>
    <tr>
      <th rowspan="2" style="width:12%">Наименование организаций<br>(опасных производственных объектов)</th>
      <th colspan="4">Вид аварии, привлекаемые подразделения, количество отделений, транспортные и технические средства</th>
      <th rowspan="2" style="width:7%">Номер телефона на ВГСВ (ВГСП)</th>
      <th rowspan="2" style="width:7%">Радиопозывные ВГСВ (ВГСП)</th>
    </tr>
    <tr>
      <th style="width:16%">Взрыв (вспышка)</th>
      <th style="width:16%">Пожар</th>
      <th style="width:16%">Обрушение, внезапный выброс, горный удар</th>
      <th style="width:16%">Загазирование, затопление, прорыв воды (рассола), пульпы, другие виды аварий</th>
    </tr>
    <tr class="num">
      <td class="num">1</td><td class="num">2</td><td class="num">3</td>
      <td class="num">4</td><td class="num">5</td><td class="num">6</td><td class="num">7</td>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>

<div class="legend">
  <p>МБЭР — медицинская бригада экстренного реагирования;</p>
  <p>КИЛ — контрольно-испытательная лаборатория;</p>
  <p>СДС — служба депрессионных съёмок;</p>
  <p>АПО — автомобиль пожарного оборудования;</p>
  <p>АСИ — аварийно-спасательный инструмент.</p>
</div>

<div class="footer">Распечатано: ${now.toLocaleString("ru-RU")} &nbsp;|&nbsp; АРМ Дежурного оператора ВГСЧ МЧС России</div>
</body></html>`;

  const win = window.open("", "_blank", "width=1100,height=820");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function printPutevka(acc: AccidentState) {
  const atype = ACCIDENT_TYPES.find(t => t.id === acc.type)!;
  const timeParts = acc.startedAt ? acc.startedAt.split(":") : [];
  const callH = timeParts[0] ?? "____";
  const callM = timeParts[1] ?? "____";
  const now  = new Date();
  const day  = String(now.getDate()).padStart(2, "0");
  const mon  = now.toLocaleDateString("ru-RU", { month: "long" });
  const year = String(now.getFullYear());

  const putevka = (num: number, dest: string) => `
<div class="putevka">
  <div class="copy-badge">Экземпляр ${num}</div>
  <div class="title">Путёвка на выезд подразделения ВГСЧ<br>на ликвидацию аварии</div>

  <table class="form-table">
    <tr>
      <td class="fl">На выезд</td>
      <td class="fv"></td>
      <td class="fl" style="padding-left:12px">ВГСВ (ВГСП)</td>
      <td class="fv"></td>
      <td class="fl" style="padding-left:12px">ВГСО</td>
      <td class="fv"></td>
    </tr>
    <tr>
      <td class="fl">на ликвидацию аварии</td>
      <td class="fv" colspan="3"></td>
      <td class="fl" style="white-space:nowrap; padding-left:12px">«${day}» ${mon} ${year} г.</td>
      <td class="fv" style="width:10px"></td>
    </tr>
    <tr>
      <td class="fl">Опасный производственный объект</td>
      <td class="fv filled" colspan="5">${acc.opo}</td>
    </tr>
    <tr>
      <td class="fl">Вид аварии</td>
      <td class="fv filled bold" colspan="5">${atype.label}</td>
    </tr>
    <tr>
      <td class="fl">Место аварии</td>
      <td class="fv filled" colspan="5">${acc.location || ""}</td>
    </tr>
    <tr>
      <td class="fl">Время вызова</td>
      <td class="fv filled bold" style="width:40px; text-align:center">${callH}</td>
      <td class="fl" style="padding-left:6px">ч.</td>
      <td class="fv filled bold" style="width:40px; text-align:center">${callM}</td>
      <td class="fl" style="padding-left:6px">мин.</td>
      <td class="fv"></td>
    </tr>
    <tr>
      <td class="fl">Фамилия И.О. вызвавшего</td>
      <td class="fv filled" colspan="5">${acc.commanderSquad || ""}</td>
    </tr>
    <tr>
      <td class="fl">Фамилия И.О. принявшего вызов</td>
      <td class="fv filled" colspan="5">${acc.commanderPlatoon || ""}</td>
    </tr>
  </table>

  <div class="sig-row">
    <div class="sig-item">
      <div class="sig-role">Дежурный у средств связи</div>
      <div class="sig-line"></div>
      <div class="sig-hint">подпись &nbsp;&nbsp;&nbsp; Фамилия И.О.</div>
    </div>
    <div class="sig-item">
      <div class="sig-role">Командир дежурного отделения</div>
      <div class="sig-line"></div>
      <div class="sig-hint">подпись &nbsp;&nbsp;&nbsp; Фамилия И.О.</div>
    </div>
  </div>

  <div class="dest-note">${dest}</div>
</div>`;

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/>
<title>Путёвка на выезд — ВГСЧ</title>
<style>
  @page { size: A4 portrait; margin: 20mm 10mm 15mm 30mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #000; margin: 0; padding: 0; height: 100%; }

  .putevka {
    height: calc(50vh - 10mm);
    min-height: 120mm;
    display: flex; flex-direction: column;
    padding: 8mm 0 6mm 0;
    border-bottom: 2px dashed #999;
    page-break-inside: avoid;
    position: relative;
  }
  .putevka:last-child { border-bottom: none; }

  .copy-badge {
    position: absolute; top: 8mm; right: 0;
    font-size: 10px; font-style: italic; color: #888;
    border: 1px solid #ccc; padding: 2px 8px; border-radius: 3px;
  }

  .title {
    font-size: 15px; font-weight: bold; text-align: center;
    text-decoration: underline; line-height: 1.4;
    margin-bottom: 10mm; letter-spacing: 0.02em;
  }

  .form-table { width: 100%; border-collapse: collapse; margin-bottom: 8mm; }
  .form-table tr td { padding: 0 2px 6px 2px; vertical-align: bottom; white-space: nowrap; }
  .fl { font-size: 13px; width: 1%; white-space: nowrap; padding-right: 4px; }
  .fv {
    border-bottom: 1px solid #000; width: auto;
    font-size: 13px; padding-bottom: 1px; min-width: 20px;
  }
  .fv.filled { color: #000; }
  .bold { font-weight: bold; }

  .sig-row { display: flex; gap: 16mm; margin-bottom: 6mm; }
  .sig-item { flex: 1; }
  .sig-role { font-size: 11px; font-weight: bold; margin-bottom: 10mm; }
  .sig-line { border-top: 1px solid #333; margin-bottom: 3px; }
  .sig-hint { font-size: 10px; color: #666; text-align: center; }

  .dest-note {
    margin-top: auto; font-size: 11px; font-style: italic;
    color: #444; border-top: 1px dotted #bbb; padding-top: 4px;
  }
</style></head><body>
${putevka(1, "Экземпляр 1 передаётся командиру дежурного отделения.")}
${putevka(2, "Экземпляр 2 остаётся у дежурного у средств связи до окончания выполнения горноспасательных работ.")}
</body></html>`;

  const win = window.open("", "_blank", "width=820,height=1060");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ─── Siren ───────────────────────────────────────────────────────────────────

function playSiren() {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();

  const start = ctx.currentTime + 0.05;
  const cycles = 4;
  const cycleUp = 1.4;    // подъём
  const cycleDown = 0.9;  // спуск
  const cycleDur = cycleUp + cycleDown;
  const totalDuration = cycles * cycleDur + 0.3;

  // --- Мастер-компрессор (не даёт клипу) ---
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -6;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.1;
  compressor.connect(ctx.destination);

  // --- Мастер-гейн ---
  const masterGain = ctx.createGain();
  masterGain.connect(compressor);
  masterGain.gain.setValueAtTime(0, start);
  masterGain.gain.linearRampToValueAtTime(0.9, start + 0.15);
  masterGain.gain.setValueAtTime(0.9, start + totalDuration - 0.35);
  masterGain.gain.linearRampToValueAtTime(0, start + totalDuration);

  // --- Лёгкое искажение (distortion) для характерного «хрипа» ---
  const waveShaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = (Math.PI + 180) * x / (Math.PI + 180 * Math.abs(x));
  }
  waveShaper.curve = curve;
  waveShaper.oversample = "4x";
  waveShaper.connect(masterGain);

  // --- Функция создания одного слоя сирены ---
  const makeLayer = (freqLow: number, freqHigh: number, type: OscillatorType, gainVal: number, detuneVal = 0) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.detune.value = detuneVal;
    g.gain.value = gainVal;
    osc.connect(g);
    g.connect(waveShaper);

    for (let i = 0; i < cycles; i++) {
      const t = start + i * cycleDur;
      osc.frequency.setValueAtTime(freqLow, t);
      osc.frequency.linearRampToValueAtTime(freqHigh, t + cycleUp);
      osc.frequency.linearRampToValueAtTime(freqLow, t + cycleUp + cycleDown);
    }
    osc.start(start);
    osc.stop(start + totalDuration);
    return osc;
  };

  // Слой 1: основной — пилообразный (характерный «вой»)
  makeLayer(480, 1080, "sawtooth", 0.55);
  // Слой 2: квадратный — добавляет «тело» и мощь
  makeLayer(480, 1080, "square", 0.20, 5);
  // Слой 3: субоктава — низкочастотная основа
  makeLayer(240, 540, "sawtooth", 0.18, -8);
  // Слой 4: небольшой вибрато-модулятор (LFO на частоту)
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 6;
  lfoGain.gain.value = 18;
  lfo.connect(lfoGain);
  // lfo модулирует детюн основного (подключим через отдельный путь)
  lfo.start(start);
  lfo.stop(start + totalDuration);

  // --- Небольшой reverb через convolver (имитация помещения) ---
  const convolver = ctx.createConvolver();
  const impulseLen = ctx.sampleRate * 0.6;
  const impulse = ctx.createBuffer(2, impulseLen, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < impulseLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLen, 2.5);
    }
  }
  convolver.buffer = impulse;
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0.18;
  convolver.connect(reverbGain);
  reverbGain.connect(masterGain);
  waveShaper.connect(convolver);

  setTimeout(() => ctx.close(), (totalDuration + 0.5) * 1000);
}

// ─── Sections ────────────────────────────────────────────────────────────────

function AccidentPanel() {
  const [acc, setAcc] = useState<AccidentState>(loadAccident);
  const [dir, setDir] = useState<Directory>(loadDirectory);

  useEffect(() => subscribeAccident(setAcc), []);
  useEffect(() => subscribeDirectory(setDir), []);

  // При изменении справочника — подставляем значения по ролям
  useEffect(() => {
    const sorted = [...dir.opo].sort((a, b) => a.sortOrder - b.sortOrder);
    const opoLabels = sorted.map(opoLabel);
    const stored = loadAccident();
    const patch: Partial<AccidentState> = {};
    if (!stored.opo && opoLabels[0]) patch.opo = opoLabels[0];
    const roleMap: { field: keyof AccidentState; role: PersonRole }[] = [
      { field: "commanderSquad",   role: "commanderSquad"   },
      { field: "commanderPlatoon", role: "commanderPlatoon" },
      { field: "commanderUnit",    role: "commanderUnit"    },
      { field: "commDuty",         role: "commDuty"         },
    ];
    for (const { field, role } of roleMap) {
      const fromRole = getPersonByRole(dir.personnel, role);
      if (fromRole && !stored[field]) (patch as Record<string, string>)[field] = fromRole;
    }
    if (Object.keys(patch).length > 0) {
      const next = { ...stored, ...patch };
      setAcc(next);
      saveAccident(next);
    }
  }, [dir]);

  const update = (patch: Partial<AccidentState>) => {
    const next = { ...acc, ...patch };
    setAcc(next);
    saveAccident(next);
  };

  const declare = () => {
    const MSK_TZ = "Europe/Moscow";
    const localNow = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const mskNow   = new Date().toLocaleTimeString("ru-RU", { timeZone: MSK_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const next = { ...acc, active: true, startedAt: localNow, startedAtMsk: mskNow };
    setAcc(next);
    saveAccident(next);
    playSiren();
    const atype = ACCIDENT_TYPES.find(t => t.id === next.type);
    addLogEntry({
      type: "critical",
      operator: next.commDuty || "Дежурный",
      message: `🚨 АВАРИЯ ОБЪЯВЛЕНА: ${atype?.label ?? next.type}${next.opo ? ` — ${next.opo}` : ""}${next.location ? `, ${next.location}` : ""}. Время объявления: ${localNow} (МСК: ${mskNow})`,
    });
  };

  const cancel = () => {
    const prev = loadAccident();
    const atype = ACCIDENT_TYPES.find(t => t.id === prev.type);
    addLogEntry({
      type: "action",
      operator: prev.commDuty || "Дежурный",
      message: `✅ ОТБОЙ АВАРИИ: ${atype?.label ?? prev.type}${prev.opo ? ` — ${prev.opo}` : ""}${prev.location ? `, ${prev.location}` : ""}. Авария объявлялась в ${prev.startedAt}`,
    });
    clearAccident();
    setAcc({ ...DEFAULT_STATE });
  };
  const atype = ACCIDENT_TYPES.find(t => t.id === acc.type)!;

  const sel: React.CSSProperties = {
    background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))", padding: "5px 8px", borderRadius: 4,
    fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif", width: "100%", outline: "none",
  };

  const personNames = dir.personnel.map(p => p.name);
  const sortedOpo   = [...dir.opo].sort((a, b) => a.sortOrder - b.sortOrder);
  const opoLabels   = sortedOpo.map(opoLabel);

  return (
    <div className="panel-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Управление аварией</h2>
          {acc.active && (
            <span className="tag blink text-xs" style={{ background: "hsl(var(--status-critical) / 0.15)", color: "hsl(var(--status-critical))" }}>
              АВАРИЯ ОБЪЯВЛЕНА
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {acc.active && (
            <button
              onClick={() => printPutevka(acc)}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors hover:opacity-90"
              style={{ background: "hsl(var(--status-warning) / 0.12)", borderColor: "hsl(var(--status-warning) / 0.4)", color: "hsl(var(--status-warning))", fontWeight: 600 }}
            >
              <Icon name="FileText" size={12} />Путёвка
            </button>
          )}
          <button
            onClick={() => printDisposition()}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors hover:opacity-90"
            style={{ background: "hsl(var(--primary) / 0.1)", borderColor: "hsl(var(--primary) / 0.4)", color: "hsl(var(--primary))", fontWeight: 600 }}
          >
            <Icon name="BookOpen" size={12} />Приложение №1
          </button>
          <button
            onClick={() => window.open("/tablo", "_blank", "noopener,noreferrer")}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-border hover:bg-secondary transition-colors"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <Icon name="Monitor" size={12} />Открыть табло
          </button>
        </div>
      </div>

      <div className="p-4 grid grid-cols-3 gap-4">
        {/* Вид аварии */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Вид аварии</div>
          <div className="space-y-1">
            {ACCIDENT_TYPES.map(t => (
              <button key={t.id} onClick={() => update({ type: t.id })}
                className="w-full text-left px-3 py-1.5 rounded text-xs transition-all"
                style={{
                  background: acc.type === t.id ? t.bg : "hsl(var(--secondary))",
                  border: `1px solid ${acc.type === t.id ? t.color + "55" : "hsl(var(--border))"}`,
                  color: acc.type === t.id ? t.color : "hsl(var(--muted-foreground))",
                  fontFamily: "Oswald, sans-serif", fontWeight: acc.type === t.id ? 700 : 400, letterSpacing: "0.04em",
                }}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {/* ОПО + место + кнопка */}
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-widest block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>ОПО</label>
            <select style={sel}
              value={opoLabels.includes(acc.opo) ? acc.opo : (opoLabels[0] ?? "")}
              onChange={e => update({ opo: e.target.value })}>
              {opoLabels.length > 0
                ? opoLabels.map(o => <option key={o} value={o}>{o}</option>)
                : <option value="">— справочник пуст —</option>}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Место аварии (уточнение)</label>
            <input style={sel} value={acc.location} onChange={e => update({ location: e.target.value })} placeholder="напр. гор. -620 м, камера №7" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest block mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Погодные условия</label>
            <div className="grid grid-cols-3 gap-1">
              {WEATHER_CONDITIONS.map(w => (
                <button key={w.id} onClick={() => update({ weatherCondition: w.id })}
                  className="px-2 py-1.5 rounded text-xs transition-all text-left flex items-center gap-1"
                  style={{
                    background: acc.weatherCondition === w.id ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))",
                    border: `1px solid ${acc.weatherCondition === w.id ? "hsl(var(--primary) / 0.5)" : "hsl(var(--border))"}`,
                    color: acc.weatherCondition === w.id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    fontWeight: acc.weatherCondition === w.id ? 600 : 400,
                  }}>
                  <span>{w.icon}</span>
                  <span>{w.label}</span>
                </button>
              ))}
            </div>
          </div>
          {acc.active && (
            <div className="rounded p-3" style={{ background: "hsl(var(--status-critical) / 0.08)", border: "1px solid hsl(var(--status-critical) / 0.3)" }}>
              <div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Объявлено</div>
              <div className="font-semibold" style={{ fontFamily: "Oswald", color: "hsl(var(--status-critical))", fontSize: 18 }}>{atype.label}</div>
              <div className="mono text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{acc.startedAt} (МСК: {acc.startedAtMsk})</div>
              <div className="text-xs mt-1 truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{acc.opo}</div>
            </div>
          )}
          <div className="pt-1">
            {!acc.active ? (
              <button onClick={declare}
                className="w-full py-3 rounded font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
                style={{ background: "hsl(0 90% 48%)", color: "white", fontFamily: "Oswald", fontSize: 16, letterSpacing: "0.12em", boxShadow: "0 0 20px hsl(0 90% 48% / 0.5), 0 2px 8px rgba(0,0,0,0.3)" }}>
                🚨 ТРЕВОГА
              </button>
            ) : (
              <button onClick={cancel}
                className="w-full py-2 rounded border border-border hover:bg-secondary transition-colors text-sm"
                style={{ color: "hsl(var(--muted-foreground))" }}>
                Отбой аварии
              </button>
            )}
          </div>
        </div>

        {/* Ответственные из справочника */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>Ответственные лица</div>
            {dir.personnel.some(p => p.role) && (
              <button
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-secondary transition-colors"
                style={{ color: "hsl(var(--primary))", fontSize: 10 }}
                onClick={() => {
                  const patch: Partial<AccidentState> = {};
                  const roleMap: { field: keyof AccidentState; role: PersonRole }[] = [
                    { field: "commanderSquad",   role: "commanderSquad"   },
                    { field: "commanderPlatoon", role: "commanderPlatoon" },
                    { field: "commanderUnit",    role: "commanderUnit"    },
                    { field: "commDuty",         role: "commDuty"         },
                  ];
                  for (const { field, role } of roleMap) {
                    const fromRole = getPersonByRole(dir.personnel, role);
                    if (fromRole) (patch as Record<string, string>)[field] = fromRole;
                  }
                  update(patch);
                }}
              >↺ Из справочника</button>
            )}
          </div>
          {([
            { label: "По отряду",              field: "commanderSquad"   as const },
            { label: "По взводу / пункту",     field: "commanderPlatoon" as const },
            { label: "Командир отделения",     field: "commanderUnit"    as const },
            { label: "Деж. у средств связи",   field: "commDuty"         as const },
          ]).map(({ label, field }) => (
            <div key={field}>
              <label className="text-xs block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</label>
              <select style={sel}
                value={acc[field] || ""}
                onChange={e => update({ [field]: e.target.value })}>
                <option value="">— не выбран —</option>
                {dir.personnel.map(p => (
                  <option key={p.id} value={p.name}>{p.name}{p.rank ? ` (${p.rank})` : ""}</option>
                ))}
              </select>
            </div>
          ))}
          {dir.personnel.length === 0 && (
            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              Добавьте сотрудников в разделе <b>Справочники</b>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Weather Widget ───────────────────────────────────────────────────────────

const WMO_LABELS: Record<number, [string, string]> = {
  0:["Ясно","☀️"],1:["Малооблачно","🌤️"],2:["Переменная облачность","⛅"],3:["Пасмурно","☁️"],
  45:["Туман","🌫️"],48:["Изморозь","🌫️"],51:["Морось","🌦️"],53:["Морось","🌦️"],55:["Сильная морось","🌧️"],
  61:["Дождь","🌧️"],63:["Умеренный дождь","🌧️"],65:["Ливень","🌧️"],71:["Снег","🌨️"],73:["Умеренный снег","❄️"],
  75:["Метель","🌨️"],80:["Ливень","🌦️"],81:["Сильный ливень","🌧️"],95:["Гроза","⛈️"],96:["Гроза с градом","⛈️"],
};

const WIND_DIRS_W = ["С","СВ","В","ЮВ","Ю","ЮЗ","З","СЗ"];

interface CityEntry { name: string; lat: number; lon: number; tz: string; group: string; }

const CITIES: CityEntry[] = [
  // Копейский ВГСО
  { name: "Москва",              lat: 55.7558, lon: 37.6173,  tz: "Europe/Moscow",         group: "Копейский ВГСО" },
  { name: "Челябинск",           lat: 55.1644, lon: 61.4368,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Копейск",             lat: 55.1167, lon: 61.6167,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Учалы",               lat: 54.3167, lon: 59.3833,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "пос. Межозерный",     lat: 54.0600, lon: 59.8700,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Пласт",               lat: 54.3667, lon: 60.8167,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Магнитогорск",        lat: 53.4069, lon: 59.0517,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Кизил",               lat: 53.7167, lon: 58.8833,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Сибай",               lat: 52.7167, lon: 58.6667,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Бурибай",             lat: 51.9500, lon: 58.1833,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Стерлитамак",         lat: 53.6333, lon: 55.9500,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Гай",                 lat: 51.4667, lon: 58.4500,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Оренбург",            lat: 51.7727, lon: 55.0988,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  { name: "Соль-Илецк",          lat: 51.1614, lon: 54.9986,  tz: "Asia/Yekaterinburg",    group: "Копейский ВГСО" },
  // ВГСО Урала
  { name: "Москва (Урал)",       lat: 55.7558, lon: 37.6173,  tz: "Europe/Moscow",         group: "ВГСО Урала" },
  { name: "Екатеринбург",        lat: 56.8431, lon: 60.6454,  tz: "Asia/Yekaterinburg",    group: "ВГСО Урала" },
  { name: "Сатка",               lat: 55.0417, lon: 58.9833,  tz: "Asia/Yekaterinburg",    group: "ВГСО Урала" },
  { name: "Верхняя Пышма",       lat: 56.9667, lon: 60.5833,  tz: "Asia/Yekaterinburg",    group: "ВГСО Урала" },
];

const CITY_STORAGE_KEY = "vgsch_weather_city";

interface WeatherData {
  temp: number;
  windSpeed: number;
  windDir: number;
  humidity: number;
  pressure: number;
  desc: string;
  icon: string;
  updated: string;
}

const GROUPS = ["Копейский ВГСО", "ВГСО Урала"] as const;

function WeatherWidget() {
  const savedCity = localStorage.getItem(CITY_STORAGE_KEY) ?? CITIES[0].name;
  const savedGroup = CITIES.find(c => c.name === savedCity)?.group ?? GROUPS[0];

  const [groupName, setGroupName] = useState(savedGroup);
  const [cityName, setCityName] = useState(savedCity);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const citiesInGroup = CITIES.filter(c => c.group === groupName);
  const city = CITIES.find(c => c.name === cityName) ?? citiesInGroup[0];

  const fetchWeather = async (c: typeof CITIES[0]) => {
    setLoading(true);
    setError(false);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&wind_speed_unit=ms&timezone=${c.tz}`;
      const res = await fetch(url);
      const data = await res.json();
      const cur = data.current;
      const [desc, icon] = WMO_LABELS[cur.weather_code as number] ?? ["Нет данных", "🌡️"];
      setWeather({
        temp: Math.round(cur.temperature_2m),
        windSpeed: Math.round(cur.wind_speed_10m),
        windDir: cur.wind_direction_10m,
        humidity: cur.relative_humidity_2m,
        pressure: Math.round(cur.surface_pressure * 0.750062),
        desc, icon,
        updated: new Date().toLocaleTimeString("ru-RU", { timeZone: c.tz, hour: "2-digit", minute: "2-digit" }),
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWeather(city); }, [cityName]);
  useEffect(() => {
    const t = setInterval(() => fetchWeather(city), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cityName]);

  const handleGroup = (g: string) => {
    setGroupName(g);
    const first = CITIES.find(c => c.group === g);
    if (first) { setCityName(first.name); localStorage.setItem(CITY_STORAGE_KEY, first.name); }
  };

  const handleCity = (name: string) => {
    setCityName(name);
    localStorage.setItem(CITY_STORAGE_KEY, name);
  };

  const sel: React.CSSProperties = {
    background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))", padding: "3px 6px", borderRadius: 4,
    fontSize: 11, fontFamily: "IBM Plex Sans, sans-serif", outline: "none", width: "100%",
  };

  return (
    <div className="panel-card flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Погода</h2>
        {weather && (
          <span className="text-xs mono" style={{ color: "hsl(var(--muted-foreground))" }}>обн. {weather.updated}</span>
        )}
      </div>

      {/* Выбор отряда и города */}
      <div className="px-4 pt-3 space-y-2">
        <div>
          <label className="text-xs block mb-1 uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>Отряд</label>
          <select style={sel} value={groupName} onChange={e => handleGroup(e.target.value)}>
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1 uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>Город</label>
          <select style={sel} value={cityName} onChange={e => handleCity(e.target.value)}>
            {citiesInGroup.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Данные */}
      <div className="flex-1 px-4 py-4">
        {loading && (
          <div className="text-xs text-center py-4" style={{ color: "hsl(var(--muted-foreground))" }}>Загрузка…</div>
        )}
        {error && !loading && (
          <div className="text-xs text-center py-4" style={{ color: "hsl(var(--status-critical))" }}>Нет соединения с сервером погоды</div>
        )}
        {weather && !loading && (
          <div className="space-y-3">
            {/* Главное */}
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 36 }}>{weather.icon}</span>
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
                  {weather.temp > 0 ? "+" : ""}{weather.temp}°C
                </div>
                <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{weather.desc}</div>
              </div>
            </div>

            {/* Детали */}
            <div className="space-y-1.5 text-xs">
              {[
                { label: "Ветер",     value: `${weather.windSpeed} м/с, ${WIND_DIRS_W[Math.round(weather.windDir / 45) % 8]}` },
                { label: "Влажность", value: `${weather.humidity}%` },
                { label: "Давление",  value: `${weather.pressure} мм рт.ст.` },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-1 border-b border-border last:border-0">
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>{r.label}</span>
                  <span className="mono font-medium">{r.value}</span>
                </div>
              ))}
            </div>

            {/* Кнопка обновить */}
            <button
              onClick={() => fetchWeather(city)}
              className="w-full text-xs py-1.5 rounded border border-border hover:bg-secondary transition-colors mt-1"
              style={{ color: "hsl(var(--muted-foreground))" }}>
              Обновить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const [dir, setDir] = useState<Directory>(loadDirectory);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>(() => loadLog().slice(0, 5));

  useEffect(() => subscribeDirectory(setDir), []);
  useEffect(() => subscribeLog(logs => setRecentLogs(logs.slice(0, 5))), []);

  const divisions = dir.divisions;

  return (
    <div className="fade-in space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="panel-card col-span-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Подразделения</h2>
            <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>{divisions.length} единиц</span>
          </div>
          <div className="overflow-auto max-h-72 scrollbar-thin">
            {divisions.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                Список пуст — добавьте подразделения в разделе <b>Справочники</b>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "hsl(var(--muted-foreground))" }} className="text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2 font-medium">ID</th>
                    <th className="text-left px-4 py-2 font-medium">Подразделение</th>
                    <th className="text-left px-4 py-2 font-medium">Адрес</th>
                    <th className="text-left px-4 py-2 font-medium">Телефон</th>
                  </tr>
                </thead>
                <tbody>
                  {divisions.map(d => (
                    <tr key={d.id} className="border-t border-border hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-2 mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{d.id}</td>
                      <td className="px-4 py-2 font-medium text-sm">{d.name}</td>
                      <td className="px-4 py-2 text-xs">{d.location}</td>
                      <td className="px-4 py-2 mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{d.lastContact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <WeatherWidget />
      </div>

      <AccidentPanel />

      <div className="panel-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Последние события</h2>
          <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>{recentLogs.length} записей</span>
        </div>
        {recentLogs.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Событий пока нет — они появятся при объявлении аварии
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentLogs.map(l => (
              <div key={l.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                <span className="mono text-xs pt-0.5 flex-shrink-0 w-16" style={{ color: "hsl(var(--muted-foreground))" }}>{l.time}</span>
                <span className="tag text-xs flex-shrink-0" style={{ background: `${LOG_COLORS[l.type]}20`, color: LOG_COLORS[l.type] }}>{LOG_LABELS[l.type]}</span>
                <span className="text-xs flex-1">{l.message}</span>
                <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{l.operator}</span>
              </div>
            ))}
          </div>
        )}
      </div>


    </div>
  );
}

function TabloWeather() {
  const savedCity = localStorage.getItem(CITY_STORAGE_KEY) ?? CITIES[0].name;
  const [cityName, setCityName] = useState(savedCity);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const city = CITIES.find(c => c.name === cityName) ?? CITIES[0];

  const fetchW = async (c: typeof CITIES[0]) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&wind_speed_unit=ms&timezone=${c.tz}`;
      const res = await fetch(url);
      const data = await res.json();
      const cur = data.current;
      const [desc, icon] = WMO_LABELS[cur.weather_code as number] ?? ["Нет данных", "🌡️"];
      setWeather({
        temp: Math.round(cur.temperature_2m),
        windSpeed: Math.round(cur.wind_speed_10m),
        windDir: cur.wind_direction_10m,
        humidity: cur.relative_humidity_2m,
        pressure: Math.round(cur.surface_pressure * 0.750062),
        desc, icon,
        updated: new Date().toLocaleTimeString("ru-RU", { timeZone: c.tz, hour: "2-digit", minute: "2-digit" }),
      });
    } catch { /* silent */ }
  };

  useEffect(() => { fetchW(city); }, [cityName]);
  useEffect(() => {
    const t = setInterval(() => fetchW(city), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cityName]);

  const handleCity = (name: string) => {
    setCityName(name);
    localStorage.setItem(CITY_STORAGE_KEY, name);
  };

  const sel: React.CSSProperties = {
    background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))", padding: "2px 6px", borderRadius: 4,
    fontSize: 11, fontFamily: "IBM Plex Sans, sans-serif", outline: "none",
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        {weather && <span style={{ fontSize: 22 }}>{weather.icon}</span>}
        {weather && (
          <span style={{ fontFamily: "Oswald", fontSize: 22, fontWeight: 700 }}>
            {weather.temp > 0 ? "+" : ""}{weather.temp}°C
          </span>
        )}
        {weather && (
          <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.3 }}>
            <div>{weather.desc}</div>
            <div>Ветер {weather.windSpeed} м/с · {weather.pressure} мм</div>
          </div>
        )}
      </div>
      <select style={sel} value={cityName} onChange={e => handleCity(e.target.value)}>
        {CITIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
      </select>
    </div>
  );
}

function Tablo() {
  const critical = UNITS.filter(u => u.status === "critical");
  const active = UNITS.filter(u => u.status === "active");
  const warning = UNITS.filter(u => u.status === "warning");

  return (
    <div className="fade-in grid-scan min-h-screen p-6 space-y-6" style={{ background: "hsl(220 20% 4%)" }}>
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>ФГУП ВГСЧ МЧС России</div>
          <h1 className="text-4xl font-bold" style={{ fontFamily: "Oswald", color: "hsl(var(--primary))" }}>
            ОПЕРАТИВНОЕ ТАБЛО
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <TabloWeather />
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Время</div>
            <Clock />
          </div>
        </div>
      </div>

      {critical.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-3 blink" style={{ color: "hsl(var(--status-critical))" }}>
            ■ ЭКСТРЕННОЕ РЕАГИРОВАНИЕ
          </div>
          <div className="grid grid-cols-3 gap-3">
            {critical.map(u => (
              <div key={u.id} className="panel-card p-4 pulse-ring" style={{ borderColor: "hsl(var(--status-critical))" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="mono text-xs" style={{ color: "hsl(var(--status-critical))" }}>{u.id}</span>
                  <span className="tag" style={{ background: "hsl(var(--status-critical) / 0.2)", color: "hsl(var(--status-critical))" }}>СРОЧНО</span>
                </div>
                <div className="text-xl font-bold" style={{ fontFamily: "Oswald" }}>{u.name}</div>
                <div className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{u.location}</div>
                <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <span>Состав: {u.crew} чел.</span>
                  <span className="mono">Связь: {u.lastContact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {warning.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "hsl(var(--status-warning))" }}>
            ▲ ПОВЫШЕННАЯ ГОТОВНОСТЬ
          </div>
          <div className="grid grid-cols-4 gap-3">
            {warning.map(u => (
              <div key={u.id} className="panel-card p-3" style={{ borderColor: "hsl(var(--status-warning) / 0.4)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <StatusDot status={u.status} />
                  <span className="mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{u.id}</span>
                </div>
                <div className="font-semibold" style={{ fontFamily: "Oswald" }}>{u.name}</div>
                <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{u.location}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "hsl(var(--status-active))" }}>
          ● ШТАТНЫЙ РЕЖИМ
        </div>
        <div className="grid grid-cols-5 gap-2">
          {active.map(u => (
            <div key={u.id} className="panel-card p-3">
              <div className="flex items-center gap-2 mb-1">
                <StatusDot status={u.status} />
                <span className="mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{u.id}</span>
              </div>
              <div className="font-semibold text-sm" style={{ fontFamily: "Oswald" }}>{u.name}</div>
              <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{u.location}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-6 pt-4 border-t border-border">
        {[
          { label: "Подразделений всего", value: UNITS.length },
          { label: "В работе", value: active.length + warning.length + critical.length },
          { label: "Дежурный оператор", value: "Иванов А.С." },
          { label: "Смена", value: "08:00 — 20:00" },
        ].map(s => (
          <div key={s.label}>
            <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</div>
            <div className="font-semibold" style={{ fontFamily: "Oswald" }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Statuses() {
  const [units, setUnits] = useState(UNITS);

  const cycleStatus = (id: string) => {
    const order: Unit["status"][] = ["active", "warning", "critical", "idle"];
    setUnits(prev => prev.map(u => {
      if (u.id !== id) return u;
      const next = order[(order.indexOf(u.status) + 1) % order.length];
      return { ...u, status: next };
    }));
  };

  return (
    <div className="fade-in space-y-4">
      <div className="panel-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Управление статусами подразделений</h2>
          <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Нажмите на статус для переключения</p>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {units.map(u => (
            <div key={u.id} className="panel-card p-3 flex items-center gap-3">
              <StatusDot status={u.status} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{u.name}</div>
                <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{u.type} · {u.location}</div>
              </div>
              <button
                onClick={() => cycleStatus(u.id)}
                className="tag text-xs cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  background: `hsl(var(--${u.status === "active" ? "status-active" : u.status === "warning" ? "status-warning" : u.status === "critical" ? "status-critical" : "status-idle"}) / 0.15)`,
                  color: u.status === "active" ? "hsl(var(--status-active))" : u.status === "warning" ? "hsl(var(--status-warning))" : u.status === "critical" ? "hsl(var(--status-critical))" : "hsl(var(--status-idle))"
                }}
              >
                {STATUS_LABELS[u.status]}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Средства связи</h2>
        </div>
        <div className="p-4 grid grid-cols-3 gap-3">
          {[
            { name: "Р/С шахтная ИГС-01", status: "active", freq: "ИГС-01, 433 МГц", lastCheck: "08:39" },
            { name: "Телефония подземная", status: "active", freq: "Шахтный коммут.", lastCheck: "08:40" },
            { name: "КВ-станция Р-130", status: "warning", freq: "7.050 МГц", lastCheck: "08:15" },
            { name: "Связь штаб ВГСЧ", status: "active", freq: "Цифровой VoIP", lastCheck: "08:42" },
            { name: "Р/С поверхностная", status: "idle", freq: "УКВ 148 МГц", lastCheck: "07:55" },
            { name: "АИАС ВГСЧ", status: "active", freq: "TCP/IP", lastCheck: "08:47" },
          ].map(c => (
            <div key={c.name} className="panel-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <StatusDot status={c.status as Unit["status"]} />
                <span className="font-medium text-sm">{c.name}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                <span>{c.freq}</span>
                <span className="mono">{c.lastCheck}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Journal() {
  const [logs, setLogs] = useState<LogEntry[]>(loadLog);
  const [filter, setFilter] = useState<"all" | LogEntry["type"]>("all");

  useEffect(() => subscribeLog(setLogs), []);

  const filtered = filter === "all" ? logs : logs.filter(l => l.type === filter);

  return (
    <div className="fade-in space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "info", "action", "warning", "critical"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="tag text-xs cursor-pointer transition-all"
            style={{
              background: filter === f
                ? f === "all" ? "hsl(var(--primary))" : `${LOG_COLORS[f as LogEntry["type"]]}30`
                : "hsl(var(--muted))",
              color: filter === f
                ? f === "all" ? "hsl(var(--primary-foreground))" : LOG_COLORS[f as LogEntry["type"]]
                : "hsl(var(--muted-foreground))"
            }}
          >
            {f === "all" ? "Все" : LOG_LABELS[f as LogEntry["type"]]}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{filtered.length} записей</span>
      </div>

      <div className="panel-card">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Записей нет
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(l => (
              <div key={l.id} className="flex items-start gap-4 px-4 py-3 hover:bg-secondary/30 transition-colors">
                <div className="flex-shrink-0 text-right w-20">
                  <div className="mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{l.time}</div>
                  {l.date && <div className="mono text-xs" style={{ color: "hsl(var(--muted-foreground))", fontSize: 10 }}>{l.date}</div>}
                </div>
                <span className="tag text-xs flex-shrink-0 w-24 text-center" style={{ background: `${LOG_COLORS[l.type]}20`, color: LOG_COLORS[l.type] }}>
                  {LOG_LABELS[l.type]}
                </span>
                <div className="flex-1 text-sm">{l.message}</div>
                <div className="flex-shrink-0 text-right">
                  {l.unit && <div className="mono text-xs" style={{ color: "hsl(var(--primary))" }}>{l.unit}</div>}
                  <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{l.operator}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}




// ─── Directory Section ────────────────────────────────────────────────────────

function DirectorySection() {
  const [dir, setDir] = useState<Directory>(loadDirectory);
  const [tab, setTab] = useState<"personnel" | "opo" | "divisions" | "disposition">("personnel");

  // Форма персонала
  const [pForm, setPForm] = useState<Omit<PersonEntry, "id">>({ name: "", rank: "", phone: "", role: "" });
  const [pEdit, setPEdit] = useState<string | null>(null);

  // Форма ОПО
  const [oForm, setOForm] = useState<Omit<OpoEntry, "id">>({ name: "", horizon: "", area: "", sortOrder: 0 });
  const [oEdit, setOEdit] = useState<string | null>(null);
  const [oDragIdx, setODragIdx] = useState<number | null>(null);

  // Форма Подразделений
  const [dForm, setDForm] = useState<DivisionEntry>({ id: "", name: "", location: "", lastContact: "" });
  const [dEdit, setDEdit] = useState<string | null>(null);

  const persist = (next: Directory) => { setDir(next); saveDirectory(next); };

  // ── Персонал CRUD ──
  const saveP = () => {
    if (!pForm.name.trim()) return;
    if (pEdit) {
      persist({ ...dir, personnel: dir.personnel.map(p => p.id === pEdit ? { id: pEdit, ...pForm } : p) });
      setPEdit(null);
    } else {
      persist({ ...dir, personnel: [...dir.personnel, { id: uid(), ...pForm }] });
    }
    setPForm({ name: "", rank: "", phone: "", role: "" });
  };
  const editP = (p: PersonEntry) => { setPEdit(p.id); setPForm({ name: p.name, rank: p.rank, phone: p.phone, role: p.role ?? "" }); };
  const delP  = (id: string) => persist({ ...dir, personnel: dir.personnel.filter(p => p.id !== id) });
  const cancelP = () => { setPEdit(null); setPForm({ name: "", rank: "", phone: "", role: "" }); };

  // ── ОПО CRUD ──
  const sortedOpoDir = [...dir.opo].sort((a, b) => a.sortOrder - b.sortOrder);
  const saveO = () => {
    if (!oForm.name.trim()) return;
    if (oEdit) {
      persist({ ...dir, opo: dir.opo.map(o => o.id === oEdit ? { id: oEdit, ...oForm } : o) });
      setOEdit(null);
    } else {
      const maxOrder = dir.opo.length > 0 ? Math.max(...dir.opo.map(o => o.sortOrder)) : -1;
      persist({ ...dir, opo: [...dir.opo, { id: uid(), ...oForm, sortOrder: maxOrder + 1 }] });
    }
    setOForm({ name: "", horizon: "", area: "", sortOrder: 0 });
  };
  const editO = (o: OpoEntry) => { setOEdit(o.id); setOForm({ name: o.name, horizon: o.horizon, area: o.area, sortOrder: o.sortOrder }); };
  const delO  = (id: string) => persist({ ...dir, opo: dir.opo.filter(o => o.id !== id) });
  const cancelO = () => { setOEdit(null); setOForm({ name: "", horizon: "", area: "", sortOrder: 0 }); };
  const moveOpo = (fromIdx: number, toIdx: number) => {
    const arr = [...sortedOpoDir];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    const reindexed = arr.map((o, i) => ({ ...o, sortOrder: i }));
    persist({ ...dir, opo: reindexed });
  };

  // ── Подразделения CRUD ──
  const saveD = () => {
    if (!dForm.id.trim() || !dForm.name.trim()) return;
    if (dEdit) {
      persist({ ...dir, divisions: dir.divisions.map(d => d.id === dEdit ? { ...dForm, id: dEdit } : d) });
      setDEdit(null);
    } else {
      // проверка уникальности ID
      if (dir.divisions.some(d => d.id === dForm.id.trim())) return;
      persist({ ...dir, divisions: [...dir.divisions, { ...dForm, id: dForm.id.trim() }] });
    }
    setDForm({ id: "", name: "", location: "", lastContact: "" });
  };
  const editD = (d: DivisionEntry) => { setDEdit(d.id); setDForm({ ...d }); };
  const delD  = (id: string) => persist({ ...dir, divisions: dir.divisions.filter(d => d.id !== id) });
  const cancelD = () => { setDEdit(null); setDForm({ id: "", name: "", location: "", lastContact: "" }); };

  // ── Диспозиция CRUD ──
  const emptyDisp = (): Omit<DispositionRow, "id"> => ({ opoName: "", explosion: "", fire: "", collapse: "", flood: "", phone: "", callsign: "" });
  const [dispForm, setDispForm] = useState<Omit<DispositionRow, "id">>(emptyDisp());
  const [dispEdit, setDispEdit] = useState<string | null>(null);
  const [dispMeta, setDispMeta] = useState(dir.dispositionMeta);

  const saveDisp = () => {
    if (!dispForm.opoName.trim()) return;
    const rows = dispEdit
      ? dir.dispositionRows.map(r => r.id === dispEdit ? { id: dispEdit, ...dispForm } : r)
      : [...dir.dispositionRows, { id: uid(), ...dispForm }];
    persist({ ...dir, dispositionRows: rows });
    setDispEdit(null); setDispForm(emptyDisp());
  };
  const editDisp = (r: DispositionRow) => { setDispEdit(r.id); setDispForm({ opoName: r.opoName, explosion: r.explosion, fire: r.fire, collapse: r.collapse, flood: r.flood, phone: r.phone, callsign: r.callsign }); };
  const delDisp  = (id: string) => persist({ ...dir, dispositionRows: dir.dispositionRows.filter(r => r.id !== id) });
  const cancelDisp = () => { setDispEdit(null); setDispForm(emptyDisp()); };
  const saveMeta = () => persist({ ...dir, dispositionMeta: dispMeta });

  const inputCls: React.CSSProperties = {
    background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))", padding: "5px 10px", borderRadius: 4,
    fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif", outline: "none", width: "100%",
  };

  return (
    <div className="fade-in space-y-4">
      {/* Вкладки */}
      <div className="flex gap-2">
        {([["personnel", "Личный состав", "Users"], ["opo", "Объекты ОПО", "Building2"], ["divisions", "Подразделения", "Shield"], ["disposition", "Диспозиция", "BookOpen"]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm transition-all"
            style={{
              background: tab === id ? "hsl(var(--primary))" : "hsl(var(--secondary))",
              color: tab === id ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
            }}>
            <Icon name={icon} fallback="Circle" size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── Личный состав ── */}
      {tab === "personnel" && (
        <div className="grid grid-cols-3 gap-4">
          {/* Форма */}
          <div className="panel-card p-4 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
              {pEdit ? "Редактировать" : "Добавить сотрудника"}
            </h3>
            {([
              { label: "ФИО *", key: "name", placeholder: "Иванов А.С." },
              { label: "Должность", key: "rank", placeholder: "Командир отряда" },
              { label: "Телефон", key: "phone", placeholder: "+7 (912) 000-00-00" },
            ] as const).map(f => (
              <div key={f.key}>
                <label className="text-xs block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{f.label}</label>
                <input style={inputCls} placeholder={f.placeholder}
                  value={pForm[f.key]} onChange={e => setPForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="text-xs block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Роль в дежурстве</label>
              <select style={inputCls} value={pForm.role ?? ""} onChange={e => setPForm(p => ({ ...p, role: e.target.value as PersonRole }))}>
                {PERSON_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveP}
                className="flex-1 py-2 rounded text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontFamily: "Oswald" }}>
                {pEdit ? "Сохранить" : "Добавить"}
              </button>
              {pEdit && (
                <button onClick={cancelP}
                  className="px-3 py-2 rounded border border-border text-sm hover:bg-secondary transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}>
                  Отмена
                </button>
              )}
            </div>
          </div>

          {/* Список */}
          <div className="panel-card col-span-2">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Список</h3>
              <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                {dir.personnel.length} записей
              </span>
            </div>
            {dir.personnel.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Список пуст — добавьте сотрудников</div>
            ) : (
              <div className="divide-y divide-border">
                {dir.personnel.map(p => {
                  const roleLabel = PERSON_ROLES.find(r => r.id === p.role && r.id !== "")?.label;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{p.name}</span>
                          {roleLabel && (
                            <span className="tag text-xs" style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))", fontSize: 9 }}>
                              {roleLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {p.rank}{p.phone ? ` · ${p.phone}` : ""}
                        </div>
                      </div>
                      <button onClick={() => editP(p)} className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary transition-colors flex-shrink-0">
                        Изменить
                      </button>
                      <button onClick={() => delP(p.id)} className="text-xs px-2 py-1 rounded border transition-colors flex-shrink-0"
                        style={{ borderColor: "hsl(var(--status-critical) / 0.3)", color: "hsl(var(--status-critical))" }}>
                        Удалить
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Объекты ОПО ── */}
      {tab === "opo" && (
        <div className="grid grid-cols-3 gap-4">
          {/* Форма */}
          <div className="panel-card p-4 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
              {oEdit ? "Редактировать" : "Добавить ОПО"}
            </h3>
            {([
              { label: "Наименование объекта *", key: "name", placeholder: "Шахта «Северная»" },
              { label: "Горизонт / уровень", key: "horizon", placeholder: "-480 м" },
              { label: "Участок / зона", key: "area", placeholder: "Участок №3" },
            ] as const).map(f => (
              <div key={f.key}>
                <label className="text-xs block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{f.label}</label>
                <input style={inputCls} placeholder={f.placeholder}
                  value={oForm[f.key]} onChange={e => setOForm(o => ({ ...o, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={saveO}
                className="flex-1 py-2 rounded text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontFamily: "Oswald" }}>
                {oEdit ? "Сохранить" : "Добавить"}
              </button>
              {oEdit && (
                <button onClick={cancelO}
                  className="px-3 py-2 rounded border border-border text-sm hover:bg-secondary transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}>
                  Отмена
                </button>
              )}
            </div>
          </div>

          {/* Список с drag-and-drop */}
          <div className="panel-card col-span-2">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Список объектов</h3>
                <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Перетащите строки для изменения порядка</p>
              </div>
              <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                {dir.opo.length} записей
              </span>
            </div>
            {dir.opo.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Список пуст — добавьте объекты ОПО</div>
            ) : (
              <div className="divide-y divide-border">
                {sortedOpoDir.map((o, idx) => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={() => setODragIdx(idx)}
                    onDragOver={e => { e.preventDefault(); }}
                    onDrop={() => { if (oDragIdx !== null && oDragIdx !== idx) { moveOpo(oDragIdx, idx); setODragIdx(null); } }}
                    onDragEnd={() => setODragIdx(null)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors cursor-grab active:cursor-grabbing"
                    style={{ opacity: oDragIdx === idx ? 0.4 : 1 }}
                  >
                    <span className="mono text-xs flex-shrink-0 w-6 text-center" style={{ color: "hsl(var(--muted-foreground))" }}>{idx + 1}</span>
                    <Icon name="GripVertical" size={14} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{o.name}</div>
                      <div className="text-xs mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {o.horizon}{o.area ? ` · ${o.area}` : ""}
                      </div>
                    </div>
                    <button onClick={() => editO(o)} className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary transition-colors flex-shrink-0">
                      Изменить
                    </button>
                    <button onClick={() => delO(o.id)} className="text-xs px-2 py-1 rounded border transition-colors flex-shrink-0"
                      style={{ borderColor: "hsl(var(--status-critical) / 0.3)", color: "hsl(var(--status-critical))" }}>
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Подразделения ── */}
      {tab === "divisions" && (
        <div className="grid grid-cols-3 gap-4">
          {/* Форма */}
          <div className="panel-card p-4 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>
              {dEdit ? "Редактировать" : "Добавить подразделение"}
            </h3>
            {([
              { label: "ID *", key: "id", placeholder: "ВГСО-1", disabled: !!dEdit },
              { label: "Подразделение *", key: "name", placeholder: "ВГСО-1 Центральный" },
              { label: "Адрес", key: "location", placeholder: "г. Копейск, ул. Ленина, 1" },
              { label: "Телефон", key: "lastContact", placeholder: "+7 (351) 123-45-67" },
            ] as const).map(f => (
              <div key={f.key}>
                <label className="text-xs block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{f.label}</label>
                <input
                  style={{ ...inputCls, opacity: f.disabled ? 0.5 : 1 }}
                  placeholder={f.placeholder}
                  disabled={f.disabled}
                  value={dForm[f.key]}
                  onChange={e => setDForm(d => ({ ...d, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={saveD}
                className="flex-1 py-2 rounded text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontFamily: "Oswald" }}>
                {dEdit ? "Сохранить" : "Добавить"}
              </button>
              {dEdit && (
                <button onClick={cancelD}
                  className="px-3 py-2 rounded border border-border text-sm hover:bg-secondary transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}>
                  Отмена
                </button>
              )}
            </div>
          </div>

          {/* Список */}
          <div className="panel-card col-span-2">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Список подразделений</h3>
              <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                {dir.divisions.length} записей
              </span>
            </div>
            {dir.divisions.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Список пуст — добавьте подразделения</div>
            ) : (
              <div className="divide-y divide-border">
                {dir.divisions.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                    <span className="mono text-xs w-16 flex-shrink-0" style={{ color: "hsl(var(--primary))" }}>{d.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{d.name}</div>
                      <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {d.location && <span>{d.location}</span>}
                        {d.location && d.lastContact && <span> · </span>}
                        {d.lastContact && <span className="mono">📞 {d.lastContact}</span>}
                      </div>
                    </div>
                    <button onClick={() => editD(d)} className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary transition-colors flex-shrink-0">
                      Изменить
                    </button>
                    <button onClick={() => delD(d.id)} className="text-xs px-2 py-1 rounded border transition-colors flex-shrink-0"
                      style={{ borderColor: "hsl(var(--status-critical) / 0.3)", color: "hsl(var(--status-critical))" }}>
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Диспозиция ── */}
      {tab === "disposition" && (
        <div className="space-y-4">

          {/* Реквизиты документа */}
          <div className="panel-card p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ fontFamily: "Oswald" }}>Реквизиты документа</h3>
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: "Командир ВГСО (Фамилия И.О.)", key: "commanderName" as const, placeholder: "Иванов А.С." },
                { label: "Наименование ВГСО", key: "vgsoName" as const, placeholder: 'филиала "Копейский ВГСО"' },
                { label: "Год", key: "year" as const, placeholder: "2026" },
              ]).map(f => (
                <div key={f.key}>
                  <label className="text-xs block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{f.label}</label>
                  <input style={inputCls} placeholder={f.placeholder}
                    value={dispMeta[f.key]}
                    onChange={e => setDispMeta(m => ({ ...m, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <button onClick={saveMeta}
              className="mt-3 px-4 py-1.5 rounded text-sm font-medium transition-all hover:opacity-90"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontFamily: "Oswald" }}>
              Сохранить реквизиты
            </button>
          </div>

          {/* Форма строки */}
          <div className="panel-card p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ fontFamily: "Oswald" }}>
              {dispEdit ? "Редактировать строку" : "Добавить организацию (ОПО)"}
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="text-xs block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Наименование организации (ОПО) *</label>
                <input style={inputCls} placeholder='Шахта «Северная»'
                  value={dispForm.opoName} onChange={e => setDispForm(f => ({ ...f, opoName: e.target.value }))} />
              </div>
              {([
                { label: "Взрыв (вспышка)", key: "explosion" as const, placeholder: "ВГСВ №1 — 2 отд., МБЭР, КИЛ" },
                { label: "Пожар", key: "fire" as const, placeholder: "ВГСВ №1 — 2 отд., МБЭР" },
                { label: "Обрушение, выброс, горный удар", key: "collapse" as const, placeholder: "ВГСВ №1 — 2 отд., МБЭР" },
                { label: "Загазирование, затопление, прорыв воды", key: "flood" as const, placeholder: "ВГСВ №1 — 2 отд., МБЭР" },
                { label: "Номер телефона ВГСВ (ВГСП)", key: "phone" as const, placeholder: "2-43-77" },
                { label: "Радиопозывные ВГСВ (ВГСП)", key: "callsign" as const, placeholder: "Лава-1" },
              ]).map(f => (
                <div key={f.key}>
                  <label className="text-xs block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{f.label}</label>
                  <textarea style={{ ...inputCls, resize: "vertical", minHeight: 52 }} placeholder={f.placeholder}
                    value={dispForm[f.key]} onChange={e => setDispForm(frm => ({ ...frm, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={saveDisp}
                className="px-4 py-1.5 rounded text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontFamily: "Oswald" }}>
                {dispEdit ? "Сохранить" : "Добавить"}
              </button>
              {dispEdit && (
                <button onClick={cancelDisp}
                  className="px-3 py-1.5 rounded border border-border text-sm hover:bg-secondary transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}>
                  Отмена
                </button>
              )}
            </div>
          </div>

          {/* Список строк */}
          <div className="panel-card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily: "Oswald" }}>Строки диспозиции</h3>
              <span className="tag" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                {dir.dispositionRows.length} объектов
              </span>
            </div>
            {dir.dispositionRows.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                Добавьте организации для диспозиции
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }} className="uppercase tracking-wide">
                      <th className="text-left px-3 py-2 font-medium">Организация (ОПО)</th>
                      <th className="text-left px-3 py-2 font-medium">Взрыв</th>
                      <th className="text-left px-3 py-2 font-medium">Пожар</th>
                      <th className="text-left px-3 py-2 font-medium">Обрушение</th>
                      <th className="text-left px-3 py-2 font-medium">Затопление</th>
                      <th className="text-left px-3 py-2 font-medium">Тел.</th>
                      <th className="text-left px-3 py-2 font-medium">Позывной</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dir.dispositionRows.map((r, i) => (
                      <tr key={r.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                        <td className="px-3 py-2 font-medium">{i + 1}. {r.opoName}</td>
                        <td className="px-3 py-2" style={{ color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap", maxWidth: 140 }}>{r.explosion || "—"}</td>
                        <td className="px-3 py-2" style={{ color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap", maxWidth: 140 }}>{r.fire || "—"}</td>
                        <td className="px-3 py-2" style={{ color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap", maxWidth: 140 }}>{r.collapse || "—"}</td>
                        <td className="px-3 py-2" style={{ color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap", maxWidth: 140 }}>{r.flood || "—"}</td>
                        <td className="px-3 py-2 mono">{r.phone || "—"}</td>
                        <td className="px-3 py-2">{r.callsign || "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => editDisp(r)} className="text-xs px-2 py-0.5 rounded border border-border hover:bg-secondary transition-colors">Изм.</button>
                            <button onClick={() => delDisp(r.id)} className="text-xs px-2 py-0.5 rounded border transition-colors"
                              style={{ borderColor: "hsl(var(--status-critical) / 0.3)", color: "hsl(var(--status-critical))" }}>Удл.</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV: { id: SectionId; label: string; icon: string }[] = [
  { id: "dashboard",  label: "Главная панель",   icon: "LayoutDashboard" },
  { id: "journal",    label: "Журнал событий",    icon: "ScrollText" },
  { id: "directory",  label: "Справочники",       icon: "BookOpen" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Index() {
  const [section, setSection] = useState<SectionId>("dashboard");
  const current = NAV.find(n => n.id === section)!;

  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => void } | null>(null);
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as Event & { prompt: () => void }); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const handleInstall = () => { if (installPrompt) { installPrompt.prompt(); setInstallPrompt(null); } };

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const renderSection = () => {
    switch (section) {
      case "dashboard": return <Dashboard />;
      case "journal": return <Journal />;
      case "directory":  return <DirectorySection />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border" style={{ background: "hsl(220 16% 6%)" }}>
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <img src="https://cdn.poehali.dev/projects/e8b93a3a-e9ed-40ee-8196-78090d463984/bucket/cdb862bf-f0a2-4d2b-899b-eb676c919290.png" alt="ВГСЧ" className="w-8 h-8 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold tracking-widest" style={{ fontFamily: "Oswald", color: "hsl(var(--primary))" }}>
                АРМ ДЕЖУРНОГО
              </div>
              <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 9 }}>ФГУП ВГСЧ МЧС России</div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <Clock />
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`nav-item w-full text-left ${section === n.id ? "active" : ""}`}
            >
              <Icon name={n.icon} fallback="Circle" size={15} />
              <span className="flex-1">{n.label}</span>

            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            <span className="status-dot status-active" />
            <span>Система в работе</span>
          </div>
          <div className="mono mt-0.5" style={{ color: "hsl(var(--muted-foreground))", fontSize: 10 }}>
            АСУ синхр.: 08:47
          </div>
        </div>
        <div className="px-3 py-2 border-t border-border">
          <div style={{ fontSize: 8.5, color: "hsl(var(--muted-foreground) / 0.35)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
            <div style={{ textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>Разработчик</div>
            <div style={{ color: "hsl(var(--primary) / 0.55)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              СДС филиала «Копейский ВГСО»
            </div>
            <div style={{ color: "hsl(var(--muted-foreground) / 0.5)", fontWeight: 500 }}>
              С.Г. Ипатов
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0" style={{ background: "hsl(220 16% 6%)" }}>
          <div className="flex items-center gap-3">
            <Icon name={current.icon} fallback="Circle" size={16} style={{ color: "hsl(var(--muted-foreground))" }} />
            <h1 className="font-semibold uppercase tracking-widest text-sm" style={{ fontFamily: "Oswald" }}>
              {current.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: isOnline ? "hsl(var(--status-active))" : "hsl(var(--status-warning))" }}>
              <span className={`status-dot ${isOnline ? "status-active" : "status-warning"}`} />
              <span>{isOnline ? "Онлайн" : "Офлайн — кэш"}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="text-xs mono" style={{ color: "hsl(var(--muted-foreground))" }}>
              {new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </div>
            <div className="w-px h-4 bg-border" />
            {installPrompt && (
              <button
                onClick={handleInstall}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all"
                style={{ background: "hsl(45 95% 55% / 0.12)", color: "hsl(45 95% 55%)", border: "1px solid hsl(45 95% 55% / 0.3)" }}
              >
                <Icon name="Download" size={13} />
                <span className="uppercase tracking-wide font-semibold" style={{ fontFamily: "Oswald", fontSize: 11 }}>Установить</span>
              </button>
            )}
            <button
              onClick={() => window.open("/tablo", "_blank", "noopener,noreferrer")}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all"
              style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.3)" }}
            >
              <Icon name="Monitor" size={13} />
              <span className="uppercase tracking-wide font-semibold" style={{ fontFamily: "Oswald", fontSize: 11 }}>Открыть табло</span>
              <Icon name="ExternalLink" size={11} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}