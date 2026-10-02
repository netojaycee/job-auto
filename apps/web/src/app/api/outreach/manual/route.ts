import { NextResponse } from "next/server";
import { enqueueManualOutreach } from "@job-auto/queue";
import { getSession } from "@/lib/session";

interface ManualOutreachInput {
  companyName: string;
  contactEmail?: string;
  website?: string;
  context: string;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const targets: ManualOutreachInput[] = Array.isArray(body.targets) ? body.targets : [];
  if (targets.length === 0) {
    return NextResponse.json({ error: "At least one target is required." }, { status: 400 });
  }

  try {
    for (const target of targets) {
      await enqueueManualOutreach({
        userId: session.user.id,
        companyName: target.companyName,
        contactEmail: target.contactEmail?.trim() || undefined,
        website: target.website?.trim() || undefined,
        context: target.context,
      });
    }
    return NextResponse.json({ enqueued: targets.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't queue this outreach — try again." },
      { status: 502 },
    );
  }
}
