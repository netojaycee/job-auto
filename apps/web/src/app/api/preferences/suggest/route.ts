import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, profiles } from "@job-auto/db";
import type { ParsedCv } from "@job-auto/types";
import { getSession } from "@/lib/session";
import { suggestJobPreferences } from "@/lib/profile-ai";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  if (!profile?.parsedCvJson || !profile.canonicalProfileText) {
    return NextResponse.json(
      { error: "Upload a CV first — preferences are suggested from your parsed profile." },
      { status: 400 },
    );
  }

  const suggestion = await suggestJobPreferences(
    profile.parsedCvJson as ParsedCv,
    profile.canonicalProfileText,
  );

  return NextResponse.json({ suggestion });
}
