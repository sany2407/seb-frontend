"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { billsApi, num, BillDTO } from "@/lib/api";
import { inr } from "@/lib/format";
import { Badge, Card, Field, inputCls, Loading, ApiErrorCard, Empty } from "@/components/ui";

export default function HistoryPage() {
  const [bills, setBills] = useState<BillDTO[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  async function load() {
    setError(null);
    try {
      const r = await billsApi.list();
      setBills([...r.bills].sort((a, b) => (a.month_key < b.month_key ? 1 : -1)));
    } catch (e) { setError(e); }
  }
  useEffect(() => { load(); }, []);

  if (error) return <div className="space-y-4"><h1 className="text-2xl font-bold">History</h1><ApiErrorCard error={error} onRetry={load} /></div>;
  if (!bills) return <div className="space-y-4"><h1 className="text-2xl font-bold">History</h1><Loading /></div>;

  const rows = bills.filter((b) =>
    (status === "all" || b.status === status) &&
    (!q || b.month.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">History</h1>
      <Card>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Payment status"><select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option value="Pending">Pending</option><option value="Partial">Partial</option><option value="Paid">Paid</option><option value="Overdue">Overdue</option></select></Field>
          <Field label="Search month"><input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Oct 2026…" /></Field>
        </div>
      </Card>
      {rows.length === 0 && <Empty title="No bills match" sub="Adjust the filters or create a new bill." />}
      <Card className="!p-0 overflow-hidden">
        <div className="hidden grid-cols-5 gap-2 bg-muted px-4 py-2 text-xs font-bold uppercase text-muted-foreground md:grid"><span>Month</span><span>Units</span><span>Bill</span><span>Status</span><span className="text-right">Open</span></div>
        {rows.map((b) => (
          <Link key={b.id} href={`/bills/${b.id}`} className="grid grid-cols-2 gap-2 border-t border-border px-4 py-3 text-sm md:grid-cols-5">
            <span className="font-bold">{b.month}</span><span>{num(b.main_units)} u</span><span className="font-bold">{inr(num(b.amount))}</span><span><Badge tone={b.status === "Paid" ? "green" : b.status === "Partial" ? "blue" : "amber"}>{b.status}</Badge></span><span className="text-right font-semibold">→</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
