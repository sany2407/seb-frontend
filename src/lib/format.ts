export function inr(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
export function fmtUnits(n: number) {
  return `${n.toLocaleString("en-IN")} units`;
}
export function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
/** Round to 2 decimals — kills float artifacts like 62.220000000000003. */
export const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
/** Share of total as % — displayed next to amounts so the row is always internally consistent. */
export const sharePct = (amount: number, total: number) => total > 0 ? r2((Number(amount) / Number(total)) * 100) : 0;
