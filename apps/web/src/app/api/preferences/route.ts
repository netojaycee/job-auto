import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, jobPreferences } from "@job-auto/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [prefs] = await db
    .select()
    .from(jobPreferences)
    .where(eq(jobPreferences.userId, session.user.id))
    .limit(1);

  return NextResponse.json({ preferences: prefs ?? null });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json();
  const values = {
    userId,
    roles: Array.isArray(body.roles) ? body.roles : [],
    locations: Array.isArray(body.locations) ? body.locations : [],
    remotePref: typeof body.remotePref === "string" ? body.remotePref : "any",
    salaryFloor: typeof body.salaryFloor === "number" ? body.salaryFloor : null,
    industries: Array.isArray(body.industries) ? body.industries : [],
    excludedCompanies: Array.isArray(body.excludedCompanies) ? body.excludedCompanies : [],
    excludedKeywords: Array.isArray(body.excludedKeywords) ? body.excludedKeywords : [],
    dailyRunTime: typeof body.dailyRunTime === "string" ? body.dailyRunTime : "08:00",
    maxApplicationsPerDay:
      typeof body.maxApplicationsPerDay === "number" ? body.maxApplicationsPerDay : 10,
  };

  const db = getDb();
  await db
    .insert(jobPreferences)
    .values(values)
    .onConflictDoUpdate({ target: jobPreferences.userId, set: values });

  return NextResponse.json({ ok: true });
}
