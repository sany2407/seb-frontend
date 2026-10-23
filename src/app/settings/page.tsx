"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, settingsApi, num } from "@/lib/api";
import { INTERVALS } from "@/lib/billing";
import { Card, Field, Badge, Btn, inputCls, Loading } from "@/components/ui";

export default function SettingsPage() {
  const { user, signout } = useAuth();
  const [profile, setProfile] = useState<{ display_name: string } | null>(null);
  const [interval, setInterval] = useState(1);
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (user) {
      api<{ profile: { display_name: string } | null }>("/api/auth/me").then((r) => setProfile(r.profile)).catch(() => {});
      settingsApi.get().then((r) => {
        setInterval(Number(r.settings.billing_interval_months) || 1);
        setPrice(num(r.settings.unit_price));
      }).catch(() => {}).finally(() => setLoading(false));
    } else setLoading(false);
  }, [user]);

  async function saveBilling() {
    setSaving(true); setMsg("");
    try {
      const r = await settingsApi.save({ billingIntervalMonths: interval, unitPrice: price });
      setInterval(Number(r.settings.billing_interval_months));
      setPrice(num(r.settings.unit_price));
      setMsg("Billing preferences saved.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <h2 className="font-bold">Account</h2>
        {user ? (
          <div className="mt-2 text-sm">
            <p><b>{profile?.display_name || "User"}</b></p>
            <p className="text-muted-foreground">{user.email}</p>
            <Btn variant="outline" className="mt-3" onClick={signout}>Sign out</Btn>
          </div>
        ) : <p className="mt-1 text-sm text-muted-foreground">Not signed in. <a href="/login" className="font-semibold text-primary">Sign in</a></p>}
      </Card>
      <Card>
        <h2 className="font-bold">Main meter billing</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Set once per main meter — every bill reuses the interval, and the amount is still entered directly per bill. Also shown on the main meter in Homes.</p>
        {loading ? <Loading label="Loading settings" /> : !user ? (
          <p className="mt-1 text-sm text-muted-foreground">Sign in to configure billing.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {msg && <p className="rounded-xl bg-muted px-3 py-2 text-sm">{msg}</p>}
            <Field label="Billing interval" hint="TANGEDCO domestic is typically every 2 months.">
              <select className={inputCls} value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
                {INTERVALS.map((o) => <option key={o.months} value={o.months}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Unit price (₹/unit)" hint="0 = always enter the bill amount directly. Used only as a calculator helper.">
              <input type="number" min={0} step="0.01" className={inputCls} value={price || ""} onChange={(e) => setPrice(Number(e.target.value))} placeholder="e.g. 8.50" />
            </Field>
            <Btn onClick={saveBilling} disabled={saving}>{saving ? "Saving…" : "Save billing preferences"}</Btn>
          </div>
        )}
      </Card>
      <Card><h2 className="font-bold">Common-cost rule (MVP)</h2><div className="mt-2 flex gap-2"><Badge tone="blue">Proportional (default)</Badge><Badge tone="slate">Equal — later</Badge><Badge tone="slate">Assign to home — later</Badge></div><p className="mt-2 text-xs text-muted-foreground">Usage method already distributes common proportionally. Equal/assign options plug in here without changing calc.</p></Card>
      <Card><h2 className="font-bold">Backend</h2><p className="text-sm text-muted-foreground">All data comes from the Express API + Supabase (`NEXT_PUBLIC_API_URL`). Photos live in Cloudinary; the DB stores URLs only.</p><div className="mt-2 flex gap-2"><Btn variant="outline" onClick={() => alert("Export CSV — next iteration.")}>Export CSV</Btn></div></Card>
      <Card><h2 className="font-bold">Future</h2><p className="text-sm text-muted-foreground">OCR · WhatsApp/email reminders · TANGEDCO import · forecasting — architecture kept ready (pure calc lib, per-user rows, UUID keys).</p></Card>
    </div>
  );
}
