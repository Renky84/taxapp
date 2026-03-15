import { eq, and, gte, lte, sql, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, sales, InsertSale, Sale, expenses, InsertExpense, Expense, receipts, InsertReceipt, Receipt, userProfiles, InsertUserProfile, UserProfile, expenseCategories, ExpenseCategory, InsertExpenseCategory, processingJobs, InsertProcessingJob, ProcessingJob, extractedExpenses, InsertExtractedExpense, ExtractedExpense, receiptDetails, InsertReceiptDetail, receiptLineItems, InsertReceiptLineItem, journalEntries, InsertJournalEntry, JournalEntry, journalLines, InsertJournalLine, JournalLine, monthClosings, InsertMonthClosing, MonthClosing } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== Users (ユーザー) =====
export async function createUser(user: InsertUser): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create user: database not available");
    return null;
  }

  try {
    await db.insert(users).values(user);
    const result = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
    return result[0]?.id || null;
  } catch (error) {
    console.error("[Database] Failed to create user:", error);
    throw error;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.emailVerificationToken, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUser(id: number, updates: Partial<InsertUser>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(users).set(updates).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update user:", error);
    return false;
  }
}

export async function verifyUserEmail(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(users).set({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    }).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to verify user email:", error);
    return false;
  }
}

export async function updateLastSignedIn(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(users).set({
      lastSignedIn: new Date(),
    }).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update last signed in:", error);
    return false;
  }
}

// ===== Sales (売上) =====
export async function createSale(sale: InsertSale): Promise<Sale | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(sales).values(sale);
  const result = await db.select().from(sales).where(eq(sales.userId, sale.userId)).orderBy(sql`id DESC`).limit(1);
  return result[0] || null;
}

export async function getSaleById(id: number): Promise<Sale | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(sales).where(eq(sales.id, id)).then(r => r[0] || null);
}

export async function getSalesByUserId(userId: number): Promise<Sale[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sales).where(eq(sales.userId, userId));
}

export async function getSalesByMonth(userId: number, year: number, month: number): Promise<Sale[]> {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  return db.select().from(sales).where(
    and(
      eq(sales.userId, userId),
      gte(sales.date, startStr as any),
      lte(sales.date, endStr as any)
    )
  );
}

export async function updateSale(id: number, updates: Partial<InsertSale>): Promise<Sale | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(sales).set(updates).where(eq(sales.id, id));
  return db.select().from(sales).where(eq(sales.id, id)).then(r => r[0] || null);
}

export async function deleteSale(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(sales).where(eq(sales.id, id));
  return true;
}

// ===== Receipts (レシート) =====
export async function createReceipt(receipt: InsertReceipt): Promise<Receipt | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(receipts).values(receipt);
  const result = await db.select().from(receipts).where(eq(receipts.userId, receipt.userId)).orderBy(sql`id DESC`).limit(1);
  return result[0] || null;
}

export async function getReceiptsByUserId(userId: number, limit?: number): Promise<Receipt[]> {
  const db = await getDb();
  if (!db) return [];
  if (limit) {
    return db.select().from(receipts).where(eq(receipts.userId, userId)).orderBy(sql`id DESC`).limit(limit);
  }
  return db.select().from(receipts).where(eq(receipts.userId, userId));
}

export async function getReceiptById(id: number): Promise<Receipt | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(receipts).where(eq(receipts.id, id)).then(r => r[0] || null);
}

export async function deleteReceipt(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(receipts).where(eq(receipts.id, id));
  return true;
}

export async function findDuplicateExpenses(userId: number, storeName: string, date: string, amount: number): Promise<Expense[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        sql`DATE(${expenses.date}) = DATE(${date})`,
        eq(expenses.amount, amount),
        like(expenses.description, `${storeName}%`),
        eq(expenses.isDeleted, false)
      )
    );
}

