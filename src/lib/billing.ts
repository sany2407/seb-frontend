/** Billing-interval + unit-price helpers. Interval counts in months; the picked month is the period END. */
export const INTERVALS = [
  { months: 1, label: "Every month" },
  { months: 2, label: "Every 2 months" },
  { months: 3, label: "Every 3 months (quarterly)" },
  { months: 6, label: "Every 6 months" },
  { months: 12, label: "Yearly" },
];

/** "2026-10" minus (n-1) months → "2026-09" etc. */
export function shiftMonth(ym: string, back: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Period start for an end-month + interval. */
export function periodStartOf(endYm: string, interval: number): string {
  return shiftMonth(endYm, Math.max(1, interval) - 1);
}

function shortMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

/** "Oct 2026" for monthly, "Aug–Sep 2026" / "Aug–Oct 2026" for longer periods. */
export function periodLabel(startYm: string, endYm: string): string {
  if (startYm === endYm) return shortMonth(endYm);
  const [sy, sm] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  const s = new Date(sy, sm - 1).toLocaleString("en-IN", { month: "short" });
  const e = new Date(ey, em - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
  return `${s}–${e}`;
}
