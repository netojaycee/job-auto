import { eq, and } from "drizzle-orm";
import { getDb, applicationChannels } from "@job-auto/db";

interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Gmail OAuth is not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Failed to refresh Gmail access token: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

function buildMimeMessage(params: {
  to: string;
  subject: string;
  bodyText: string;
  attachments: { filename: string; content: Buffer; mimeType: string }[];
}): string {
  const boundary = `job-auto-${Date.now()}`;
  const lines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    params.bodyText,
    "",
  ];
  for (const att of params.attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      att.content.toString("base64"),
      "",
    );
  }
  lines.push(`--${boundary}--`);
  return lines.join("\r\n");
}

/**
 * Sends an application email FROM the user's own Gmail account via their
 * OAuth token — never from a platform address. See ARCHITECTURE.md §5 Tier A
 * and the non-negotiables list.
 *
 * SAFETY: this has a real-world side effect on a third party (an employer
 * receives an email). It is gated behind AGENT_ALLOW_REAL_APPLY so it can
 * never fire by accident during development/testing — see apply/orchestrate.ts.
 */
export async function sendApplicationEmail(
  userId: string,
  message: {
    to: string;
    subject: string;
    bodyText: string;
    attachments: { filename: string; content: Buffer; mimeType: string }[];
  },
): Promise<void> {
  const db = getDb();
  const [channel] = await db
    .select()
    .from(applicationChannels)
    .where(and(eq(applicationChannels.userId, userId), eq(applicationChannels.provider, "gmail")))
    .limit(1);
  if (!channel?.oauthTokens) {
    throw new Error(`User ${userId} has not connected Gmail — visit /profile to connect.`);
  }

  const tokens = channel.oauthTokens as GmailTokens;
  const accessToken = tokens.refresh_token
    ? await refreshAccessToken(tokens.refresh_token)
    : tokens.access_token;

  const raw = Buffer.from(buildMimeMessage(message))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${body}`);
  }
}
