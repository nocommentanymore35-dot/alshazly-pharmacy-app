import { describe, it, expect } from "vitest";

// Test the loyalty reset logic by simulating the reducer behavior

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

interface ResetResult {
  loyalty: LoyaltyState;
  showNewYearResetBanner: boolean;
  resetBannerPreviousPoints: number;
}

function resetLoyaltyYear(loyalty: LoyaltyState, newYear: number): ResetResult {
  const prevYear = newYear - 1;
  const prevPoints = loyalty.totalPoints;
  const archivedEntry = {
    year: prevYear,
    totalPoints: prevPoints,
    transactions: loyalty.transactions,
  };
  const existingArchives = loyalty.archivedYears || [];
  return {
    loyalty: {
      totalPoints: 0,
      transactions: [],
      lastResetYear: newYear,
      archivedYears: [...existingArchives, archivedEntry],
    },
    showNewYearResetBanner: prevPoints > 0,
    resetBannerPreviousPoints: prevPoints,
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

    expect(result.loyalty.totalPoints).toBe(0);
    expect(result.loyalty.transactions).toHaveLength(0);
    expect(result.loyalty.lastResetYear).toBe(2026);
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

    expect(result.loyalty.archivedYears).toBeDefined();
    expect(result.loyalty.archivedYears).toHaveLength(1);
    expect(result.loyalty.archivedYears![0].year).toBe(2025);
    expect(result.loyalty.archivedYears![0].totalPoints).toBe(750);
    expect(result.loyalty.archivedYears![0].transactions).toHaveLength(2);
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

    expect(result.loyalty.archivedYears).toHaveLength(2);
    expect(result.loyalty.archivedYears![0].year).toBe(2025);
    expect(result.loyalty.archivedYears![1].year).toBe(2026);
    expect(result.loyalty.archivedYears![1].totalPoints).toBe(200);
    expect(result.loyalty.totalPoints).toBe(0);
    expect(result.loyalty.lastResetYear).toBe(2027);
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

    const afterReset = resetLoyaltyYear(loyalty, 2026);
    expect(afterReset.loyalty.totalPoints).toBe(0);

    const afterPoints = addLoyaltyPoints(afterReset.loyalty, 100, "طلب جديد في 2026");
    expect(afterPoints.totalPoints).toBe(100);
    expect(afterPoints.transactions).toHaveLength(1);
    expect(afterPoints.archivedYears).toHaveLength(1);
    expect(afterPoints.archivedYears![0].year).toBe(2025);
  });
});

describe("Reset Banner", () => {
  it("should show banner when reset happens with points > 0", () => {
    const loyalty: LoyaltyState = {
      totalPoints: 300,
      transactions: [
        { id: "t1", date: "2025-06-15T10:00:00Z", points: 300, description: "طلب" },
      ],
      lastResetYear: 2025,
    };

    const result = resetLoyaltyYear(loyalty, 2026);

    expect(result.showNewYearResetBanner).toBe(true);
    expect(result.resetBannerPreviousPoints).toBe(300);
  });

  it("should NOT show banner when reset happens with 0 points", () => {
    const loyalty: LoyaltyState = {
      totalPoints: 0,
      transactions: [],
      lastResetYear: 2025,
    };

    const result = resetLoyaltyYear(loyalty, 2026);

    expect(result.showNewYearResetBanner).toBe(false);
    expect(result.resetBannerPreviousPoints).toBe(0);
  });

  it("should carry correct previous points amount in banner", () => {
    const loyalty: LoyaltyState = {
      totalPoints: 1250,
      transactions: [
        { id: "t1", date: "2025-01-15T10:00:00Z", points: 500, description: "طلب #1" },
        { id: "t2", date: "2025-06-20T10:00:00Z", points: 750, description: "طلب #2" },
      ],
      lastResetYear: 2025,
    };

    const result = resetLoyaltyYear(loyalty, 2026);

    expect(result.resetBannerPreviousPoints).toBe(1250);
    expect(result.loyalty.totalPoints).toBe(0);
  });
});

describe("Archive Display", () => {
  it("archived years should be accessible and contain correct data", () => {
    const loyalty: LoyaltyState = {
      totalPoints: 400,
      transactions: [
        { id: "t1", date: "2025-03-10T10:00:00Z", points: 150, description: "طلب #1" },
        { id: "t2", date: "2025-08-20T10:00:00Z", points: 250, description: "طلب #2" },
      ],
      lastResetYear: 2025,
    };

    const result = resetLoyaltyYear(loyalty, 2026);
    const archives = result.loyalty.archivedYears!;

    expect(archives).toHaveLength(1);
    expect(archives[0].year).toBe(2025);
    expect(archives[0].totalPoints).toBe(400);
    expect(archives[0].transactions).toHaveLength(2);
    expect(archives[0].transactions[0].points).toBe(150);
    expect(archives[0].transactions[1].points).toBe(250);
  });

  it("multiple years should be archived in order", () => {
    // Simulate 2025 -> 2026 reset
    const loyalty2025: LoyaltyState = {
      totalPoints: 500,
      transactions: [{ id: "t1", date: "2025-05-01T10:00:00Z", points: 500, description: "2025" }],
      lastResetYear: 2025,
    };
    const after2026 = resetLoyaltyYear(loyalty2025, 2026);

    // Add points in 2026
    const with2026Points = addLoyaltyPoints(after2026.loyalty, 300, "طلب 2026");

    // Simulate 2026 -> 2027 reset
    const after2027 = resetLoyaltyYear(with2026Points, 2027);

    const archives = after2027.loyalty.archivedYears!;
    expect(archives).toHaveLength(2);
    expect(archives[0].year).toBe(2025);
    expect(archives[0].totalPoints).toBe(500);
    expect(archives[1].year).toBe(2026);
    expect(archives[1].totalPoints).toBe(300);
  });
});
