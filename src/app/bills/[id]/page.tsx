"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { billsApi, paymentsApi, attachmentsApi, uploadToCloudinary, num, BillDTO, SplitDTO, PaymentDTO, AttachmentDTO } from "@/lib/api";
import { inr, r2, sharePct } from "@/lib/format";
import { periodLabel } from "@/lib/billing";
import { Badge, Btn, Card, Field, inputCls, Loading, ApiErrorCard } from "@/components/ui";

export default function BillDetail() {
  const { id } = useParams() as { id: string };
  const [bill, setBill] = useState<BillDTO | null>(null);
  const [splits, setSplits] = useState<SplitDTO[]>([]);
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [paying, setPaying] = useState(false);
  const [pay, setPay] = useState({ amount: "", method: "UPI", ref: "" });
  const [payErr, setPayErr] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    setError(null);
    try {
      const d = await billsApi.get(id);
      setBill(d.bill); setSplits(d.splits); setPayments(d.payments); setAttachments(d.attachments);
    } catch (e) { setError(e); }
  }
  useEffect(() => { load(); }, [id]);

  async function recordPayment() {
    if (!bill) return;
    setPayErr(""); setPaying(true);
    try {
      await paymentsApi.create({ billId: bill.id, amount: Number(pay.amount), method: pay.method, ref: pay.ref || undefined });
      setPay({ amount: "", method: "UPI", ref: "" });
      await load();
    } catch (e) { setPayErr(e instanceof Error ? e.message : "Failed"); }
    finally { setPaying(false); }
  }

  async function uploadReceipt(files: FileList | null) {
    if (!bill || !files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const url = await uploadToCloudinary(f, "receipts");
        await attachmentsApi.create({
          ownerType: "EB_BILL", ownerId: bill.id, fileName: f.name,
          fileUrl: url, fileType: f.type || "image", fileSize: f.size,
          attachmentType: "PAYMENT_RECEIPT",
        });
      }
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  if (error) return <div className="space-y-4"><ApiErrorCard error={error} onRetry={load} /></div>;
  if (!bill) return <div className="space-y-4"><Loading /></div>;

  const amount = num(bill.amount), paid = num(bill.paid);
  const outstanding = Math.max(0, amount - paid);
  const total = splits.reduce((s, x) => s + num(x.amount), 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground"><Link href="/bills" className="font-semibold">← Bills</Link></p>
      <div className="flex items-start justify-between"><div><h1 className="text-2xl font-bold">{bill.month}</h1><p className="text-sm text-muted-foreground">{bill.bill_no} · due {bill.due_date ?? "—"}</p>{(bill.period_start || num(bill.unit_price) > 0) && <p className="mt-0.5 text-xs text-muted-foreground">Period {bill.period_start ? periodLabel(bill.period_start, bill.period_end ?? bill.period_start) : bill.month}{num(bill.unit_price) > 0 ? ` · ₹${num(bill.unit_price)}/unit` : ""} · amount entered directly</p>}</div><Badge tone={bill.status === "Paid" ? "green" : bill.status === "Partial" ? "blue" : "amber"}>{bill.status}</Badge></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><p className="text-xs uppercase text-muted-foreground">EB Bill</p><p className="text-2xl font-bold">{inr(amount)}</p></Card>
        <Card><p className="text-xs uppercase text-muted-foreground">Main meter</p><p className="text-2xl font-bold">{r2(num(bill.main_units))}u</p><p className="text-xs text-muted-foreground">{r2(num(bill.main_prev))}→{r2(num(bill.main_curr))}</p></Card>
        <Card><p className="text-xs uppercase text-muted-foreground">Sub total</p><p className="text-2xl font-bold">{r2(splits.filter((s) => s.home_id !== null).reduce((s, x) => s + num(x.units), 0))}u</p></Card>
        <Card><p className="text-xs uppercase text-muted-foreground">Common</p><p className="text-2xl font-bold text-amber-600">{r2(num(bill.common_units))}u</p><p className="text-xs">{inr(num(bill.common_amount))}</p></Card>
      </div>
      <Card>
        <h2 className="font-bold">Breakdown · {bill.method}</h2>
        <div className="mt-2 divide-y divide-border">
          {splits.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5"><div className="flex-1"><p className="text-sm font-bold">{s.home_name}</p><p className="text-xs text-muted-foreground">{r2(num(s.units))} units · {sharePct(num(s.amount), amount)}%</p></div><p className="font-bold">{inr(num(s.amount))}</p></div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold"><span>Total</span><span>{inr(total)}</span></div>
      </Card>
      <Card>
        <h2 className="font-bold">Payment</h2>
        <div className="mt-2 text-sm"><div className="flex justify-between"><span>Total</span><b>{inr(amount)}</b></div><div className="flex justify-between"><span>Paid</span><b className="text-green-700">{inr(paid)}</b></div><div className="flex justify-between"><span>Outstanding</span><b className="text-amber-700">{inr(outstanding)}</b></div></div>
        {payments.length > 0 && <div className="mt-2 space-y-1">{payments.map((p) => <p key={p.id} className="text-xs text-muted-foreground">{p.paid_at} · {inr(num(p.amount))}{p.method ? ` · ${p.method}` : ""}{p.ref ? ` · ${p.ref}` : ""}</p>)}</div>}
        {outstanding > 0 && (
          <div className="mt-3 space-y-2">
            {payErr && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{payErr}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Amount ₹"><input type="number" className={inputCls} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder={String(outstanding)} /></Field>
              <Field label="Method"><select className={inputCls} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option>UPI</option><option>Cash</option><option>Bank transfer</option><option>Card</option></select></Field>
            </div>
            <Field label="Reference (optional)"><input className={inputCls} value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} placeholder="Txn / ref no." /></Field>
            <Btn className="w-full" onClick={recordPayment} disabled={paying || !pay.amount}>{paying ? "Recording…" : "Record payment"}</Btn>
          </div>
        )}
      </Card>
      <Card>
        <h2 className="font-bold">Attachments</h2>
        {attachments.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">None yet.</p> : (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" className="block w-24 truncate rounded-xl bg-muted p-2 text-center text-[11px]">
                {a.attachment_type === "EB_BILL" ? "🧾" : "📷"}<br />{a.file_name}
              </a>
            ))}
          </div>
        )}
        <label className="mt-3 block text-sm font-semibold text-primary">
          {uploading ? "Uploading…" : "+ Upload receipt / bill photo"}
          <input type="file" multiple accept="image/*,.pdf" className="hidden" disabled={uploading} onChange={(e) => uploadReceipt(e.target.files)} />
        </label>
      </Card>
    </div>
  );
}
