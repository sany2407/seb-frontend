"use client";
import { useEffect, useState } from "react";
import { readingsApi, homesApi, metersApi, num, ReadingDTO, HomeDTO, MeterDTO } from "@/lib/api";
import { r2 } from "@/lib/format";
import { Card, Field, Badge, Btn, inputCls, Loading, ApiErrorCard, Empty } from "@/components/ui";

export default function ReadingsPage() {
  const [readings, setReadings] = useState<ReadingDTO[] | null>(null);
  const [homes, setHomes] = useState<HomeDTO[]>([]);
  const [meters, setMeters] = useState<MeterDTO[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ homeId: "", monthKey: "", prev: "", curr: "", meterReset: false, notes: "" });
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const [r, h, m] = await Promise.all([readingsApi.list(), homesApi.list(), metersApi.list()]);
      setReadings([...r.readings].sort((a, b) => (a.month_key < b.month_key ? 1 : -1)));
      setHomes(h.homes.filter((x) => x.active));
      setMeters(m.meters);
    } catch (e) { setError(e); }
  }
  useEffect(() => { load(); }, []);

  const homeName = (id: string | null) => homes.find((h) => h.id === id)?.name ?? "—";
  const meterNo = (id: string) => meters.find((m) => m.id === id)?.meter_no ?? "";

  async function add() {
    setFormErr(""); setBusy(true);
    try {
      const meter = meters.find((m) => m.home_id === form.homeId);
      if (!meter) throw new Error("No meter registered for this home — re-add the home.");
      const [y, m] = form.monthKey.split("-");
      if (!y || !m) throw new Error("Pick a month");
      const label = new Date(Number(y), Number(m) - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
      await readingsApi.create({
        meterId: meter.id, homeId: form.homeId, monthKey: form.monthKey, month: label,
        prev: Number(form.prev), curr: Number(form.curr), meterReset: form.meterReset, notes: form.notes,
      });
      setShow(false);
      setForm({ homeId: "", monthKey: "", prev: "", curr: "", meterReset: false, notes: "" });
      await load();
    } catch (e) { setFormErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  if (error) return <div className="space-y-4"><h1 className="text-2xl font-bold">Meter Readings</h1><ApiErrorCard error={error} onRetry={load} /></div>;
  if (!readings) return <div className="space-y-4"><h1 className="text-2xl font-bold">Meter Readings</h1><Loading /></div>;

  const months = [...new Set(readings.map((r) => r.month_key))].sort().reverse();
  const rows = readings.filter((r) =>
    (filter === "all" || r.month_key === filter) &&
    (!q || homeName(r.home_id).toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Meter Readings</h1>
      <Card>
        <div className="grid gap-2 md:grid-cols-3">
          <Field label="Month"><select className={inputCls} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All months</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
          <Field label="Search home"><input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Home A…" /></Field>
          <div className="flex items-end"><Btn className="w-full" onClick={() => setShow(!show)}>+ Add reading</Btn></div>
        </div>
      </Card>

      {show && (
        <Card>
          <h2 className="font-bold">Add reading</h2>
          {formErr && <p className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{formErr}</p>}
          {homes.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Add a home first.</p> : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Home"><select className={inputCls} value={form.homeId} onChange={(e) => setForm({ ...form, homeId: e.target.value })}><option value="">Select…</option>{homes.map((h) => <option key={h.id} value={h.id}>{h.name} · {h.meter_no}</option>)}</select></Field>
              <Field label="Month"><input type="month" className={inputCls} value={form.monthKey} onChange={(e) => setForm({ ...form, monthKey: e.target.value })} /></Field>
              <Field label="Previous reading"><input type="number" className={inputCls} value={form.prev} onChange={(e) => setForm({ ...form, prev: e.target.value })} /></Field>
              <Field label="Current reading"><input type="number" className={inputCls} value={form.curr} onChange={(e) => setForm({ ...form, curr: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.meterReset} onChange={(e) => setForm({ ...form, meterReset: e.target.checked })} /> Meter reset / replaced</label>
              <Field label="Notes"><input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>
            </div>
          )}
          <div className="mt-3 flex gap-2"><Btn onClick={add} disabled={busy || homes.length === 0}>{busy ? "Saving…" : "Save reading"}</Btn><Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn></div>
        </Card>
      )}

      {rows.length === 0 && <Empty title="No readings" sub="Add one above, or create a monthly bill and readings are captured there." />}
      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-bold">{homeName(r.home_id)} · {r.month}</p>
                <p className="text-xs text-muted-foreground">{meterNo(r.meter_id)} · {r2(num(r.prev))} → {r2(num(r.curr))} = <b className="text-foreground">{r2(num(r.units))} units</b>{r.meter_reset ? " · reset" : ""}</p>
              </div>
              <Badge tone="slate">📷 {r.photo_count}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
