import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  AnomalyItem,
  Category,
  CategoryBreakdown,
  Envelope,
  MappingRule,
  MonthlySummary,
  TransactionListResponse,
} from "./types";

// Dashboard
export function useSummary(month: string) {
  return useQuery<MonthlySummary>({
    queryKey: ["summary", month],
    queryFn: () => api.get(`/dashboard/summary?month=${month}`).then((r) => r.data),
    enabled: !!month,
  });
}

export function useCategoryBreakdown(from: string, to: string) {
  return useQuery<CategoryBreakdown[]>({
    queryKey: ["categories-breakdown", from, to],
    queryFn: () => api.get(`/dashboard/categories?from_month=${from}&to_month=${to}`).then((r) => r.data),
    enabled: !!from && !!to,
  });
}

export function useAnomalies(month: string) {
  return useQuery<AnomalyItem[]>({
    queryKey: ["anomalies", month],
    queryFn: () => api.get(`/dashboard/anomalies?month=${month}`).then((r) => r.data),
    enabled: !!month,
  });
}

export function useCategoryTrends(categoryId: number | null, months: number = 12) {
  return useQuery<{ month: string; total: string }[]>({
    queryKey: ["trends", categoryId, months],
    queryFn: () => api.get(`/dashboard/trends?category_id=${categoryId}&months=${months}`).then((r) => r.data),
    enabled: !!categoryId,
  });
}

export function usePeriodComparison(p1From: string, p1To: string, p2From: string, p2To: string) {
  return useQuery<{ category: string; period1: string; period2: string; diff: string }[]>({
    queryKey: ["comparison", p1From, p1To, p2From, p2To],
    queryFn: () =>
      api.get(`/dashboard/comparison?period1_from=${p1From}&period1_to=${p1To}&period2_from=${p2From}&period2_to=${p2To}`).then((r) => r.data),
    enabled: !!p1From && !!p2From,
  });
}

// Transactions
export function useTransactions(params: Record<string, string | number | boolean>) {
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") searchParams.set(k, String(v));
  }
  return useQuery<TransactionListResponse>({
    queryKey: ["transactions", params],
    queryFn: () => api.get(`/transactions?${searchParams}`).then((r) => r.data),
  });
}

// Categories
export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((r) => r.data),
  });
}

// Rules
export function useRules() {
  return useQuery<MappingRule[]>({
    queryKey: ["rules"],
    queryFn: () => api.get("/rules").then((r) => r.data),
  });
}

// Envelopes
export function useEnvelopes() {
  return useQuery<Envelope[]>({
    queryKey: ["envelopes"],
    queryFn: () => api.get("/envelopes").then((r) => r.data),
  });
}

// Mutations
export function useUploadImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => api.post("/import/upload", formData).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["categories-breakdown"] });
    },
  });
}

export function useApplyRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/categorize/apply-rules").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parent_id?: number | null; month_shift_days?: number | null }) =>
      api.post("/categories", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { pattern: string; category_id: number; priority?: number; min_amount?: number | null; max_amount?: number | null; direction?: string | null }) =>
      api.post("/rules", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; pattern: string; category_id: number; priority?: number; min_amount?: number | null; max_amount?: number | null; direction?: string | null }) =>
      api.put(`/rules/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rules/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

// Split rules
export function useSplitRules() {
  return useQuery<import("./types").SplitRule[]>({
    queryKey: ["split-rules"],
    queryFn: () => api.get("/split-rules").then((r) => r.data),
  });
}

export function useCreateSplitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { pattern: string; min_amount?: number | null; max_amount?: number | null; splits: { category_id: number; amount: number; note?: string | null }[] }) =>
      api.post("/split-rules", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["split-rules"] }),
  });
}

export function useDeleteSplitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/split-rules/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["split-rules"] }),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; category_id?: number | null; note?: string }) =>
      api.patch(`/transactions/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}
