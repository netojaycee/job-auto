import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const role = (session.user as { role?: string }).role ?? "user";

  return (
    <AppShell user={{ name: session.user.name, email: session.user.email, role }}>
      {children}
    </AppShell>
  );
}
