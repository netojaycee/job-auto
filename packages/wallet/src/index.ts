import { and, eq } from "drizzle-orm";
import { getDb, wallets, walletLedger } from "@job-auto/db";
import type { WalletOwnerType } from "@job-auto/types";

export async function getOrCreateWallet(ownerType: WalletOwnerType, ownerId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.ownerType, ownerType), eq(wallets.ownerId, ownerId)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(wallets)
    .values({ ownerType, ownerId, balance: "0" })
    .returning();
  return created;
}

/** Cluster members draw from the shared cluster wallet; everyone else uses their own. */
export async function getEffectiveWallet(user: { id: string; clusterId: string | null }) {
  if (user.clusterId) {
    return getOrCreateWallet("cluster", user.clusterId);
  }
  return getOrCreateWallet("user", user.id);
}

export async function grantCredits(
  ownerType: WalletOwnerType,
  ownerId: string,
  amount: number,
  reason: string,
) {
  const db = getDb();
  const wallet = await getOrCreateWallet(ownerType, ownerId);

  const [updated] = await db
    .update(wallets)
    .set({ balance: (Number(wallet.balance) + amount).toFixed(2) })
    .where(eq(wallets.id, wallet.id))
    .returning();

  await db.insert(walletLedger).values({
    walletId: wallet.id,
    delta: amount.toFixed(2),
    reason,
  });

  return updated;
}

/**
 * Debits credits for a metered agent action (parse/score/tailor/apply — see
 * ARCHITECTURE.md §6). Throws if the wallet can't cover it — callers must
 * check balance BEFORE doing the paid work, not after, per the non-negotiables.
 */
export async function debitCredits(
  user: { id: string; clusterId: string | null },
  amount: number,
  reason: string,
) {
  const db = getDb();
  const wallet = await getEffectiveWallet(user);
  const balance = Number(wallet.balance);
  if (balance < amount) {
    throw new Error(
      `Insufficient credits: wallet ${wallet.id} has ${balance}, need ${amount} for ${reason}`,
    );
  }

  const [updated] = await db
    .update(wallets)
    .set({ balance: (balance - amount).toFixed(2) })
    .where(eq(wallets.id, wallet.id))
    .returning();

  await db.insert(walletLedger).values({
    walletId: wallet.id,
    delta: (-amount).toFixed(2),
    reason,
  });

  return updated;
}

export async function hasSufficientBalance(
  user: { id: string; clusterId: string | null },
  amount: number,
): Promise<boolean> {
  const wallet = await getEffectiveWallet(user);
  return Number(wallet.balance) >= amount;
}
