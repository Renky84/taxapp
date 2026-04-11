import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
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

describe("帳簿登録とレシート管理機能", () => {
  it("経費を作成できる（receiptIdなし）", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const expense = await caller.expenses.create({
      categoryId: 1,
      amount: 1000,
      description: "テスト経費",
      date: "2025-11-29",
    });

    expect(expense).toBeDefined();
    expect(expense.amount).toBe(1000);
    expect(expense.description).toBe("テスト経費");
  });

  it("経費を作成できる（receiptIdあり）", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const expense = await caller.expenses.create({
      categoryId: 1,
      amount: 2000,
      description: "レシート付き経費",
      date: "2025-11-29",
      receiptId: 1,
    });

    expect(expense).toBeDefined();
    expect(expense.amount).toBe(2000);
    expect(expense.receiptId).toBe(1);
  });

  it("経費を論理削除できる", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 経費を作成
    const expense = await caller.expenses.create({
      categoryId: 1,
      amount: 500,
      description: "削除テスト",
      date: "2025-11-29",
    });

    // 論理削除
    await caller.expenses.delete({ id: expense.id });

    // 通常の一覧には表示されない
    const expenses = await caller.expenses.list();
    const found = expenses.find((e) => e.id === expense.id);
    expect(found).toBeUndefined();
  });

  it("削除済み経費を復旧できる", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 経費を作成
    const expense = await caller.expenses.create({
      categoryId: 1,
      amount: 700,
      description: "復旧テスト",
      date: "2025-11-29",
    });

    // 論理削除
    await caller.expenses.delete({ id: expense.id });

    // 復旧
    await caller.expenses.restore({ id: expense.id });

    // 通常の一覧に表示される
    const expenses = await caller.expenses.list();
    const found = expenses.find((e) => e.id === expense.id);
    expect(found).toBeDefined();
    expect(found?.isDeleted).toBe(false);
  });

  it("削除済み経費の一覧を取得できる", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 経費を作成して削除
    const expense = await caller.expenses.create({
      categoryId: 1,
      amount: 300,
      description: "削除済み一覧テスト",
      date: "2025-11-29",
    });

    await caller.expenses.delete({ id: expense.id });

    // 削除済み一覧を取得
    const deletedExpenses = await caller.expenses.getDeleted();
    const found = deletedExpenses.find((e) => e.id === expense.id);
    expect(found).toBeDefined();
    expect(found?.isDeleted).toBe(true);
  });
});
