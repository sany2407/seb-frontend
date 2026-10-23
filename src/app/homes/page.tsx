"use client";
import { useEffect, useState } from "react";
import { homesApi, metersApi, num, HomeDTO, MeterDTO } from "@/lib/api";
import { INTERVALS } from "@/lib/billing";
import { Badge, Btn, Card, Field, inputCls, Loading, ApiErrorCard, Empty } from "@/components/ui";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";

export default function HomesPage() {
  const [homes, setHomes] = useState<HomeDTO[] | null>(null);
  const [meters, setMeters] = useState<MeterDTO[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<HomeDTO | null>(null);
  const [form, setForm] = useState({ name: "", occupant: "", meterNo: "", meterType: "SUB" as "MAIN" | "SUB", notes: "" });
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  async function load() {
    setError(null);
    try {
      const [r, mt] = await Promise.all([homesApi.list(), metersApi.list().catch(() => ({ meters: [] as MeterDTO[] }))]);
      setHomes(r.homes); setMeters(mt.meters);
    }
    catch (e) { setError(e); }
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", occupant: "", meterNo: "", meterType: "SUB", notes: "" });
    setFormErr(""); setShow(true);
  }
  function openEdit(h: HomeDTO) {
    setEditing(h);
    setForm({ name: h.name, occupant: h.occupant, meterNo: h.meter_no, meterType: h.meter_type, notes: h.notes });
    setFormErr(""); setShow(true);
  }

  async function save() {
    setFormErr(""); setBusy(true);
    try {
      if (editing) await homesApi.update(editing.id, { name: form.name, occupant: form.occupant, meterNo: form.meterNo, notes: form.notes });
      else await homesApi.create({ name: form.name, occupant: form.occupant, meterNo: form.meterNo, meterType: form.meterType, notes: form.notes });
      setShow(false); await load();
    } catch (e) { setFormErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  async function toggle(h: HomeDTO) {
    try {
      if (h.active) await homesApi.remove(h.id);
      else await homesApi.update(h.id, { active: true });
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function hardDelete(h: HomeDTO) {
    if (!confirm(`Permanently delete ${h.name}? Readings stay but lose their home link.`)) return;
    try { await homesApi.remove(h.id, true); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  if (error) return <div className="space-y-4"><h1 className="text-2xl font-bold">Homes & Meters</h1><ApiErrorCard error={error} onRetry={load} /></div>;
  if (!homes) return <div className="space-y-4"><h1 className="text-2xl font-bold">Homes & Meters</h1><Loading /></div>;

  const mains = homes.filter((h) => h.meter_type === "MAIN");
  const subs = homes.filter((h) => h.meter_type !== "MAIN");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Homes & Meters</h1><p className="text-sm text-muted-foreground">{subs.filter((h) => h.active).length} active homes · {mains.length} main meter{mains.length === 1 ? "" : "s"}</p></div>
        <Btn onClick={openAdd}><Plus size={16} /> Add home</Btn>
      </div>

      {mains.map((m) => {
        const meter = meters.find((x) => x.home_id === m.id) ?? meters.find((x) => x.meter_no === m.meter_no);
        const months = Number(meter?.billing_interval_months ?? 1);
        const price = num(meter?.unit_price);
        return (
        <Card key={m.id} className="border-primary">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">⚡</div>
            <div className="flex-1">
              <p className="font-bold">{m.name} (TANGEDCO)</p>
              <p className="text-sm text-muted-foreground">{m.meter_no}{m.occupant ? ` · ${m.occupant}` : ""}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone="blue">{INTERVALS.find((o) => o.months === months)?.label ?? `Every ${months} mo`}</Badge>
                {price > 0 && <Badge tone="slate">₹{price}/unit</Badge>}
              </div>
            </div>
            <Badge tone={m.active ? "green" : "slate"}>{m.active ? "Active" : "Inactive"}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => openEdit(m)}><Pencil size={13} /> Edit</Btn>
            <Btn variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => toggle(m)}><Power size={13} /> {m.active ? "Deactivate" : "Activate"}</Btn>
            <Btn variant="ghost" className="!px-3 !py-1.5 text-xs !text-destructive" onClick={() => hardDelete(m)}><Trash2 size={13} /> Delete</Btn>
          </div>
        </Card>
        );
      })}

      {show && (
        <Card>
          <h2 className="font-bold">{editing ? `Edit ${editing.name}` : "Add home"}</h2>
          {formErr && <p className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{formErr}</p>}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Home name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Home D" /></Field>
            <Field label="Occupant"><input className={inputCls} value={form.occupant} onChange={(e) => setForm({ ...form, occupant: e.target.value })} placeholder="Name" /></Field>
            <Field label="Meter no."><input className={inputCls} value={form.meterNo} onChange={(e) => setForm({ ...form, meterNo: e.target.value })} placeholder="MTR004" disabled={!!editing} /></Field>
            {!editing && <Field label="Meter type"><select className={inputCls} value={form.meterType} onChange={(e) => setForm({ ...form, meterType: e.target.value as "MAIN" | "SUB" })}><option value="SUB">Sub meter</option><option value="MAIN">Main meter (TANGEDCO)</option></select></Field>}
            <Field label="Notes"><input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>
          </div>
          <div className="mt-3 flex gap-2"><Btn onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Save home"}</Btn><Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn></div>
        </Card>
      )}

      {subs.length === 0 && !show && <Empty title="No homes yet" sub="Add your first home — a sub-meter is registered automatically." />}
      <div className="grid gap-3 md:grid-cols-2">
        {subs.map((h) => (
          <Card key={h.id}>
            <div className="flex items-start justify-between">
              <div><p className="font-bold">{h.name}</p><p className="text-sm text-muted-foreground">Occupant: {h.occupant || "—"}</p><p className="text-sm text-muted-foreground">Meter No: {h.meter_no}</p></div>
              <Badge tone={h.active ? "green" : "slate"}>{h.active ? "Active" : "Inactive"}</Badge>
            </div>
            {h.notes && <p className="mt-1 text-xs text-muted-foreground">{h.notes}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => openEdit(h)}><Pencil size={13} /> Edit</Btn>
              <Btn variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => toggle(h)}><Power size={13} /> {h.active ? "Deactivate" : "Activate"}</Btn>
              <Btn variant="ghost" className="!px-3 !py-1.5 text-xs !text-destructive" onClick={() => hardDelete(h)}><Trash2 size={13} /> Delete</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
