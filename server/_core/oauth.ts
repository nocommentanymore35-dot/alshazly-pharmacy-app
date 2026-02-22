import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import crypto from "crypto";

function buildUserResponse(
  user: any,
) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  // Simple login endpoint (replaces Manus OAuth)
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { deviceId, name, phone } = req.body;

      if (!deviceId) {
        res.status(400).json({ error: "deviceId is required" });
        return;
      }

      // Use deviceId as openId for simplicity
      const openId = `device_${deviceId}`;
      const lastSignedIn = new Date();

      await upsertUser({
        openId,
        name: name || `مستخدم ${deviceId.substring(0, 6)}`,
        loginMethod: "device",
        lastSignedIn,
      });

      const user = await getUserByOpenId(openId);

      const sessionToken = await sdk.createSessionToken(openId, {
        name: name || `مستخدم ${deviceId.substring(0, 6)}`,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Admin login endpoint
  app.post("/api/auth/admin-login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (username === ENV.adminUsername && password === ENV.adminPassword) {
        const openId = `admin_${username}`;
        const lastSignedIn = new Date();

        await upsertUser({
          openId,
          name: username,
          role: "admin",
          loginMethod: "admin",
          lastSignedIn,
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name: username,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        res.json({
          app_session_id: sessionToken,
          success: true,
        });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      console.error("[Auth] Admin login failed:", error);
      res.status(500).json({ error: "Admin login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current authenticated user
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session cookie from Bearer token
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
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
}
