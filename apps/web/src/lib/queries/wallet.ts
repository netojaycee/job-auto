import { useQuery } from "@tanstack/react-query";

export interface WalletData {
  balance: number;
  ownerType: "user" | "cluster";
}

async function fetchWallet(): Promise<WalletData> {
  const res = await fetch("/api/wallet");
  if (!res.ok) throw new Error("Failed to load wallet");
  return res.json();
}

export function useWalletQuery() {
  return useQuery({ queryKey: ["wallet"], queryFn: fetchWallet });
}
