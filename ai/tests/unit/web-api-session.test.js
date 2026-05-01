import { beforeEach, describe, expect, it, vi } from "vitest";

const jwtVerifyMock = vi.fn();
const dbCreateAuthUserMock = vi.fn();
const dbEnsureAuthUserSignupQuotaMock = vi.fn();
const dbGetAuthUserByEmailMock = vi.fn();
const dbGetUserPaygCreditBalanceMock = vi.fn();
const dbGetAdminOverviewMock = vi.fn();
const getRequestDetailsMock = vi.fn();
const getApiKeysMock = vi.fn();

vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "signed-token";
    }
  },
  jwtVerify: jwtVerifyMock,
}));

vi.mock("@/lib/adminPostgres", () => ({
  dbAddAdminUserPaygCredit: vi.fn(),
  dbApproveAdminPayment: vi.fn(),
  dbCreateAuthUser: dbCreateAuthUserMock,
  dbEnsureAuthUserSignupQuota: dbEnsureAuthUserSignupQuotaMock,
  dbCreateManualPayment: vi.fn(),
  dbGetAuthUserByEmail: dbGetAuthUserByEmailMock,
  dbChangeAdminUserSubscription: vi.fn(),
  dbDeleteAdminUser: vi.fn(),
  dbGetAdminAuditEvents: vi.fn(),
  dbGetAdminModels: vi.fn(),
  dbGetAdminOverview: dbGetAdminOverviewMock,
  dbGetAdminPayment: vi.fn(),
  dbGetAdminPayments: vi.fn(),
  dbGetAdminPlans: vi.fn(),
  dbGetAdminUsageRequests: vi.fn(),
  dbGetAdminUser: vi.fn(),
  dbGetUserPaygCreditBalance: dbGetUserPaygCreditBalanceMock,
  dbGetAdminUsers: vi.fn(),
  dbIsDeletedUserEmailReserved: vi.fn(),
  dbRejectAdminPayment: vi.fn(),
  dbToggleAdminUserBan: vi.fn(),
  dbUpdateAdminUser: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  getApiKeyById: vi.fn(),
  getApiKeys: getApiKeysMock,
  getSettings: vi.fn(async () => null),
  updateApiKey: vi.fn(),
}));

vi.mock("../../src/lib/usageDb.js", () => ({
  getRequestDetails: getRequestDetailsMock,
}));

vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: vi.fn(),
}));

vi.mock("@/shared/constants/models", () => ({
  PROVIDER_MODELS: {},
}));

vi.mock("@/shared/constants/pricing", () => ({
  MODEL_PRICING: {},
}));

vi.mock("@/shared/constants/providers", () => ({
  AI_PROVIDERS: {},
}));

