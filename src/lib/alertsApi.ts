const API = "https://functions.poehali.dev/alerts";

export type AlertChannel = "max" | "sms" | "call";

export interface ChannelsReady {
  max: boolean;
  sms: boolean;
  call: boolean;
}

export interface AlertRecipient {
  id: number;
  name: string;
  rank: string;
  phone: string;
  smsStatus: string;
  smsError: string;
  callStatus: string;
  callError: string;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedVia: string;
}

export interface AlertInfo {
  id: number;
  label: string;
  opo: string;
  location: string;
  startedAt: string;
  declaredBy: string;
  channels: string[];
  total: number;
  confirmed: number;
  active: boolean;
  createdAt: string;
}

export interface DeclarePayload {
  accidentType: string;
  accidentLabel: string;
  opo: string;
  location: string;
  startedAt: string;
  declaredBy: string;
  channels: AlertChannel[];
  recipients: { id: string; name: string; rank: string; phone: string }[];
  baseUrl: string;
}

export async function getChannels(): Promise<ChannelsReady> {
  try {
    const r = await fetch(`${API}?action=channels`);
    return await r.json();
  } catch {
    return { max: false, sms: false, call: false };
  }
}

export async function declareAlert(p: DeclarePayload) {
  const r = await fetch(`${API}?action=declare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? "Не удалось разослать оповещение");
  return d as { alertId: number; recipients: number; result: unknown };
}

export async function getAlertStatus(alertId?: number) {
  const q = alertId ? `&alertId=${alertId}` : "";
  const r = await fetch(`${API}?action=status${q}`);
  const d = await r.json();
  return d as { alert: AlertInfo | null; recipients: AlertRecipient[] };
}

export async function closeAlert(alertId?: number) {
  await fetch(`${API}?action=close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertId }),
  }).catch(() => {});
}

const KEY = "vgsch_active_alert_id";
export const rememberAlertId = (id: number) => localStorage.setItem(KEY, String(id));
export const forgetAlertId = () => localStorage.removeItem(KEY);
export const recallAlertId = (): number | undefined => {
  const v = localStorage.getItem(KEY);
  return v ? Number(v) : undefined;
};
