"use client";

import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWalletQuery } from "@/lib/queries/wallet";

export function WalletBadge() {
  const { data, isLoading } = useWalletQuery();

  return (
    <Badge variant="secondary" className="gap-1.5 font-normal">
      <Coins className="h-3.5 w-3.5 text-brand" />
      {isLoading ? "…" : data?.balance ?? 0} credits
      {data?.ownerType === "cluster" && <span className="text-muted-foreground">(shared)</span>}
    </Badge>
  );
}
