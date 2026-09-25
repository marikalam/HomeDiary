import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth } from "../auth";

export const googleRouter = Router();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly openid email";
const STATE_COOKIE = "google_oauth_state";

function isConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
    path: "/",
  };
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse | null> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID as string,
      client_secret: CLIENT_SECRET as string,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) return null;
  return (await tokenRes.json()) as GoogleTokenResponse;
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) return null;
  if (account.expiresAt.getTime() > Date.now() + 60_000) {
    return account.accessToken;
  }
  const refreshed = await refreshAccessToken(account.refreshToken);
  if (!refreshed) return null;
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.googleAccount.update({
    where: { userId },
    data: { accessToken: refreshed.access_token, expiresAt },
  });
  return refreshed.access_token;
}

googleRouter.use(requireAuth);

// GET /api/google/status
googleRouter.get("/status", async (req, res) => {
  if (!isConfigured()) return res.json({ configured: false, connected: false });
  const account = await prisma.googleAccount.findUnique({ where: { userId: req.userId } });
  res.json({
    configured: true,
    connected: Boolean(account),
    googleEmail: account?.googleEmail ?? null,
  });
});

// GET /api/google/connect -> redirect to Google's consent screen
googleRouter.get("/connect", (req, res) => {
  if (!isConfigured()) {
    return res.status(500).json({ error: "Google Calendar isn't configured on the server" });
  }
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, stateCookieOptions());
  const params = new URLSearchParams({
    client_id: CLIENT_ID as string,
    redirect_uri: REDIRECT_URI as string,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/google/callback
googleRouter.get("/callback", async (req, res) => {
  const redirectBack = (path: string) => res.redirect(`${CLIENT_ORIGIN}${path}`);
  res.clearCookie(STATE_COOKIE, { path: "/" });

  if (!isConfigured()) return redirectBack("/?google=error");

  const code = req.query.code;
  const state = req.query.state;
  const expectedState = req.cookies?.[STATE_COOKIE];
  if (typeof code !== "string" || !state || state !== expectedState) {
    return redirectBack("/?google=error");
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID as string,
        client_secret: CLIENT_SECRET as string,
        redirect_uri: REDIRECT_URI as string,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(await tokenRes.text());
    const tokens = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokens.refresh_token) {
      // Google only issues a refresh token the first time a user consents
      // (or if we force it with prompt=consent, which we do) - if this ever
      // comes back empty, keep whatever refresh token we already had.
      const existing = await prisma.googleAccount.findUnique({ where: { userId: req.userId as string } });
      if (!existing) throw new Error("No refresh token returned and no existing account to fall back to");
    }

    let googleEmail: string | null = null;
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (userinfoRes.ok) {
      const info = (await userinfoRes.json()) as { email?: string };
      googleEmail = info.email ?? null;
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.googleAccount.upsert({
      where: { userId: req.userId as string },
      create: {
        userId: req.userId as string,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token as string,
        expiresAt,
        googleEmail,
      },
      update: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt,
        googleEmail,
      },
    });

    redirectBack("/?google=connected");
  } catch (err) {
    console.error("Google OAuth callback failed", err);
    redirectBack("/?google=error");
  }
});

// POST /api/google/disconnect
googleRouter.post("/disconnect", async (req, res) => {
  await prisma.googleAccount.deleteMany({ where: { userId: req.userId } });
  res.status(204).end();
});

// GET /api/google/events?start=YYYY-MM-DD&end=YYYY-MM-DD
googleRouter.get("/events", async (req, res) => {
  const accessToken = await getValidAccessToken(req.userId as string);
  if (!accessToken) return res.status(400).json({ error: "Google Calendar isn't connected" });

  const start = typeof req.query.start === "string" ? req.query.start : undefined;
  const end = typeof req.query.end === "string" ? req.query.end : undefined;
  const timeMin = start ? new Date(`${start}T00:00:00`).toISOString() : new Date().toISOString();
  const timeMaxDate = end
    ? new Date(`${end}T23:59:59`)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin,
    timeMax: timeMaxDate.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!calRes.ok) {
    return res.status(502).json({ error: "Failed to fetch Google Calendar events" });
  }
  interface GCalItem {
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    htmlLink: string;
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
  }
  const data = (await calRes.json()) as { items?: GCalItem[] };
  const events = (data.items || []).map((item) => ({
    id: item.id,
    title: item.summary || "(No title)",
    start: item.start?.dateTime || item.start?.date,
    end: item.end?.dateTime || item.end?.date,
    allDay: !item.start?.dateTime,
    description: item.description || null,
    location: item.location || null,
    htmlLink: item.htmlLink,
  }));
  res.json(events);
});
