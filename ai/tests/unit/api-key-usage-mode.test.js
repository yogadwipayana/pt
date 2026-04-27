import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiKeyByValueMock = vi.fn();
const dbGetUserPaygCreditBalanceMock = vi.fn();

vi.mock("@/lib/localDb", async () => {
  return {
    getProviderConnections: vi.fn(),
    validateApiKey: vi.fn(),
    updateProviderConnection: vi.fn(),
    getSettings: vi.fn(),
    getApiKeyByValue: getApiKeyByValueMock,
  };
});

vi.mock("@/lib/adminPostgres", () => ({
  dbGetUserPaygCreditBalance: dbGetUserPaygCreditBalanceMock,
}));

vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: vi.fn(),
}));

vi.mock("open-sse/services/accountFallback.js", () => ({
  formatRetryAfter: vi.fn(),
  checkFallbackError: vi.fn(),
  isModelLockActive: vi.fn(() => false),
  buildModelLockUpdate: vi.fn(),
  getEarliestModelLockUntil: vi.fn(),
}));

vi.mock("@/shared/constants/providers.js", () => ({
  resolveProviderId: vi.fn((provider) => provider),
  FREE_PROVIDERS: {},
}));

vi.mock("../../src/sse/utils/logger.js", () => ({
  debug: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  request: vi.fn(),
  maskKey: vi.fn((value) => value),
}));

describe("API key usage mode access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGetUserPaygCreditBalanceMock.mockResolvedValue(0);
  });

  it("rejects payg-only keys when payg balance is zero", async () => {
    getApiKeyByValueMock.mockResolvedValue({
      id: "key_1",
      key: "sk-payg",
      userId: "user_1",
      usageMode: "payg",
      isActive: true,
    });

    const { validateApiKeyAccess } = await import("../../src/sse/services/auth.js");
    const result = await validateApiKeyAccess("sk-payg");

    expect(result).toMatchObject({
      valid: false,
      status: 402,
      code: "payg_balance_required",
      message: "Pay as you go balance is required for this API key.",
    });
    expect(dbGetUserPaygCreditBalanceMock).toHaveBeenCalledWith("user_1");
  });

  it("allows payg-only keys when payg balance is available", async () => {
    getApiKeyByValueMock.mockResolvedValue({
      id: "key_1",
      key: "sk-payg",
      userId: "user_1",
      usageMode: "payg",
      isActive: true,
    });
    dbGetUserPaygCreditBalanceMock.mockResolvedValue(5);

    const { validateApiKeyAccess } = await import("../../src/sse/services/auth.js");
    const result = await validateApiKeyAccess("sk-payg");

    expect(result).toMatchObject({
      valid: true,
      key: {
        id: "key_1",
        usageMode: "payg",
      },
    });
  });

  it("allows non-payg keys without checking payg balance", async () => {
    getApiKeyByValueMock.mockResolvedValue({
      id: "key_2",
      key: "sk-both",
      userId: "user_1",
      usageMode: "both",
      isActive: true,
    });

    const { validateApiKeyAccess } = await import("../../src/sse/services/auth.js");
    const result = await validateApiKeyAccess("sk-both");

    expect(result).toMatchObject({
      valid: true,
      key: {
        id: "key_2",
        usageMode: "both",
      },
    });
    expect(dbGetUserPaygCreditBalanceMock).not.toHaveBeenCalled();
  });
});
