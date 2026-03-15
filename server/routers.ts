import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { beginTotpSetup, confirmTotpSetup, disableTotp, updateTwoFactorPreference } from "./_core/auth";
import { DEFAULT_EXPENSE_CREDIT_ACCOUNT, DEFAULT_SALE_CREDIT_ACCOUNT, DEFAULT_SALE_DEBIT_ACCOUNT, JOURNAL_ACCOUNTS, getAccountByCode, guessExpenseAccount } from "../shared/journal";

function estimateExtractionConfidence(extracted: { storeName?: string; purchaseDate?: string; amount?: number; lineItems?: Array<unknown>; paymentMethod?: string; documentType?: string; description?: string }) {
  let confidence = 48;
  if (extracted.storeName) confidence += 12;
  if (extracted.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(extracted.purchaseDate)) confidence += 12;
  if (typeof extracted.amount === "number" && extracted.amount > 0) confidence += 18;
  if (Array.isArray(extracted.lineItems) && extracted.lineItems.length > 0) confidence += 8;
  if (extracted.paymentMethod) confidence += 6;
  if (extracted.documentType && extracted.documentType !== 'document') confidence += 6;
  if (extracted.description) confidence += 4;
  return Math.min(confidence, 98);
}

function resolveCategory(categories: Awaited<ReturnType<typeof db.getExpenseCategories>>, categoryName?: string | null) {
  if (!categories.length) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No expense categories found' });
  }
  const normalized = (categoryName || '').trim();
  let matched = categories.find(c => c.name === normalized);
  if (!matched && normalized) {
    matched = categories.find(c => c.name.includes(normalized) || normalized.includes(c.name));
  }
  if (!matched) {
    matched = categories.find(c => c.code === 'other') || categories[0];
  }
  return matched;
}


function normalizeDateInput(input?: string | null) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/[年月.]/g, '-').replace(/日/g, '').replace(/\//g, '-').replace(/\s+/g, '');
  const full = normalized.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (full) {
    return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
  }
  const short = normalized.match(/(\d{2})-(\d{1,2})-(\d{1,2})/);
  if (short) {
    return `20${short[1]}-${short[2].padStart(2, '0')}-${short[3].padStart(2, '0')}`;
  }
  return raw;
}

