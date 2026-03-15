export type JournalAccount = {
  code: string;
  name: string;
  normalBalance: "debit" | "credit";
  kind: "asset" | "liability" | "equity" | "revenue" | "expense";
};

export const JOURNAL_ACCOUNTS: JournalAccount[] = [
  { code: "111", name: "現金", normalBalance: "debit", kind: "asset" },
  { code: "112", name: "普通預金", normalBalance: "debit", kind: "asset" },
  { code: "113", name: "売掛金", normalBalance: "debit", kind: "asset" },
  { code: "114", name: "未収入金", normalBalance: "debit", kind: "asset" },
  { code: "211", name: "買掛金", normalBalance: "credit", kind: "liability" },
  { code: "212", name: "未払金", normalBalance: "credit", kind: "liability" },
  { code: "311", name: "元入金", normalBalance: "credit", kind: "equity" },
  { code: "411", name: "売上高", normalBalance: "credit", kind: "revenue" },
  { code: "511", name: "仕入高", normalBalance: "debit", kind: "expense" },
  { code: "521", name: "消耗品費", normalBalance: "debit", kind: "expense" },
  { code: "522", name: "旅費交通費", normalBalance: "debit", kind: "expense" },
  { code: "523", name: "通信費", normalBalance: "debit", kind: "expense" },
  { code: "524", name: "水道光熱費", normalBalance: "debit", kind: "expense" },
  { code: "525", name: "地代家賃", normalBalance: "debit", kind: "expense" },
  { code: "526", name: "接待交際費", normalBalance: "debit", kind: "expense" },
  { code: "527", name: "広告宣伝費", normalBalance: "debit", kind: "expense" },
  { code: "528", name: "雑費", normalBalance: "debit", kind: "expense" },
];

export const DEFAULT_SALE_DEBIT_ACCOUNT = "111";
export const DEFAULT_SALE_CREDIT_ACCOUNT = "411";
export const DEFAULT_EXPENSE_CREDIT_ACCOUNT = "111";

const CATEGORY_CODE_MAP: Record<string, string> = {
  supplies: "521",
  transport: "522",
  transportation: "522",
  communication: "523",
  utilities: "524",
  utility: "524",
  rent: "525",
  rental: "525",
  entertainment: "526",
  meals: "526",
  advertising: "527",
  misc: "528",
  other: "528",
  purchase: "511",
};

const CATEGORY_NAME_MAP: Record<string, string> = {
  消耗品: "521",
  消耗品費: "521",
  交通費: "522",
  旅費交通費: "522",
  通信費: "523",
  水道光熱費: "524",
  家賃: "525",
  地代家賃: "525",
  接待交際費: "526",
  広告宣伝費: "527",
  雑費: "528",
  仕入: "511",
  仕入高: "511",
};

export function getAccountByCode(code: string) {
  return JOURNAL_ACCOUNTS.find(account => account.code === code);
}

export function guessExpenseAccount(params: { categoryCode?: string | null; categoryName?: string | null }) {
  const normalizedCode = (params.categoryCode || "").trim().toLowerCase();
  if (normalizedCode && CATEGORY_CODE_MAP[normalizedCode]) {
    return CATEGORY_CODE_MAP[normalizedCode];
  }
  if (params.categoryName && CATEGORY_NAME_MAP[params.categoryName]) {
    return CATEGORY_NAME_MAP[params.categoryName];
  }
  return "528";
}
