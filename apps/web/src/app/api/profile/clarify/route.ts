import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, profiles } from "@job-auto/db";
import type { ParsedCv } from "@job-auto/types";
import { getSession } from "@/lib/session";
import { synthesizeCanonicalProfile } from "@/lib/profile-ai";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json();
  const answers: string[] = Array.isArray(body.answers) ? body.answers : [];

  const db = getDb();
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!existing?.clarifyingQa || !existing.parsedCvJson) {
    return NextResponse.json(
      { error: "No pending clarifying questions for this profile." },
      { status: 400 },
    );
  }

  const clarifyingQa = existing.clarifyingQa.map((qa, i) => ({
    question: qa.question,
    answer: answers[i]?.trim() || qa.answer,
  }));

  const canonicalProfileText = await synthesizeCanonicalProfile({
    parsedCv: existing.parsedCvJson as ParsedCv,
    aboutMeText: existing.aboutMeText,
    linkedinUrl: existing.linkedinUrl,
    otherLinks: existing.otherLinks ?? [],
    clarifyingQa,
  });

  await db
    .update(profiles)
    .set({ clarifyingQa, canonicalProfileText, canonicalProfileUpdatedAt: new Date() })
    .where(eq(profiles.userId, userId));

  return NextResponse.json({ clarifyingQa, canonicalProfileText });
}
