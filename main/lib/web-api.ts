export type WebApiErrorDetail = {
  field?: string;
  message: string;
};

export type WebApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: WebApiErrorDetail[];
  };
};

export class WebApiError extends Error {
  code: string;
  status: number;
  details: WebApiErrorDetail[];

  constructor(message: string, status: number, code = "request_failed", details: WebApiErrorDetail[] = []) {
    super(message);
    this.name = "WebApiError";
    this.code = code;
    this.status = status;
    this.details = Array.isArray(details) ? details : [];
  }

  getFieldMessage(field: string) {
    return this.details.find((detail) => detail.field === field)?.message;
  }
}

export type PublicPlan = {
  slug: "free" | "pro" | "payg" | string;
  name: string;
  priceLabel: string;
  periodLabel: string | null;
  includedCreditUsd?: number;
  windowHours?: number | null;
  discountPercent?: number;
  description: string;
  ctaLabel: string;
  highlighted?: boolean;
  billingType: "free" | "recurring" | "metered" | string;
  entitlements: { label: string; value: string }[];
};

export type PublicModel = {
  slug: string;
  name: string;
  provider: string;
  providerCode: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
  modelId: string;
};

export type SessionResponse = {
  authenticated: boolean;
  expiresAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    planSlug: string;
  } | null;
  profile?: Profile | null;
};

export type AuthSuccessResponse = {
  session: SessionResponse;
  redirectTo: string;
};

export type OtpChallengeResponse = {
  challengeId: string;
  channel: "email_otp";
  email: string;
  maskedDestination: string;
  expiresAt: string;
  retryAfterSeconds?: number | null;
  redirectTo: string;
  debugOtp?: string;
  delivery?: {
    status: "failed" | string;
    message?: string;
  };
};

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  planSlug: string;
  avatarUrl: string | null;
  company: string | null;
  timezone: string | null;
  bio: string | null;
};

export type UsageMeter = {
  id: string;
  label: string;
  description: string;
  valueDisplay: string;
  totalDisplay: string;
  progressPercent: number;
  resetsAt: string | null;
  countdownText: string | null;
};

export type UsageOverviewResponse = {
  planSlug: string;
  canUpgrade: boolean;
  meters: UsageMeter[];
};

export type UsageRequestSummary = {
  id: string;
  provider: string;
  model: string;
  appLabel: string | null;
  status: string;
  costDisplay: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number | null;
  createdAt: string;
  charge: {
    chargedCostUsd: number;
    countedTowardQuotaUsd: number;
    planSlug?: string;
  } | null;
};

export type UsageRequestsResponse = {
  items: UsageRequestSummary[];
  nextCursor: string | null;
};

export type ApiKeyUsageMode = "subscription" | "payg" | "both";

export type ApiKeySummary = {
  id: string;
  label: string;
  maskedKey: string;
  usageMode?: ApiKeyUsageMode;
  createdAt: string;
  lastUsedAt: string | null;
};

export type CreateApiKeyResponse = {
  key: ApiKeySummary;
  secret: string;
};

export type UpdateApiKeyResponse = {
  key: ApiKeySummary;
};

export type SubscriptionSummary = {
  id?: string;
  planSlug: string;
  planName: string;
  status: "active" | "renew_off" | string;
  autoRenew: boolean;
  renewsAt: string | null;
  price: {
    currency: string;
    amount: number;
    interval: string;
  } | null;
};

export type BillingOverviewResponse = {
  subscription: SubscriptionSummary | null;
  creditBalance: {
    currency: string;
    amount: number;
    displayValue: string;
  };
  availableActions: {
    canManageRenewal: boolean;
    canAddFunds: boolean;
    canCreateManualPayment: boolean;
  };
};

export type PaymentDestination = {
  provider: string;
  displayName: string;
  accountNumber: string;
  accountHolderName: string;
  instructions: string;
  isActive: boolean;
  updatedAt: string;
};

export type ManualPayment = {
  id: string;
  purpose: "upgrade_plan" | "add_funds" | string;
  status: string;
  planSlug: string | null;
  amountMinor: number;
  currency: string;
  referenceCode: string;
  expiresAt: string;
  createdAt: string;
  destination: PaymentDestination | null;
};

export type CreateManualPaymentResponse = {
  payment: ManualPayment;
};

