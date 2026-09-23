import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Gmail OAuth is not configured (GOOGLE_CLIENT_ID/GOOGLE_OAUTH_REDIRECT_URI)" },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: session.user.id,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
