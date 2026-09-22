import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, profiles } from "@job-auto/db";
import { uploadObject } from "@job-auto/storage";
import { getSession } from "@/lib/session";
import { extractTextFromCv } from "@/lib/cv-parser";
import { parseCvText, synthesizeCanonicalProfile } from "@/lib/profile-ai";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const formData = await request.formData();
  const file = formData.get("cv");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Upload a PDF or .docx.` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const cvText = await extractTextFromCv(buffer, file.type);
  if (cvText.trim().length < 50) {
    return NextResponse.json(
      { error: "Couldn't extract meaningful text from this file." },
      { status: 400 },
    );
  }

  const key = `cvs/${userId}/${Date.now()}-${file.name}`;
  const [parsedCv] = await Promise.all([
    parseCvText(cvText),
    uploadObject(key, buffer, file.type),
  ]);

  const db = getDb();
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);

  const canonicalProfileText = await synthesizeCanonicalProfile({
    parsedCv,
    aboutMeText: existing?.aboutMeText ?? null,
    linkedinUrl: existing?.linkedinUrl ?? null,
    otherLinks: existing?.otherLinks ?? [],
  });

  await db
    .insert(profiles)
    .values({
      userId,
      rawCvFileRef: key,
      parsedCvJson: parsedCv,
      canonicalProfileText,
      canonicalProfileUpdatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        rawCvFileRef: key,
        parsedCvJson: parsedCv,
        canonicalProfileText,
        canonicalProfileUpdatedAt: new Date(),
      },
    });

  return NextResponse.json({ parsedCv, canonicalProfileText });
}
