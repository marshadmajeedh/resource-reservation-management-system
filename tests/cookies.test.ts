import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getSessionCookieOptions,
  getLogoutCookieOptions,
  isSessionCookieSecure,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "../src/features/auth/cookies.ts";

const env = process.env as Record<string, string | undefined>;

describe("Session & Logout Cookie Configuration (Isolated)", () => {
  it("defaults to Secure=true in production when COOKIE_SECURE is not set", () => {
    const origEnv = env.NODE_ENV;
    const origCookie = env.COOKIE_SECURE;
    try {
      env.NODE_ENV = "production";
      delete env.COOKIE_SECURE;

      assert.strictEqual(isSessionCookieSecure(), true);
      assert.strictEqual(getSessionCookieOptions().secure, true);
      assert.strictEqual(getLogoutCookieOptions().secure, true);
    } finally {
      env.NODE_ENV = origEnv;
      if (origCookie !== undefined) {
        env.COOKIE_SECURE = origCookie;
      } else {
        delete env.COOKIE_SECURE;
      }
    }
  });

  it("defaults to Secure=false in non-production when COOKIE_SECURE is not set", () => {
    const origEnv = env.NODE_ENV;
    const origCookie = env.COOKIE_SECURE;
    try {
      env.NODE_ENV = "development";
      delete env.COOKIE_SECURE;

      assert.strictEqual(isSessionCookieSecure(), false);
      assert.strictEqual(getSessionCookieOptions().secure, false);
      assert.strictEqual(getLogoutCookieOptions().secure, false);
    } finally {
      env.NODE_ENV = origEnv;
      if (origCookie !== undefined) {
        env.COOKIE_SECURE = origCookie;
      } else {
        delete env.COOKIE_SECURE;
      }
    }
  });

  it("permits explicit local-only HTTP review when COOKIE_SECURE is 'false' even in production", () => {
    const origEnv = env.NODE_ENV;
    const origCookie = env.COOKIE_SECURE;
    try {
      env.NODE_ENV = "production";
      env.COOKIE_SECURE = "false";

      assert.strictEqual(isSessionCookieSecure(), false);
      assert.strictEqual(getSessionCookieOptions().secure, false);
      assert.strictEqual(getLogoutCookieOptions().secure, false);
    } finally {
      env.NODE_ENV = origEnv;
      if (origCookie !== undefined) {
        env.COOKIE_SECURE = origCookie;
      } else {
        delete env.COOKIE_SECURE;
      }
    }
  });

  it("enforces Secure=true when COOKIE_SECURE is 'true' even in development", () => {
    const origEnv = env.NODE_ENV;
    const origCookie = env.COOKIE_SECURE;
    try {
      env.NODE_ENV = "development";
      env.COOKIE_SECURE = "true";

      assert.strictEqual(isSessionCookieSecure(), true);
      assert.strictEqual(getSessionCookieOptions().secure, true);
      assert.strictEqual(getLogoutCookieOptions().secure, true);
    } finally {
      env.NODE_ENV = origEnv;
      if (origCookie !== undefined) {
        env.COOKIE_SECURE = origCookie;
      } else {
        delete env.COOKIE_SECURE;
      }
    }
  });

  it("strictly preserves HttpOnly, SameSite=lax, Path=/, and lifespan when COOKIE_SECURE is overridden", () => {
    const origEnv = env.NODE_ENV;
    const origCookie = env.COOKIE_SECURE;
    try {
      env.NODE_ENV = "production";
      env.COOKIE_SECURE = "false";

      const sessionOpts = getSessionCookieOptions();
      assert.strictEqual(sessionOpts.name, SESSION_COOKIE_NAME);
      assert.strictEqual(sessionOpts.httpOnly, true);
      assert.strictEqual(sessionOpts.sameSite, "lax");
      assert.strictEqual(sessionOpts.path, "/");
      assert.strictEqual(sessionOpts.maxAge, SESSION_DURATION_SECONDS);
      assert.ok(sessionOpts.expires > new Date());

      const logoutOpts = getLogoutCookieOptions();
      assert.strictEqual(logoutOpts.name, SESSION_COOKIE_NAME);
      assert.strictEqual(logoutOpts.httpOnly, true);
      assert.strictEqual(logoutOpts.sameSite, "lax");
      assert.strictEqual(logoutOpts.path, "/");
      assert.strictEqual(logoutOpts.maxAge, 0);
      assert.strictEqual(logoutOpts.expires.getTime(), 0);
    } finally {
      env.NODE_ENV = origEnv;
      if (origCookie !== undefined) {
        env.COOKIE_SECURE = origCookie;
      } else {
        delete env.COOKIE_SECURE;
      }
    }
  });
});
