import {
  addAdminUserPaygCredit,
  adminLogout,
  adminSignIn,
  approveAdminPayment,
  banAdminUser,
  changeAdminUserSubscription,
  createAdminModel,
  createManualPayment,
  createKey,
  deleteAdminModel,
  deleteAdminUser,
  disableAdminModel,
  enableAdminModel,
  errorResponse,
  getAdminAuditEvents,
  getAdminModels,
  getAdminOverview,
  getAdminPayment,
  getAdminPayments,
  getAdminPlans,
  getAdminSession,
  getAdminUsageRequests,
  getAdminUser,
  getAdminUsers,
  getBilling,
  getPublicModels,
  getPublicPlans,
  getSession,
  getUsage,
  getUsageRequests,
  listKeys,
  logout,
  patchKey,
  rejectAdminPayment,
  removeKey,
  resendOtp,
  signIn,
  signUp,
  updateAdminModel,
  updateSubscription,
  updateAdminUser,
  verifyOtp,
} from "@/lib/webApiDev";

export const dynamic = "force-dynamic";

function notFound() {
  return errorResponse(404, "not_found", "Web API endpoint not found.");
}

async function handleRequest(request, { params }) {
  const resolvedParams = await params;
  const path = resolvedParams.path || [];
  const pathname = `/${path.join("/")}`;

  if (request.method === "GET" && pathname === "/public/plans") {
    return getPublicPlans();
  }

  if (request.method === "GET" && pathname === "/public/models") {
    return getPublicModels(request);
  }

  if (request.method === "GET" && pathname === "/auth/session") {
    return Response.json(await getSession(request));
  }

  if (request.method === "POST" && pathname === "/auth/sign-in") {
    return signIn(request);
  }

  if (request.method === "POST" && pathname === "/auth/sign-up") {
    return signUp(request);
  }

  if (request.method === "POST" && pathname === "/auth/otp/verify") {
    return verifyOtp(request);
  }

  if (request.method === "POST" && pathname === "/auth/otp/resend") {
    return resendOtp(request);
  }

  if (request.method === "POST" && pathname === "/auth/logout") {
    return logout();
  }

  if (request.method === "GET" && pathname === "/admin/auth/session") {
    return Response.json(await getAdminSession(request));
  }

  if (request.method === "POST" && pathname === "/admin/auth/sign-in") {
    return adminSignIn(request);
  }

  if (request.method === "POST" && pathname === "/admin/auth/logout") {
    return adminLogout();
  }

  if (request.method === "GET" && pathname === "/admin/overview") {
    return getAdminOverview(request);
  }

  if (request.method === "GET" && pathname === "/admin/payments") {
    return getAdminPayments(request);
  }

  if (path[0] === "admin" && path[1] === "payments" && path[2]) {
    const paymentId = decodeURIComponent(path[2]);
    if (request.method === "GET" && !path[3]) {
      return getAdminPayment(request, paymentId);
    }
    if (request.method === "POST" && path[3] === "approve") {
      return approveAdminPayment(request, paymentId);
    }
    if (request.method === "POST" && path[3] === "reject") {
      return rejectAdminPayment(request, paymentId);
    }
  }

  if (request.method === "GET" && pathname === "/admin/users") {
    return getAdminUsers(request);
  }

  if (path[0] === "admin" && path[1] === "users" && path[2]) {
    const userId = decodeURIComponent(path[2]);
    if (request.method === "GET" && !path[3]) {
      return getAdminUser(request, userId);
    }
    if (request.method === "PATCH" && !path[3]) {
      return updateAdminUser(request, userId);
    }
    if (request.method === "DELETE" && !path[3]) {
      return deleteAdminUser(request, userId);
    }
    if (request.method === "POST" && path[3] === "ban") {
      return banAdminUser(request, userId);
    }
    if (request.method === "POST" && path[3] === "credits" && path[4] === "payg") {
      return addAdminUserPaygCredit(request, userId);
    }
    if (request.method === "POST" && path[3] === "subscription" && path[4] === "change") {
      return changeAdminUserSubscription(request, userId);
    }
  }

  if (request.method === "GET" && pathname === "/admin/usage/requests") {
    return getAdminUsageRequests(request);
  }

  if (request.method === "GET" && pathname === "/admin/models") {
    return getAdminModels(request);
  }

  if (request.method === "POST" && pathname === "/admin/models") {
    return createAdminModel(request);
  }

  if (path[0] === "admin" && path[1] === "models" && path[2]) {
    const modelId = decodeURIComponent(path[2]);
    if (request.method === "DELETE" && !path[3]) {
      return deleteAdminModel(request, modelId);
    }
    if (request.method === "PATCH" && !path[3]) {
      return updateAdminModel(request, modelId);
    }
    if (request.method === "POST" && path[3] === "enable") {
      return enableAdminModel(request, modelId);
    }
    if (request.method === "POST" && path[3] === "disable") {
      return disableAdminModel(request, modelId);
    }
  }

  if (request.method === "GET" && pathname === "/admin/plans") {
    return getAdminPlans(request);
  }

  if (request.method === "GET" && pathname === "/admin/audit-events") {
    return getAdminAuditEvents(request);
  }

  if (request.method === "GET" && pathname === "/me/usage") {
    return getUsage(request);
  }

  if (request.method === "GET" && pathname === "/me/usage/requests") {
    return getUsageRequests(request);
  }

  if (request.method === "GET" && pathname === "/me/keys") {
    return listKeys(request);
  }

  if (request.method === "POST" && pathname === "/me/keys") {
    return createKey(request);
  }

  if (path[0] === "me" && path[1] === "keys" && path[2]) {
    const keyId = decodeURIComponent(path[2]);
    if (request.method === "PATCH") {
      return patchKey(request, keyId);
    }
    if (request.method === "DELETE") {
      return removeKey(request, keyId);
    }
  }

  if (request.method === "GET" && pathname === "/me/billing") {
    return getBilling(request);
  }

  if (request.method === "POST" && pathname === "/me/billing/subscription") {
    return updateSubscription(request);
  }

  if (request.method === "POST" && pathname === "/me/billing/manual-payments") {
    return createManualPayment(request);
  }

  return notFound();
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