function cleanupExtractedText(input?: string | null) {
  return String(input || '')
    .replace(/〒\d{3}-?\d{4}.*/g, '')
    .replace(/TEL[:：]?\s*[\d\-]+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[★☆◆◇■□※※＊*]{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function inferDocumentType(extracted: any, source: string) {
  const hint = `${source} ${extracted?.documentType || ''}`;
  if (/診療請求書|保険診療|歯科|クリニック|医療/i.test(hint)) return 'medical_receipt';
  if (/駐車|パーキング|入庫|精算/i.test(hint)) return 'parking_receipt';
  if (/メルカリ|商品代金|購入日時|商品ID|出品者情報/i.test(hint)) return 'purchase_screenshot';
  if (/請求書|納品書|御請求|invoice/i.test(hint)) return 'invoice';
  if (/クレジット領収書|カード|visa|master|jcb|id情報/i.test(hint)) return 'credit_slip';
  if (/診断|document/i.test(hint)) return 'document';
  return 'receipt';
}

function inferPaymentMethod(source: string, fallback?: string | null) {
  const explicit = cleanupExtractedText(fallback);
  if (explicit) return explicit;
  if (/コード決済|バーコード決済|qr決済/i.test(source)) return 'コード決済';
  if (/電子マネー|楽天edy|waon|nanaco|交通系|ic /i.test(source)) return '電子マネー';
  if (/クレジット|visa|master|jcb|amex|カード|一括/i.test(source)) return 'クレジットカード';
  if (/\bid\b/i.test(source)) return 'iD';
  if (/現金/i.test(source)) return '現金';
  return '';
}

function normalizeLineItems(rawLineItems: any[] | undefined) {
  const items = Array.isArray(rawLineItems) ? rawLineItems : [];
  return items
    .map((item: any) => ({
      ...item,
      name: cleanupExtractedText(item?.name),
      quantity: Number(item?.quantity || 0),
      unitPrice: Math.round(Number(item?.unitPrice || 0)),
      totalPrice: Math.round(Number(item?.totalPrice || 0)),
    }))
    .filter((item: any) => item.name)
    .filter((item: any) => !/qr|キャンペーン|会員募集中|ポイント|友だち募集中|バーコード|クーポン|アンケート|お持ち帰り|web会員/i.test(item.name))
    .filter((item: any) => !(item.totalPrice === 0 && item.unitPrice === 0 && item.quantity === 0));
}

function normalizeExtractedDocument(extracted: any, categories: Awaited<ReturnType<typeof db.getExpenseCategories>>) {
  const storeCandidate = cleanupExtractedText(extracted?.storeName || extracted?.issuerName || extracted?.merchantName);
  const descriptionCandidate = cleanupExtractedText(extracted?.description);
  const lineItems = normalizeLineItems(extracted?.lineItems);
  const source = `${storeCandidate} ${descriptionCandidate} ${lineItems.map((item: any) => item.name).join(' ')} ${cleanupExtractedText(extracted?.notes?.join?.(' '))}`.trim();
  const documentType = inferDocumentType(extracted, source);
  const summed = lineItems.reduce((sum: number, item: any) => sum + Math.round(Number(item.totalPrice || 0)), 0);
  const rawAmount = Math.round(Number(extracted?.amount || extracted?.totalAmount || 0));
  const taxAmount = Math.round(Number(extracted?.taxAmount || 0));
  const amount = rawAmount || (summed > 0 ? summed : 0);
  const purchaseDate = normalizeDateInput(extracted?.purchaseDate || extracted?.issuedAt || extracted?.transactionDate);
  const dueDate = normalizeDateInput(extracted?.dueDate);
  const paymentMethod = inferPaymentMethod(source, extracted?.paymentMethod);
  const description = descriptionCandidate || `${storeCandidate} ${lineItems.map((item: any) => item.name).join(' / ')}`.trim();
  const categoryFromKeywords = (() => {
    if (/amazon|ヨドバシ|ビック|ケーズ|pc|usb|lan|ケーブル|文具|プリンタ|インク|キーボード|crocs|クロックス|ユニクロ|無法松|グッデイ|空調服/i.test(source)) return '消耗品';
    if (/電車|jr|新幹線|タクシー|高速|ガソリン|駐車|enejet|usappy|駐車場/i.test(source)) return '交通費';
    if (/ソフトバンク|ドコモ|au|wifi|プロバイダ|サーバー|ドメイン|cloudflare|vercel/i.test(source)) return '通信費';
    if (/昼食|夕食|ランチ|カフェ|コーヒー|レストラン|食事|シャトレーゼ|モテナス/i.test(source)) return '食事代';
    if (/広告|instagram|meta|google ads|youtube/i.test(source)) return '広告宣伝費';
    if (/保険|労災|組合費/i.test(source)) return '保険料';
    if (/歯科|クリニック|診療|病院|医院/i.test(source)) return 'その他';
    return '';
  })();
  const category = cleanupExtractedText(extracted?.category) || categoryFromKeywords || 'その他';
  const matchedCategory = resolveCategory(categories, category);
  return {
    ...extracted,
    documentType,
    storeName: storeCandidate || cleanupExtractedText(extracted?.storeName),
    purchaseDate,
    dueDate,
    paymentMethod,
    amount,
    taxAmount,
    category: matchedCategory.name,
    description,
    lineItems,
  };
}

function buildLineItemsWithIds(lineItems: any[] | undefined, prefix: string) {
  return (Array.isArray(lineItems) ? lineItems : []).map((item: any, index: number) => ({
    ...item,
    id: `${prefix}-${index}`,
  }));
}

async function buildMonthlyClosePayload(userId: number, year: number, month: number) {
  const report = {
    monthlyReport: await db.getJournalEntriesByMonth(userId, year, month),
  };
  const sales = await db.getSalesByMonth(userId, year, month);
  const expenses = await db.getExpensesByMonth(userId, year, month);
  const journalEntries = report.monthlyReport;
  const pendingExtracted = (await db.getExtractedExpensesByUserId(userId, 'pending')).filter(item => {
    if (!item.date) return false;
    const d = new Date(item.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const expensesWithoutReceipt = expenses.filter(item => !item.receiptId);
  const unsettledJournalCount = journalEntries.filter(entry => entry.status === 'draft' || entry.status === 'needs_review').length;
  const totalSales = sales.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const items = [
    {
      key: 'pendingExtracted',
      label: 'AI読取の未承認',
      status: pendingExtracted.length === 0 ? 'ok' : 'warning',
      message: pendingExtracted.length === 0 ? '未承認のAI読取はありません。' : `${pendingExtracted.length}件のAI読取が未承認です。`,
    },
    {
      key: 'unsettledJournal',
      label: '未確定仕訳',
      status: unsettledJournalCount === 0 ? 'ok' : 'warning',
      message: unsettledJournalCount === 0 ? '未確定仕訳はありません。' : `${unsettledJournalCount}件の仕訳が draft / needs_review のままです。`,
    },
    {
      key: 'expenseReceipts',
      label: '証憑未登録の経費',
      status: expensesWithoutReceipt.length === 0 ? 'ok' : 'warning',
      message: expensesWithoutReceipt.length === 0 ? '証憑未登録の経費はありません。' : `${expensesWithoutReceipt.length}件の経費に証憑が紐づいていません。`,
    },
    {
      key: 'activity',
      label: '月内入力',
      status: sales.length + expenses.length > 0 ? 'ok' : 'warning',
      message: sales.length + expenses.length > 0 ? '売上または経費の入力があります。' : 'この月は売上・経費とも未入力です。',
    },
  ];

  return {
    year,
    month,
    totalSales,
    totalExpenses,
    profit: totalSales - totalExpenses,
    salesCount: sales.length,
    expenseCount: expenses.length,
    unsettledJournalCount,
    pendingExtractedCount: pendingExtracted.length,
    expensesWithoutReceiptCount: expensesWithoutReceipt.length,
    items,
    warningCount: items.filter(item => item.status === 'warning').length,
  };
}


async function persistExtractedDocument(params: {
  userId: number;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  sourceDataUrl?: string;
  documentType?: 'receipt' | 'invoice' | 'document';
}) {
  const { storagePut } = await import('../server/storage');
  const safeType = params.documentType || (params.mimeType === 'application/pdf' ? 'invoice' : 'receipt');
  const folder = safeType === 'invoice' ? 'invoices' : 'receipts';
  const fileKey = `${folder}/${params.userId}/${Date.now()}-${params.fileName}`;
  const { url } = await storagePut(fileKey, params.fileBuffer, params.mimeType);

  const receiptRecord = await db.createReceipt({
    userId: params.userId,
    fileName: params.fileName,
    fileUrl: url,
    fileKey,
    mimeType: params.mimeType,
    documentType: safeType,
  });

  if (!receiptRecord) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '書類の保存に失敗しました' });
  }

  const categories = await db.getExpenseCategories();
  let extracted: any;

  if (params.mimeType === 'application/pdf') {
    if (url.startsWith('/local_uploads/')) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'PDF解析には公開アクセス可能なストレージ設定が必要です。.env を設定して再実行してください。',
      });
    }

    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'あなたは日本の確定申告アプリ向けに請求書・領収書・診療明細・購入スクリーンショットを解析するアシスタントです。最初に documentType を判定してください。候補は invoice, receipt, parking_receipt, medical_receipt, credit_slip, purchase_screenshot, document です。書類から取引先名、取引日、支払期日、支払方法、合計金額、消費税額、摘要、明細行、推定カテゴリを抽出してください。購入日または請求日が不明な場合は空文字にしてください。カテゴリは必ず次の日本語のいずれかから返してください: 消耗品, 交通費, 食事代, 通信費, 水道光熱費, 賃料, 広告宣伝費, 旅費, 接待交際費, 修繕費, 保険料, 税金, その他。広告文・QR・会員案内・ポイント案内・フッターは明細に含めないでください。日付は YYYY-MM-DD 形式、金額は整数の円で返してください。',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'このPDFを読み取り、帳票タイプを判定したうえで帳簿候補をJSONで返してください。特殊な帳票では最重要項目だけを優先して返してください。' },
            { type: 'file_url', file_url: { url, mime_type: 'application/pdf' } },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'invoice_extraction',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              documentType: { type: 'string' },
              storeName: { type: 'string' },
              purchaseDate: { type: 'string' },
              dueDate: { type: 'string' },
              paymentMethod: { type: 'string' },
              amount: { type: 'number' },
              taxAmount: { type: 'number' },
              category: { type: 'string' },
              description: { type: 'string' },
              storeAddress: { type: 'string' },
              storePhone: { type: 'string' },
              notes: { type: 'array', items: { type: 'string' } },
              lineItems: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    quantity: { type: 'number' },
                    unitPrice: { type: 'number' },
                    totalPrice: { type: 'number' },
                  },
                  required: ['name', 'quantity', 'unitPrice', 'totalPrice'],
                  additionalProperties: false,
                },
              },
            },
            required: ['documentType', 'storeName', 'purchaseDate', 'dueDate', 'paymentMethod', 'amount', 'taxAmount', 'category', 'description', 'storeAddress', 'storePhone', 'notes', 'lineItems'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content || typeof content !== 'string') throw new Error('No response from LLM');
    extracted = JSON.parse(content);
  } else {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'You analyze Japanese receipts, invoices, parking stubs, medical receipts, and purchase screenshots for bookkeeping. First classify documentType using one of: receipt, parking_receipt, medical_receipt, credit_slip, purchase_screenshot, document. Return JSON only. Extract storeName, purchaseDate in YYYY-MM-DD when possible, paymentMethod in Japanese, total amount in yen integer, taxAmount if visible, category in Japanese, concise description, and lineItems. Ignore QR codes, campaign text, member ads, footer banners, barcode sections, and app navigation UI. For parking receipts prioritize 入庫, 精算, 現金, 500円 style key facts. For medical receipts prioritize 金額, 発行日, 医療機関名. For screenshots prioritize 商品代金, 購入日時, 商品ID, 配送方法. All responses must be in Japanese.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please classify this document and extract bookkeeping-friendly structured data with only the most important values.' },
            { type: 'image_url', image_url: { url: params.sourceDataUrl || url } },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'receipt_extraction',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              documentType: { type: 'string' },
              storeName: { type: 'string' },
              purchaseDate: { type: 'string' },
              dueDate: { type: 'string' },
              paymentMethod: { type: 'string' },
              amount: { type: 'number' },
              taxAmount: { type: 'number' },
              category: { type: 'string' },
              description: { type: 'string' },
              storeAddress: { type: 'string' },
              storePhone: { type: 'string' },
              notes: { type: 'array', items: { type: 'string' } },
              lineItems: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    quantity: { type: 'number' },
                    unitPrice: { type: 'number' },
                    totalPrice: { type: 'number' },
                  },
                  required: ['name', 'quantity', 'unitPrice', 'totalPrice'],
                  additionalProperties: false,
                },
              },
            },
            required: ['documentType', 'storeName', 'purchaseDate', 'dueDate', 'paymentMethod', 'amount', 'taxAmount', 'category', 'description', 'storeAddress', 'storePhone', 'notes', 'lineItems'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content || typeof content !== 'string') throw new Error('No response from LLM');
    extracted = JSON.parse(content);
  }

  extracted = normalizeExtractedDocument(extracted, categories);
  const matchedCategory = resolveCategory(categories, extracted.category);
  const lineItemsWithIds = buildLineItemsWithIds(extracted.lineItems, `item-${receiptRecord.id}`);
  const documentDate = extracted.purchaseDate || extracted.dueDate || new Date().toISOString().split('T')[0];
  const description = (extracted.description || `${extracted.storeName || ''} ${lineItemsWithIds.map((item: any) => item.name).join(' / ')}`).trim();

  await db.saveReceiptExtraction({
    receiptId: receiptRecord.id,
    storeName: extracted.storeName,
    purchaseDate: documentDate,
    paymentMethod: extracted.paymentMethod,
    totalAmount: extracted.amount,
    rawData: JSON.stringify(extracted),
    lineItems: lineItemsWithIds.map((item: any) => ({
      itemName: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      category: extracted.category,
    })),
  });

  const extractedExpense = await db.createExtractedExpense({
    userId: params.userId,
    receiptId: receiptRecord.id,
    jobId: 0,
    amount: Math.round(extracted.amount || 0),
    categoryId: matchedCategory.id,
    categoryName: matchedCategory.name,
    description,
    date: new Date(documentDate),
    confidence: estimateExtractionConfidence({
      storeName: extracted.storeName,
      purchaseDate: documentDate,
      amount: extracted.amount,
      paymentMethod: extracted.paymentMethod,
      documentType: extracted.documentType,
      description: extracted.description,
      lineItems: extracted.lineItems,
    }),
    status: 'pending',
  });

  return {
    receiptRecord,
    extracted,
    matchedCategory,
    lineItemsWithIds,
    extractedExpense,
    documentDate,
    description,
  };
}

