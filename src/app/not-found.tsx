import Link from "next/link";
import { Zap, House, Plus } from "lucide-react";
import { Card, Btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center pt-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground">
        <Zap size={30} />
      </div>
      <p className="mt-6 font-display text-7xl font-bold tracking-tight text-foreground">404</p>
      <h1 className="mt-2 font-display text-xl font-bold text-foreground">Meter not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This page used 0 units and still got disconnected. Let&apos;s get you back on the grid.
      </p>
      <Card className="mt-6 w-full">
        <div className="flex flex-col gap-2">
          <Link href="/"><Btn className="w-full"><House size={16} /> Back to dashboard</Btn></Link>
          <Link href="/bills/new"><Btn variant="outline" className="w-full"><Plus size={16} /> New monthly bill</Btn></Link>
        </div>
      </Card>
    </div>
  );
}
