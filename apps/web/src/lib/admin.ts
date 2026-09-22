import { getSession } from "@/lib/session";

export async function requireAdminSession() {
  const session = await getSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") return null;
  return session;
}
