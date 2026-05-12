export const chartPalette = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#8b5cf6",
];

const vndFormatter = new Intl.NumberFormat("vi-VN");

export function formatCurrencyVnd(value) {
  return `${vndFormatter.format(value)} ₫`;
}

export function formatInteger(value) {
  return vndFormatter.format(value);
}

export function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export function formatQueryString(filters) {
  const params = new URLSearchParams();
  if (filters.location) params.set("location", filters.location);
  if (filters.paymentMethod) params.set("payment_method", filters.paymentMethod);
  params.set("time_granularity", filters.timeGranularity || "month");
  return params.toString();
}

