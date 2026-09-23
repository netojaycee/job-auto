import { NextResponse } from "next/server";
import { getDb, applicationChannels } from "@job-auto/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const userId = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/profile?gmail_error=${error}`, request.url));
  }
  if (!code || !userId) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Gmail OAuth is not configured" }, { status: 503 });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return NextResponse.json({ error: "Token exchange failed", detail: body }, { status: 502 });
  }

  const tokens = await tokenRes.json();
  // { access_token, refresh_token, expires_in, scope, token_type }

  const db = getDb();
  await db
    .insert(applicationChannels)
    .values({ userId, provider: "gmail", oauthTokens: tokens })
    .onConflictDoUpdate({
      target: [applicationChannels.userId, applicationChannels.provider],
      set: { oauthTokens: tokens, connectedAt: new Date() },
    });

  return NextResponse.redirect(new URL("/profile?gmail_connected=1", request.url));
}
