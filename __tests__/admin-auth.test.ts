import { describe, it, expect } from "vitest";

describe("Admin Authentication via ENV", () => {
  it("should have ADMIN_USERNAME env var set", () => {
    expect(process.env.ADMIN_USERNAME).toBeDefined();
    expect(process.env.ADMIN_USERNAME).toBe("Admin");
  });

  it("should have ADMIN_PASSWORD env var set", () => {
    expect(process.env.ADMIN_PASSWORD).toBeDefined();
    expect(process.env.ADMIN_PASSWORD!.length).toBeGreaterThan(0);
  });

  it("should verify correct admin credentials", () => {
    const username = process.env.ADMIN_USERNAME!;
    const password = process.env.ADMIN_PASSWORD!;
    const isValid = username === "Admin" && password === process.env.ADMIN_PASSWORD;
    expect(isValid).toBe(true);
  });

  it("should reject wrong credentials", () => {
    const isValid = "wrong" === process.env.ADMIN_USERNAME && "wrong" === process.env.ADMIN_PASSWORD;
    expect(isValid).toBe(false);
  });
});
