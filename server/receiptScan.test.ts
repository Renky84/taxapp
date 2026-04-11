import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  // テスト用にユニークなIDを生成（既存データと競合しないように）
  const testUserId = Math.floor(Math.random() * 1000000) + 9000000;
  const user: AuthenticatedUser = {
    id: testUserId,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
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
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Receipt Scan Flow", () => {
  it("should get expense categories", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const categories = await caller.expenses.getCategories();

    expect(categories).toBeDefined();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toHaveProperty("id");
    expect(categories[0]).toHaveProperty("name");
    expect(categories[0]).toHaveProperty("code");
  });

  it("should create expense with category", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const categories = await caller.expenses.getCategories();
    const testCategory = categories.find(c => c.code === 'supplies') || categories[0];

    const expense = await caller.expenses.create({
      categoryId: testCategory.id,
      amount: 1500,
      description: "Test receipt scan expense",
      date: new Date().toISOString().split('T')[0],
    });

    expect(expense).toBeDefined();
    expect(expense.amount).toBe(1500);
    expect(expense.categoryId).toBe(testCategory.id);
    expect(expense.description).toBe("Test receipt scan expense");
  });
});
