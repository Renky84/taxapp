import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * 独自認証システム用のユーザーテーブル
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** メールアドレス（ログインID） */
  email: varchar("email", { length: 320 }).notNull().unique(),
  /** パスワードハッシュ（bcrypt） */
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  /** ユーザー名 */
  name: text("name"),
  /** ユーザーロール */
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** メール認証済みフラグ */
  emailVerified: boolean("emailVerified").default(false).notNull(),
  /** メール認証トークン */
  emailVerificationToken: varchar("emailVerificationToken", { length: 255 }),
  /** メール認証トークン有効期限 */
  emailVerificationExpires: timestamp("emailVerificationExpires"),
  /** パスワードリセットトークン */
  passwordResetToken: varchar("passwordResetToken", { length: 255 }),
  /** パスワードリセットトークン有効期限 */
  passwordResetExpires: timestamp("passwordResetExpires"),
  /** アカウント作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 最終更新日時 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** 最終ログイン日時 */
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  /** 2段階認証を有効化しているか */
  twoFactorEnabled: boolean("twoFactorEnabled").default(false).notNull(),
  /** 2段階認証の方式 */
  twoFactorMethod: mysqlEnum("twoFactorMethod", ["email", "totp"]).default("email").notNull(),
  /** TOTPシークレット（認証アプリ用） */
  totpSecret: varchar("totpSecret", { length: 64 }),
  /** TOTP初回確認日時 */
  totpVerifiedAt: timestamp("totpVerifiedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 売上テーブル
 */
export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(), // 金額（整数で保存）
  description: text("description"), // 説明
  date: date("date").notNull(), // 売上日
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

/**
 * 経費区分マスタテーブル
 */
export const expenseCategories = mysqlTable("expenseCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // 区分名（消耗品、交通費など）
  code: varchar("code", { length: 20 }).notNull().unique(), // 区分コード
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = typeof expenseCategories.$inferInsert;

/**
 * レシートテーブル
 */
export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(), // S3ファイルキー
  fileUrl: varchar("fileUrl", { length: 255 }).notNull(), // S3 URL
  fileName: varchar("fileName", { length: 255 }).notNull(), // オリジナルファイル名
  mimeType: varchar("mimeType", { length: 120 }).default("image/jpeg").notNull(),
  documentType: mysqlEnum("documentType", ["receipt", "invoice", "document"]).default("receipt").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;

/**
 * 経費テーブル
 */
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  receiptId: int("receiptId"), // 関連するレシートID（nullableで手動入力にも対応）
  categoryId: int("categoryId").notNull(), // 経費区分ID
  amount: int("amount").notNull(), // 金額（整数で保存）
  description: text("description"), // 説明
  date: date("date").notNull(), // 支出日
  isAutoClassified: boolean("isAutoClassified").default(false).notNull(), // LLMで自動分類されたか
  isDeleted: boolean("isDeleted").default(false).notNull(), // 論理削除フラグ
  deletedAt: timestamp("deletedAt"), // 削除日時
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

/**
 * ユーザープロファイル拡張テーブル（事業情報）
 */
export const userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  businessName: varchar("businessName", { length: 255 }), // 屋号・事業名
  businessType: varchar("businessType", { length: 100 }), // 事業形態（個人事業主など）
  representativeName: varchar("representativeName", { length: 255 }), // 代表者名
  postalCode: varchar("postalCode", { length: 10 }), // 郵便番号
  address: text("address"), // 住所
  phoneNumber: varchar("phoneNumber", { length: 20 }), // 電話番号
  taxFilingDeadline: date("taxFilingDeadline"), // 確定申告期限
  fiscalYearStart: int("fiscalYearStart").default(1), // 事業年度開始月（1-12）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * バッチ処理ジョブテーブル（レシート自動スキャン用）
 */
export const processingJobs = mysqlTable("processingJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobType: varchar("jobType", { length: 50 }).notNull(), // 'batch_receipt_scan'
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  totalCount: int("totalCount").notNull(), // 処理対象の総数
  processedCount: int("processedCount").default(0).notNull(), // 処理済みの数
  receiptIds: text("receiptIds").notNull(), // JSON形式のレシートID配列
  errorMessage: text("errorMessage"), // エラーメッセージ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type ProcessingJob = typeof processingJobs.$inferSelect;
export type InsertProcessingJob = typeof processingJobs.$inferInsert;

/**
 * 抽出データ確認テーブル（二重チェック用）
 */
export const extractedExpenses = mysqlTable("extractedExpenses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  receiptId: int("receiptId").notNull(),
  jobId: int("jobId").notNull(),
  amount: int("amount").notNull(), // 抽出された金額
  categoryId: int("categoryId"), // 推奨カテゴリID
  categoryName: varchar("categoryName", { length: 100 }), // 推奨カテゴリ名
  description: text("description"), // 抽出された説明
  date: date("date"), // 抽出された日付
  confidence: int("confidence").default(100).notNull(), // 信頼度(0-100)
  status: mysqlEnum("status", ["pending", "approved", "rejected", "manual_edit"]).default("pending").notNull(),
  approvedAmount: int("approvedAmount"), // 承認時の金額
  approvedCategoryId: int("approvedCategoryId"), // 承認時のカテゴリID
  approvedDescription: text("approvedDescription"), // 承認時の説明
  approvedDate: date("approvedDate"), // 承認時の日付
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExtractedExpense = typeof extractedExpenses.$inferSelect;
export type InsertExtractedExpense = typeof extractedExpenses.$inferInsert;

// 関連付けの型定義
export type UserWithProfile = User & { profile?: UserProfile };

/**
 * レシート詳細情報テーブル（店舗名、商品詳細等）
 */
export const receiptDetails = mysqlTable("receiptDetails", {
  id: int("id").autoincrement().primaryKey(),
  receiptId: int("receiptId").notNull(),
  storeName: varchar("storeName", { length: 255 }),
  storeAddress: text("storeAddress"),
  purchaseDate: date("purchaseDate"),
  purchaseTime: varchar("purchaseTime", { length: 10 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  totalAmount: int("totalAmount"),
  taxAmount: int("taxAmount"),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReceiptDetail = typeof receiptDetails.$inferSelect;
export type InsertReceiptDetail = typeof receiptDetails.$inferInsert;

/**
 * レシート商品詳細テーブル（商品一つ一つを追跡）
 */
export const receiptLineItems = mysqlTable("receiptLineItems", {
  id: int("id").autoincrement().primaryKey(),
  receiptDetailId: int("receiptDetailId").notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: int("unitPrice").notNull(),
  totalPrice: int("totalPrice").notNull(),
  category: varchar("category", { length: 100 }),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReceiptLineItem = typeof receiptLineItems.$inferSelect;
export type InsertReceiptLineItem = typeof receiptLineItems.$inferInsert;


/**
 * 仕訳ヘッダーテーブル
 */
export const journalEntries = mysqlTable("journalEntries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  entryDate: date("entryDate").notNull(),
  description: text("description"),
  sourceType: mysqlEnum("sourceType", ["manual", "sale", "expense", "receipt_scan"]).default("manual").notNull(),
  sourceId: int("sourceId"),
  status: mysqlEnum("status", ["draft", "confirmed", "needs_review"]).default("confirmed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;

/**
 * 仕訳明細テーブル
 */
export const journalLines = mysqlTable("journalLines", {
  id: int("id").autoincrement().primaryKey(),
  journalEntryId: int("journalEntryId").notNull(),
  side: mysqlEnum("side", ["debit", "credit"]).notNull(),
  accountCode: varchar("accountCode", { length: 20 }).notNull(),
  accountName: varchar("accountName", { length: 100 }).notNull(),
  amount: int("amount").notNull(),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JournalLine = typeof journalLines.$inferSelect;
export type InsertJournalLine = typeof journalLines.$inferInsert;

/**
 * 月次締めテーブル
 */
export const monthClosings = mysqlTable("monthClosings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  closedAt: timestamp("closedAt"),
  notes: text("notes"),
  summaryJson: text("summaryJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonthClosing = typeof monthClosings.$inferSelect;
export type InsertMonthClosing = typeof monthClosings.$inferInsert;
