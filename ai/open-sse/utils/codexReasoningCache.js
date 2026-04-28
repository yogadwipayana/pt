/**
 * Codex reasoning cache
 *
 * Codex (OpenAI Responses API) emits encrypted "reasoning" items alongside
 * `function_call` items when `include: ["reasoning.encrypted_content"]` is set.
 * Codex requires those reasoning items to be passed back verbatim in the next
 * turn (between the previous user message and its associated function_calls),
 * otherwise the API rejects the follow-up request with HTTP 400.
 *
 * The OpenAI Chat Completions wire format has no slot to carry encrypted
 * reasoning across turns, so we cache the items server-side keyed by the
 * `call_id` of every function_call that follows them. When a follow-up chat
 * request arrives with assistant.tool_calls, we look up the cached reasoning
 * and re-inject it before forwarding to Codex.
 *
 * The cache is process-local and best-effort: TTL eviction prevents unbounded
 * growth and a hard size cap stops a misbehaving session from blowing up
 * memory. When the cache misses, behavior degrades to the previous broken
 * state (Codex 400) — no worse than today.
 */

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 5000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 min

// Map<callId, { item, lastUsed }>
const cache = new Map();

function evictOldest() {
  // Drop the single oldest entry. Cheap O(n) but only runs when cap is hit.
  let oldestKey = null;
  let oldestTs = Infinity;
  for (const [k, v] of cache) {
    if (v.lastUsed < oldestTs) {
      oldestTs = v.lastUsed;
      oldestKey = k;
    }
  }
  if (oldestKey !== null) cache.delete(oldestKey);
}

/**
 * Store a reasoning item for one or more call_ids.
 *
 * @param {string|string[]} callIds — call_id(s) of function_call items that
 *   should be preceded by this reasoning item on replay.
 * @param {object} item — full reasoning item as returned by Codex:
 *   { id, type: "reasoning", summary?: [...], encrypted_content: "..." }
 */
export function storeReasoningForCallIds(callIds, item) {
  if (!item || !item.encrypted_content) return;
  const ids = Array.isArray(callIds) ? callIds : [callIds];
  const now = Date.now();
  for (const id of ids) {
    if (!id || typeof id !== "string") continue;
    cache.set(id, { item, lastUsed: now });
    if (cache.size > MAX_ENTRIES) evictOldest();
  }
}

/**
 * Look up the reasoning item that should precede a given function_call.
 * Returns null if not cached (caller should fall back to current behavior).
 */
export function getReasoningForCallId(callId) {
  if (!callId || typeof callId !== "string") return null;
  const entry = cache.get(callId);
  if (!entry) return null;
  // Refresh LRU timestamp so active conversations stay warm
  entry.lastUsed = Date.now();
  return entry.item;
}

/** Test helper — clears the cache. */
export function _resetCacheForTests() {
  cache.clear();
}

/** Test helper — current size. */
export function _cacheSize() {
  return cache.size;
}

// Periodic cleanup. .unref() so it doesn't block process exit.
const timer = setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for (const [k, v] of cache) {
    if (v.lastUsed < cutoff) cache.delete(k);
  }
}, CLEANUP_INTERVAL_MS);
if (typeof timer?.unref === "function") timer.unref();