// ===== Expenses (経費) =====
export async function createExpense(expense: InsertExpense): Promise<Expense | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(expenses).values(expense);
  const result = await db.select().from(expenses).where(eq(expenses.userId, expense.userId)).orderBy(sql`id DESC`).limit(1);
  return result[0] || null;
}

export async function getExpenseById(id: number): Promise<Expense | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(expenses).where(eq(expenses.id, id)).then(r => r[0] || null);
}

export async function getExpensesByUserId(userId: number): Promise<Expense[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenses).where(and(eq(expenses.userId, userId), eq(expenses.isDeleted, false)));
}

export async function getDeletedExpensesByUserId(userId: number): Promise<Expense[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenses).where(and(eq(expenses.userId, userId), eq(expenses.isDeleted, true)));
}

export async function getExpensesByMonth(userId: number, year: number, month: number): Promise<Expense[]> {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  return db.select().from(expenses).where(
    and(
      eq(expenses.userId, userId),
      eq(expenses.isDeleted, false),
      gte(expenses.date, startStr as any),
      lte(expenses.date, endStr as any)
    )
  );
}

export async function updateExpense(id: number, updates: Partial<InsertExpense>): Promise<Expense | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(expenses).set(updates).where(eq(expenses.id, id));
  return db.select().from(expenses).where(eq(expenses.id, id)).then(r => r[0] || null);
}

export async function deleteExpense(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(expenses).set({ isDeleted: true, deletedAt: new Date() }).where(eq(expenses.id, id));
  return true;
}

export async function restoreExpense(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(expenses).set({ isDeleted: false, deletedAt: null }).where(eq(expenses.id, id));
  return true;
}

export async function permanentlyDeleteExpense(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(expenses).where(eq(expenses.id, id));
  return true;
}

// ===== User Profiles (ユーザープロファイル) =====
export async function createUserProfile(profile: InsertUserProfile): Promise<UserProfile | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(userProfiles).values(profile);
  return db.select().from(userProfiles).where(eq(userProfiles.userId, profile.userId)).then(r => r[0] || null);
}

export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).then(r => r[0] || null);
}

export async function updateUserProfile(userId: number, updates: Partial<InsertUserProfile>): Promise<UserProfile | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(userProfiles).set(updates).where(eq(userProfiles.userId, userId));
  return db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).then(r => r[0] || null);
}

export async function upsertUserProfile(userId: number, profile: Partial<InsertUserProfile>): Promise<UserProfile | null> {
  const db = await getDb();
  if (!db) return null;

  const existing = await getUserProfile(userId);
  if (existing) {
    return updateUserProfile(userId, profile);
  } else {
    return createUserProfile({ userId, ...profile });
  }
}

// ===== Expense Categories (経費区分) =====
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenseCategories);
}

export async function getExpenseCategoryByCode(code: string): Promise<ExpenseCategory | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(expenseCategories).where(eq(expenseCategories.code, code)).then(r => r[0] || null);
}

export async function createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(expenseCategories).values(category);
  return db.select().from(expenseCategories).where(eq(expenseCategories.code, category.code)).then(r => r[0] || null);
}

// ===== Processing Jobs (バッチ処理ジョブ) =====
export async function createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(processingJobs).values(job);
  const result = await db.select().from(processingJobs).where(eq(processingJobs.userId, job.userId)).orderBy(sql`id DESC`).limit(1);
  return result[0] || null;
}

export async function getProcessingJobsByUserId(userId: number): Promise<ProcessingJob[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(processingJobs).where(eq(processingJobs.userId, userId));
}

export async function getProcessingJobById(id: number): Promise<ProcessingJob | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(processingJobs).where(eq(processingJobs.id, id)).then(r => r[0] || null);
}

export async function updateProcessingJob(id: number, updates: Partial<InsertProcessingJob>): Promise<ProcessingJob | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(processingJobs).set(updates).where(eq(processingJobs.id, id));
  return db.select().from(processingJobs).where(eq(processingJobs.id, id)).then(r => r[0] || null);
}

