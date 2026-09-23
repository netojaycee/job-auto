import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" color="var(--muted-foreground)" />
          <span>job-auto</span>
        </div>
        <p>&copy; {new Date().getFullYear()} job-auto. Built for job seekers who'd rather be doing something else.</p>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hover:text-foreground">
            Log in
          </Link>
          <Link href="/signup" className="hover:text-foreground">
            Sign up
          </Link>
        </div>
      </div>
    </footer>
  );
}
