import { NextResponse } from "next/server";
import { getDb, users, wallets } from "@job-auto/db";
import { requireAdminSession } from "@/lib/admin";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const [allUsers, allWallets] = await Promise.all([db.select().from(users), db.select().from(wallets)]);

  const balanceByOwner = new Map(allWallets.map((w) => [`${w.ownerType}:${w.ownerId}`, Number(w.balance)]));

  const result = allUsers.map((u) => {
    const ownerKey = u.clusterId ? `cluster:${u.clusterId}` : `user:${u.id}`;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      clusterId: u.clusterId,
      balance: balanceByOwner.get(ownerKey) ?? 0,
    };
  });

  return NextResponse.json({ users: result });
}