// ===== Extracted Expenses (抽出経費) =====
export async function createExtractedExpense(expense: InsertExtractedExpense): Promise<ExtractedExpense | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(extractedExpenses).values(expense);
  const result = await db.select().from(extractedExpenses).where(eq(extractedExpenses.userId, expense.userId)).orderBy(sql`id DESC`).limit(1);
  return result[0] || null;
}

export async function getExtractedExpensesByJobId(jobId: number): Promise<ExtractedExpense[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(extractedExpenses).where(eq(extractedExpenses.jobId, jobId));
}

export async function updateExtractedExpense(id: number, updates: Partial<InsertExtractedExpense>): Promise<ExtractedExpense | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(extractedExpenses).set(updates).where(eq(extractedExpenses.id, id));
  return db.select().from(extractedExpenses).where(eq(extractedExpenses.id, id)).then(r => r[0] || null);
}


export async function getExtractedExpensesByUserId(userId: number, status?: "pending" | "approved" | "rejected" | "manual_edit") : Promise<ExtractedExpense[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(extractedExpenses.userId, userId)];
  if (status) conditions.push(eq(extractedExpenses.status, status as any));
  return db.select().from(extractedExpenses).where(and(...conditions)).orderBy(sql`createdAt DESC, id DESC`);
}

export async function getExtractedExpenseById(id: number): Promise<ExtractedExpense | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(extractedExpenses).where(eq(extractedExpenses.id, id)).then(r => r[0] || null);
}
// ===== Receipt Details (レシート詳細) =====
export async function createReceiptDetail(detail: InsertReceiptDetail): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(receiptDetails).values(detail);
  const result = await db.select().from(receiptDetails).where(eq(receiptDetails.receiptId, detail.receiptId)).orderBy(sql`id DESC`).limit(1);
  return result[0]?.id || null;
}

export async function getReceiptDetailByReceiptId(receiptId: number) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(receiptDetails).where(eq(receiptDetails.receiptId, receiptId)).then(r => r[0] || null);
}

export async function updateReceiptDetail(id: number, updates: Partial<InsertReceiptDetail>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(receiptDetails).set(updates).where(eq(receiptDetails.id, id));
  return db.select().from(receiptDetails).where(eq(receiptDetails.id, id)).then(r => r[0] || null);
}

// ===== Receipt Line Items (レシート商品詳細) =====
export async function createReceiptLineItem(item: InsertReceiptLineItem): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(receiptLineItems).values(item);
  const result = await db.select().from(receiptLineItems).where(eq(receiptLineItems.receiptDetailId, item.receiptDetailId)).orderBy(sql`id DESC`).limit(1);
  return result[0]?.id || null;
}

export async function getReceiptLineItemsByDetailId(detailId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(receiptLineItems).where(and(eq(receiptLineItems.receiptDetailId, detailId), eq(receiptLineItems.isDeleted, false)));
}

export async function updateReceiptLineItem(id: number, updates: Partial<InsertReceiptLineItem>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(receiptLineItems).set(updates).where(eq(receiptLineItems.id, id));
  return db.select().from(receiptLineItems).where(eq(receiptLineItems.id, id)).then(r => r[0] || null);
}

export async function deleteReceiptLineItem(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(receiptLineItems).set({ isDeleted: true }).where(eq(receiptLineItems.id, id));
  return true;
}



export async function markReceiptLineItemsDeletedByDetailId(detailId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(receiptLineItems).set({ isDeleted: true }).where(eq(receiptLineItems.receiptDetailId, detailId));
  return true;
}

