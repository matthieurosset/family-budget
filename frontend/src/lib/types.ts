export interface Transaction {
  id: number;
  date: string;
  value_date: string | null;
  effective_month: string;
  description: string;
  merchant_name: string | null;
  amount: string;
  currency: string;
  original_currency: string | null;
  original_amount: string | null;
  category_id: number | null;
  category_name: string | null;
  parent_category_name: string | null;
  note: string | null;
  is_transfer: boolean;
  transaction_type: string | null;
  account_id: number;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
}

export interface MonthlySummary {
  month: string;
  total_expenses: string;
  total_income: string;
  total_transfers: string;
  net: string;
  by_account: { account: string; expenses: string; income: string }[];
}

export interface CategoryBreakdown {
  category_id: number | null;
  category_name: string;
  parent_name: string | null;
  total: string;
  count: number;
}

export interface AnomalyItem {
  category_name: string;
  current_month_total: string;
  average_total: string;
  deviation_pct: string;
  direction: "up" | "down";
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  month_shift_days: number | null;
  sort_order: number;
  children: Category[];
}

export interface MappingRule {
  id: number;
  pattern: string;
  category_id: number;
  category_name: string;
  priority: number;
  min_amount: string | null;
  max_amount: string | null;
  direction: string | null;
  source: string;
}

export interface Envelope {
  id: number;
  name: string;
  monthly_amount: string;
  initial_balance: string;
  currency: string;
  category_id: number | null;
  category_name: string | null;
  total_provisions: string;
  total_expenses: string;
  balance: string;
}

export interface SplitRule {
  id: number;
  pattern: string;
  min_amount: string | null;
  max_amount: string | null;
  splits: { category_id: number; amount: number; note: string | null; category_name: string }[];
}

export interface ImportResponse {
  batch_id: number;
  month: string;
  status: string;
  files: string[];
  transactions_created: number;
  reconciliation: Record<string, unknown> | null;
}
