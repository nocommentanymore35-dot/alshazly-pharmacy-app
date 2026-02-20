import { describe, it, expect } from "vitest";

// Test the loyalty reset logic by simulating the reducer behavior
// We replicate the reducer logic here to test it in isolation

interface LoyaltyTransaction {
  id: string;
  date: string;
  points: number;
  description: string;
  orderId?: number;
}

interface LoyaltyState {
  totalPoints: number;
  transactions: LoyaltyTransaction[];
  lastResetYear?: number;
  archivedYears?: { year: number; totalPoints: number; transactions: LoyaltyTransaction[] }[];
}

function resetLoyaltyYear(loyalty: LoyaltyState, newYear: number): LoyaltyState {
  const prevYear = newYear - 1;
  const archivedEntry = {
    year: prevYear,
    totalPoints: loyalty.totalPoints,
    transactions: loyalty.transactions,
  };
  const existingArchives = loyalty.archivedYears || [];
  return {
    totalPoints: 0,
    transactions: [],
    lastResetYear: newYear,
    archivedYears: [...existingArchives, archivedEntry],
  };
}

function addLoyaltyPoints(loyalty: LoyaltyState, points: number, description: string): LoyaltyState {
  const transaction: LoyaltyTransaction = {
    id: "txn_test_" + Math.random().toString(36).substring(2, 6),
    date: new Date().toISOString(),
    points,
    description,
  };
  return {
    ...loyalty,
    totalPoints: loyalty.totalPoints + points,
    transactions: [transaction, ...loyalty.transactions],
  };
}

function shouldResetLoyalty(lastResetYear: number | undefined, currentYear: number): boolean {
  if (!lastResetYear || lastResetYear === 0) return false;
  return lastResetYear < currentYear;
}

describe("Loyalty Annual Reset", () => {
  it("should reset points to 0 when a new year starts", () => {
    const loyalty: LoyaltyState = {
      totalPoints: 500,
      transactions: [
        { id: "t1", date: "2025-06-15T10:00:00Z", points: 200, description: "طلب #1" },
        { id: "t2", date: "2025-09-20T10:00:00Z", points: 300, description: "طلب #2" },
      ],
      lastResetYear: 2025,
    };

    const result = resetLoyaltyYear(loyalty, 2026);

    expect(result.totalPoints).toBe(0);
    expect(result.transactions).toHaveLength(0);
    expect(result.lastResetYear).toBe(2026);
  });

  it("should archive previous year's data", () => {
    const loyalty: LoyaltyState = {
      totalPoints: 750,
      transactions: [
        { id: "t1", date: "2025-03-10T10:00:00Z", points: 350, description: "طلب #1" },
        { id: "t2", date: "2025-11-05T10:00:00Z", points: 400, description: "طلب #2" },
      ],
      lastResetYear: 2025,
    };

    const result = resetLoyaltyYear(loyalty, 2026);

    expect(result.archivedYears).toBeDefined();
    expect(result.archivedYears).toHaveLength(1);
    expect(result.archivedYears![0].year).toBe(2025);
    expect(result.archivedYears![0].totalPoints).toBe(750);
    expect(result.archivedYears![0].transactions).toHaveLength(2);
  });

  it("should preserve existing archives when resetting again", () => {
    const loyalty: LoyaltyState = {
      totalPoints: 200,
      transactions: [
        { id: "t3", date: "2026-04-01T10:00:00Z", points: 200, description: "طلب #3" },
      ],
      lastResetYear: 2026,
      archivedYears: [
        { year: 2025, totalPoints: 750, transactions: [{ id: "t1", date: "2025-03-10T10:00:00Z", points: 750, description: "مجموع 2025" }] },
      ],
    };

    const result = resetLoyaltyYear(loyalty, 2027);

    expect(result.archivedYears).toHaveLength(2);
    expect(result.archivedYears![0].year).toBe(2025);
    expect(result.archivedYears![1].year).toBe(2026);
    expect(result.archivedYears![1].totalPoints).toBe(200);
    expect(result.totalPoints).toBe(0);
    expect(result.lastResetYear).toBe(2027);
  });

  it("should detect when reset is needed (lastResetYear < currentYear)", () => {
    expect(shouldResetLoyalty(2025, 2026)).toBe(true);
    expect(shouldResetLoyalty(2024, 2026)).toBe(true);
  });

  it("should NOT reset when already in current year", () => {
    expect(shouldResetLoyalty(2026, 2026)).toBe(false);
  });

  it("should NOT reset when lastResetYear is undefined or 0", () => {
    expect(shouldResetLoyalty(undefined, 2026)).toBe(false);
    expect(shouldResetLoyalty(0, 2026)).toBe(false);
  });

  it("should allow adding points after reset", () => {
    const loyalty: LoyaltyState = {
      totalPoints: 500,
      transactions: [
        { id: "t1", date: "2025-12-20T10:00:00Z", points: 500, description: "طلب #1" },
      ],
      lastResetYear: 2025,
    };

    // Reset for new year
    const afterReset = resetLoyaltyYear(loyalty, 2026);
    expect(afterReset.totalPoints).toBe(0);

    // Add new points in the new year
    const afterPoints = addLoyaltyPoints(afterReset, 100, "طلب جديد في 2026");
    expect(afterPoints.totalPoints).toBe(100);
    expect(afterPoints.transactions).toHaveLength(1);
    // Archives should still be preserved
    expect(afterPoints.archivedYears).toHaveLength(1);
    expect(afterPoints.archivedYears![0].year).toBe(2025);
  });
});
