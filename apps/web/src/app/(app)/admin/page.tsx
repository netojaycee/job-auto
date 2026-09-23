"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminClustersQuery,
  useAdminUsersQuery,
  useAssignClusterMutation,
  useCreateClusterMutation,
  useGrantCreditsMutation,
  useRunNowMutation,
} from "@/lib/queries/admin";

function GrantCell({ userId }: { userId: string }) {
  const [amount, setAmount] = useState("");
  const grantMutation = useGrantCreditsMutation();

  return (
    <div className="flex gap-1.5">
      <Input
        className="h-8 w-20"
        type="number"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={grantMutation.isPending}
        onClick={() => {
          const n = Number(amount);
          if (!Number.isFinite(n) || n === 0) {
            toast.error("Enter a non-zero amount");
            return;
          }
          grantMutation.mutate(
            { userId, amount: n },
            {
              onSuccess: () => {
                toast.success("Credits granted.");
                setAmount("");
              },
              onError: (err) => toast.error(err.message),
            },
          );
        }}
      >
        Grant
      </Button>
    </div>
  );
}

function RunNowCell({ userId }: { userId: string }) {
  const runNow = useRunNowMutation();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={runNow.isPending || runNow.isSuccess}
      onClick={() =>
        runNow.mutate(userId, {
          onSuccess: () => toast.success("Agent run queued."),
          onError: (err) => toast.error(err.message),
        })
      }
    >
      {runNow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      {runNow.isSuccess ? "Queued" : "Run now"}
    </Button>
  );
}

export default function AdminPage() {
  const usersQuery = useAdminUsersQuery();
  const clustersQuery = useAdminClustersQuery();
  const createCluster = useCreateClusterMutation();
  const assignCluster = useAssignClusterMutation();
  const [newClusterName, setNewClusterName] = useState("");

  if (usersQuery.error?.message === "forbidden" || clustersQuery.error?.message === "forbidden") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Admin access only</p>
        <p className="text-sm text-muted-foreground">Your account doesn't have permission to view this page.</p>
      </div>
    );
  }

  const users = usersQuery.data ?? [];
  const clusters = clustersQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage users, clusters, and credits.</p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-base">Clusters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newClusterName.trim()) return;
              createCluster.mutate(newClusterName, {
                onSuccess: () => {
                  setNewClusterName("");
                  toast.success("Cluster created.");
                },
                onError: (err) => toast.error(err.message),
              });
            }}
            className="mb-4 flex gap-2"
          >
            <Input
              placeholder="New cluster name"
              value={newClusterName}
              onChange={(e) => setNewClusterName(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" variant="outline" disabled={createCluster.isPending}>
              {createCluster.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </form>
          {clustersQuery.isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : clusters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clusters yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {clusters.map((c) => (
                <Badge key={c.id} variant="secondary" className="font-normal">
                  {c.name} — {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                </Badge>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-base">Users</CardTitle>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted-foreground">
                    <th className="py-2 font-medium">Email</th>
                    <th className="font-medium">Role</th>
                    <th className="font-medium">Cluster</th>
                    <th className="font-medium">Balance</th>
                    <th className="font-medium">Grant</th>
                    <th className="font-medium">Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-2">{u.email}</td>
                      <td className="pr-2">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                      </td>
                      <td className="pr-2">
                        <Select
                          value={u.clusterId ?? "__none__"}
                          onValueChange={(value) =>
                            assignCluster.mutate({
                              userId: u.id,
                              clusterId: value === "__none__" || !value ? "" : value,
                              previousClusterId: u.clusterId,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue>
                              {(value: string) =>
                                value === "__none__" || !value
                                  ? "(none)"
                                  : (clusters.find((c) => c.id === value)?.name ?? value)
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">(none)</SelectItem>
                            {clusters.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="pr-2 font-mono">{u.balance}</td>
                      <td className="pr-2">
                        <GrantCell userId={u.id} />
                      </td>
                      <td>
                        <RunNowCell userId={u.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
