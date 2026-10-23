"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { billsApi, num, BillDTO, SplitDTO } from "@/lib/api";
import { inr, r2, sharePct } from "@/lib/format";
import { Badge, Btn, Card, Stat, Loading, ApiErrorCard, Empty } from "@/components/ui";
import { ArrowRight, CircleAlert, Plus } from "lucide-react";

export default function Dashboard() {
  const [bills, setBills] = useState<BillDTO[] | null>(null);
  const [splits, setSplits] = useState<SplitDTO[]>([]);
  const [error, setError] = useState<unknown>(null);

  async function load() {
    setError(null);
    try {
      const r = await billsApi.list();
      const sorted = [...r.bills].sort((a, b) => (a.month_key < b.month_key ? 1 : -1));
      setBills(sorted);
      if (sorted[0]) {
        const d = await billsApi.get(sorted[0].id);
        setSplits(d.splits);
      }
    } catch (e) { setError(e); }
  }
  useEffect(() => { load(); }, []);

  if (error) return <div className="space-y-4"><h1 className="text-2xl font-bold">Dashboard</h1><ApiErrorCard error={error} onRetry={load} /></div>;
  if (!bills) return <div className="space-y-4"><h1 className="text-2xl font-bold">Dashboard</h1><Loading /></div>;
  if (bills.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Empty title="No bills yet" sub="Add your homes, then create your first monthly bill." />
        <div className="flex gap-2">
          <Link href="/homes" className="flex-1"><Btn variant="outline" className="w-full">1 · Add homes</Btn></Link>
          <Link href="/bills/new" className="flex-1"><Btn className="w-full"><Plus size={16} /> New Monthly Bill</Btn></Link>
        </div>
      </div>
    );
  }

  const cur = bills[0];
  const amount = num(cur.amount), paid = num(cur.paid);
  const mainUnits = num(cur.main_units);
  const outstanding = amount - paid;
  const subUnits = splits.filter((s) => s.home_id !== null).reduce((s, x) => s + num(x.units), 0);
  const commonUnits = num(cur.common_units), commonAmount = num(cur.common_amount);
  const status = cur.status;
  const chart = [...bills].reverse();
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div><h1 className="text-2xl font-bold">{cur.month}</h1><p className="text-sm text-muted-foreground">Current month electricity overview</p></div>
        <Badge tone={status === "Paid" ? "green" : status === "Partial" ? "blue" : "amber"}>
          {status === "Paid" ? "Paid" : `${status} · ${inr(outstanding)} due`}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="EB Bill" value={inr(amount)} sub={`Bill ${cur.bill_no}`} />
        <Stat label="Main consumption" value={`${r2(mainUnits)} u`} sub={`${r2(num(cur.main_prev))} → ${r2(num(cur.main_curr))}`} />
        <Stat label="Sub-meter" value={`${r2(subUnits)} u`} sub={`${splits.filter((s) => s.home_id !== null).length} homes`} />
        <Stat label="Common" value={`${r2(commonUnits)} u`} sub={inr(commonAmount)} accent="text-amber-600" />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Per-home split</h2>
          <Link href={`/bills/${cur.id}`} className="inline-flex items-center gap-1 text-sm font-semibold">View bill <ArrowRight size={15} /></Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {splits.map((s) => (
            <div key={s.id} className="rounded-xl bg-muted p-3">
              <p className="text-sm font-bold">{s.home_name}</p>
              <p className="text-xs text-muted-foreground">{r2(num(s.units))} units · {sharePct(num(s.amount), amount)}%</p>
              <p className="mt-1 text-lg font-bold">{inr(num(s.amount))}</p>
            </div>
          ))}
        </div>
        {status !== "Paid" && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-warning/20 px-3 py-2 text-sm text-warning-foreground"><CircleAlert size={16} /> Outstanding {inr(outstanding)} — due {cur.due_date ?? "—"}</p>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="font-bold">Monthly consumption (units)</h2>
          <div className="mt-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.map((b) => ({ m: b.month.split(" ")[0], units: num(b.main_units) }))}>
                <XAxis dataKey="m" fontSize={12} /><YAxis fontSize={12} /><Tooltip />
                <Bar dataKey="units" radius={[8, 8, 0, 0]} fill="var(--chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="font-bold">Monthly bill (₹)</h2>
          <div className="mt-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart.map((b) => ({ m: b.month.split(" ")[0], amt: num(b.amount) }))}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="m" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(v: unknown) => inr(Number(v))} />
                <Line type="monotone" dataKey="amt" stroke="var(--chart-3)" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between"><h2 className="font-bold">Recent bills</h2><Link href="/history" className="text-sm font-semibold">See all</Link></div>
        <div className="mt-2 divide-y divide-border">
          {bills.slice(0, 5).map((b) => (
            <Link key={b.id} href={`/bills/${b.id}`} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{b.month}</p><p className="text-xs text-muted-foreground">{num(b.main_units)} units · {inr(num(b.amount))}</p></div>
              <Badge tone={b.status === "Paid" ? "green" : b.status === "Partial" ? "blue" : "amber"}>{b.status}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
