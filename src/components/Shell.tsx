"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, House, ReceiptIndianRupee, Gauge, Split, History, Settings, Plus, LogOut } from "lucide-react";
import { cx } from "@/lib/format";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/homes", label: "Homes", icon: House },
  { href: "/bills", label: "EB Bills", icon: ReceiptIndianRupee },
  { href: "/readings", label: "Readings", icon: Gauge },
  { href: "/split", label: "Bill Split", icon: Split },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, signout } = useAuth();
  return (
    <div className="min-h-dvh bg-background font-sans text-foreground">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground">⚡</div>
          <div><p className="font-display text-sm font-bold leading-tight">Shared EB Bill</p><p className="text-xs opacity-70">Meter Management</p></div>
        </div>
        <nav className="mt-2 space-y-1">
          {NAV.map((n) => {
            const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
            return <Link key={n.href} href={n.href} className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "opacity-80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:opacity-100")}><n.icon size={18} />{n.label}</Link>;
          })}
        </nav>
        <div className="mt-auto space-y-2">
          {user ? (
            <div className="rounded-xl bg-sidebar-accent px-3 py-2">
              <p className="truncate text-xs font-semibold text-sidebar-accent-foreground">{user.email}</p>
              <button onClick={signout} className="mt-0.5 inline-flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100"><LogOut size={11} /> Sign out</button>
            </div>
          ) : (
            <Link href="/login" className="block rounded-xl border border-sidebar-border px-4 py-2.5 text-center text-sm font-semibold opacity-90 hover:opacity-100">Sign in</Link>
          )}
          <Link href="/bills/new" className="flex items-center justify-center gap-2 rounded-xl bg-sidebar-primary px-4 py-3 text-sm font-semibold text-sidebar-primary-foreground"><Plus size={16} /> New Monthly Bill</Link>
          <p className="px-2 text-[11px] opacity-60">UI MVP · mock data · DB later</p>
        </div>
      </aside>

      <div className="md:pl-60">
        {/* mobile top bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur md:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">⚡</div>
            <p className="font-display text-sm font-bold">Shared EB Bill</p>
            {user ? (
              <button onClick={signout} title={user.email} className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {user.email.slice(0, 1).toUpperCase()}
              </button>
            ) : (
              <Link href="/login" className="ml-auto text-xs font-semibold text-primary">Sign in</Link>
            )}
            <Link href="/bills/new" className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><Plus size={14} /> New Bill</Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-6">{children}</main>
      </div>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {[
            { href: "/", label: "Home", icon: LayoutDashboard },
            { href: "/homes", label: "Homes", icon: House },
            { href: "/bills/new", label: "New", icon: Plus, fab: true },
            { href: "/bills", label: "Bills", icon: ReceiptIndianRupee },
            { href: "/history", label: "History", icon: History },
          ].map((n) => {
            const active = path === n.href;
            if ((n as any).fab) return <Link key={n.href} href={n.href} className="flex flex-col items-center gap-0.5 py-1"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"><Plus size={20} /></span><span className="text-[10px] font-semibold text-muted-foreground">New Bill</span></Link>;
            return <Link key={n.href + n.label} href={n.href} className={cx("flex flex-col items-center gap-0.5 rounded-lg py-2", active ? "text-foreground" : "text-muted-foreground")}><n.icon size={20} /><span className="text-[10px] font-semibold">{n.label}</span></Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
