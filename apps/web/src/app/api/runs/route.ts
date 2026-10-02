import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, agentRuns, applications, jobPostings, profileFeedback, speculativeApplications, fundingLeads } from "@job-auto/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [runs, recentApplications, suggestions, recentOutreach] = await Promise.all([
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
        method: applications.method,
        matchScore: applications.matchScore,
        matchReasoning: applications.matchReasoning,
        title: jobPostings.title,
        company: jobPostings.company,
        applicationEmail: jobPostings.applicationEmail,
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
    db
      .select({
        id: speculativeApplications.id,
        status: speculativeApplications.status,
        companyName: speculativeApplications.companyName,
        contactEmail: speculativeApplications.contactEmail,
        contactEmailGuessed: speculativeApplications.contactEmailGuessed,
        leadCompanyName: fundingLeads.companyName,
        leadGuessedEmail: fundingLeads.guessedEmail,
        createdAt: speculativeApplications.createdAt,
      })
      .from(speculativeApplications)
      .leftJoin(fundingLeads, eq(fundingLeads.id, speculativeApplications.leadId))
      .where(eq(speculativeApplications.userId, session.user.id))
      .orderBy(desc(speculativeApplications.createdAt))
      .limit(50),
  ]);

  const outreach = recentOutreach.map((o) => ({
    id: o.id,
    status: o.status,
    company: o.companyName ?? o.leadCompanyName ?? "Unknown",
    contactEmail: o.contactEmail ?? o.leadGuessedEmail ?? null,
    // Funding-lead-sourced rows also use a pattern-guessed email — see
    // leads/email-guess.ts — never a verified address either way.
    contactEmailGuessed: o.contactEmailGuessed || !!o.leadGuessedEmail,
    createdAt: o.createdAt,
  }));

  return NextResponse.json({ runs, applications: recentApplications, suggestions, outreach });
}
