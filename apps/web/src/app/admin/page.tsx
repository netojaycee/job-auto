"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  clusterId: string | null;
  balance: number;
}

interface Cluster {
  id: string;
  name: string;
  memberCount: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [grantAmounts, setGrantAmounts] = useState<Record<string, string>>({});
  const [newClusterName, setNewClusterName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    const data = await res.json();
    setUsers(data.users);
  }

  async function loadClusters() {
    const res = await fetch("/api/admin/clusters");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    const data = await res.json();
    setClusters(data.clusters);
  }

  useEffect(() => {
    if (!session) return;
    loadUsers();
    loadClusters();
  }, [session]);

  if (isPending) return <main className="p-8">Loading…</main>;
  if (!session) {
    router.push("/login");
    return null;
  }
  if (role !== "admin" || forbidden) {
    return <main className="p-8">Forbidden — admin access only.</main>;
  }

  async function handleGrant(userId: string) {
    setError(null);
    const amount = Number(grantAmounts[userId]);
    if (!Number.isFinite(amount) || amount === 0) {
      setError("Enter a non-zero amount");
      return;
    }
    const res = await fetch("/api/admin/wallet/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: userId, amount, reason: "admin_grant" }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Grant failed");
      return;
    }
    setGrantAmounts((prev) => ({ ...prev, [userId]: "" }));
    loadUsers();
  }

  async function handleCreateCluster(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/clusters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClusterName }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Create failed");
      return;
    }
    setNewClusterName("");
    loadClusters();
  }

  async function handleAssignCluster(userId: string, clusterId: string) {
    setError(null);
    if (clusterId) {
      await fetch(`/api/admin/clusters/${clusterId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } else {
      const user = users.find((u) => u.id === userId);
      if (user?.clusterId) {
        await fetch(`/api/admin/clusters/${user.clusterId}/members`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      }
    }
    loadUsers();
    loadClusters();
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-xl font-semibold">Admin</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <section className="mb-10">
        <h2 className="mb-2 font-medium">Clusters</h2>
        <form onSubmit={handleCreateCluster} className="mb-3 flex gap-2">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="New cluster name"
            value={newClusterName}
            onChange={(e) => setNewClusterName(e.target.value)}
          />
          <button type="submit" className="rounded border px-3 py-2 text-sm">
            Create
          </button>
        </form>
        <ul className="text-sm">
          {clusters.map((c) => (
            <li key={c.id}>
              {c.name} — {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Users</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Email</th>
              <th>Role</th>
              <th>Cluster</th>
              <th>Balance</th>
              <th>Grant</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="py-2">{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <select
                    className="border rounded px-1 py-1"
                    value={u.clusterId ?? ""}
                    onChange={(e) => handleAssignCluster(u.id, e.target.value)}
                  >
                    <option value="">(none)</option>
                    {clusters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.balance}</td>
                <td>
                  <div className="flex gap-1">
                    <input
                      className="w-20 border rounded px-1 py-1"
                      type="number"
                      value={grantAmounts[u.id] ?? ""}
                      onChange={(e) =>
                        setGrantAmounts((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleGrant(u.id)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Grant
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
