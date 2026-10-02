import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, UserRound, SlidersHorizontal, Activity, ShieldCheck, ClipboardPaste } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/preferences", label: "Preferences", icon: SlidersHorizontal },
  { href: "/apply/manual", label: "Paste & apply", icon: ClipboardPaste },
  { href: "/runs", label: "Agent activity", icon: Activity },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];