export type AdminSessionResponse = {
  authenticated: boolean;
  expiresAt: string | null;
  admin: { email: string } | null;
};

export type AdminSignInResponse = {
  session: AdminSessionResponse;
  redirectTo: string;
};

export type AdminChartPoint = {
  label: string;
  value: number;
};

export type AdminMetric = {
  id: string;
  label: string;
  value: string;
  description: string;
};

export type AdminOverviewResponse = {
  metrics: AdminMetric[];
  workQueue: {
    payments: AdminPaymentSummary[];
    users: AdminUserSummary[];
    requests: AdminUsageRequestSummary[];
  };
  charts: {
    requests: AdminChartPoint[];
    revenue: AdminChartPoint[];
    errors: AdminChartPoint[];
  };
};

export type AdminPaymentSummary = {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  purpose: "upgrade_plan" | "add_funds" | string;
  status: string;
  statusLabel?: string;
  planSlug: string | null;
  amountMinor: number;
  amountDisplay?: string;
  currency: string;
  referenceCode: string;
  senderName: string | null;
  senderReference: string | null;
  notes?: string | null;
  submittedAt: string | null;
  transferredAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type AdminPaymentDetail = AdminPaymentSummary & {
  approvedByAdminEmail?: string | null;
  rejectedByAdminEmail?: string | null;
  destination: PaymentDestination | null;
  user: { id: string; email: string; name: string; planSlug: string; status?: string };
};

export type AdminPaymentsResponse = {
  items: AdminPaymentSummary[];
  nextCursor: string | null;
  summary: Record<string, string | number>;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string;
  planSlug: string;
  status?: string;
  creditBalanceDisplay: string;
  createdAt: string;
  lastSeenAt: string | null;
};

export type AdminUserDetail = AdminUserSummary & {
  profile?: {
    username: string | null;
    company: string | null;
    timezone: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
  subscription?: (SubscriptionSummary & { autoRenew: boolean }) | null;
  apiKeys: ApiKeySummary[];
  recentUsage: AdminUsageRequestSummary[];
  recentPayments: AdminPaymentSummary[];
  charts?: { usage: AdminChartPoint[] };
};

export type AdminUsersResponse = {
  items: AdminUserSummary[];
  nextCursor: string | null;
  summary: Record<string, string | number>;
};

export type AdminUsageRequestSummary = UsageRequestSummary & {
  userId?: string;
  userEmail?: string;
  requestId?: string;
  apiKeyId?: string | null;
  machineId?: string | null;
  chargedCostUsd?: number;
  chargedCostDisplay?: string;
  countedTowardQuotaUsd?: number;
  errorCode?: string | null;
};

export type AdminUsageRequestsResponse = {
  items: AdminUsageRequestSummary[];
  nextCursor: string | null;
  summary: Record<string, string | number>;
  charts: { requests: AdminChartPoint[]; tokens: AdminChartPoint[]; cost: AdminChartPoint[] };
};

export type AdminModelSummary = {
  id: string;
  slug: string;
  name: string;
  provider: string;
  providerCode: string;
  summary: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
  latency: string;
  modelId: string;
  category: string;
  visibility: "visible" | "hidden" | string;
  accessState: "enabled" | "disabled" | string;
  allowedPlanSlugs: string[];
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt: string;
};

export type AdminModelsResponse = {
  items: AdminModelSummary[];
  nextCursor: string | null;
  summary: Record<string, string | number>;
};

export type AdminPlanSummary = PublicPlan & {
  id: string;
  priceMinor?: number;
  priceDisplay?: string;
  currency: string;
  interval: string | null;
  active: boolean;
  visible: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
  updatedAt: string;
};

export type AdminPlansResponse = {
  plans: AdminPlanSummary[];
};

export type AdminAuditEvent = {
  id: string;
  actorAdminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type AdminAuditEventsResponse = {
  items: AdminAuditEvent[];
  nextCursor: string | null;
  summary: Record<string, string | number>;
};

export type AdminPaygCreditAdjustmentResponse = {
  userId: string;
  updatedBalanceDisplay: string;
  ledgerEntryId: string;
};

export type AdminSubscriptionChangeResponse = {
  userId: string;
  previousPlanSlug: string | null;
  currentPlanSlug: string;
  effectiveAt: string;
  subscriptionId: string | null;
};

export type AdminUserUpdateResponse = {
  user: AdminUserDetail | AdminUserSummary;
};

export type AdminUserBanResponse = {
  user: AdminUserDetail | AdminUserSummary;
  action: "banned" | "unbanned" | string;
};

export type AdminUserDeleteResponse = {
  userId: string;
  deletedAt: string;
};

export type AdminModelDetailResponse = {
  model: AdminModelSummary | null;
  modelId?: string;
};

export type AdminPlanDetailResponse = {
  plan: AdminPlanSummary | null;
  planId?: string;
};

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

const defaultServerWebApiBaseUrl = "http://localhost:4000/api/web/v1";
const browserWebApiBaseUrl = "/api/web/v1";

function getServerWebApiBaseUrl() {
  return (
    process.env.WEB_API_BASE_URL ||
    process.env.NEXT_PUBLIC_WEB_API_BASE_URL ||
    defaultServerWebApiBaseUrl
  );
}

function getWebApiBaseUrl() {
  return typeof window === "undefined" ? getServerWebApiBaseUrl() : browserWebApiBaseUrl;
}

export const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function buildUrl(path: string) {
  const baseUrl = getWebApiBaseUrl().replace(/\/$/, "");
  const normalizedPath = `/${path.replace(/^\//, "")}`;

  if (/^https?:\/\//.test(baseUrl)) {
    return new URL(normalizedPath.replace(/^\//, ""), `${baseUrl}/`).toString();
  }

  return `${baseUrl}${normalizedPath}`;
}

async function parseError(response: Response) {
  let body: WebApiErrorBody | null = null;

  try {
    body = (await response.json()) as WebApiErrorBody;
  } catch {
    body = null;
  }

  const error = body?.error;
  return new WebApiError(
    error?.message || `Request failed with status ${response.status}.`,
    response.status,
    error?.code,
    error?.details,
  );
}

export async function webApiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  const init: RequestInit = {
    ...requestOptions,
    headers,
    credentials: "include",
  };

  if (body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path), init);

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function buildQuery(params?: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const webApi = {
  getPublicModels: (init?: ApiRequestOptions) =>
    webApiRequest<{ items: PublicModel[]; total: number }>("/public/models", init),
  getPublicPlans: (init?: ApiRequestOptions) =>
    webApiRequest<{ plans: PublicPlan[] }>("/public/plans", init),
  getSession: (init?: ApiRequestOptions) => webApiRequest<SessionResponse>("/auth/session", init),
  logout: () => webApiRequest<void>("/auth/logout", { method: "POST" }),
  signIn: (body: { email: string; password: string }) =>
    webApiRequest<AuthSuccessResponse>("/auth/sign-in", { method: "POST", body }),
  signUp: (body: { fullName: string; email: string; password: string }) =>
    webApiRequest<OtpChallengeResponse>("/auth/sign-up", { method: "POST", body }),
  verifyOtp: (body: { challengeId: string; otpCode: string }) =>
    webApiRequest<AuthSuccessResponse>("/auth/otp/verify", { method: "POST", body }),
  resendOtp: (body: { challengeId: string }) =>
    webApiRequest<OtpChallengeResponse>("/auth/otp/resend", { method: "POST", body }),
  getUsage: (init?: ApiRequestOptions) => webApiRequest<UsageOverviewResponse>("/me/usage", init),
  getUsageRequests: (params?: { limit?: number; cursor?: string | null; hasTokens?: boolean }, init?: ApiRequestOptions) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.hasTokens) searchParams.set("hasTokens", "true");
    const query = searchParams.toString();
    return webApiRequest<UsageRequestsResponse>(`/me/usage/requests${query ? `?${query}` : ""}`, init);
  },
  getKeys: (init?: ApiRequestOptions) => webApiRequest<{ keys: ApiKeySummary[] }>("/me/keys", init),
  createKey: (body: { label: string; usageMode: ApiKeyUsageMode }) =>
    webApiRequest<CreateApiKeyResponse>("/me/keys", { method: "POST", body }),
  updateKey: (keyId: string, body: { usageMode: ApiKeyUsageMode }) =>
    webApiRequest<UpdateApiKeyResponse>(`/me/keys/${encodeURIComponent(keyId)}`, { method: "PATCH", body }),
  deleteKey: (keyId: string) =>
    webApiRequest<void>(`/me/keys/${encodeURIComponent(keyId)}`, { method: "DELETE" }),
  getBilling: (init?: ApiRequestOptions) =>
    webApiRequest<BillingOverviewResponse>("/me/billing", init),
  updateSubscription: (body: { action: "renew" | "cancel" }) =>
    webApiRequest<SubscriptionSummary>("/me/billing/subscription", { method: "POST", body }),
  createManualPaymentIntent: (
    body:
      | { purpose: "add_funds"; amountMinor: number; notes?: string | null }
      | { purpose: "upgrade_plan"; planSlug: string; notes?: string | null },
  ) =>
    webApiRequest<CreateManualPaymentResponse>("/me/billing/manual-payments", { method: "POST", body }),
  getAdminSession: (init?: ApiRequestOptions) => webApiRequest<AdminSessionResponse>("/admin/auth/session", init),
  adminSignIn: (body: { email: string; password: string }) =>
    webApiRequest<AdminSignInResponse>("/admin/auth/sign-in", { method: "POST", body }),
  adminLogout: () => webApiRequest<void>("/admin/auth/logout", { method: "POST" }),
  getAdminOverview: (init?: ApiRequestOptions) => webApiRequest<AdminOverviewResponse>("/admin/overview", init),
  getAdminPayments: (params?: Record<string, string | number | null | undefined>, init?: ApiRequestOptions) =>
    webApiRequest<AdminPaymentsResponse>(`/admin/payments${buildQuery(params)}`, init),
  getAdminPayment: (paymentId: string, init?: ApiRequestOptions) =>
    webApiRequest<{ payment: AdminPaymentDetail | null; paymentId?: string }>(`/admin/payments/${encodeURIComponent(paymentId)}`, init),
  approveAdminPayment: (paymentId: string, body: { note?: string | null; idempotencyKey: string }) =>
    webApiRequest<AdminPaymentDetail | { paymentId: string; status: string; updatedAt: string }>(
      `/admin/payments/${encodeURIComponent(paymentId)}/approve`,
      { method: "POST", body },
    ),
  rejectAdminPayment: (paymentId: string, body: { reason: string; note?: string | null; idempotencyKey: string }) =>
    webApiRequest<AdminPaymentDetail | { paymentId: string; status: string; updatedAt: string }>(
      `/admin/payments/${encodeURIComponent(paymentId)}/reject`,
      { method: "POST", body },
    ),
  getAdminUsers: (params?: Record<string, string | number | null | undefined>, init?: ApiRequestOptions) =>
    webApiRequest<AdminUsersResponse>(`/admin/users${buildQuery(params)}`, init),
  getAdminUser: (userId: string, init?: ApiRequestOptions) =>
    webApiRequest<{ user: AdminUserDetail | null; userId?: string }>(`/admin/users/${encodeURIComponent(userId)}`, init),
  addAdminUserPaygCredit: (
    userId: string,
    body: { amountMinor: number; currency?: string; reason: string; note?: string | null; idempotencyKey: string },
  ) =>
    webApiRequest<AdminPaygCreditAdjustmentResponse>(`/admin/users/${encodeURIComponent(userId)}/credits/payg`, {
      method: "POST",
      body,
    }),
  changeAdminUserSubscription: (
    userId: string,
    body: {
      targetPlanSlug: string;
      effectiveMode: "immediate" | "next_renewal";
      reason: string;
      note?: string | null;
      idempotencyKey: string;
    },
  ) =>
    webApiRequest<AdminSubscriptionChangeResponse>(`/admin/users/${encodeURIComponent(userId)}/subscription/change`, {
      method: "POST",
      body,
    }),
  updateAdminUser: (
    userId: string,
    body: { email: string; name: string; planSlug: string; reason: string },
  ) =>
    webApiRequest<AdminUserUpdateResponse>(`/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body,
    }),
  banAdminUser: (
    userId: string,
    body: { reason: string },
  ) =>
    webApiRequest<AdminUserBanResponse>(`/admin/users/${encodeURIComponent(userId)}/ban`, {
      method: "POST",
      body,
    }),
  deleteAdminUser: (
    userId: string,
    body: { reason: string },
  ) =>
    webApiRequest<AdminUserDeleteResponse>(`/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      body,
    }),
  getAdminUsageRequests: (params?: Record<string, string | number | null | undefined>, init?: ApiRequestOptions) =>
    webApiRequest<AdminUsageRequestsResponse>(`/admin/usage/requests${buildQuery(params)}`, init),
  getAdminModels: (params?: Record<string, string | number | null | undefined>, init?: ApiRequestOptions) =>
    webApiRequest<AdminModelsResponse>(`/admin/models${buildQuery(params)}`, init),
  getAdminModel: (modelId: string, init?: ApiRequestOptions) =>
    webApiRequest<AdminModelDetailResponse>(`/admin/models/${encodeURIComponent(modelId)}`, init),
  createAdminModel: (body: {
    slug: string;
    name: string;
    provider: string;
    providerCode: string;
    modelId: string;
    contextWindow?: string;
    inputPrice?: string;
    outputPrice?: string;
    visibility?: string;
    accessState?: string;
    allowedPlanSlugs?: string[];
    metadata?: Record<string, unknown> | null;
  }) => webApiRequest<AdminModelDetailResponse>("/admin/models", { method: "POST", body }),
  updateAdminModel: (modelId: string, body: {
    slug?: string;
    name?: string;
    provider?: string;
    providerCode?: string;
    modelId?: string;
    contextWindow?: string;
    inputPrice?: string;
    outputPrice?: string;
    visibility?: string;
    accessState?: string;
    allowedPlanSlugs?: string[];
    metadata?: Record<string, unknown> | null;
  }) => webApiRequest<AdminModelDetailResponse>(`/admin/models/${encodeURIComponent(modelId)}`, { method: "PATCH", body }),
  enableAdminModel: (modelId: string) =>
    webApiRequest<AdminModelDetailResponse>(`/admin/models/${encodeURIComponent(modelId)}/enable`, { method: "POST" }),
  disableAdminModel: (modelId: string) =>
    webApiRequest<AdminModelDetailResponse>(`/admin/models/${encodeURIComponent(modelId)}/disable`, { method: "POST" }),
  deleteAdminModel: (modelId: string) =>
    webApiRequest<{ modelId: string; deletedAt: string }>(`/admin/models/${encodeURIComponent(modelId)}`, { method: "DELETE" }),
  getAdminPlans: (init?: ApiRequestOptions) => webApiRequest<AdminPlansResponse>("/admin/plans", init),
  getAdminPlan: (planId: string, init?: ApiRequestOptions) =>
    webApiRequest<AdminPlanDetailResponse>(`/admin/plans/${encodeURIComponent(planId)}`, init),
  updateAdminPlan: (planId: string, body: {
    name?: string;
    description?: string;
    billingType?: string;
    priceMinor?: number;
    currency?: string;
    interval?: string | null;
    includedCreditUsd?: number | null;
    windowHours?: number | null;
    discountPercent?: number | null;
    active?: boolean;
    visible?: boolean;
    sortOrder?: number;
    metadata?: Record<string, unknown> | null;
  }) => webApiRequest<AdminPlanDetailResponse>(`/admin/plans/${encodeURIComponent(planId)}`, { method: "PATCH", body }),
  publishAdminPlan: (planId: string) =>
    webApiRequest<AdminPlanDetailResponse>(`/admin/plans/${encodeURIComponent(planId)}/publish`, { method: "POST" }),
  getAdminAuditEvents: (params?: Record<string, string | number | null | undefined>, init?: ApiRequestOptions) =>
    webApiRequest<AdminAuditEventsResponse>(`/admin/audit-events${buildQuery(params)}`, init),
};

export function getOAuthAuthorizeUrl(provider: "google", intent: "sign-in" | "sign-up", returnTo: string) {
  const authBaseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : siteBaseUrl;
  const url = new URL(
    `api/web/v1/auth/oauth/${provider}/authorize`,
    `${authBaseUrl.replace(/\/$/, "")}/`,
  );
  const callbackUrl = returnTo.startsWith("http") ? returnTo : new URL(returnTo, siteBaseUrl).toString();
  url.searchParams.set("intent", intent);
  url.searchParams.set("returnTo", callbackUrl);
  return url.toString();
}
