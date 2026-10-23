import { ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/lib/format";
import { ApiError } from "@/lib/api";
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>{children}</div>;
}
export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cx("mt-1 font-display text-2xl font-bold", accent ?? "text-card-foreground")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
export function Badge({ tone, children }: { tone: "green" | "amber" | "red" | "slate" | "blue"; children: ReactNode }) {
  const map: Record<string, string> = {
    green: "bg-success/15 text-success",
    amber: "bg-warning/25 text-warning-foreground",
    red: "bg-destructive/10 text-destructive",
    slate: "bg-muted text-muted-foreground",
    blue: "bg-primary/10 text-primary",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", map[tone])}>{children}</span>;
}
export function Btn({ children, variant, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "danger" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50";
  const v = variant === "ghost" ? "text-muted-foreground hover:bg-muted" : variant === "outline" ? "border border-input bg-card text-card-foreground hover:bg-muted" : variant === "danger" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90";
  return <button className={cx(base, v, className)} {...rest}>{children}</button>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70";
export function Empty({ title, sub }: { title: string; sub?: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><p className="font-semibold text-card-foreground">{title}</p>{sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}</div>;
}
export function Loading({ label }: { label?: string }) {
  return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}<p className="sr-only">{label ?? "Loading…"}</p></div>;
}
export function ApiErrorCard({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : -1;
  const msg = error instanceof Error ? error.message : "Something went wrong";
  if (status === 401) {
    return (
      <Card className="text-center">
        <p className="font-bold">Please sign in</p>
        <p className="mt-1 text-sm text-muted-foreground">Your data lives in your account — sign in to load it.</p>
        <div className="mt-3 flex justify-center gap-2">
          <Link href="/login"><Btn>Sign in</Btn></Link>
          <Link href="/signup"><Btn variant="outline">Sign up</Btn></Link>
        </div>
      </Card>
    );
  }
  return (
    <Card className="text-center">
      <p className="font-bold">{status === 0 ? "Backend offline" : "Couldn't load data"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{msg}</p>
      {onRetry && <Btn variant="outline" className="mt-3" onClick={onRetry}>Retry</Btn>}
    </Card>
  );
}
