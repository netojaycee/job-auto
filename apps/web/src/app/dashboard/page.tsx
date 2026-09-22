"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) return <main className="p-8">Loading…</main>;

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-600">Signed in as {session.user.email}</p>
      <button
        className="rounded border px-3 py-2"
        onClick={async () => {
          await signOut();
          router.push("/login");
        }}
      >
        Log out
      </button>
    </main>
  );
}
