"use client";
import { useEffect, useState } from "react";
import { splitUsageBased, splitEqual, splitPercentage } from "@/lib/calc";
import { splitsApi, homesApi, settingsApi, num, ApiError, HomeDTO } from "@/lib/api";
import { inr, r2, sharePct } from "@/lib/format";
import { Btn, Card, Field, inputCls, Badge, Loading, ApiErrorCard } from "@/components/ui";
import Link from "next/link";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

export default function SplitLab() {
  const [homes, setHomes] = useState<HomeDTO[] | null>(null);
  const [loadErr, setLoadErr] = useState<unknown>(null);
  const [ym, setYm] = useState("2026-10");
  const [bill, setBill] = useState(2400);
  const [main, setMain] = useState(330);
  const [method, setMethod] = useState<"usage" | "equal" | "percentage">("usage");
  const [units, setUnits] = useState<Record<string, number>>({});
  const [pcts, setPcts] = useState<Record<string, number>>({});
  const [saveState, setSaveState] = useState<"idle" | "loading" | "saved" | "offline" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [needAuth, setNeedAuth] = useState(false);
  const [locked, setLocked] = useState(false);
  const [savedBillId, setSavedBillId] = useState<string | null>(null);
  const [savedBillAmount, setSavedBillAmount] = useState<number | null>(null);
  const [unitPrice, setUnitPrice] = useState(0);
  const [over, setOver] = useState<Record<string, number>>({});

  async function loadHomes() {
    setLoadErr(null);
    try {
      const [r, s] = await Promise.all([homesApi.list(true), settingsApi.get().catch(() => null)]);
      const subs = r.homes.filter((h) => h.meter_type !== "MAIN");
      setHomes(subs);
      setUnits(Object.fromEntries(subs.map((h) => [h.id, 0])));
      if (s) setUnitPrice(num(s.settings.unit_price));
      setPcts(Object.fromEntries(subs.map((h, i) => [h.id, i === 0 ? 100 - (subs.length - 1) * Math.floor(100 / subs.length) : Math.floor(100 / subs.length)])));
    } catch (e) { setLoadErr(e); }
  }
  useEffect(() => { loadHomes(); }, []);

  const list = homes ?? [];
  let out: { rows: { homeId: string; homeName: string; units: number; percent: number; amount: number }[]; commonUnits?: number; commonAmount?: number } | null = null;
  let err = "";
  try {
    if (list.length > 0 && main > 0 && bill > 0) {
      if (method === "usage") out = splitUsageBased(bill, main, list.map((h) => ({ homeId: h.id, homeName: h.name, units: units[h.id] ?? 0 })));
      else if (method === "equal") out = { rows: splitEqual(bill, list.map((h) => ({ homeId: h.id, homeName: h.name }))) };
      else out = { rows: splitPercentage(bill, list.map((h) => ({ homeId: h.id, homeName: h.name, percent: pcts[h.id] ?? 0 }))) };
    }
  } catch (e) { err = (e as Error).message; }
  const rows = out?.rows ?? [];
  const effRows = rows.map((r: { homeId: string; homeName: string; units: number; percent: number; amount: number }) => ({ ...r, amount: over[r.homeId] ?? r.amount }));
  const allocated = r2(effRows.reduce((s: number, r: { amount: number }) => s + r.amount, 0));
  const balDiff = r2(bill - allocated);
  const balanced = Math.abs(balDiff) <= 0.005 && effRows.length > 0;

  function autoBalance() {
    const target = effRows.find((r: { homeId: string }) => r.homeId === "COMMON") ?? [...effRows].sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount)[0];
    if (!target) return;
    const rest = effRows.filter((r: { homeId: string }) => r.homeId !== target.homeId).reduce((s: number, r: { amount: number }) => s + r.amount, 0);
    setOver({ ...over, [target.homeId]: r2(bill - rest) });
  }

  async function loadSaved(year: string, month: string) {
    if (!homes || homes.length === 0) return;
    setSaveState("loading"); setSaveMsg(""); setNeedAuth(false); setOver({});
    try {
      const r = await splitsApi.get(year, month);
      if (r.saved && r.bill) {
        const b = r.bill;
        setBill(r2(Number(b.amount))); setMain(r2(Number(b.main_units)));
        setMethod(b.method as "usage" | "equal" | "percentage");
        setSavedBillId((b as { id: string }).id ?? null);
        setSavedBillAmount(r2(Number(b.amount)));
        setLocked(true);
        const byId = Object.fromEntries((r.splits ?? []).map((s) => [s.home_id ?? "COMMON", s]));
        if (b.method === "usage") {
          setUnits(Object.fromEntries(homes.map((h) => [h.id, r2(Number((byId[h.id] as { units?: number })?.units ?? 0))])));
        }
        setSaveState("saved"); setSaveMsg(`Loaded saved split for ${monthLabel(r.monthKey)}`);
      } else {
        setSavedBillId(null); setSavedBillAmount(null); setLocked(false);
        setSaveState("idle"); setSaveMsg(`No saved split for ${monthLabel(r.monthKey)} — compute & save below.`);
      }
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      setSaveState(status === 0 ? "offline" : "error");
      setNeedAuth(status === 401);
      setLocked(false);
      setSaveMsg(e instanceof Error ? e.message : "Load failed");
    }
  }

  useEffect(() => {
    if (!homes || homes.length === 0) return;
    const [y, m] = ym.split("-");
    if (y && m) loadSaved(y, m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym, homes]);

  function onYm(v: string) { setYm(v); }

  async function save() {
    if (err || effRows.length === 0) return;
    if (!balanced) { setSaveState("error"); setSaveMsg(`Split is off by ${inr(balDiff)} — adjust amounts or tap Auto-balance.`); return; }
    const [y, m] = ym.split("-");
    setSaveState("loading"); setSaveMsg(""); setNeedAuth(false);
    try {
      const r = await splitsApi.save(y, m, {
        month: monthLabel(ym), totalBill: bill, mainUnits: main,
        method, rows: effRows.map((r) => ({ ...r, units: r2(r.units), amount: r2(r.amount) })), commonUnits: out?.commonUnits ?? 0, commonAmount: out?.commonAmount ?? 0,
      });
      setSaveState("saved"); setSaveMsg(`Saved split for ${monthLabel(r.monthKey)}`);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      setSaveState(status === 0 ? "offline" : "error");
      setNeedAuth(status === 401);
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  if (loadErr) return <div className="space-y-4"><h1 className="text-2xl font-bold">Bill Split</h1><ApiErrorCard error={loadErr} onRetry={loadHomes} /></div>;
  if (!homes) return <div className="space-y-4"><h1 className="text-2xl font-bold">Bill Split</h1><Loading /></div>;
  if (homes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Bill Split</h1>
        <Card className="text-center">
          <p className="font-bold">No homes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add homes first — splits are stored per month against your homes.</p>
          <Link href="/homes"><Btn className="mt-3">Go to Homes</Btn></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Bill Split</h1>
        <p className="text-sm text-muted-foreground">Pick month/year, compute with the 3 MVP methods, save per month.</p></div>
        {saveState === "saved" && <Badge tone="green">Saved</Badge>}
        {saveState === "offline" && <Badge tone="amber">Backend offline</Badge>}
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Month / Year"><input type="month" className={inputCls} value={ym} onChange={(e) => onYm(e.target.value)} /></Field>
          <Field label="Total bill ₹"><input type="number" className={inputCls} value={bill} onChange={(e) => setBill(Number(e.target.value))} /></Field>          <Field label="Main units"><input type="number" className={inputCls} value={main} disabled={locked} onChange={(e) => setMain(Number(e.target.value))} /></Field>
          <Field label="Method"><select className={inputCls} value={method} onChange={(e) => { setOver({}); setMethod(e.target.value as "usage" | "equal" | "percentage"); }}><option value="usage">Usage based</option><option value="equal">Equal</option><option value="percentage">Percentage</option></select></Field>
        </div>
        {!locked && unitPrice > 0 && main > 0 && <p className="mt-2 text-xs text-muted-foreground">💡 {r2(main)} × ₹{unitPrice} ≈ {inr(r2(main * unitPrice))} <button className="font-semibold text-primary" onClick={() => setBill(r2(main * unitPrice))}>Use calculated</button> — or keep the directly-entered bill.</p>}
        {saveMsg && <p className="mt-2 text-sm text-muted-foreground">{saveMsg}{needAuth && <> — <Link href="/login" className="font-semibold text-primary">sign in</Link> or <Link href="/signup" className="font-semibold text-primary">create an account</Link></>}</p>}
        {locked && <p className="mt-2 text-xs text-muted-foreground">🔒 Main units locked to the saved bill — {savedBillId ? <Link href={`/bills/${savedBillId}`} className="font-semibold text-primary">edit in Bills</Link> : "edit in Bills"}. Total + house values stay editable; re-save updates bill + split.</p>}
        {savedBillAmount !== null && bill !== savedBillAmount && <p className="mt-2 rounded-xl bg-warning/20 px-3 py-2 text-xs font-medium text-warning-foreground">Total differs from saved bill ({inr(savedBillAmount)}) — saving writes the new total to the bill too.</p>}
        {method !== "equal" && <div className="mt-3 grid grid-cols-3 gap-2">{list.map((h) => <Field key={h.id} label={method === "usage" ? `${h.name} units` : `${h.name} %`}><input type="number" className={inputCls} value={method === "usage" ? (units[h.id] ?? 0) : (pcts[h.id] ?? 0)} onChange={(e) => { if (method === "usage") setUnits({ ...units, [h.id]: Number(e.target.value) }); else setPcts({ ...pcts, [h.id]: Number(e.target.value) }); }} /></Field>)}</div>}
      </Card>

      {err ? <Card><p className="text-sm font-medium text-destructive">{err}</p></Card> : (
        <Card>
          <h2 className="font-bold">Result — total {inr(allocated)}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Tap an amount to adjust it — the total must stay exact.</p>
          <div className="mt-2 space-y-2">{effRows.map((r) => {
            const manual = over[r.homeId] !== undefined;
            return (
            <div key={r.homeId} className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <div className="flex-1"><p className="text-sm font-bold">{r.homeName} {manual && <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">adjusted</span>}</p><p className="text-xs text-muted-foreground">{r2(r.units)} units · {sharePct(r.amount, bill)}%</p></div>
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
            );
          })}</div>
          <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${balanced ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
            <span>Allocated {inr(allocated)} / {inr(bill)}</span>
            <span>{balanced ? "✓ exact" : `off by ${inr(balDiff)}`}</span>
          </div>
          {!balanced && <Btn variant="outline" className="mt-2 w-full" onClick={autoBalance}>Auto-balance via {effRows.some((r) => r.homeId === "COMMON") ? "Common" : "largest share"}</Btn>}
          {Object.keys(over).length > 0 && <button className="mt-2 w-full text-center text-xs font-semibold text-muted-foreground" onClick={() => setOver({})}>Reset to auto split</button>}
          {out?.commonUnits !== undefined && <p className="mt-2 text-xs text-muted-foreground">Common = {r2(main)} − {r2(list.reduce((a, h) => a + (units[h.id] ?? 0), 0))} = {r2(out.commonUnits)} units · {inr(out.commonAmount ?? 0)}</p>}
          <Btn className="mt-3 w-full !py-3" onClick={save} disabled={saveState === "loading"}>{saveState === "loading" ? "Saving…" : `Save split for ${monthLabel(ym)}`}</Btn>
        </Card>
      )}
    </div>
  );
}
