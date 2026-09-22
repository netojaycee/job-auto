import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { grantCredits } from "@/lib/wallet";

export async function POST(request: Request) {
  const session = await getSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const ownerType = body.ownerType === "cluster" ? "cluster" : "user";
  const ownerId: string | undefined = body.ownerId;
  const amount: number = Number(body.amount);
  const reason: string = typeof body.reason === "string" ? body.reason : "admin_grant";

  if (!ownerId || !Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "ownerId and a non-zero amount are required" }, { status: 400 });
  }

  const wallet = await grantCredits(ownerType, ownerId, amount, reason);
  return NextResponse.json({ balance: Number(wallet.balance) });
}
