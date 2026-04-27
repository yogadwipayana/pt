export const adminNavItems = [
  { label: "Overview", href: "/admin" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Users", href: "/admin/users" },
  { label: "Usage", href: "/admin/usage" },
  { label: "Models", href: "/admin/models" },
  { label: "Plans", href: "/admin/plans" },
  { label: "Audit", href: "/admin/audit" },
] as const;

export const adminCopy = {
  signInTitle: "Admin sign in",
  signInDescription: "Use your Dwipa admin credential to access operational tools.",
  invalidLogin: "Email atau password admin tidak valid.",
  overviewTitle: "Admin overview",
  overviewDescription: "Monitor manual payments, user activity, API usage, and operational alerts.",
  paymentsTitle: "Manual payments",
  paymentsDescription: "Review pending transfer, submitted top-up, and Dwipa Pro payments.",
  paymentDetailTitle: "Payment detail",
  usersTitle: "Users",
  usersDescription: "Search users and inspect billing, plan, key, and usage state.",
  usageTitle: "Usage logs",
  usageDescription: "Review metadata-only API usage across users.",
  modelsTitle: "Model catalog",
  modelsDescription: "Manage model visibility, access, plan eligibility, and pricing display.",
  plansTitle: "Pricing plans",
  plansDescription: "Manage Free, Pro, and Pay as you go operational plan configuration.",
  auditTitle: "Audit log",
  auditDescription: "Inspect admin actions and operational changes.",
  emptyTitle: "No data yet",
  emptyDescription: "This view will populate from the Dwipa admin API once backend records exist.",
};

export function formatAdminDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMinorCurrency(amountMinor: number, currency: string) {
  const divisor = currency === "USD" ? 100 : 1;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(amountMinor / divisor);
}
