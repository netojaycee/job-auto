import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, users, clusterMembers } from "@job-auto/db";
import { requireAdminSession } from "@/lib/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: clusterId } = await params;

  const body = await request.json();
  const userId: string | undefined = body.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  await db.update(users).set({ clusterId }).where(eq(users.id, userId));
  await db
    .insert(clusterMembers)
    .values({ userId, clusterId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: clusterId } = await params;

  const body = await request.json();
  const userId: string | undefined = body.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  await db.update(users).set({ clusterId: null }).where(eq(users.id, userId));
  await db
    .delete(clusterMembers)
    .where(and(eq(clusterMembers.userId, userId), eq(clusterMembers.clusterId, clusterId)));

  return NextResponse.json({ ok: true });
}
