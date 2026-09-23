import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  clusterId: string | null;
  balance: number;
}

export interface AdminCluster {
  id: string;
  name: string;
  memberCount: number;
}

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<AdminUser[]> => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(res.status === 403 ? "forbidden" : "Failed to load users");
      const data = await res.json();
      return data.users;
    },
    retry: false,
  });
}

export function useAdminClustersQuery() {
  return useQuery({
    queryKey: ["admin", "clusters"],
    queryFn: async (): Promise<AdminCluster[]> => {
      const res = await fetch("/api/admin/clusters");
      if (!res.ok) throw new Error(res.status === 403 ? "forbidden" : "Failed to load clusters");
      const data = await res.json();
      return data.clusters;
    },
    retry: false,
  });
}

export function useCreateClusterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/admin/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "clusters"] }),
  });
}

export function useGrantCreditsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const res = await fetch("/api/admin/wallet/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: userId, amount, reason: "admin_grant" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Grant failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAssignClusterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      clusterId,
      previousClusterId,
    }: {
      userId: string;
      clusterId: string;
      previousClusterId: string | null;
    }) => {
      if (clusterId) {
        await fetch(`/api/admin/clusters/${clusterId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } else if (previousClusterId) {
        await fetch(`/api/admin/clusters/${previousClusterId}/members`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "clusters"] });
    },
  });
}

export function useRunNowMutation() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/admin/agent/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to queue");
    },
  });
}
