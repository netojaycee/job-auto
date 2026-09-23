export interface DigestItem {
  title: string;
  company: string;
  score: number;
  reasoning: string;
}

export async function sendDailyDigest(
  toEmail: string,
  items: DigestItem[],
  suggestions: string[],
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[digest] RESEND_API_KEY not set, skipping digest email");
    return;
  }

  const itemsHtml = items.length
    ? items
        .map((i) => `<li><strong>[${i.score}]</strong> ${i.title} @ ${i.company} — ${i.reasoning}</li>`)
        .join("")
    : "<li>No new matches today.</li>";

  const suggestionsHtml = suggestions.length
    ? `<h3>Ways to improve future matches</h3><ul>${suggestions.map((s) => `<li>${s}</li>`).join("")}</ul>`
    : "";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "job-auto <onboarding@resend.dev>",
      to: [toEmail],
      subject: `Your daily job matches (${items.length})`,
      html: `<h2>Today's shortlisted jobs</h2><ul>${itemsHtml}</ul>${suggestionsHtml}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[digest] Resend send failed: ${res.status} ${body}`);
  }
}