export async function saveReceiptExtraction(params: {
  receiptId: number;
  storeName?: string | null;
  purchaseDate?: string | null;
  paymentMethod?: string | null;
  totalAmount?: number | null;
  rawData?: string | null;
  lineItems: Array<{
    itemName: string;
    quantity?: number | null;
    unitPrice?: number | null;
    totalPrice?: number | null;
    category?: string | null;
  }>;
}) {
  let detail = await getReceiptDetailByReceiptId(params.receiptId);
  const detailPayload = {
    receiptId: params.receiptId,
    storeName: params.storeName ?? null,
    purchaseDate: params.purchaseDate ? new Date(params.purchaseDate) : null,
    paymentMethod: params.paymentMethod ?? null,
    totalAmount: params.totalAmount != null ? Math.round(params.totalAmount) : null,
    rawData: params.rawData ?? null,
  } satisfies Partial<InsertReceiptDetail> & { receiptId: number };

  let detailId: number | null = null;
  if (detail) {
    await updateReceiptDetail(detail.id, detailPayload);
    detailId = detail.id;
    await markReceiptLineItemsDeletedByDetailId(detail.id);
  } else {
    detailId = await createReceiptDetail(detailPayload as InsertReceiptDetail);
  }

  if (!detailId) return null;

  for (const item of params.lineItems) {
    await createReceiptLineItem({
      receiptDetailId: detailId,
      itemName: item.itemName,
      quantity: item.quantity != null ? Math.round(item.quantity) : 1,
      unitPrice: item.unitPrice != null ? Math.round(item.unitPrice) : Math.round(item.totalPrice ?? 0),
      totalPrice: item.totalPrice != null ? Math.round(item.totalPrice) : Math.round(item.unitPrice ?? 0),
      category: item.category ?? null,
    });
  }

  return getReceiptDetailByReceiptId(params.receiptId);
}

export async function getReceiptExtractionBundle(receiptId: number) {
  const detail = await getReceiptDetailByReceiptId(receiptId);
  if (!detail) return { detail: null, lineItems: [] };
  const lineItems = await getReceiptLineItemsByDetailId(detail.id);
  return { detail, lineItems };
}

// ===== Journal Entries (仕訳) =====
export async function createJournalEntry(entry: InsertJournalEntry, lines: InsertJournalLine[]): Promise<JournalEntry | null> {
  const db = await getDb();
  if (!db) return null;

  await db.insert(journalEntries).values(entry);
  const created = await db.select().from(journalEntries)
    .where(eq(journalEntries.userId, entry.userId))
    .orderBy(sql`id DESC`).limit(1);
  const journalEntry = created[0] || null;
  if (!journalEntry) return null;

  if (lines.length > 0) {
    await db.insert(journalLines).values(lines.map(line => ({ ...line, journalEntryId: journalEntry.id })));
  }

  return journalEntry;
}

export async function getJournalEntryById(id: number): Promise<JournalEntry | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(journalEntries).where(eq(journalEntries.id, id)).then(r => r[0] || null);
}

export async function getJournalLinesByEntryId(journalEntryId: number): Promise<JournalLine[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(journalLines).where(eq(journalLines.journalEntryId, journalEntryId));
}

export async function getJournalEntriesByUserId(userId: number): Promise<Array<JournalEntry & { lines: JournalLine[] }>> {
  const db = await getDb();
  if (!db) return [];
  const entries = await db.select().from(journalEntries).where(eq(journalEntries.userId, userId)).orderBy(sql`entryDate DESC, id DESC`);
  const result = [] as Array<JournalEntry & { lines: JournalLine[] }>;
  for (const entry of entries) {
    const lines = await getJournalLinesByEntryId(entry.id);
    result.push({ ...entry, lines });
  }
  return result;
}

export async function getJournalEntriesByMonth(userId: number, year: number, month: number): Promise<Array<JournalEntry & { lines: JournalLine[] }>> {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  const entries = await db.select().from(journalEntries).where(
    and(
      eq(journalEntries.userId, userId),
      gte(journalEntries.entryDate, startStr as any),
      lte(journalEntries.entryDate, endStr as any),
    )
  ).orderBy(sql`entryDate DESC, id DESC`);
  const result = [] as Array<JournalEntry & { lines: JournalLine[] }>;
  for (const entry of entries) {
    const lines = await getJournalLinesByEntryId(entry.id);
    result.push({ ...entry, lines });
  }
  return result;
}

