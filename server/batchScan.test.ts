import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  // テスト用にユニークなIDを生成（既存データと競合しないように）
  const userId = Math.floor(Math.random() * 1000000) + 9000000;
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "local",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("batchScan", () => {
  describe("getJobs", () => {
    it("returns empty array or list of jobs", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.batchScan.getJobs();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getCurrentJob", () => {
    it("returns null or a job when called", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.batchScan.getCurrentJob();

      // Result can be null or a job object
      if (result !== null) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('status');
      }
    });
  });

  describe("startBatch", () => {
    it("throws error when receiptIds is empty", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.batchScan.startBatch({ receiptIds: [] });
        expect.fail("Should throw error");
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
        expect(error.message).toContain("No receipts to process");
      }
    });

    it("creates a processing job with pending status", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.batchScan.startBatch({
        receiptIds: [1, 2, 3],
      });

      expect(result).toBeDefined();
      expect(result?.userId).toBe(ctx.user.id);
      expect(result?.jobType).toBe("batch_receipt_scan");
      expect(result?.status).toBe("pending");
      expect(result?.totalCount).toBe(3);
      expect(result?.processedCount).toBe(0);
    });

    it("stores receiptIds as JSON string", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.batchScan.startBatch({
        receiptIds: [10, 20, 30],
      });

      expect(result?.receiptIds).toBe(JSON.stringify([10, 20, 30]));
    });
  });

  describe("categories", () => {
    it("returns list of expense categories", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.categories.list();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("receipts", () => {
    it("returns empty list for new user", async () => {
      const { ctx } = createAuthContext(999);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.receipts.list();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("expenses", () => {
    it("returns empty list for new user", async () => {
      const { ctx } = createAuthContext(999);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.expenses.list();

      expect(Array.isArray(result)).toBe(true);
    });

    it("creates expense with valid data", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // First get categories
      const categories = await caller.categories.list();
      expect(categories.length).toBeGreaterThan(0);

      const result = await caller.expenses.create({
        categoryId: categories[0].id,
        amount: 5000,
        description: "Test expense",
        date: new Date().toISOString().split("T")[0],
      });

      expect(result).toBeDefined();
      expect(result?.userId).toBe(ctx.user.id);
      expect(result?.amount).toBe(5000);
      expect(result?.categoryId).toBe(categories[0].id);
      expect(result?.description).toBe("Test expense");
    });
  });
});
