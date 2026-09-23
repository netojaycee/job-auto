import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, agentRuns, applications, jobPostings, profileFeedback } from "@job-auto/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [runs, recentApplications, suggestions] = await Promise.all([
    db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.userId, session.user.id))
      .orderBy(desc(agentRuns.startedAt))
      .limit(20),
    db
      .select({
        id: applications.id,
        status: applications.status,
        matchScore: applications.matchScore,
        matchReasoning: applications.matchReasoning,
        title: jobPostings.title,
        company: jobPostings.company,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(jobPostings, eq(jobPostings.id, applications.jobPostingId))
      .where(eq(applications.userId, session.user.id))
      .orderBy(desc(applications.createdAt))
      .limit(50),
    db
      .select()
      .from(profileFeedback)
      .where(eq(profileFeedback.userId, session.user.id))
      .orderBy(desc(profileFeedback.generatedAt))
      .limit(20),
  ]);

  return NextResponse.json({ runs, applications: recentApplications, suggestions });
}