describe("webApiDev session hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEB_API_DEV_EMAIL = "user@example.com";
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "legacy_cookie_user_id",
        email: "user@example.com",
        name: "Cookie User",
        planSlug: "free",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });
    dbCreateAuthUserMock.mockResolvedValue(null);
    dbEnsureAuthUserSignupQuotaMock.mockResolvedValue(undefined);
    dbGetUserPaygCreditBalanceMock.mockResolvedValue(0);
    getRequestDetailsMock.mockResolvedValue({ details: [] });
    getApiKeysMock.mockResolvedValue([]);
    dbGetAdminOverviewMock.mockResolvedValue({
      metrics: [],
      workQueue: { payments: [], users: [], requests: [] },
      charts: { requests: [], revenue: [], errors: [] },
    });
    dbGetAuthUserByEmailMock.mockResolvedValue({
      id: "db_user_123",
      email: "user@example.com",
      name: "Persisted User",
      planSlug: "free",
      creditBalanceUsd: 0,
      username: "user",
      company: null,
      timezone: "Asia/Makassar",
      bio: null,
      avatarUrl: null,
    });
  });

  it("returns the persisted user id instead of a stale JWT subject", async () => {
    const { getSession } = await import("../../src/lib/webApiDev.js");

    const session = await getSession(
      new Request("http://localhost/api/web/v1/auth/session", {
        headers: {
          cookie: "dwipa_user_session=stale-token",
        },
      }),
    );

    expect(session.authenticated).toBe(true);
    expect(session.user?.id).toBe("db_user_123");
    expect(session.user?.id).not.toBe("legacy_cookie_user_id");
    expect(dbEnsureAuthUserSignupQuotaMock).toHaveBeenCalledWith("db_user_123");
  });

  it("keeps free users on a zero payg balance by default", async () => {
    const { getBilling } = await import("../../src/lib/webApiDev.js");

    const response = await getBilling(
      new Request("http://localhost/api/web/v1/me/billing", {
        headers: {
          cookie: "dwipa_user_session=stale-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      subscription: null,
      creditBalance: {
        currency: "USD",
        amount: 0,
        displayValue: "$0",
      },
    });
  });

  it("reports pro usage as plan credit with the active quota balance", async () => {
    dbGetAuthUserByEmailMock.mockResolvedValue({
      id: "db_user_pro",
      email: "user@example.com",
      name: "Persisted User",
      planSlug: "pro",
      creditBalanceUsd: 10,
      username: "user",
      company: null,
      timezone: "Asia/Makassar",
      bio: null,
      avatarUrl: null,
    });

    const { getUsage } = await import("../../src/lib/webApiDev.js");
    const response = await getUsage(
      new Request("http://localhost/api/web/v1/me/usage", {
        headers: {
          cookie: "dwipa_user_session=stale-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      planSlug: "pro",
      canUpgrade: false,
      meters: [
        {
          id: "credit-balance",
          label: "Plan credit",
          description: "Dwipa Pro includes $10 of credit every 12 hours.",
          valueDisplay: "$10",
          totalDisplay: "$10",
          countdownText: "Renews every 12 hours",
        },
      ],
    });
  });

  it("keeps billing payg balance at zero for pro users without payg top-ups", async () => {
    dbGetAuthUserByEmailMock.mockResolvedValue({
      id: "db_user_pro",
      email: "user@example.com",
      name: "Persisted User",
      planSlug: "pro",
      creditBalanceUsd: 10,
      username: "user",
      company: null,
      timezone: "Asia/Makassar",
      bio: null,
      avatarUrl: null,
    });
    dbGetUserPaygCreditBalanceMock.mockResolvedValueOnce(0);

    const { getBilling } = await import("../../src/lib/webApiDev.js");
    const response = await getBilling(
      new Request("http://localhost/api/web/v1/me/billing", {
        headers: {
          cookie: "dwipa_user_session=stale-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      subscription: {
        planSlug: "pro",
        planName: "Pro",
      },
      creditBalance: {
        currency: "USD",
        amount: 0,
        displayValue: "$0",
      },
    });
  });

  it("shows payg balance only when admin has added payg credit", async () => {
    dbGetUserPaygCreditBalanceMock.mockResolvedValueOnce(7.5);

    const { getBilling } = await import("../../src/lib/webApiDev.js");
    const response = await getBilling(
      new Request("http://localhost/api/web/v1/me/billing", {
        headers: {
          cookie: "dwipa_user_session=stale-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      subscription: null,
      creditBalance: {
        currency: "USD",
        amount: 7.5,
        displayValue: "$7.5",
      },
    });
  });

  it("maps payment_required request details into settings logs", async () => {
    getApiKeysMock.mockResolvedValueOnce([
      { id: "key_1", userId: null, name: "PAYG1", key: "sk-payg" },
    ]);
    getRequestDetailsMock.mockResolvedValueOnce({
      details: [
        {
          id: "req_payg_1",
          provider: "dwipa",
          model: "openai/gpt-4.1-mini",
          userId: null,
          apiKeyId: "key_1",
          appLabel: "PAYG1",
          planSlug: "payg",
          timestamp: "2026-04-26T09:00:00.000Z",
          status: "payment_required",
          latency: { total: 0 },
          tokens: { prompt_tokens: 0, completion_tokens: 0 },
          response: { error: "Pay as you go balance is required for this API key.", status: 402 },
        },
      ],
    });

    const { getUsageRequests } = await import("../../src/lib/webApiDev.js");
    const response = await getUsageRequests(
      new Request("http://localhost/api/web/v1/me/usage/requests?limit=10", {
        headers: {
          cookie: "dwipa_user_session=stale-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        {
          id: "req_payg_1",
          model: "openai/gpt-4.1-mini",
          appLabel: "PAYG1",
          status: "payment_required",
          costDisplay: "$0",
          charge: {
            planSlug: "payg",
            chargedCostUsd: 0,
            countedTowardQuotaUsd: 0,
          },
        },
      ],
      nextCursor: null,
    });
  });

  it("maps payment_required request details into admin usage", async () => {
    jwtVerifyMock.mockResolvedValueOnce({
      payload: {
        email: "admin@example.com",
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });
    getRequestDetailsMock.mockResolvedValueOnce({
      details: [
        {
          id: "req_payg_2",
          provider: "dwipa",
          model: "openai/gpt-4.1-mini",
          userId: "db_user_123",
          appLabel: "PAYG1",
          planSlug: "payg",
          timestamp: "2026-04-26T09:01:00.000Z",
          status: "payment_required",
          latency: { total: 0 },
          tokens: { prompt_tokens: 0, completion_tokens: 0 },
          response: { error: "Pay as you go balance is required for this API key.", status: 402 },
        },
      ],
    });

    const { getAdminUsageRequests } = await import("../../src/lib/webApiDev.js");
    const response = await getAdminUsageRequests(
      new Request("http://localhost/api/web/v1/admin/usage?limit=10", {
        headers: {
          cookie: "dwipa_admin_session=admin-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        {
          id: "req_payg_2",
          model: "openai/gpt-4.1-mini",
          appLabel: "PAYG1",
          status: "payment_required",
          chargedCostDisplay: "$0",
          charge: {
            planSlug: "payg",
          },
        },
      ],
      summary: {
        requests: 1,
        failedRequests: 1,
      },
      nextCursor: null,
    });
  });

  it("uses dev request details for admin overview request metrics", async () => {
    jwtVerifyMock.mockResolvedValueOnce({
      payload: {
        email: "admin@example.com",
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    dbGetAdminOverviewMock.mockResolvedValueOnce({
      metrics: [
        { id: "users", label: "Users", value: "8", description: "Registered accounts in PostgreSQL." },
        { id: "requests", label: "Requests today", value: "0", description: "Usage requests recorded today." },
        { id: "failed", label: "Failed today", value: "0", description: "Failed or rejected requests today." },
      ],
      workQueue: { payments: [], users: [], requests: [] },
      charts: { requests: [], revenue: [], errors: [] },
    });
    getRequestDetailsMock.mockResolvedValueOnce({
      details: [
        {
          id: "req_today_success",
          provider: "openai",
          model: "gpt-5.4",
          timestamp: today,
          status: "success",
          tokens: { prompt_tokens: 10, completion_tokens: 5 },
        },
        {
          id: "req_today_failed",
          provider: "openai",
          model: "gpt-5.4",
          timestamp: today,
          status: "error",
          tokens: { prompt_tokens: 3, completion_tokens: 0 },
        },
        {
          id: "req_yesterday",
          provider: "openai",
          model: "gpt-5.4",
          timestamp: yesterday,
          status: "success",
          tokens: { prompt_tokens: 1, completion_tokens: 1 },
        },
      ],
    });

    const { getAdminOverview } = await import("../../src/lib/webApiDev.js");
    const response = await getAdminOverview(
      new Request("http://localhost/api/web/v1/admin/overview", {
        headers: {
          cookie: "dwipa_admin_session=admin-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      metrics: [
        { id: "users", value: "8" },
        { id: "requests", value: "2" },
        { id: "failed", value: "1" },
      ],
      workQueue: {
        requests: [
          { id: "req_today_success" },
          { id: "req_today_failed" },
          { id: "req_yesterday" },
        ],
      },
      charts: {
        requests: expect.arrayContaining([
          { label: today.slice(0, 10), value: 2 },
          { label: yesterday.slice(0, 10), value: 1 },
        ]),
        errors: expect.arrayContaining([
          { label: today.slice(0, 10), value: 1 },
          { label: yesterday.slice(0, 10), value: 0 },
        ]),
      },
    });
  });

  it("maps persisted success cost into settings logs and admin usage", async () => {
    getApiKeysMock.mockResolvedValue([
      { id: "key_cost_1", userId: "db_user_123", name: "PAYG1", key: "sk-payg" },
    ]);
    getRequestDetailsMock.mockResolvedValue({
      details: [
        {
          id: "req_cost_1",
          provider: "openai",
          model: "gpt-5.4",
          userId: "db_user_123",
          apiKeyId: "key_cost_1",
          appLabel: "PAYG1",
          planSlug: "payg",
          cost: 0.125,
          timestamp: "2026-04-26T10:00:00.000Z",
          status: "success",
          latency: { total: 1200 },
          tokens: { prompt_tokens: 1000, completion_tokens: 500 },
          response: {},
        },
      ],
    });

    const { getUsageRequests, getAdminUsageRequests } = await import("../../src/lib/webApiDev.js");

    const userResponse = await getUsageRequests(
      new Request("http://localhost/api/web/v1/me/usage/requests?limit=10", {
        headers: {
          cookie: "dwipa_user_session=stale-token",
        },
      }),
    );

    jwtVerifyMock.mockResolvedValueOnce({
      payload: {
        email: "admin@example.com",
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    const adminResponse = await getAdminUsageRequests(
      new Request("http://localhost/api/web/v1/admin/usage?limit=10", {
        headers: {
          cookie: "dwipa_admin_session=admin-token",
        },
      }),
    );

    expect(userResponse.status).toBe(200);
    await expect(userResponse.json()).resolves.toMatchObject({
      items: [
        {
          id: "req_cost_1",
          status: "success",
          costDisplay: "$0.13",
        },
      ],
      summary: {
        chargedCost: "$0.13",
      },
    });

    expect(adminResponse.status).toBe(200);
    await expect(adminResponse.json()).resolves.toMatchObject({
      items: [
        {
          id: "req_cost_1",
          status: "success",
          chargedCostDisplay: "$0.13",
        },
      ],
      summary: {
        chargedCost: "$0.13",
      },
    });
  });
});
