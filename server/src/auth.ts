import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export const COOKIE_NAME = "homediary_token";
const TOKEN_TTL = "30d";

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET as string, { expiresIn: TOKEN_TTL });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

// Personal API tokens ("hd_..."), sent as "Authorization: Bearer <token>".
// Only the SHA-256 hash is stored, so a database leak doesn't leak tokens.
const API_TOKEN_PREFIX = "hd_";

export function generateApiToken() {
  const token = API_TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashApiToken(token) };
}

function hashApiToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      authMethod?: "session" | "apiToken";
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer?.startsWith(API_TOKEN_PREFIX)) {
    try {
      const apiToken = await prisma.apiToken.findUnique({
        where: { tokenHash: hashApiToken(bearer) },
      });
      if (!apiToken) return res.status(401).json({ error: "Invalid or revoked API token" });
      req.userId = apiToken.userId;
      req.authMethod = "apiToken";
      prisma.apiToken
        .update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
      return next();
    } catch (err) {
      return next(err);
    }
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not signed in" });
  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as { userId: string };
    req.userId = payload.userId;
    req.authMethod = "session";
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, please sign in again" });
  }
}
