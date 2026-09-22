import { NextResponse } from "next/server";
import { getDb, clusters, clusterMembers } from "@job-auto/db";
import { requireAdminSession } from "@/lib/admin";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const [allClusters, allMembers] = await Promise.all([
    db.select().from(clusters),
    db.select().from(clusterMembers),
  ]);

  const memberCountByCluster = new Map<string, number>();
  for (const m of allMembers) {
    memberCountByCluster.set(m.clusterId, (memberCountByCluster.get(m.clusterId) ?? 0) + 1);
  }

  return NextResponse.json({
    clusters: allClusters.map((c) => ({
      id: c.id,
      name: c.name,
      memberCount: memberCountByCluster.get(c.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name: string = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const db = getDb();
  const [created] = await db
    .insert(clusters)
    .values({ name, ownerAdminId: session.user.id })
    .returning();

  return NextResponse.json({ cluster: created });
}
