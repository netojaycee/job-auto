"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [wallet, setWallet] = useState<{ balance: number; ownerType: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/wallet")
      .then((r) => r.json())
      .then(setWallet);
  }, [session]);

  if (isPending) return <main className="p-8">Loading…</main>;

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
      <p className="mb-2 text-sm text-gray-600">Signed in as {session.user.email}</p>
      {wallet && (
        <p className="mb-6 text-sm">
          Credits: <span className="font-medium">{wallet.balance}</span>
          {wallet.ownerType === "cluster" && (
            <span className="text-gray-500"> (shared cluster wallet)</span>
          )}
        </p>
      )}
      <div className="mb-6 flex flex-col gap-2">
        <Link className="text-sm underline" href="/profile">
          Profile
        </Link>
        <Link className="text-sm underline" href="/preferences">
          Job preferences
        </Link>
        <Link className="text-sm underline" href="/runs">
          Agent activity
        </Link>
      </div>
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
