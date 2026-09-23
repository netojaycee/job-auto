import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getEffectiveWallet } from "@job-auto/wallet";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallet = await getEffectiveWallet({
    id: session.user.id,
    clusterId: (session.user as { clusterId?: string | null }).clusterId ?? null,
  });

  return NextResponse.json({
    balance: Number(wallet.balance),
    ownerType: wallet.ownerType,
  });
}