export async function getJournalSummaryByMonth(userId: number, year: number, month: number) {
  const entries = await getJournalEntriesByMonth(userId, year, month);
  const summary = new Map<string, { accountCode: string; accountName: string; debit: number; credit: number }>();

  for (const entry of entries) {
    for (const line of entry.lines) {
      const current = summary.get(line.accountCode) || {
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: 0,
        credit: 0,
      };
      if (line.side === 'debit') current.debit += line.amount;
      if (line.side === 'credit') current.credit += line.amount;
      summary.set(line.accountCode, current);
    }
  }

  return Array.from(summary.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}


export async function getGeneralLedgerByMonth(userId: number, year: number, month: number) {
  const entries = await getJournalEntriesByMonth(userId, year, month);
  const grouped = new Map<string, {
    accountCode: string;
    accountName: string;
    debitTotal: number;
    creditTotal: number;
    balance: number;
    lines: Array<{
      journalEntryId: number;
      entryDate: Date;
      description: string | null;
      memo: string | null;
      side: "debit" | "credit";
      amount: number;
      runningBalance: number;
      counterAccount: string;
    }>;
  }>();

  for (const entry of entries.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime() || a.id - b.id)) {
    for (const line of entry.lines) {
      const key = `${line.accountCode}__${line.accountName}`;
      const counterAccount = entry.lines
        .filter(item => item.id !== line.id)
        .map(item => `${item.accountCode} ${item.accountName}`)
        .join(' / ');
      const bucket = grouped.get(key) ?? {
        accountCode: line.accountCode,
        accountName: line.accountName,
        debitTotal: 0,
        creditTotal: 0,
        balance: 0,
        lines: [],
      };

      if (line.side === 'debit') {
        bucket.debitTotal += line.amount;
        bucket.balance += line.amount;
      } else {
        bucket.creditTotal += line.amount;
        bucket.balance -= line.amount;
      }

      bucket.lines.push({
        journalEntryId: entry.id,
        entryDate: entry.entryDate as Date,
        description: entry.description ?? null,
        memo: line.memo ?? null,
        side: line.side,
        amount: line.amount,
        runningBalance: bucket.balance,
        counterAccount,
      });
      grouped.set(key, bucket);
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode, 'ja'));
}
export async function hasJournalEntryForSource(userId: number, sourceType: string, sourceId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(journalEntries).where(
    and(
      eq(journalEntries.userId, userId),
      eq(journalEntries.sourceType, sourceType as any),
      eq(journalEntries.sourceId, sourceId),
    )
  ).limit(1);
  return result.length > 0;
}


export async function getMonthClosingByPeriod(userId: number, year: number, month: number): Promise<MonthClosing | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(monthClosings).where(
    and(
      eq(monthClosings.userId, userId),
      eq(monthClosings.year, year),
      eq(monthClosings.month, month),
    )
  ).limit(1);
  return result[0] || null;
}

export async function listMonthClosingsByYear(userId: number, year: number): Promise<MonthClosing[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(monthClosings).where(
    and(eq(monthClosings.userId, userId), eq(monthClosings.year, year))
  ).orderBy(sql`month ASC, id ASC`);
}

export async function upsertMonthClosing(userId: number, year: number, month: number, updates: Partial<InsertMonthClosing>): Promise<MonthClosing | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await getMonthClosingByPeriod(userId, year, month);
  if (existing) {
    await db.update(monthClosings).set(updates).where(eq(monthClosings.id, existing.id));
    return getMonthClosingByPeriod(userId, year, month);
  }
  await db.insert(monthClosings).values({
    userId,
    year,
    month,
    ...updates,
  } as InsertMonthClosing);
  return getMonthClosingByPeriod(userId, year, month);
}
