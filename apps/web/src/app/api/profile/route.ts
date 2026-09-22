import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, profiles } from "@job-auto/db";
import type { ParsedCv } from "@job-auto/types";
import { getSession } from "@/lib/session";
import { synthesizeCanonicalProfile } from "@/lib/profile-ai";

export async function GET() {
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

  return NextResponse.json({ profile: profile ?? null });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json();
  const linkedinUrl: string | null = body.linkedinUrl ?? null;
  const otherLinks: string[] = Array.isArray(body.otherLinks) ? body.otherLinks : [];
  const aboutMeText: string | null = body.aboutMeText ?? null;

  const db = getDb();
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);

  let canonicalProfileText = existing?.canonicalProfileText ?? null;
  if (existing?.parsedCvJson) {
    canonicalProfileText = await synthesizeCanonicalProfile({
      parsedCv: existing.parsedCvJson as ParsedCv,
      aboutMeText,
      linkedinUrl,
      otherLinks,
      clarifyingQa: existing.clarifyingQa ?? undefined,
    });
  }

  await db
    .insert(profiles)
    .values({
      userId,
      linkedinUrl,
      otherLinks,
      aboutMeText,
      canonicalProfileText,
      canonicalProfileUpdatedAt: canonicalProfileText ? new Date() : undefined,
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        linkedinUrl,
        otherLinks,
        aboutMeText,
        canonicalProfileText,
        canonicalProfileUpdatedAt: canonicalProfileText ? new Date() : undefined,
      },
    });

  return NextResponse.json({ canonicalProfileText });
}