async function createExpenseWithJournal(userId: number, input: {
  categoryId: number;
  amount: number;
  description: string;
  date: string;
  receiptId?: number;
  isAutoClassified?: boolean;
}) {
  const expense = await db.createExpense({
    userId,
    categoryId: input.categoryId,
    amount: Math.round(input.amount),
    description: input.description,
    date: new Date(input.date),
    isAutoClassified: input.isAutoClassified ?? false,
    receiptId: input.receiptId,
  });

  if (expense && !(await db.hasJournalEntryForSource(userId, "expense", expense.id))) {
    const categories = await db.getExpenseCategories();
    const category = categories.find(item => item.id === input.categoryId);
    const debitAccountCode = guessExpenseAccount({ categoryCode: category?.code, categoryName: category?.name });
    await db.createJournalEntry({
      userId,
      entryDate: new Date(input.date),
      description: input.description || category?.name || "経費計上",
      sourceType: "expense",
      sourceId: expense.id,
      status: "confirmed",
    }, [
      {
        journalEntryId: 0,
        side: "debit",
        accountCode: debitAccountCode,
        accountName: getAccountByCode(debitAccountCode)?.name || category?.name || "雑費",
        amount: Math.round(input.amount),
        memo: category?.name || "経費",
      },
      {
        journalEntryId: 0,
        side: "credit",
        accountCode: DEFAULT_EXPENSE_CREDIT_ACCOUNT,
        accountName: getAccountByCode(DEFAULT_EXPENSE_CREDIT_ACCOUNT)?.name || "現金",
        amount: Math.round(input.amount),
        memo: "支払",
      },
    ]);
  }

  return expense;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    getSecuritySettings: protectedProcedure.query(async ({ ctx }) => ({
      twoFactorEnabled: Boolean((ctx.user as any).twoFactorEnabled),
      twoFactorMethod: (ctx.user as any).twoFactorMethod || "email",
      totpConfigured: Boolean((ctx.user as any).totpSecret),
      totpVerifiedAt: (ctx.user as any).totpVerifiedAt || null,
    })),
    updateSecuritySettings: protectedProcedure
      .input(z.object({
        twoFactorEnabled: z.boolean(),
        twoFactorMethod: z.enum(["email", "totp"]).default("email"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.twoFactorEnabled && input.twoFactorMethod === "totp") {
          const currentUser = await db.getUserById(ctx.user.id);
          if (!currentUser?.totpSecret) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "先にTOTP設定を完了してください" });
          }
        }
        const updated = await updateTwoFactorPreference(ctx.user.id, input.twoFactorEnabled, input.twoFactorMethod);
        if (!updated) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "2段階認証設定の更新に失敗しました" });
        }
        return { success: true, ...input };
      }),
    beginTotpSetup: protectedProcedure.mutation(async ({ ctx }) => {
      return await beginTotpSetup(ctx.user.id, ctx.user.email);
    }),
    confirmTotpSetup: protectedProcedure
      .input(z.object({ setupToken: z.string().min(1), code: z.string().min(6) }))
      .mutation(async ({ ctx, input }) => {
        const result = await confirmTotpSetup(ctx.user.id, input.setupToken, input.code);
        if (!result.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error || "TOTP設定に失敗しました" });
        }
        return { success: true };
      }),
    disableTotp: protectedProcedure.mutation(async ({ ctx }) => {
      const ok = await disableTotp(ctx.user.id);
      if (!ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "TOTPの解除に失敗しました" });
      return { success: true };
    }),
  }),

  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string().min(1),
        })).min(1),
        includeContext: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getUserProfile(ctx.user.id);
        const businessSummary = [
          profile?.businessName ? `事業名: ${profile.businessName}` : null,
          profile?.businessType ? `事業形態: ${profile.businessType}` : null,
        ].filter(Boolean).join(" / ");

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const monthlyReport = input.includeContext ? await appRouter.createCaller(ctx).reports.getMonthlyReport({ year, month }) : null;
        const filingCheck = input.includeContext ? await appRouter.createCaller(ctx).reports.getFilingCheck({ year }) : null;

        const contextLines = input.includeContext ? [
          monthlyReport ? `今月の帳簿状況: 売上 ${monthlyReport.totalSales}円 / 経費 ${monthlyReport.totalExpenses}円 / 利益 ${monthlyReport.profit}円 / 仕訳 ${monthlyReport.journalEntries.length}件 / 要確認 ${monthlyReport.reviewCount}件` : null,
          filingCheck ? `申告チェック: 警告 ${filingCheck.warningCount}件 / 未入力月 ${filingCheck.zeroActivityMonths.length}件 / 未処理のAI読取 ${filingCheck.pendingReviewCount}件 / 証憑未登録の経費候補 ${filingCheck.expensesWithoutReceiptCount}件` : null,
].filter(Boolean).join("\n") : "";

        const systemPrompt = [
          "あなたは日本の個人事業主向け確定申告アシスタントです。",
          "帳簿入力、経費区分、レシート整理、申告準備の相談に日本語で簡潔かつ実務的に答えてください。",
          "ユーザーの帳簿状況が与えられたら、それを前提に優先順位をつけて答えてください。",
          "税務上の断定が危険な時は、一般論として説明し、最終確認が必要であることを一言添えてください。",
          businessSummary ? `現在の事業者情報: ${businessSummary}` : null,
          contextLines || null,
        ].filter(Boolean).join("\n")

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...input.messages,
          ],
        });

        const textContent = response.choices?.[0]?.message?.content;
        return {
          message: typeof textContent === "string" ? textContent : "回答を生成できませんでした。",
        };
      }),
  }),

  // ===== Sales (売上管理) =====
  sales: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSalesByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        amount: z.number().positive(),
        description: z.string(),
        date: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sale = await db.createSale({
          userId: ctx.user.id,
          amount: Math.round(input.amount),
          description: input.description,
          date: new Date(input.date),
        });

        if (sale && !(await db.hasJournalEntryForSource(ctx.user.id, "sale", sale.id))) {
          await db.createJournalEntry({
            userId: ctx.user.id,
            entryDate: new Date(input.date),
            description: input.description || "売上計上",
            sourceType: "sale",
            sourceId: sale.id,
            status: "confirmed",
          }, [
            {
              journalEntryId: 0,
              side: "debit",
              accountCode: DEFAULT_SALE_DEBIT_ACCOUNT,
              accountName: getAccountByCode(DEFAULT_SALE_DEBIT_ACCOUNT)?.name || "現金",
              amount: Math.round(input.amount),
              memo: "売上入金",
            },
            {
              journalEntryId: 0,
              side: "credit",
              accountCode: DEFAULT_SALE_CREDIT_ACCOUNT,
              accountName: getAccountByCode(DEFAULT_SALE_CREDIT_ACCOUNT)?.name || "売上高",
              amount: Math.round(input.amount),
              memo: "売上計上",
            },
          ]);
        }

        return sale;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        amount: z.number().positive().optional(),
        description: z.string().optional(),
        date: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sale = await db.getSaleById(input.id);
        if (!sale || sale.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return await db.updateSale(input.id, {
          amount: input.amount ? Math.round(input.amount) : undefined,
          description: input.description,
          date: input.date ? new Date(input.date) : undefined,
        });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sale = await db.getSaleById(input.id);
        if (!sale || sale.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return await db.deleteSale(input.id);
      }),
  }),

  // ===== Expenses (経費管理) =====
  expenses: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getExpensesByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        amount: z.number().positive(),
        description: z.string(),
        date: z.string(),
        receiptId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await createExpenseWithJournal(ctx.user.id, {
          categoryId: input.categoryId,
          amount: input.amount,
          description: input.description,
          date: input.date,
          receiptId: input.receiptId,
          isAutoClassified: false,
        });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        amount: z.number().positive().optional(),
        description: z.string().optional(),
        date: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const expense = await db.getExpenseById(input.id);
        if (!expense || expense.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return await db.updateExpense(input.id, {
          categoryId: input.categoryId,
          amount: input.amount ? Math.round(input.amount) : undefined,
          description: input.description,
          date: input.date ? new Date(input.date) : undefined,
        });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const expense = await db.getExpenseById(input.id);
        if (!expense || expense.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        // 論理削除
        return await db.updateExpense(input.id, {
          isDeleted: true,
          deletedAt: new Date(),
        });
      }),
    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const expense = await db.getExpenseById(input.id);
        if (!expense || expense.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        // 復旧
        return await db.updateExpense(input.id, {
          isDeleted: false,
          deletedAt: null,
        });
      }),
    getCategories: protectedProcedure.query(async () => {
      return await db.getExpenseCategories();
    }),
    getDeleted: protectedProcedure.query(async ({ ctx }) => {
      return await db.getDeletedExpensesByUserId(ctx.user.id);
    }),
  }),

  // ===== Categories (経費区分) =====
  categories: router({
    list: protectedProcedure.query(async () => {
      return await db.getExpenseCategories();
    }),
  }),

  // ===== Receipts (レシート管理) =====
  receipts: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const receipts = await db.getReceiptsByUserId(ctx.user.id);
        if (input?.limit) {
          return receipts.slice(0, input.limit);
        }
        return receipts;
      }),
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import("../server/storage");
        const fileKey = `receipts/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, Buffer.from(input.fileData, 'base64'), input.mimeType);

        return await db.createReceipt({
          userId: ctx.user.id,
          fileName: input.fileName,
          fileUrl: url,
          fileKey: fileKey,
          mimeType: input.mimeType,
          documentType: input.mimeType === "application/pdf" ? "invoice" : "receipt",
        });
      }),
    importDocuments: protectedProcedure
      .input(z.object({
        documents: z.array(z.object({
          fileName: z.string(),
          fileData: z.string(),
          mimeType: z.string(),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = [] as any[];
        for (let i = 0; i < input.documents.length; i++) {
          const doc = input.documents[i];
          try {
            const rawBase64 = doc.fileData.split(',')[1] || doc.fileData;
            const parsed = await persistExtractedDocument({
              userId: ctx.user.id,
              fileName: doc.fileName,
              mimeType: doc.mimeType,
              fileBuffer: Buffer.from(rawBase64, 'base64'),
              sourceDataUrl: doc.mimeType.startsWith('image/') ? doc.fileData : undefined,
              documentType: doc.mimeType === 'application/pdf' ? 'invoice' : 'receipt',
            });

            results.push({
              success: true,
              fileName: doc.fileName,
              data: {
                storeName: parsed.extracted.storeName,
                purchaseDate: parsed.documentDate,
                dueDate: parsed.extracted.dueDate || '',
                paymentMethod: parsed.extracted.paymentMethod || '',
                totalAmount: Math.round(parsed.extracted.amount || 0),
                taxAmount: Math.round(parsed.extracted.taxAmount || 0),
                description: parsed.description,
                categoryId: parsed.matchedCategory.id,
                receiptId: parsed.receiptRecord.id,
                extractedExpenseId: parsed.extractedExpense?.id,
                lineItems: parsed.lineItemsWithIds,
                confidence: parsed.extractedExpense?.confidence ?? 0,
                documentType: parsed.receiptRecord.documentType,
              },
            });
          } catch (error: any) {
            results.push({
              success: false,
              fileName: doc.fileName,
              error: error?.message || '書類の解析に失敗しました',
            });
          }
        }
        return results;
      }),
    checkDuplicates: protectedProcedure
      .input(z.object({
        storeName: z.string(),
        date: z.string(),
        amount: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const duplicates = await db.findDuplicateExpenses(
          ctx.user.id,
          input.storeName,
          input.date,
          input.amount
        );
        return duplicates;
      }),
    batchClassify: protectedProcedure
      .input(z.object({
        receipts: z.array(z.object({
          imageData: z.string(),
          mimeType: z.string(),
          fileName: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = [] as any[];

        for (let i = 0; i < input.receipts.length; i++) {
          const receipt = input.receipts[i];
          try {
            const rawBase64 = receipt.imageData.split(',')[1] || receipt.imageData;
            const parsed = await persistExtractedDocument({
              userId: ctx.user.id,
              fileName: receipt.fileName,
              mimeType: receipt.mimeType,
              fileBuffer: Buffer.from(rawBase64, 'base64'),
              sourceDataUrl: receipt.imageData,
              documentType: 'receipt',
            });

            results.push({
              success: true,
              receiptId: parsed.receiptRecord.id,
              data: {
                storeName: parsed.extracted.storeName,
                purchaseDate: parsed.documentDate,
                paymentMethod: parsed.extracted.paymentMethod,
                totalAmount: Math.round(parsed.extracted.amount || 0),
                lineItems: parsed.lineItemsWithIds,
                categoryId: parsed.matchedCategory.id,
                categoryName: parsed.matchedCategory.name,
                storeAddress: parsed.extracted.storeAddress || '',
                storePhone: parsed.extracted.storePhone || '',
                receiptId: parsed.receiptRecord.id,
                extractedExpenseId: parsed.extractedExpense?.id,
                confidence: parsed.extractedExpense?.confidence ?? 0,
              },
              fileName: receipt.fileName,
            });
          } catch (error: any) {
            results.push({
              success: false,
              error: error.message || 'スキャンに失敗しました',
              fileName: receipt.fileName,
            });
          }
        }

        return results;
      }),
    classify: protectedProcedure
      .input(z.object({
        imageData: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const rawBase64 = input.imageData.split(',')[1] || input.imageData;
          const parsed = await persistExtractedDocument({
            userId: ctx.user.id,
            fileName: input.fileName,
            mimeType: input.mimeType,
            fileBuffer: Buffer.from(rawBase64, 'base64'),
            sourceDataUrl: input.imageData,
            documentType: 'receipt',
          });

          return {
            storeName: parsed.extracted.storeName,
            storeAddress: parsed.extracted.storeAddress || '',
            storePhone: parsed.extracted.storePhone || '',
            purchaseDate: parsed.documentDate,
            paymentMethod: parsed.extracted.paymentMethod || '現金',
            amount: Math.round(parsed.extracted.amount || 0),
            categoryId: parsed.matchedCategory.id,
            lineItems: parsed.lineItemsWithIds,
            receiptId: parsed.receiptRecord.id,
            extractedExpenseId: parsed.extractedExpense?.id,
            confidence: parsed.extractedExpense?.confidence ?? 0,
          };
        } catch (error) {
          console.error('Receipt classification error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to classify receipt' });
        }
      }),
    getExtraction: protectedProcedure
      .input(z.object({ receiptId: z.number() }))
      .query(async ({ ctx, input }) => {
        const receipt = await db.getReceiptById(input.receiptId);
        if (!receipt || receipt.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const bundle = await db.getReceiptExtractionBundle(input.receiptId);
        return { receipt, ...bundle };
      }),
    reviewQueue: protectedProcedure.query(async ({ ctx }) => {
      const extracted = await db.getExtractedExpensesByUserId(ctx.user.id, "pending");
      const results = [];
      for (const item of extracted) {
        const receipt = await db.getReceiptById(item.receiptId);
        const bundle = await db.getReceiptExtractionBundle(item.receiptId);
        results.push({
          ...item,
          receiptFileName: receipt?.fileName || null,
          receiptFileUrl: receipt?.fileUrl || null,
          receiptMimeType: (receipt as any)?.mimeType || null,
          receiptDocumentType: (receipt as any)?.documentType || null,
          detail: bundle.detail,
          lineItems: bundle.lineItems,
        });
      }
      return results;
    }),
    approveReview: protectedProcedure
      .input(z.object({
        extractedExpenseId: z.number(),
        categoryId: z.number(),
        amount: z.number().positive(),
        description: z.string().min(1),
        date: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const extracted = await db.getExtractedExpenseById(input.extractedExpenseId);
        if (!extracted || extracted.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const expense = await createExpenseWithJournal(ctx.user.id, {
          categoryId: input.categoryId,
          amount: input.amount,
          description: input.description,
          date: input.date,
          receiptId: extracted.receiptId,
          isAutoClassified: true,
        });

        await db.updateExtractedExpense(input.extractedExpenseId, {
          status: "approved",
          approvedAmount: Math.round(input.amount),
          approvedCategoryId: input.categoryId,
          approvedDescription: input.description,
          approvedDate: new Date(input.date),
        });

        return expense;
      }),
    rejectReview: protectedProcedure
      .input(z.object({ extractedExpenseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const extracted = await db.getExtractedExpenseById(input.extractedExpenseId);
        if (!extracted || extracted.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return await db.updateExtractedExpense(input.extractedExpenseId, { status: "rejected" });
      }),
    deleteReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const receipt = await db.getReceiptById(input.id);
        if (!receipt || receipt.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return await db.deleteReceipt(input.id);
      }),
  }),

  // ===== Batch Scan (レシート自動スキャン) =====
  batchScan: router({
    getJobs: protectedProcedure.query(async ({ ctx }) => {
      return await db.getProcessingJobsByUserId(ctx.user.id);
    }),
    getCurrentJob: protectedProcedure.query(async ({ ctx }) => {
      const jobs = await db.getProcessingJobsByUserId(ctx.user.id);
      const current = jobs.find(j => j.status === 'processing' || j.status === 'pending');
      return current || null;
    }),
    startBatch: protectedProcedure
      .input(z.object({
        receiptIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.receiptIds.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No receipts to process' });
        }

        const job = await db.createProcessingJob({
          userId: ctx.user.id,
          jobType: 'batch_receipt_scan',
          status: 'pending',
          totalCount: input.receiptIds.length,
          processedCount: 0,
          receiptIds: JSON.stringify(input.receiptIds),
        });

        return job;
      }),
    getJobDetails: protectedProcedure
      .input(z.object({
        jobId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const job = await db.getProcessingJobById(input.jobId);
        if (!job || job.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        const extracted = await db.getExtractedExpensesByJobId(input.jobId);
        return {
          job,
          extracted,
        };
      }),
    approveExtracted: protectedProcedure
      .input(z.object({
        extractedId: z.number(),
        amount: z.number().optional(),
        categoryId: z.number().optional(),
        description: z.string().optional(),
        date: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const extracted = await db.getExtractedExpensesByJobId(0);
        const item = extracted.find((e: any) => e.id === input.extractedId);
        
        if (!item || item.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        const finalAmount = input.amount ?? item.amount;
        const finalCategoryId = input.categoryId ?? item.categoryId;
        const finalDescription = input.description ?? item.description;
        const finalDate = input.date ? new Date(input.date) : item.date ? new Date(item.date) : new Date();

        if (!finalCategoryId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Category is required' });
        }

        const expense = await db.createExpense({
          userId: ctx.user.id,
          receiptId: item.receiptId,
          categoryId: finalCategoryId,
          amount: Math.round(finalAmount),
          description: finalDescription,
          date: finalDate,
          isAutoClassified: true,
        });

        await db.updateExtractedExpense(input.extractedId, {
          status: 'approved',
          approvedAmount: Math.round(finalAmount),
          approvedCategoryId: finalCategoryId,
          approvedDescription: finalDescription,
          approvedDate: finalDate,
        });

        return expense;
      }),
    rejectExtracted: protectedProcedure
      .input(z.object({
        extractedId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const extracted = await db.getExtractedExpensesByJobId(0);
        const item = extracted.find((e: any) => e.id === input.extractedId);
        
        if (!item || item.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        return await db.updateExtractedExpense(input.extractedId, {
          status: 'rejected',
        });
      }),
  }),

  // ===== Journal (仕訳帳) =====
  journal: router({
    accounts: protectedProcedure.query(async () => JOURNAL_ACCOUNTS),
    list: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getJournalEntriesByMonth(ctx.user.id, input.year, input.month);
      }),
    summary: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const rows = await db.getJournalSummaryByMonth(ctx.user.id, input.year, input.month);
        const totals = rows.reduce((acc, row) => {
          acc.debit += row.debit;
          acc.credit += row.credit;
          return acc;
        }, { debit: 0, credit: 0 });
        return { rows, totals };
      }),
    generalLedger: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getGeneralLedgerByMonth(ctx.user.id, input.year, input.month);
      }),
    createManual: protectedProcedure
      .input(z.object({
        entryDate: z.string(),
        description: z.string().min(1),
        debitAccountCode: z.string().min(1),
        creditAccountCode: z.string().min(1),
        amount: z.number().positive(),
        memo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const debitAccount = getAccountByCode(input.debitAccountCode);
        const creditAccount = getAccountByCode(input.creditAccountCode);
        if (!debitAccount || !creditAccount) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "勘定科目が不正です" });
        }

        return await db.createJournalEntry({
          userId: ctx.user.id,
          entryDate: new Date(input.entryDate),
          description: input.description,
          sourceType: "manual",
          status: "confirmed",
        }, [
          {
            journalEntryId: 0,
            side: "debit",
            accountCode: debitAccount.code,
            accountName: debitAccount.name,
            amount: Math.round(input.amount),
            memo: input.memo,
          },
          {
            journalEntryId: 0,
            side: "credit",
            accountCode: creditAccount.code,
            accountName: creditAccount.name,
            amount: Math.round(input.amount),
            memo: input.memo,
          },
        ]);
      }),
    syncCurrentMonth: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sales = await db.getSalesByMonth(ctx.user.id, input.year, input.month);
        const expenses = await db.getExpensesByMonth(ctx.user.id, input.year, input.month);
        let createdCount = 0;

        for (const sale of sales) {
          if (await db.hasJournalEntryForSource(ctx.user.id, "sale", sale.id)) continue;
          await db.createJournalEntry({
            userId: ctx.user.id,
            entryDate: sale.date,
            description: sale.description || "売上計上",
            sourceType: "sale",
            sourceId: sale.id,
            status: "confirmed",
          }, [
            {
              journalEntryId: 0,
              side: "debit",
              accountCode: DEFAULT_SALE_DEBIT_ACCOUNT,
              accountName: getAccountByCode(DEFAULT_SALE_DEBIT_ACCOUNT)?.name || "現金",
              amount: sale.amount,
              memo: "売上入金",
            },
            {
              journalEntryId: 0,
              side: "credit",
              accountCode: DEFAULT_SALE_CREDIT_ACCOUNT,
              accountName: getAccountByCode(DEFAULT_SALE_CREDIT_ACCOUNT)?.name || "売上高",
              amount: sale.amount,
              memo: "売上計上",
            },
          ]);
          createdCount += 1;
        }

        const categories = await db.getExpenseCategories();
        for (const expense of expenses) {
          if (await db.hasJournalEntryForSource(ctx.user.id, "expense", expense.id)) continue;
          const category = categories.find(item => item.id === expense.categoryId);
          const debitAccountCode = guessExpenseAccount({ categoryCode: category?.code, categoryName: category?.name });
          await db.createJournalEntry({
            userId: ctx.user.id,
            entryDate: expense.date,
            description: expense.description || category?.name || "経費計上",
            sourceType: "expense",
            sourceId: expense.id,
            status: "confirmed",
          }, [
            {
              journalEntryId: 0,
              side: "debit",
              accountCode: debitAccountCode,
              accountName: getAccountByCode(debitAccountCode)?.name || category?.name || "雑費",
              amount: expense.amount,
              memo: category?.name || "経費",
            },
            {
              journalEntryId: 0,
              side: "credit",
              accountCode: DEFAULT_EXPENSE_CREDIT_ACCOUNT,
              accountName: getAccountByCode(DEFAULT_EXPENSE_CREDIT_ACCOUNT)?.name || "現金",
              amount: expense.amount,
              memo: "支払",
            },
          ]);
          createdCount += 1;
        }

        return { success: true, createdCount };
      }),
  }),

  // ===== Reports (帳簿生成) =====
  reports: router({
    getMonthlyReport: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const sales = await db.getSalesByUserId(ctx.user.id);
        const expenses = await db.getExpensesByUserId(ctx.user.id);

        const monthStart = new Date(input.year, input.month - 1, 1);
        const monthEnd = new Date(input.year, input.month, 0);

        const monthSales = sales.filter(s => s.date >= monthStart && s.date <= monthEnd);
        const monthExpenses = expenses.filter(e => e.date >= monthStart && e.date <= monthEnd);

        const totalSales = monthSales.reduce((sum, s) => sum + s.amount, 0);
        const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const profit = totalSales - totalExpenses;
        const journalEntries = await db.getJournalEntriesByMonth(ctx.user.id, input.year, input.month);
        const journalSummary = await db.getJournalSummaryByMonth(ctx.user.id, input.year, input.month);
        const reviewCount = journalEntries.filter(entry => entry.status === "needs_review" || entry.status === "draft").length;

        return {
          year: input.year,
          month: input.month,
          sales: monthSales,
          expenses: monthExpenses,
          totalSales,
          totalExpenses,
          profit,
          journalEntries,
          journalSummary,
          reviewCount,
        };
      }),
    exportCSV: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const report = await appRouter.createCaller(ctx).reports.getMonthlyReport({
          year: input.year,
          month: input.month,
        });

        let csv = "日付,種類,説明,金額\n";
        report.sales.forEach(s => {
          csv += `${s.date.toISOString().split('T')[0]},売上,${s.description},${s.amount}\n`;
        });
        report.expenses.forEach(e => {
          csv += `${e.date.toISOString().split('T')[0]},経費,${e.description},${e.amount}\n`;
        });
        return csv;
      }),
    exportJournalCsv: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const entries = await db.getJournalEntriesByMonth(ctx.user.id, input.year, input.month);
        const rows: string[][] = [["日付", "仕訳ID", "摘要", "区分", "勘定科目", "金額", "相手科目", "メモ", "状態"]];
        for (const entry of entries) {
          for (const line of entry.lines) {
            const counter = entry.lines
              .filter(item => item.id !== line.id)
              .map(item => `${item.accountCode} ${item.accountName}`)
              .join(" / ");
            rows.push([
              new Date(entry.entryDate).toISOString().split('T')[0],
              String(entry.id),
              entry.description || '',
              line.side === 'debit' ? '借方' : '貸方',
              `${line.accountCode} ${line.accountName}`,
              String(line.amount),
              counter,
              line.memo || '',
              entry.status,
            ]);
          }
        }
        return rows;
      }),
    exportGeneralLedgerCsv: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const ledgers = await db.getGeneralLedgerByMonth(ctx.user.id, input.year, input.month);
        const rows: string[][] = [["勘定科目", "日付", "仕訳ID", "摘要", "相手科目", "借貸", "金額", "残高", "メモ"]];
        for (const ledger of ledgers) {
          for (const line of ledger.lines) {
            rows.push([
              `${ledger.accountCode} ${ledger.accountName}`,
              new Date(line.entryDate).toISOString().split('T')[0],
              String(line.journalEntryId),
              line.description || '',
              line.counterAccount,
              line.side === 'debit' ? '借方' : '貸方',
              String(line.amount),
              String(line.runningBalance),
              line.memo || '',
            ]);
          }
        }
        return rows;
      }),


    exportYearlyBookCsv: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const summary = await appRouter.createCaller(ctx).reports.getYearlySummary({ year: input.year });
        const sales = (await db.getSalesByUserId(ctx.user.id)).filter(item => item.date.getFullYear() === input.year);
        const expenses = (await db.getExpensesByUserId(ctx.user.id)).filter(item => item.date.getFullYear() === input.year && !item.isDeleted);
        const categories = await db.getExpenseCategories();
        const categoryMap = new Map(categories.map(category => [category.id, category.name]));

        const rows: string[][] = [
          ['確定申告用 年次帳簿'],
          [`対象年`, String(input.year)],
          [],
          ['年間サマリー'],
          ['項目', '金額'],
          ['売上合計', String(summary.totalSales)],
          ['経費合計', String(summary.totalExpenses)],
          ['利益', String(summary.profit)],
          [],
          ['月別サマリー'],
          ['月', '売上', '経費', '利益'],
          ...summary.monthly.map(row => [String(row.month), String(row.sales), String(row.expenses), String(row.profit)]),
          [],
          ['経費上位カテゴリ'],
          ['カテゴリ', '金額'],
          ...summary.topExpenseCategories.map(item => [item.name, String(item.amount)]),
          [],
          ['売上明細'],
          ['日付', '摘要', '金額'],
          ...sales
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(item => [new Date(item.date).toISOString().split('T')[0], item.description || '', String(item.amount)]),
          [],
          ['経費明細'],
          ['日付', '摘要', 'カテゴリ', '金額', '証憑'],
          ...expenses
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(item => [
              new Date(item.date).toISOString().split('T')[0],
              item.description || '',
              categoryMap.get(item.categoryId) || '不明',
              String(item.amount),
              item.receiptId ? 'あり' : 'なし',
            ]),
        ];

        return rows;
      }),
    exportYearlyJournalCsv: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const rows: string[][] = [['日付', '月', '仕訳ID', '摘要', '区分', '勘定科目', '金額', '相手科目', 'メモ', '状態']];
        for (let month = 1; month <= 12; month += 1) {
          const entries = await db.getJournalEntriesByMonth(ctx.user.id, input.year, month);
          for (const entry of entries) {
            for (const line of entry.lines) {
              const counter = entry.lines
                .filter(item => item.id !== line.id)
                .map(item => `${item.accountCode} ${item.accountName}`)
                .join(' / ');
              rows.push([
                new Date(entry.entryDate).toISOString().split('T')[0],
                String(month),
                String(entry.id),
                entry.description || '',
                line.side === 'debit' ? '借方' : '貸方',
                `${line.accountCode} ${line.accountName}`,
                String(line.amount),
                counter,
                line.memo || '',
                entry.status,
              ]);
            }
          }
        }
        return rows;
      }),
    exportYearlyGeneralLedgerCsv: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const rows: string[][] = [['月', '勘定科目', '日付', '仕訳ID', '摘要', '相手科目', '借貸', '金額', '残高', 'メモ']];
        for (let month = 1; month <= 12; month += 1) {
          const ledgers = await db.getGeneralLedgerByMonth(ctx.user.id, input.year, month);
          for (const ledger of ledgers) {
            for (const line of ledger.lines) {
              rows.push([
                String(month),
                `${ledger.accountCode} ${ledger.accountName}`,
                new Date(line.entryDate).toISOString().split('T')[0],
                String(line.journalEntryId),
                line.description || '',
                line.counterAccount,
                line.side === 'debit' ? '借方' : '貸方',
                String(line.amount),
                String(line.runningBalance),
                line.memo || '',
              ]);
            }
          }
        }
        return rows;
      }),
    exportFilingCheckCsv: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const summary = await appRouter.createCaller(ctx).reports.getYearlySummary({ year: input.year });
        const filingCheck = await appRouter.createCaller(ctx).reports.getFilingCheck({ year: input.year });
        const closings = await db.listMonthClosingsByYear(ctx.user.id, input.year);
        const rows: string[][] = [
          ['申告前チェック'],
          ['対象年', String(input.year)],
          [],
          ['年間サマリー'],
          ['売上合計', String(summary.totalSales)],
          ['経費合計', String(summary.totalExpenses)],
          ['利益', String(summary.profit)],
          ['要対応件数', String(filingCheck.warningCount)],
          [],
          ['チェック項目'],
          ['項目', '状態', '内容'],
          ...filingCheck.items.map(item => [item.label, item.status === 'ok' ? 'OK' : '要確認', item.message]),
          [],
          ['月次締め状況'],
          ['月', '状態', '締め日時', 'メモ'],
          ...Array.from({ length: 12 }, (_, index) => index + 1).map(month => {
            const closing = closings.find(item => item.month === month);
            return [
              String(month),
              closing?.status === 'closed' ? '締め済み' : '未締め',
              closing?.closedAt ? new Date(closing.closedAt).toISOString() : '',
              closing?.notes || '',
            ];
          }),
        ];
        return rows;
      }),

    getYearlySummary: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const sales = await db.getSalesByUserId(ctx.user.id);
        const expenses = await db.getExpensesByUserId(ctx.user.id);
        const monthly = Array.from({ length: 12 }, (_, index) => {
          const month = index + 1;
          const monthStart = new Date(input.year, index, 1);
          const monthEnd = new Date(input.year, index + 1, 0);
          const monthSales = sales.filter(s => s.date >= monthStart && s.date <= monthEnd);
          const monthExpenses = expenses.filter(e => e.date >= monthStart && e.date <= monthEnd && !e.isDeleted);
          const totalSales = monthSales.reduce((sum, item) => sum + item.amount, 0);
          const totalExpenses = monthExpenses.reduce((sum, item) => sum + item.amount, 0);
          return {
            month,
            sales: totalSales,
            expenses: totalExpenses,
            profit: totalSales - totalExpenses,
          };
        });

        const totalSales = monthly.reduce((sum, row) => sum + row.sales, 0);
        const totalExpenses = monthly.reduce((sum, row) => sum + row.expenses, 0);
        const categories = await db.getExpenseCategories();
        const categoryMap = new Map(categories.map(category => [category.id, category.name]));
        const expenseBreakdown = new Map<string, number>();
        expenses
          .filter(item => item.date.getFullYear() === input.year && !item.isDeleted)
          .forEach(item => {
            const name = categoryMap.get(item.categoryId) || '不明';
            expenseBreakdown.set(name, (expenseBreakdown.get(name) || 0) + item.amount);
          });

        return {
          year: input.year,
          totalSales,
          totalExpenses,
          profit: totalSales - totalExpenses,
          monthly,
          topExpenseCategories: Array.from(expenseBreakdown.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, amount]) => ({ name, amount })),
        };
      }),
    getMonthlyCloseStatus: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const summary = await buildMonthlyClosePayload(ctx.user.id, input.year, input.month);
        const closing = await db.getMonthClosingByPeriod(ctx.user.id, input.year, input.month);
        return {
          ...summary,
          closing: closing ? {
            id: closing.id,
            status: closing.status,
            closedAt: closing.closedAt,
            notes: closing.notes || '',
          } : {
            id: null,
            status: 'open',
            closedAt: null,
            notes: '',
          },
        };
      }),
    updateMonthlyCloseStatus: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
        status: z.enum(['open', 'closed']),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const summary = await buildMonthlyClosePayload(ctx.user.id, input.year, input.month);
        if (input.status === 'closed' && summary.warningCount > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '要確認項目が残っているため月次締めできません。' });
        }

        const saved = await db.upsertMonthClosing(ctx.user.id, input.year, input.month, {
          status: input.status,
          closedAt: input.status === 'closed' ? new Date() : null,
          notes: input.notes ?? '',
          summaryJson: JSON.stringify(summary),
        });

        return {
          success: true,
          closing: saved,
          summary,
        };
      }),
    listMonthlyClosings: protectedProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.listMonthClosingsByYear(ctx.user.id, input.year);
      }),


    getFinalReviewSummary: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const yearlySummary = await appRouter.createCaller(ctx).reports.getYearlySummary({ year: input.year });
        const filingCheck = await appRouter.createCaller(ctx).reports.getFilingCheck({ year: input.year });
        const closings = await db.listMonthClosingsByYear(ctx.user.id, input.year);
        const expenses = (await db.getExpensesByUserId(ctx.user.id)).filter(item => item.date.getFullYear() === input.year && !item.isDeleted);
        const receipts = (await db.getReceiptsByUserId(ctx.user.id)).filter(item => new Date(item.createdAt).getFullYear() === input.year);
        const journalEntriesByMonth = await Promise.all(
          Array.from({ length: 12 }, (_, index) => db.getJournalEntriesByMonth(ctx.user.id, input.year, index + 1))
        );

        const closedMonths = new Set(closings.filter(item => item.status === 'closed').map(item => item.month));
        const openMonths = Array.from({ length: 12 }, (_, index) => index + 1).filter(month => !closedMonths.has(month));

        const duplicateBuckets = new Map<string, Array<typeof expenses[number]>>();
        for (const expense of expenses) {
          const key = [
            expense.date.toISOString().split('T')[0],
            expense.amount,
            expense.categoryId,
            (expense.description || '').trim(),
          ].join('|');
          const bucket = duplicateBuckets.get(key) || [];
          bucket.push(expense);
          duplicateBuckets.set(key, bucket);
        }
        const duplicateCandidates = Array.from(duplicateBuckets.values())
          .filter(bucket => bucket.length > 1)
          .flatMap(bucket => bucket);

        const profile = await db.getUserProfile(ctx.user.id);
        const deadlineDate = profile?.taxFilingDeadline ? new Date(profile.taxFilingDeadline) : null;
        const today = new Date();
        const daysUntilDeadline = deadlineDate ? Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

        const monthlyHealth = Array.from({ length: 12 }, (_, index) => {
          const month = index + 1;
          const summary = yearlySummary.monthly.find((item: { month: number; sales: number; expenses: number; profit: number }) => {
            return item.month === month;
          });
          const clos = closings.find(item => item.month === month);
          const journalEntries = journalEntriesByMonth[index] || [];
          return {
            month,
            sales: summary?.sales || 0,
            expenses: summary?.expenses || 0,
            profit: summary?.profit || 0,
            isClosed: clos?.status === 'closed',
            hasActivity: (summary?.sales || 0) > 0 || (summary?.expenses || 0) > 0,
            unsettledJournalCount: journalEntries.filter(entry => entry.status === 'draft' || entry.status === 'needs_review').length,
          };
        });

        const readinessItems = [
          {
            key: 'deadline',
            label: '申告期限',
            status: daysUntilDeadline === null ? 'warning' : daysUntilDeadline >= 0 ? 'ok' : 'warning',
            detail: daysUntilDeadline === null
              ? 'プロフィールに申告期限が未設定です。'
              : daysUntilDeadline >= 0
                ? `申告期限まであと${daysUntilDeadline}日です。`
                : `申告期限を${Math.abs(daysUntilDeadline)}日過ぎています。`,
          },
          {
            key: 'monthlyClosings',
            label: '月次締め',
            status: openMonths.length === 0 ? 'ok' : 'warning',
            detail: openMonths.length === 0 ? '12か月すべて締め済みです。' : `未締めの月: ${openMonths.join('、')}月`,
          },
          {
            key: 'filingWarnings',
            label: '申告チェックの警告',
            status: filingCheck.warningCount === 0 ? 'ok' : 'warning',
            detail: filingCheck.warningCount === 0 ? '申告チェックの警告はありません。' : `${filingCheck.warningCount}件の要対応があります。`,
          },
          {
            key: 'duplicateExpenses',
            label: '重複の疑いがある経費',
            status: duplicateCandidates.length === 0 ? 'ok' : 'warning',
            detail: duplicateCandidates.length === 0 ? '重複候補は見つかっていません。' : `${duplicateCandidates.length}件の重複候補があります。`,
          },
          {
            key: 'receiptCoverage',
            label: '証憑の保存状況',
            status: expenses.length === 0 || filingCheck.expensesWithoutReceiptCount === 0 ? 'ok' : 'warning',
            detail: expenses.length === 0
              ? '今年の経費はまだありません。'
              : `経費 ${expenses.length}件のうち、証憑あり ${Math.max(expenses.length - filingCheck.expensesWithoutReceiptCount, 0)}件 / 未登録 ${filingCheck.expensesWithoutReceiptCount}件です。`,
          },
        ];

        return {
          year: input.year,
          yearlySummary,
          filingCheck,
          daysUntilDeadline,
          monthlyCloseRate: `${closedMonths.size}/12`,
          closedMonthCount: closedMonths.size,
          openMonths,
          duplicateCandidateCount: duplicateCandidates.length,
          duplicateCandidates: duplicateCandidates.slice(0, 20).map(item => ({
            id: item.id,
            date: item.date.toISOString().split('T')[0],
            amount: item.amount,
            description: item.description || '',
          })),
          receiptCoverageRate: expenses.length === 0 ? 100 : Math.round(((expenses.length - filingCheck.expensesWithoutReceiptCount) / expenses.length) * 100),
          receiptCount: receipts.length,
          readinessItems,
          monthlyHealth,
        };
      }),
    exportFinalReviewCsv: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const summary = await appRouter.createCaller(ctx).reports.getFinalReviewSummary({ year: input.year });
        const rows: string[][] = [
          ['申告直前の最終確認'],
          ['対象年', String(input.year)],
          ['売上合計', String(summary.yearlySummary.totalSales)],
          ['経費合計', String(summary.yearlySummary.totalExpenses)],
          ['利益', String(summary.yearlySummary.profit)],
          ['申告期限までの日数', summary.daysUntilDeadline === null ? '' : String(summary.daysUntilDeadline)],
          ['月次締め', summary.monthlyCloseRate],
          ['証憑保存率', `${summary.receiptCoverageRate}%`],
          ['重複候補', String(summary.duplicateCandidateCount)],
          [],
          ['最終確認項目'],
          ['項目', '状態', '内容'],
          ...summary.readinessItems.map((item: { label: string; status: string; detail: string }) => [item.label, item.status === 'ok' ? 'OK' : '要確認', item.detail]),
          [],
          ['月別ヘルス'],
          ['月', '売上', '経費', '利益', '締め状態', '未確定仕訳'],
          ...summary.monthlyHealth.map((item: {
            month: number;
            sales: number;
            expenses: number;
            profit: number;
            isClosed: boolean;
            hasActivity: boolean;
            unsettledJournalCount: number;
          }) => [
            String(item.month),
            String(item.sales),
            String(item.expenses),
            String(item.profit),
            item.isClosed ? '締め済み' : '未締め',
            String(item.unsettledJournalCount),
          ]),
          [],
          ['重複候補（先頭20件）'],
          ['日付', '摘要', '金額'],
          ...summary.duplicateCandidates.map((item: { date: string; description: string; amount: number }) => [item.date, item.description, String(item.amount)]),
        ];
        return rows;
      }),


    getSubmissionPackSummary: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const finalReview = await appRouter.createCaller(ctx).reports.getFinalReviewSummary({ year: input.year });
        const filingCheck = await appRouter.createCaller(ctx).reports.getFilingCheck({ year: input.year });
        const profile = await db.getUserProfile(ctx.user.id);
        const yearlyBook = await appRouter.createCaller(ctx).reports.exportYearlyBookCsv({ year: input.year });
        const yearlyJournal = await appRouter.createCaller(ctx).reports.exportYearlyJournalCsv({ year: input.year });
        const yearlyGeneralLedger = await appRouter.createCaller(ctx).reports.exportYearlyGeneralLedgerCsv({ year: input.year });
        const filingCsv = await appRouter.createCaller(ctx).reports.exportFilingCheckCsv({ year: input.year });
        const finalReviewCsv = await appRouter.createCaller(ctx).reports.exportFinalReviewCsv({ year: input.year });

        const documents = [
          {
            key: 'yearlyBook',
            label: '年次帳簿CSV',
            status: yearlyBook.length > 2 ? 'ready' : 'attention',
            detail: yearlyBook.length > 2 ? '年間の売上・経費・利益を確認できます。' : 'まだ年次帳簿データが少ない可能性があります。',
          },
          {
            key: 'yearlyJournal',
            label: '年次仕訳帳CSV',
            status: yearlyJournal.length > 2 ? 'ready' : 'attention',
            detail: yearlyJournal.length > 2 ? '仕訳帳の年次出力を準備済みです。' : '仕訳帳のデータ件数が少ない可能性があります。',
          },
          {
            key: 'yearlyGeneralLedger',
            label: '年次総勘定元帳CSV',
            status: yearlyGeneralLedger.length > 2 ? 'ready' : 'attention',
            detail: yearlyGeneralLedger.length > 2 ? '総勘定元帳の年次出力を準備済みです。' : '総勘定元帳に十分なデータがない可能性があります。',
          },
          {
            key: 'filingCheck',
            label: '申告チェックCSV',
            status: filingCsv.length > 2 && filingCheck.warningCount === 0 ? 'ready' : 'attention',
            detail: filingCheck.warningCount === 0 ? '申告チェック上の警告はありません。' : `${filingCheck.warningCount}件の警告があります。`,
          },
          {
            key: 'finalReview',
            label: '最終確認CSV',
            status: finalReviewCsv.length > 2 && finalReview.readinessItems.every(item => item.status === 'ok') ? 'ready' : 'attention',
            detail: finalReview.readinessItems.every(item => item.status === 'ok') ? '最終確認は概ね完了しています。' : '最終確認に未解決項目があります。',
          },
        ];

        const recommendedActions = [
          ...filingCheck.items.filter(item => item.status === 'warning').map(item => ({
            label: item.label,
            detail: item.message,
            path: item.key === 'pendingReview' ? '/review-extracted' : item.key === 'activityMonths' ? '/monthly-close' : '/filing-check',
          })),
          ...finalReview.readinessItems.filter(item => item.status === 'warning').map(item => ({
            label: item.label,
            detail: item.detail,
            path: item.key === 'monthlyClosings' ? '/monthly-close' : item.key === 'duplicateExpenses' ? '/final-review' : '/filing-check',
          })),
        ].filter((item, index, self) => self.findIndex(candidate => candidate.label === item.label && candidate.detail === item.detail) === index).slice(0, 8);

        const completionChecks = [
          profile?.businessName && profile?.businessType ? 1 : 0,
          profile?.taxFilingDeadline ? 1 : 0,
          filingCheck.warningCount === 0 ? 1 : 0,
          finalReview.openMonths.length === 0 ? 1 : 0,
          finalReview.duplicateCandidateCount === 0 ? 1 : 0,
          finalReview.receiptCoverageRate === 100 ? 1 : 0,
        ];
        const completionRate = Math.round((completionChecks.reduce((sum, value) => sum + value, 0) / completionChecks.length) * 100);

        return {
          year: input.year,
          businessName: profile?.businessName || '',
          businessType: profile?.businessType || '',
          deadline: profile?.taxFilingDeadline ? new Date(profile.taxFilingDeadline).toISOString().split('T')[0] : '',
          completionRate,
          warningCount: filingCheck.warningCount + finalReview.readinessItems.filter(item => item.status === 'warning').length,
          documentCount: documents.filter(item => item.status === 'ready').length,
          documents,
          recommendedActions,
          yearlySummary: finalReview.yearlySummary,
          filingCheck,
          finalReview,
        };
      }),
    exportSubmissionPackCsv: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const summary = await appRouter.createCaller(ctx).reports.getSubmissionPackSummary({ year: input.year });
        const rows: string[][] = [
          ['申告準備パック'],
          ['対象年', String(input.year)],
          ['事業名', summary.businessName],
          ['事業形態', summary.businessType],
          ['申告期限', summary.deadline],
          ['準備完了率', `${summary.completionRate}%`],
          ['警告数', String(summary.warningCount)],
          ['年間売上', String(summary.yearlySummary.totalSales)],
          ['年間経費', String(summary.yearlySummary.totalExpenses)],
          ['年間利益', String(summary.yearlySummary.profit)],
          [],
          ['提出前にそろえるデータ'],
          ['項目', '状態', '内容'],
          ...summary.documents.map(item => [item.label, item.status === 'ready' ? '準備済み' : '要確認', item.detail]),
          [],
          ['優先アクション'],
          ['項目', '内容', '画面'],
          ...summary.recommendedActions.map(item => [item.label, item.detail, item.path]),
          [],
          ['最終確認項目'],
          ['項目', '状態', '内容'],
          ...summary.finalReview.readinessItems.map(item => [item.label, item.status === 'ok' ? 'OK' : '要確認', item.detail]),
        ];
        return rows;
      }),

    getFilingCheck: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const profile = await db.getUserProfile(ctx.user.id);
        const sales = await db.getSalesByUserId(ctx.user.id);
        const expenses = await db.getExpensesByUserId(ctx.user.id);
        const receipts = await db.getReceiptsByUserId(ctx.user.id);
        const pendingReview = await db.getExtractedExpensesByUserId(ctx.user.id, 'pending');
        const yearExpenses = expenses.filter(item => item.date.getFullYear() === input.year && !item.isDeleted);
        const yearSales = sales.filter(item => item.date.getFullYear() === input.year);
        const yearReceipts = receipts.filter(item => new Date(item.createdAt).getFullYear() === input.year);
        let unsettledJournalCount = 0;
        for (let month = 1; month <= 12; month += 1) {
          const entries = await db.getJournalEntriesByMonth(ctx.user.id, input.year, month);
          unsettledJournalCount += entries.filter(entry => entry.status === 'draft' || entry.status === 'needs_review').length;
        }
        const zeroActivityMonths = Array.from({ length: 12 }, (_, index) => index + 1).filter(month => {
          const hasSales = yearSales.some(item => item.date.getMonth() + 1 === month);
          const hasExpenses = yearExpenses.some(item => item.date.getMonth() + 1 === month);
          return !hasSales && !hasExpenses;
        });
        const expensesWithoutReceiptCount = yearExpenses.filter(item => !item.receiptId).length;
        const deadlineText = profile?.taxFilingDeadline ? new Date(profile.taxFilingDeadline).toISOString().split('T')[0] : null;
        const items = [
          {
            key: 'businessProfile',
            label: '事業プロフィール',
            status: profile?.businessName && profile?.businessType ? 'ok' : 'warning',
            message: profile?.businessName && profile?.businessType ? '事業名と事業形態は設定済みです。' : 'プロフィールの事業名または事業形態が未設定です。',
          },
          {
            key: 'taxDeadline',
            label: '申告期限',
            status: deadlineText ? 'ok' : 'warning',
            message: deadlineText ? `申告期限は ${deadlineText} に設定されています。` : '申告期限が未設定です。プロフィールで設定してください。',
          },
          {
            key: 'pendingReview',
            label: 'AI読取の要確認',
            status: pendingReview.length === 0 ? 'ok' : 'warning',
            message: pendingReview.length === 0 ? '未処理のAI読取はありません。' : `${pendingReview.length}件のAI読取が未承認です。`,
          },
          {
            key: 'unsettledJournal',
            label: '未確定仕訳',
            status: unsettledJournalCount === 0 ? 'ok' : 'warning',
            message: unsettledJournalCount === 0 ? '未確定仕訳はありません。' : `${unsettledJournalCount}件の仕訳が draft / needs_review のままです。`,
          },
          {
            key: 'expenseReceipts',
            label: '証憑未登録の経費',
            status: expensesWithoutReceiptCount === 0 ? 'ok' : 'warning',
            message: expensesWithoutReceiptCount === 0 ? '経費に紐づく証憑の不足は見つかっていません。' : `${expensesWithoutReceiptCount}件の経費にレシート・請求書が紐づいていません。`,
          },
          {
            key: 'activityMonths',
            label: '入力ゼロの月',
            status: zeroActivityMonths.length === 0 ? 'ok' : 'warning',
            message: zeroActivityMonths.length === 0 ? '全ての月に売上または経費の記録があります。' : `${zeroActivityMonths.join('、')}月に売上・経費の記録がありません。`,
          },
        ];

        return {
          year: input.year,
          pendingReviewCount: pendingReview.length,
          unsettledJournalCount,
          expensesWithoutReceiptCount,
          zeroActivityMonths,
          receiptCount: yearReceipts.length,
          items,
          warningCount: items.filter(item => item.status === 'warning').length,
        };
      }),
  }),

  // ===== Profile (プロフィール) =====
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserProfile(ctx.user.id);
    }),
    update: protectedProcedure
      .input(z.object({
        businessName: z.string().optional(),
        businessType: z.string().optional(),
        taxFilingDeadline: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // プロフィールが存在するか確認
        const existingProfile = await db.getUserProfile(ctx.user.id);
        
        if (!existingProfile) {
          // プロフィールが存在しない場合は作成
          return await db.createUserProfile({
            userId: ctx.user.id,
            businessName: input.businessName,
            businessType: input.businessType,
            taxFilingDeadline: input.taxFilingDeadline ? new Date(input.taxFilingDeadline) : undefined,
          });
        }
        
        // プロフィールが存在する場合は更新
        return await db.updateUserProfile(ctx.user.id, {
          businessName: input.businessName,
          businessType: input.businessType,
          taxFilingDeadline: input.taxFilingDeadline ? new Date(input.taxFilingDeadline) : undefined,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
