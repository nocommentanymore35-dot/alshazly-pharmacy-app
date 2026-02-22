import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";
import { getUserByOpenId, upsertUser, verifyAdmin } from "../db";

const COOKIE_NAME = "app_session";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function getSessionCookieOptions(req: Request) {
  return {
    httpOnly: true,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    sameSite: "lax" as const,
    path: "/",
  };
}

function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

async function createSessionToken(openId: string, name: string): Promise<string> {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);
  const secretKey = getSessionSecret();
  return new SignJWT({
    openId,
    appId: ENV.appId,
    name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

async function verifySession(
  cookieValue: string | undefined | null,
): Promise<{ openId: string; appId: string; name: string } | null> {
  if (!cookieValue) return null;
  try {
    const secretKey = getSessionSecret();
    const { payload } = await jwtVerify(cookieValue, secretKey, {
      algorithms: ["HS256"],
    });
    const { openId, appId, name } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || !openId) return null;
    return {
      openId: openId as string,
      appId: (appId as string) || ENV.appId,
      name: (name as string) || "",
    };
  } catch (error) {
    console.warn("[Auth] Session verification failed", String(error));
    return null;
  }
}

export async function authenticateRequest(req: Request) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token: string | undefined;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  }
  const cookieHeader = req.headers.cookie;
  let sessionCookie = token;
  if (!sessionCookie && cookieHeader) {
    const cookies = cookieHeader.split(";").reduce((acc, c) => {
      const [key, ...val] = c.trim().split("=");
      acc[key] = val.join("=");
      return acc;
    }, {} as Record<string, string>);
    sessionCookie = cookies[COOKIE_NAME];
  }

  const session = await verifySession(sessionCookie);
  if (!session) {
    throw new Error("Not authenticated");
  }

  let user = await getUserByOpenId(session.openId);
  if (!user) {
    await upsertUser({
      openId: session.openId,
      name: session.name || null,
      lastSignedIn: new Date(),
    });
    user = await getUserByOpenId(session.openId);
  }
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

function buildUserResponse(user: any) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    role: user?.role ?? "user",
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  // Admin login endpoint
  app.post("/api/admin/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: "Username and password are required" });
        return;
      }
      const isValid = await verifyAdmin(username, password);
      if (!isValid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
      const openId = `admin_${username}`;
      await upsertUser({
        openId,
        name: username,
        role: "admin",
        lastSignedIn: new Date(),
      });
      const sessionToken = await createSessionToken(openId, username);
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      const user = await getUserByOpenId(openId);
      res.json({
        success: true,
        token: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[Auth] Admin login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current authenticated user
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session from Bearer token
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Keep OAuth routes for compatibility - redirect to home
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect("/");
  });
  app.get("/api/oauth/mobile", (_req: Request, res: Response) => {
    res.json({ error: "Use /api/admin/login instead" });
  });
}
