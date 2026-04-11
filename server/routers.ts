import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";

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
        return await db.createSale({
          userId: ctx.user.id,
          amount: Math.round(input.amount),
          description: input.description,
          date: new Date(input.date),
        });
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
        return await db.createExpense({
          userId: ctx.user.id,
          categoryId: input.categoryId,
          amount: Math.round(input.amount),
          description: input.description,
          date: new Date(input.date),
          isAutoClassified: false,
          receiptId: input.receiptId,
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
        });
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
        const results = [];
        
        for (let i = 0; i < input.receipts.length; i++) {
          const receipt = input.receipts[i];
          try {
            const response = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: "You are an expert at analyzing receipts and extracting detailed information. Extract ONLY store name (no address), purchase date (MUST be in YYYY-MM-DD format, e.g., 2025-11-29), payment method (in Japanese: 現金, クレジットカード, 電子マネー, etc.), total amount, and line items (product name, quantity, unit price, total price). For category, use one of these Japanese names: 消耗品, 交通費, 食事代, 通信費, 水道光熱費, 賃料, 広告宣伝費, 旅費, 接待交際費, 修繕費, 保険料, 税金, その他. All responses must be in Japanese. IMPORTANT: purchaseDate must be in YYYY-MM-DD format. DO NOT include store address or phone number."
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Please analyze this receipt and extract detailed information."
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: receipt.imageData,
                      }
                    }
                  ]
                }
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "receipt_extraction",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      storeName: { type: "string" },
                      purchaseDate: { type: "string" },
                      paymentMethod: { type: "string" },
                      amount: { type: "number" },
                      category: { type: "string" },
                      lineItems: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            quantity: { type: "number" },
                            unitPrice: { type: "number" },
                            totalPrice: { type: "number" }
                          },
                          required: ["name", "quantity", "unitPrice", "totalPrice"],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["storeName", "purchaseDate", "amount", "category", "lineItems"],
                    additionalProperties: false
                  }
                }
              }
            });

            const content = response.choices[0]?.message.content;
            if (!content || typeof content !== 'string') throw new Error("No response from LLM");
            
            const extracted = JSON.parse(content);
            
            // カテゴリIDを取得
            const categories = await db.getExpenseCategories();
            let matchedCategory = categories.find(c => c.name === extracted.category);
            if (!matchedCategory) {
              matchedCategory = categories.find(c => 
                c.name.includes(extracted.category) || extracted.category.includes(c.name)
              );
            }
            if (!matchedCategory) {
              matchedCategory = categories.find(c => c.code === 'other');
            }
            if (!matchedCategory) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No expense categories found' });
            }

            // Add unique IDs to line items
            const lineItemsWithIds = extracted.lineItems.map((item: any, index: number) => ({
              ...item,
              id: `item-${i}-${index}`
            }));

            // Save receipt image to S3
            const { storagePut } = await import("../server/storage");
            const fileKey = `receipts/${ctx.user.id}/${Date.now()}-${i}-${receipt.fileName}`;
            const base64Data = receipt.imageData.split(',')[1] || receipt.imageData;
            const { url } = await storagePut(fileKey, Buffer.from(base64Data, 'base64'), receipt.mimeType);

            // Create receipt record
            const receiptRecord = await db.createReceipt({
              userId: ctx.user.id,
              fileName: receipt.fileName,
              fileUrl: url,
              fileKey: fileKey,
            });

            if (!receiptRecord) {
              throw new Error('レシートの保存に失敗しました');
            }

            results.push({
              success: true,
              receiptId: receiptRecord.id,
              data: {
                storeName: extracted.storeName,
                purchaseDate: extracted.purchaseDate,
                paymentMethod: extracted.paymentMethod,
                totalAmount: extracted.amount,
                lineItems: lineItemsWithIds,
                categoryId: matchedCategory.id,
                receiptId: receiptRecord.id,
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
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                  content: "You are an expert at analyzing receipts and extracting detailed information. Extract ONLY store name (no address), purchase date (MUST be in YYYY-MM-DD format, e.g., 2025-11-29), payment method (in Japanese: 現金, クレジットカード, 電子マネー, etc.), total amount, and line items (product name, quantity, unit price, total price). For category, use one of these Japanese names: 消耗品, 交通費, 食事代, 通信費, 水道光熱費, 賃料, 広告宣伝費, 旅費, 接待交際費, 修繕費, 保険料, 税金, その他. All responses must be in Japanese. IMPORTANT: purchaseDate must be in YYYY-MM-DD format. DO NOT include store address or phone number."
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Please analyze this receipt and extract detailed information."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: input.imageData,
                    }
                  }
                ]
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "receipt_extraction",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    storeName: { type: "string" },
                    purchaseDate: { type: "string" },
                    paymentMethod: { type: "string" },
                    amount: { type: "number" },
                    category: { type: "string" },
                    lineItems: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          quantity: { type: "number" },
                          unitPrice: { type: "number" },
                          totalPrice: { type: "number" }
                        },
                        required: ["name", "quantity", "unitPrice", "totalPrice"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["storeName", "purchaseDate", "amount", "category", "lineItems"],
                  additionalProperties: false
                }
              }
            }
          });

          const content = response.choices[0]?.message.content;
          if (!content || typeof content !== 'string') throw new Error("No response from LLM");
          
          const extracted = JSON.parse(content);
          
          // カテゴリIDを取得
          const categories = await db.getExpenseCategories();
          let matchedCategory = categories.find(c => c.name === extracted.category);
          if (!matchedCategory) {
            matchedCategory = categories.find(c => 
              c.name.includes(extracted.category) || extracted.category.includes(c.name)
            );
          }
          if (!matchedCategory) {
            matchedCategory = categories.find(c => c.code === 'other');
          }
          if (!matchedCategory) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No expense categories found' });
          }

          // Add unique IDs to line items
          const lineItemsWithIds = extracted.lineItems.map((item: any, index: number) => ({
            ...item,
            id: `item-${index}`
          }));

          // Save receipt image to S3
          const { storagePut } = await import("../server/storage");
          const fileKey = `receipts/${ctx.user.id}/${Date.now()}-${input.fileName}`;
          const base64Data = input.imageData.split(',')[1] || input.imageData;
          const { url } = await storagePut(fileKey, Buffer.from(base64Data, 'base64'), input.mimeType);

          // Create receipt record
          const receipt = await db.createReceipt({
            userId: ctx.user.id,
            fileName: input.fileName,
            fileUrl: url,
            fileKey: fileKey,
          });

          if (!receipt) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save receipt' });
          }

          return {
            storeName: extracted.storeName,
            storeAddress: extracted.storeAddress || "",
            storePhone: extracted.storePhone || "",
            purchaseDate: extracted.purchaseDate,
            paymentMethod: extracted.paymentMethod || "現金",
            amount: Math.round(extracted.amount),
            categoryId: matchedCategory.id,
            lineItems: lineItemsWithIds,
            receiptId: receipt.id,
          };
        } catch (error) {
          console.error("Receipt classification error:", error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to classify receipt' });
        }
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

        return {
          year: input.year,
          month: input.month,
          sales: monthSales,
          expenses: monthExpenses,
          totalSales,
          totalExpenses,
          profit,
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
