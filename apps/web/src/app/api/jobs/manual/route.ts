import { NextResponse } from "next/server";
import { enqueueManualApply } from "@job-auto/queue";
import { getSession } from "@/lib/session";

interface ManualPostingInput {
  rawText: string;
  applicationEmail?: string;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const postings: ManualPostingInput[] = Array.isArray(body.postings) ? body.postings : [];
  if (postings.length === 0) {
    return NextResponse.json({ error: "At least one job listing is required." }, { status: 400 });
  }

  try {
    for (const posting of postings) {
      await enqueueManualApply({
        userId: session.user.id,
        rawText: posting.rawText,
        applicationEmail: posting.applicationEmail?.trim() || null,
      });
    }
    return NextResponse.json({ enqueued: postings.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't queue these listings — try again." },
      { status: 502 },
    );
  }
}
