/** Typed client for the Express backend. Set NEXT_PUBLIC_API_URL (default localhost:4000). */
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Supabase numeric columns arrive as strings — coerce everywhere. */
export const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const TOKEN_KEY = "seb_session";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const s = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null");
    return s?.access_token ?? null;
  } catch { return null; }
}

export function setSession(session: { access_token: string; refresh_token: string } | null) {
  if (typeof window === "undefined") return;
  if (session) localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Backend unreachable — is `npm run dev` running in /backend?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ---------- DTOs (snake_case, as returned by the API) ----------
export interface HomeDTO { id: string; name: string; occupant: string; meter_no: string; meter_type: "MAIN" | "SUB"; active: boolean; notes: string; }
export interface MeterDTO { id: string; home_id: string | null; meter_no: string; type: "MAIN" | "SUB"; active: boolean; billing_interval_months: number; unit_price: number | string; }
export interface ReadingDTO { id: string; meter_id: string; home_id: string | null; month_key: string; month: string; prev: number | string; curr: number | string; units: number | string; meter_reset: boolean; photo_count: number; notes: string; }
export interface BillDTO {
  id: string; month_key: string; month: string; bill_no: string;
  main_prev: number | string; main_curr: number | string; main_units: number | string;
  amount: number | string; bill_date: string | null; due_date: string | null;
  status: string; paid: number | string; method: string;
  common_units: number | string; common_amount: number | string;
  payment_method: string | null; notes: string;
  period_start: string | null; period_end: string | null; unit_price: number | string;
}
export interface SplitDTO { id: string; bill_id: string; home_id: string | null; home_name: string; units: number | string; percent: number | string; amount: number | string; }
export interface PaymentDTO { id: string; bill_id: string; amount: number | string; paid_at: string; method: string | null; ref: string | null; }
export interface AttachmentDTO { id: string; owner_type: string; owner_id: string; file_name: string; file_url: string; file_type: string; file_size: number; attachment_type: string; }

export interface SplitRowDTO { homeId: string; homeName: string; units: number; percent: number; amount: number; }

export const homesApi = {
  list(active?: boolean) {
    const q = active === undefined ? "" : `?active=${active}`;
    return api<{ homes: HomeDTO[] }>(`/api/homes${q}`);
  },
  create(b: { name: string; occupant?: string; meterNo: string; meterType?: "MAIN" | "SUB"; notes?: string }) {
    return api<{ home: HomeDTO }>("/api/homes", { method: "POST", body: JSON.stringify(b) });
  },
  update(id: string, b: Partial<{ name: string; occupant: string; meterNo: string; notes: string; active: boolean }>) {
    return api<{ home: HomeDTO }>(`/api/homes/${id}`, { method: "PATCH", body: JSON.stringify(b) });
  },
  remove(id: string, hard = false) {
    return api(`/api/homes/${id}${hard ? "?hard=true" : ""}`, { method: "DELETE" });
  },
};

export const metersApi = {
  list() { return api<{ meters: MeterDTO[] }>("/api/meters"); },
};

export const readingsApi = {
  list(params?: { monthKey?: string; homeId?: string }) {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<{ readings: ReadingDTO[] }>(`/api/readings${q ? `?${q}` : ""}`);
  },
  create(b: { meterId: string; homeId?: string | null; monthKey: string; month: string; prev: number; curr: number; meterReset?: boolean; notes?: string }) {
    return api<{ reading: ReadingDTO }>("/api/readings", { method: "POST", body: JSON.stringify(b) });
  },
};

export const billsApi = {
  list(status?: string) {
    return api<{ bills: BillDTO[] }>(`/api/bills${status ? `?status=${status}` : ""}`);
  },
  get(id: string) {
    return api<{ bill: BillDTO; splits: SplitDTO[]; payments: PaymentDTO[]; attachments: AttachmentDTO[] }>(`/api/bills/${id}`);
  },
  create(b: {
    monthKey: string; month: string; billNo?: string; mainPrev: number; mainCurr: number; amount: number;
    billDate?: string; dueDate?: string; method: "usage" | "equal" | "percentage";
    percentages?: Record<string, number>; notes?: string;
    readings: { homeId: string; homeName: string; prev: number; curr: number }[];
    periodStart?: string; periodEnd?: string; unitPrice?: number;
    finalRows?: { homeId: string; amount: number }[];
  }) {
    return api<{ bill: BillDTO; splits: SplitDTO[] }>("/api/bills", { method: "POST", body: JSON.stringify(b) });
  },
  update(id: string, b: object) {
    return api<{ bill: BillDTO }>(`/api/bills/${id}`, { method: "PATCH", body: JSON.stringify(b) });
  },
};

export const splitsApi = {
  get(year: string, month: string) {
    return api<{ saved: boolean; monthKey: string; bill?: BillDTO; splits?: SplitDTO[] }>(`/api/splits/${year}/${month}`);
  },
  save(year: string, month: string, payload: {
    month: string; totalBill: number; mainUnits: number; mainPrev?: number; mainCurr?: number;
    method: "usage" | "equal" | "percentage"; rows: SplitRowDTO[]; commonUnits: number; commonAmount: number;
  }) {
    return api<{ saved: boolean; monthKey: string; billId: string }>(`/api/splits/${year}/${month}`, {
      method: "PUT", body: JSON.stringify(payload),
    });
  },
};

export interface SettingsDTO { user_id: string; billing_interval_months: number; unit_price: number | string; currency: string; }

export const settingsApi = {
  get() { return api<{ settings: SettingsDTO }>("/api/settings"); },
  save(b: { billingIntervalMonths: number; unitPrice: number }) {
    return api<{ settings: SettingsDTO }>("/api/settings", { method: "PUT", body: JSON.stringify(b) });
  },
};

export const paymentsApi = {  create(b: { billId: string; amount: number; paidAt?: string; method?: string; ref?: string; screenshotUrl?: string }) {
    return api<{ paid: number; outstanding: number; status: string }>("/api/payments", { method: "POST", body: JSON.stringify(b) });
  },
};

export const attachmentsApi = {
  create(b: { ownerType: "EB_BILL" | "METER_READING" | "PAYMENT"; ownerId: string; fileName: string; fileUrl: string; fileType: string; fileSize: number; attachmentType: "EB_BILL" | "METER_PHOTO" | "PAYMENT_RECEIPT" | "PAYMENT_SCREENSHOT" | "OTHER" }) {
    return api<{ attachment: AttachmentDTO }>("/api/attachments", { method: "POST", body: JSON.stringify(b) });
  },
  remove(id: string) {
    return api(`/api/attachments/${id}`, { method: "DELETE" });
  },
};

/** Direct browser upload to Cloudinary via backend-signed params. Returns the secure URL. */
export async function uploadToCloudinary(file: File, folder = "eb-bills"): Promise<string> {
  const sign = await api<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string; uploadUrl: string }>(
    "/api/uploads/sign", { method: "POST", body: JSON.stringify({ folder }) }
  );
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", sign.signature);
  form.append("folder", sign.folder);
  const res = await fetch(sign.uploadUrl, { method: "POST", body: form });
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const json = await res.json();
  return json.secure_url as string;
}
