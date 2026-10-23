"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { billsApi, num, BillDTO } from "@/lib/api";
import { inr, r2 } from "@/lib/format";
import { Badge, Btn, Card, Loading, ApiErrorCard, Empty } from "@/components/ui";
import { Plus } from "lucide-react";

export default function BillsPage() {
  const [bills, setBills] = useState<BillDTO[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function load() {
    setError(null);
    try {
      const r = await billsApi.list();
      setBills([...r.bills].sort((a, b) => (a.month_key < b.month_key ? 1 : -1)));
    } catch (e) { setError(e); }
  }
  useEffect(() => { load(); }, []);

  if (error) return <div className="space-y-4"><h1 className="text-2xl font-bold">EB Bills</h1><ApiErrorCard error={error} onRetry={load} /></div>;
  if (!bills) return <div className="space-y-4"><h1 className="text-2xl font-bold">EB Bills</h1><Loading /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">EB Bills</h1><p className="text-sm text-muted-foreground">All monthly TANGEDCO bills</p></div><Link href="/bills/new"><Btn><Plus size={16} /> Add EB Bill</Btn></Link></div>
      {bills.length === 0 && <Empty title="No bills yet" sub="Create your first monthly bill — it takes under 2 minutes." />}
      <div className="space-y-3">
        {bills.map((b) => (
          <Link key={b.id} href={`/bills/${b.id}`}>
            <Card className="transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex-1"><p className="font-bold">{b.month}</p><p className="text-xs text-muted-foreground">{b.bill_no} · {r2(num(b.main_units))} units · {r2(num(b.main_prev))}→{r2(num(b.main_curr))}</p></div>
                <div className="text-right"><p className="text-lg font-bold">{inr(num(b.amount))}</p><Badge tone={b.status === "Paid" ? "green" : b.status === "Partial" ? "blue" : "amber"}>{b.status}</Badge></div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
