"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Btn, Card, Field, inputCls } from "@/components/ui";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setErr(""); setBusy(true);
    try { await signup(email, password, name); router.push("/split"); }
    catch (e) { setErr(e instanceof Error ? e.message : "Sign-up failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-8">
      <h1 className="text-2xl font-bold">Create account</h1>
      <Card>
        {err && <p className="mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{err}</p>}
        <div className="space-y-3">
          <Field label="Display name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sany" /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
          <Field label="Password (6+ chars)"><input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} /></Field>
          <Btn className="w-full" onClick={go} disabled={busy}>{busy ? "Creating…" : "Sign up"}</Btn>
        </div>
      </Card>
      <p className="text-center text-sm text-muted-foreground">Have an account? <Link href="/login" className="font-semibold text-primary">Sign in</Link></p>
    </div>
  );
}
