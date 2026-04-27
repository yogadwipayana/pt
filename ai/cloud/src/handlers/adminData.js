import { writeAdminAuditEvent } from "../services/adminAudit.js";
import { listAdminAuditEvents } from "../services/adminAudit.js";
import { requireAdmin } from "../services/adminAuth.js";
import { withAdminIdempotency } from "../services/adminIdempotency.js";
import { incrementCacheVersion } from "../services/adminRedis.js";
import {
  ADMIN_CACHE_VERSION_KEY,
  createModel,
  deleteModel,
  getOverview,
  getModelDetail,
  getPaymentDetail,
  getPlanDetail,
  getUserDetail,
  listModels,
  listPayments,
  listPlans,
  listUsageRequests,
  listUsers,
  setModelAccessState,
  setUserBanState,
  deleteUser,
  updateModel,
  updatePlan,
  updateUser
} from "../services/adminRepository.js";
import { addPaygCredit, approvePayment, changeSubscription, rejectPayment } from "../services/billingAdmin.js";
import { errorResponse, jsonResponse, readJson } from "../utils/jsonResponse.js";

function getPathId(path, prefix) {
  const rest = path.slice(prefix.length).replace(/^\//, "");
  return decodeURIComponent(rest.split("/")[0] || "");
}

async function requireAdminSession(request, env) {
  const auth = await requireAdmin(request, env);
  return auth.response ? { response: auth.response } : { session: auth.session };
}

function responseFromService(result) {
  if (result?.body?.error) return jsonResponse(result.body, result.status || 400);
  return jsonResponse(result?.body ?? result, result?.status || 200);
}

async function bumpAdminCache(env) {
  await incrementCacheVersion(env, ADMIN_CACHE_VERSION_KEY);
}

async function recordAdminAudit(env, session, event) {
  await writeAdminAuditEvent(env, {
    actorEmail: session.email,
    ...event,
  });
}

export async function handleAdminData(request, env, path) {
  const auth = await requireAdminSession(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);

  if (path === "/api/web/v1/admin/overview" && request.method === "GET") {
    return jsonResponse(await getOverview(env));
  }

  if (path === "/api/web/v1/admin/payments" && request.method === "GET") {
    return jsonResponse(await listPayments(env, url));
  }

  if (path.endsWith("/approve") && request.method === "POST") {
    const paymentId = getPathId(path, "/api/web/v1/admin/payments");
    const body = await readJson(request);
    return withAdminIdempotency(env, { key: body?.idempotencyKey, scope: `payment:${paymentId}:approve`, actorEmail: auth.session.email, requestBody: body }, async () => responseFromService(await approvePayment(env, paymentId, body || {}, auth.session)));
  }

  if (path.endsWith("/reject") && request.method === "POST") {
    const paymentId = getPathId(path, "/api/web/v1/admin/payments");
    const body = await readJson(request);
    return withAdminIdempotency(env, { key: body?.idempotencyKey, scope: `payment:${paymentId}:reject`, actorEmail: auth.session.email, requestBody: body }, async () => responseFromService(await rejectPayment(env, paymentId, body || {}, auth.session)));
  }

  if (path.startsWith("/api/web/v1/admin/payments/") && request.method === "GET") {
    const paymentId = getPathId(path, "/api/web/v1/admin/payments");
    return jsonResponse(await getPaymentDetail(env, paymentId));
  }

  if (path === "/api/web/v1/admin/users" && request.method === "GET") {
    return jsonResponse(await listUsers(env, url));
  }

  if (path.startsWith("/api/web/v1/admin/users/") && path.endsWith("/credits/payg") && request.method === "POST") {
    const userId = getPathId(path, "/api/web/v1/admin/users");
    const body = await readJson(request);
    return withAdminIdempotency(env, { key: body?.idempotencyKey, scope: `user:${userId}:credit`, actorEmail: auth.session.email, requestBody: body }, async () => responseFromService(await addPaygCredit(env, userId, body || {}, auth.session)));
  }

  if (path.startsWith("/api/web/v1/admin/users/") && path.endsWith("/subscription/change") && request.method === "POST") {
    const userId = getPathId(path, "/api/web/v1/admin/users");
    const body = await readJson(request);
    return withAdminIdempotency(env, { key: body?.idempotencyKey, scope: `user:${userId}:subscription`, actorEmail: auth.session.email, requestBody: body }, async () => responseFromService(await changeSubscription(env, userId, body || {}, auth.session)));
  }

  if (path.startsWith("/api/web/v1/admin/users/") && path.endsWith("/ban") && request.method === "POST") {
    const userId = getPathId(path, "/api/web/v1/admin/users");
    const body = await readJson(request);
    const current = await getUserDetail(env, userId);
    const nextStatus = current?.user?.status === "banned" ? "active" : "banned";
    const result = await setUserBanState(env, userId, body || {}, nextStatus);
    if (!result?.body?.error) {
      await recordAdminAudit(env, auth.session, {
        action: nextStatus === "banned" ? "user.ban" : "user.unban",
        targetType: "user",
        targetId: userId,
        summary: nextStatus === "banned" ? `Banned user ${userId}` : `Reactivated user ${userId}`,
        metadata: { reason: body?.reason || null }
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path.startsWith("/api/web/v1/admin/users/") && request.method === "PATCH") {
    const userId = getPathId(path, "/api/web/v1/admin/users");
    const body = await readJson(request);
    const result = await updateUser(env, userId, body || {});
    if (!result?.body?.error) {
      await recordAdminAudit(env, auth.session, {
        action: "user.update",
        targetType: "user",
        targetId: userId,
        summary: `Updated user ${userId}`,
        metadata: { reason: body?.reason || null }
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path.startsWith("/api/web/v1/admin/users/") && request.method === "DELETE") {
    const userId = getPathId(path, "/api/web/v1/admin/users");
    const body = await readJson(request);
    const result = await deleteUser(env, userId, body || {});
    if (!result?.body?.error) {
      await recordAdminAudit(env, auth.session, {
        action: "user.delete",
        targetType: "user",
        targetId: userId,
        summary: `Deleted user ${userId}`,
        metadata: { reason: body?.reason || null, previousEmail: result?.body?.previousEmail || null }
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path.startsWith("/api/web/v1/admin/users/") && request.method === "GET") {
    const userId = getPathId(path, "/api/web/v1/admin/users");
    return jsonResponse(await getUserDetail(env, userId));
  }

  if (path === "/api/web/v1/admin/usage/requests" && request.method === "GET") {
    return jsonResponse(await listUsageRequests(env, url));
  }

  if (path === "/api/web/v1/admin/models" && request.method === "GET") {
    return jsonResponse(await listModels(env, url));
  }

  if (path === "/api/web/v1/admin/models" && request.method === "POST") {
    const body = await readJson(request);
    const result = await createModel(env, body || {});
    if (!result?.body?.error) {
      const targetId = result?.body?.model?.id || result?.body?.modelId || "model";
      await recordAdminAudit(env, auth.session, {
        action: "model.create",
        targetType: "model",
        targetId,
        summary: `Created model ${result?.body?.model?.modelId || targetId}`,
        metadata: { modelId: result?.body?.model?.modelId || null }
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path.startsWith("/api/web/v1/admin/models/") && path.endsWith("/enable") && request.method === "POST") {
    const modelId = getPathId(path, "/api/web/v1/admin/models");
    const result = await setModelAccessState(env, modelId, "enabled");
    if (!result?.body?.error) {
      await recordAdminAudit(env, auth.session, {
        action: "model.enable",
        targetType: "model",
        targetId: modelId,
        summary: `Enabled model ${modelId}`,
        metadata: null
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path.startsWith("/api/web/v1/admin/models/") && path.endsWith("/disable") && request.method === "POST") {
    const modelId = getPathId(path, "/api/web/v1/admin/models");
    const result = await setModelAccessState(env, modelId, "disabled");
    if (!result?.body?.error) {
      await recordAdminAudit(env, auth.session, {
        action: "model.disable",
        targetType: "model",
        targetId: modelId,
        summary: `Disabled model ${modelId}`,
        metadata: null
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path.startsWith("/api/web/v1/admin/models/") && request.method === "PATCH") {
    const modelId = getPathId(path, "/api/web/v1/admin/models");
    const body = await readJson(request);
    const result = await updateModel(env, modelId, body || {});
    if (!result?.body?.error) {
      await recordAdminAudit(env, auth.session, {
        action: "model.update",
        targetType: "model",
        targetId: modelId,
        summary: `Updated model ${modelId}`,
        metadata: { modelId: result?.body?.model?.modelId || null }
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path.startsWith("/api/web/v1/admin/models/") && request.method === "GET") {
    const modelId = getPathId(path, "/api/web/v1/admin/models");
    return jsonResponse(await getModelDetail(env, modelId));
  }

  if (path.startsWith("/api/web/v1/admin/models/") && request.method === "DELETE") {
    const modelId = getPathId(path, "/api/web/v1/admin/models");
    const result = await deleteModel(env, modelId);
    if (!result?.body?.error) {
      await recordAdminAudit(env, auth.session, {
        action: "model.delete",
        targetType: "model",
        targetId: modelId,
        summary: `Deleted model ${modelId}`,
        metadata: { modelId: result?.body?.modelId || null }
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path === "/api/web/v1/admin/plans" && request.method === "GET") {
    return jsonResponse(await listPlans(env));
  }

  if (path.startsWith("/api/web/v1/admin/plans/") && path.endsWith("/publish") && request.method === "POST") {
    const planId = getPathId(path, "/api/web/v1/admin/plans");
    const result = await updatePlan(env, planId, { active: true, visible: true });
    if (!result?.body?.error) {
      await recordAdminAudit(env, auth.session, {
        action: "plan.publish",
        targetType: "plan",
        targetId: planId,
        summary: `Published plan ${planId}`,
        metadata: null
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path.startsWith("/api/web/v1/admin/plans/") && request.method === "PATCH") {
    const planId = getPathId(path, "/api/web/v1/admin/plans");
    const body = await readJson(request);
    const result = await updatePlan(env, planId, body || {});
    if (!result?.body?.error) {
      await recordAdminAudit(env, auth.session, {
        action: "plan.update",
        targetType: "plan",
        targetId: planId,
        summary: `Updated plan ${planId}`,
        metadata: null
      });
      await bumpAdminCache(env);
    }
    return responseFromService(result);
  }

  if (path.startsWith("/api/web/v1/admin/plans/") && request.method === "GET") {
    const planId = getPathId(path, "/api/web/v1/admin/plans");
    return jsonResponse(await getPlanDetail(env, planId));
  }

  if (path === "/api/web/v1/admin/audit-events" && request.method === "GET") {
    return jsonResponse(await listAdminAuditEvents(env, url));
  }

  return errorResponse(404, "not_found", "Admin endpoint not found.");
}
