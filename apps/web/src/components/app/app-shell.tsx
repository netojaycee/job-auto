"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NAV_ITEMS } from "./nav-items";
import { UserMenu } from "./user-menu";
import { WalletBadge } from "./wallet-badge";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

function NavLinks({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin").map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-soft text-brand"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: { name: string | null; email: string; role: string };
  children: React.ReactNode;
}) {
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <div className="flex min-h-full flex-1">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-sidebar p-4 md:flex md:flex-col">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2 font-heading text-lg font-bold">
          <LogoMark className="h-7 w-7" color="var(--brand)" />
          job-auto
        </Link>
        <NavLinks role={user.role} />
        <div className="mt-auto flex flex-col gap-3 px-2">
          <WalletBadge />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b border-border/60 px-4 md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" />}>
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileNavOpen(false)}
                  className="mb-6 flex items-center gap-2 px-2 font-heading text-lg font-bold"
                >
                  <LogoMark className="h-7 w-7" color="var(--brand)" />
                  job-auto
                </Link>
                <NavLinks role={user.role} onNavigate={() => setMobileNavOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="font-heading text-base font-bold">job-auto</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <WalletBadge />
            </div>
            <UserMenu name={user.name} email={user.email} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
