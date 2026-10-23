"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { splitUsageBased, splitEqual, splitPercentage } from "@/lib/calc";
import { homesApi, billsApi, attachmentsApi, uploadToCloudinary, settingsApi, num, HomeDTO } from "@/lib/api";
import { periodStartOf, periodLabel } from "@/lib/billing";
import { inr, r2, sharePct } from "@/lib/format";
import { Btn, Card, Field, inputCls, Badge, Loading, ApiErrorCard } from "@/components/ui";

interface Row { homeId: string; homeName: string; prev: number; curr: number; }

export default function NewBillPage() {
  const router = useRouter();
  const [homes, setHomes] = useState<HomeDTO[] | null>(null);
  const [loadErr, setLoadErr] = useState<unknown>(null);
  const [step, setStep] = useState(1);
  const [month, setMonth] = useState("2026-11");
  const [mainPrev, setMainPrev] = useState(0);
  const [mainCurr, setMainCurr] = useState(0);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"usage" | "equal" | "percentage">("usage");
  const [rows, setRows] = useState<Row[]>([]);
  const [pct, setPct] = useState<number[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [over, setOver] = useState<Record<string, number>>({});
  const [pUnits, setPUnits] = useState<Record<string, number>>({});
  const [interval, setInterval] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  async function load() {
    setLoadErr(null);
    try {
      const [r, s] = await Promise.all([homesApi.list(true), settingsApi.get().catch(() => null)]);
      const subs = r.homes.filter((h) => h.meter_type !== "MAIN");
      setHomes(subs);
      setRows(subs.map((h) => ({ homeId: h.id, homeName: h.name, prev: 0, curr: 0 })));
      setPct(subs.map(() => Math.floor(100 / Math.max(1, subs.length))));
      if (s) { setInterval(Number(s.settings.billing_interval_months) || 1); setUnitPrice(num(s.settings.unit_price)); }
    } catch (e) { setLoadErr(e); }
  }
  useEffect(() => { load(); }, []);

  const mainUnits = mainCurr - mainPrev;
  const startYm = periodStartOf(month, interval);
  const label = periodLabel(startYm, month);
  const calculated = unitPrice > 0 && mainUnits > 0 ? r2(mainUnits * unitPrice) : 0;
  let preview: { rows: { homeId: string; homeName: string; units: number; percent: number; amount: number }[]; commonUnits?: number; commonAmount?: number; error?: string } | null = null;
  // Preview-stage unit edits (usage method): full recompute off these units.
  const adjUnits = (id: string, fallback: number) => Math.max(0, pUnits[id] ?? fallback);
  try {
    if (mainUnits > 0 && amount > 0 && rows.length > 0) {
      if (method === "usage") preview = splitUsageBased(amount, mainUnits, rows.map((r) => ({ homeId: r.homeId, homeName: r.homeName, units: adjUnits(r.homeId, r.curr - r.prev) })));
      else if (method === "equal") preview = { rows: splitEqual(amount, rows) };
      else preview = { rows: splitPercentage(amount, rows.map((r, i) => ({ homeId: r.homeId, homeName: r.homeName, percent: pct[i] ?? 0 }))) };
    }
  } catch (e) { preview = { rows: [], error: (e as Error).message }; }

  function validate(): string {
    if (!month) return "Billing month is required";
    if (rows.length === 0) return "Add at least one active home first";
    if (mainCurr < mainPrev) return "Main current reading cannot be lower than previous.";
    if (amount <= 0) return "Bill amount must be > 0";
    for (const r of rows) if (r.curr < r.prev) return `${r.homeName}: current < previous.`;
    if (method === "percentage" && Math.abs(pct.reduce((a, b) => a + b, 0) - 100) > 0.01) return "Percentages must total 100%";
    return "";
  }

  function calc() { const e = validate(); setErr(e); if (!e) { setOver({}); setPUnits(Object.fromEntries(rows.map((r) => [r.homeId, r.curr - r.prev]))); setStep(2); } }

  // Manual overrides on top of the computed split; must sum exactly to the bill.
  const effRows = (preview?.rows ?? []).map((r) => ({ ...r, amount: over[r.homeId] ?? r.amount }));
  const allocated = r2(effRows.reduce((s, r) => s + r.amount, 0));
  const diff = r2(amount - allocated);
  const balanced = Math.abs(diff) <= 0.005 && effRows.length > 0;

  function autoBalance() {
    if (!preview || preview.error) return;
    const base = preview.rows.map((r) => ({ ...r, amount: over[r.homeId] ?? r.amount }));
    const target = base.find((r) => r.homeId === "COMMON") ?? [...base].sort((a, b) => b.amount - a.amount)[0];
    if (!target) return;
    const rest = base.filter((r) => r.homeId !== target.homeId).reduce((s, r) => s + r.amount, 0);
    setOver({ ...over, [target.homeId]: r2(amount - rest) });
  }

  async function save() {
    const e = validate();
    if (e || !preview || preview.error) { setErr(e || preview?.error || "Cannot save"); return; }
    if (!balanced) { setErr(`Split is off by ${inr(diff)} — adjust amounts or tap Auto-balance.`); return; }
    setSaving(true); setSaveNote("Creating bill…");
    try {
      const created = await billsApi.create({
        monthKey: month, month: label, mainPrev, mainCurr, amount, method,
        percentages: method === "percentage" ? Object.fromEntries(rows.map((r, i) => [r.homeId, pct[i]])) : undefined,
        readings: rows.map((r) => ({ homeId: r.homeId, homeName: r.homeName, prev: r.prev, curr: r2(r.prev + adjUnits(r.homeId, r.curr - r.prev)) })),
        periodStart: startYm, periodEnd: month, unitPrice,
        finalRows: Object.keys(over).length > 0 ? effRows.map((r) => ({ homeId: r.homeId, amount: r2(r.amount) })) : undefined,
      });
      if (files.length > 0) {
        setSaveNote(`Uploading ${files.length} file(s)…`);
        for (const f of files) {
          const url = await uploadToCloudinary(f, "eb-bills");
          await attachmentsApi.create({
            ownerType: "EB_BILL", ownerId: created.bill.id, fileName: f.name,
            fileUrl: url, fileType: f.type || "image", fileSize: f.size, attachmentType: "EB_BILL",
          });
        }
      }
      router.push(`/bills/${created.bill.id}`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Save failed");
      setStep(1);
    } finally { setSaving(false); setSaveNote(""); }
  }

  if (loadErr) return <div className="space-y-4"><h1 className="text-2xl font-bold">New Monthly Bill</h1><ApiErrorCard error={loadErr} onRetry={load} /></div>;
  if (!homes) return <div className="space-y-4"><h1 className="text-2xl font-bold">New Monthly Bill</h1><Loading /></div>;
  if (homes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">New Monthly Bill</h1>
        <Card className="text-center">
          <p className="font-bold">No homes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your homes (sub-meters register automatically) before creating a bill.</p>
          <Link href="/homes"><Btn className="mt-3">Go to Homes</Btn></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground"><Link href="/bills" className="font-semibold">← Bills</Link> · New Monthly Bill — step {step}/2 · &lt;2 min flow</p>
      <h1 className="text-2xl font-bold">New Monthly Bill</h1>
      {(err || saveNote) && <div className={`rounded-xl px-3 py-2 text-sm font-medium ${err ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{err || saveNote}</div>}

      {step === 1 && (
        <div className="space-y-3">
          <Card>
            <h2 className="font-bold">1 · EB bill + main meter</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label={interval === 1 ? "Billing month" : "Billing period ends"}><input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
              <Field label="Bill amount (₹)" hint={calculated ? `${r2(mainUnits)} × ₹${unitPrice} = ₹${calculated.toLocaleString("en-IN")}` : "Entered directly from the EB bill — always the source of truth."}>
                <div className="flex gap-2">
                  <input type="number" className={inputCls} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} placeholder="2400" />
                  {calculated > 0 && <Btn variant="outline" className="shrink-0" onClick={() => setAmount(calculated)}>Use ₹{calculated}</Btn>}
                </div>
              </Field>
              <Field label="Main prev reading"><input type="number" className={inputCls} value={mainPrev || ""} onChange={(e) => setMainPrev(Number(e.target.value))} placeholder="9990" /></Field>
              <Field label="Main curr reading"><input type="number" className={inputCls} value={mainCurr || ""} onChange={(e) => setMainCurr(Number(e.target.value))} placeholder="10320" /></Field>
            </div>
            <p className="mt-2 text-sm">Billing period = <b>{label}</b> · Main consumption = <b>{mainUnits} units</b></p>
            <Field label="Split method">
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as "usage" | "equal" | "percentage")}>
                <option value="usage">Usage based (Recommended)</option>
                <option value="equal">Equal split</option>
                <option value="percentage">Percentage</option>
              </select>
            </Field>
          </Card>
          <Card>
            <h2 className="font-bold">2 · Sub-meter readings</h2>
            <div className="mt-3 space-y-3">
              {rows.map((r, i) => (
                <div key={r.homeId} className="rounded-xl bg-muted p-3">
                  <p className="text-sm font-bold">{r.homeName}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Prev"><input type="number" className={inputCls} value={r.prev || ""} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, prev: Number(e.target.value) } : x))} /></Field>
                    <Field label="Curr"><input type="number" className={inputCls} value={r.curr || ""} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, curr: Number(e.target.value) } : x))} /></Field>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Consumption = <b>{r.curr - r.prev} units</b></p>
                  {method === "percentage" && <Field label="Share %"><input type="number" className={inputCls} value={pct[i] ?? ""} onChange={(e) => setPct(pct.map((p, j) => j === i ? Number(e.target.value) : p))} /></Field>}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="font-bold">3 · Photos <span className="font-normal text-muted-foreground">(optional)</span></h2>
            <input type="file" multiple accept="image/*,.pdf" className="mt-2 text-sm" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            {files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{files.map((f) => <Badge key={f.name} tone="slate">{f.name}</Badge>)}</div>}
            <p className="mt-1 text-xs text-muted-foreground">Uploaded to Cloudinary after the bill is created.</p>
          </Card>
          <Btn className="w-full !py-3" onClick={calc}>Calculate Split →</Btn>
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-3">
          <Card>
            <h2 className="font-bold">Split preview — {inr(amount)} / {mainUnits} units</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Tap an amount to adjust it — the total must stay exact.</p>
            {preview.error ? <p className="mt-2 text-sm text-destructive">{preview.error}</p> : (
              <div className="mt-3 space-y-2">
                {effRows.map((r) => {
                  const manual = over[r.homeId] !== undefined;
                  const isHome = r.homeId !== "COMMON";
                  return (
                  <div key={r.homeId} className="rounded-xl bg-muted p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-bold">{r.homeName} {manual && <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">adjusted</span>}</p>
                          <p className="text-xs text-muted-foreground">{r2(r.units)} units · {sharePct(r.amount, amount)}%</p>
                      </div>
                      <input
                        type="number" min={0} step="0.01" aria-label={`${r.homeName} amount`}
                        className="w-28 rounded-lg border border-input bg-card px-2 py-1.5 text-right text-lg font-bold outline-none focus:border-ring"
                        value={r.amount}
                        onChange={(e) => {
                          const v = e.target.value;
                          setOver((o) => {
                            if (v === "") { const { [r.homeId]: _drop, ...rest } = o; return rest; }
                            return { ...o, [r.homeId]: Number(v) };
                          });
                        }}
                      />
                    </div>
                    {method === "usage" && isHome && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Units</span>
                        <input
                          type="number" min={0} step="0.01" aria-label={`${r.homeName} units`}
                          className="w-28 rounded-lg border border-input bg-card px-2 py-1.5 text-right text-sm font-semibold outline-none focus:border-ring"
                          value={pUnits[r.homeId] ?? r.units}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setPUnits((p) => ({ ...p, [r.homeId]: Number.isFinite(v) ? v : 0 }));
                            setOver({});
                          }}
                        />
                        <span className="text-xs text-muted-foreground">edits recompute the split</span>
                      </div>
                    )}
                  </div>
                  );
                })}
                {preview.commonUnits !== undefined && <p className="text-xs text-muted-foreground">Common: {r2(preview.commonUnits)} units · {inr(preview.commonAmount ?? 0)}</p>}
                <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${balanced ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
                  <span>Allocated {inr(allocated)} / {inr(amount)}</span>
                  <span>{balanced ? "✓ exact" : `off by ${inr(diff)}`}</span>
                </div>
                {!balanced && <Btn variant="outline" className="w-full" onClick={autoBalance}>Auto-balance via {effRows.some((r) => r.homeId === "COMMON") ? "Common" : "largest share"}</Btn>}
                {Object.keys(over).length > 0 && <button className="w-full text-center text-xs font-semibold text-muted-foreground" onClick={() => setOver({})}>Reset to auto split</button>}
              </div>
            )}
          </Card>
          <div className="flex gap-2"><Btn variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={saving}>← Edit</Btn><Btn className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save bill"}</Btn></div>
        </div>
      )}
    </div>
  );
}
