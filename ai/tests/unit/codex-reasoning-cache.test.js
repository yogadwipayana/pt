/**
 * Codex reasoning cache: round-trip test.
 *
 * Reproduces the production bug where Codex (`gpt-5.4`) returns 400 Bad Request
 * on multi-turn tool-use because the encrypted reasoning items emitted in the
 * previous response are stripped by the OpenAI Chat Completions wire format
 * and never replayed. With the cache in place, the chat→responses request
 * translator must re-inject those items before each function_call.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  openaiToOpenAIResponsesRequest,
} from "../../open-sse/translator/request/openai-responses.js";
import {
  openaiResponsesToOpenAIResponse,
} from "../../open-sse/translator/response/openai-responses.js";
import {
  _resetCacheForTests,
  _cacheSize,
  storeReasoningForCallIds,
  getReasoningForCallId,
} from "../../open-sse/utils/codexReasoningCache.js";

function freshState() {
  return {};
}

function feed(events, state) {
  const out = [];
  for (const ev of events) {
    const r = openaiResponsesToOpenAIResponse(ev, state);
    if (r) out.push(r);
  }
  return out;
}

import { CodexExecutor } from "../../open-sse/executors/codex.js";

describe("CodexExecutor transformRequest", () => {
  let executor;

  beforeEach(() => {
    executor = new CodexExecutor();
  });

  it("never sets include=reasoning.encrypted_content (avoids 400 on tool follow-ups)", () => {
    const body = {
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
      reasoning_effort: "medium",
    };
    const result = executor.transformRequest("gpt-5.4", body, true, {});
    expect(result.include).toBeUndefined();
  });

  it("does not set include even on first turn with tools present", () => {
    const body = {
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "read file" }] }],
      reasoning_effort: "medium",
      tools: [{ type: "function", function: { name: "read" } }],
    };
    const result = executor.transformRequest("gpt-5.4", body, true, {});
    expect(result.include).toBeUndefined();
  });

  it("does not set include on follow-up turns with function_call history", () => {
    const body = {
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "read file" }] },
        { type: "function_call", call_id: "call_A", name: "read", arguments: "{}" },
        { type: "function_call_output", call_id: "call_A", output: "file contents" },
      ],
      reasoning_effort: "medium",
    };
    const result = executor.transformRequest("gpt-5.4", body, true, {});
    expect(result.include).toBeUndefined();
  });

  it("does NOT set include when reasoning effort is none", () => {
    const body = {
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
      reasoning: { effort: "none", summary: "auto" },
    };
    const result = executor.transformRequest("gpt-5.4", body, true, {});
    expect(result.include).toBeUndefined();
  });
});

describe("codexReasoningCache (basic)", () => {
  beforeEach(() => _resetCacheForTests());

  it("stores and retrieves an item by call_id", () => {
    const item = { id: "rs_1", type: "reasoning", summary: [], encrypted_content: "ENC" };
    storeReasoningForCallIds("call_A", item);
    expect(getReasoningForCallId("call_A")).toEqual(item);
  });

  it("supports binding the same item to multiple call_ids", () => {
    const item = { id: "rs_2", type: "reasoning", summary: [], encrypted_content: "ENC" };
    storeReasoningForCallIds(["call_A", "call_B", "call_C"], item);
    expect(_cacheSize()).toBe(3);
    expect(getReasoningForCallId("call_B")).toBe(item);
  });

  it("ignores items without encrypted_content", () => {
    storeReasoningForCallIds("call_X", { id: "rs", type: "reasoning" });
    expect(_cacheSize()).toBe(0);
  });

  it("returns null for unknown ids", () => {
    expect(getReasoningForCallId("call_nope")).toBeNull();
    expect(getReasoningForCallId(null)).toBeNull();
    expect(getReasoningForCallId(undefined)).toBeNull();
  });
});

describe("Codex response capture → request injection round-trip", () => {
  beforeEach(() => _resetCacheForTests());

  it("captures reasoning from output_item.done and re-injects it on follow-up", () => {
    const state = freshState();
    feed([
      {
        type: "response.output_item.added",
        item: { id: "rs_resp_1", type: "reasoning", summary: [] },
      },
      {
        type: "response.output_item.done",
        item: {
          id: "rs_resp_1",
          type: "reasoning",
          summary: [{ type: "summary_text", text: "thinking..." }],
          encrypted_content: "ENC_ABC",
        },
      },
      {
        type: "response.output_item.added",
        item: {
          id: "fc_call_A",
          type: "function_call",
          call_id: "call_A",
          name: "read",
          arguments: "",
        },
      },
      { type: "response.completed", response: { id: "resp_1" } },
    ], state);

    expect(getReasoningForCallId("call_A")?.encrypted_content).toBe("ENC_ABC");

    // Simulate the follow-up turn: client sends back the assistant tool_calls
    // plus the tool result. The translator must inject the cached reasoning
    // item BEFORE the function_call item.
    const followUp = openaiToOpenAIResponsesRequest("gpt-5.4", {
      messages: [
        { role: "system", content: "you are a helpful assistant" },
        { role: "user", content: "read the file" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "call_A", type: "function", function: { name: "read", arguments: '{"f":"x"}' } },
          ],
        },
        { role: "tool", tool_call_id: "call_A", content: "file contents" },
      ],
    }, true);

    const types = followUp.input.map(i => i.type);
    expect(types).toEqual([
      "message",        // user
      "reasoning",      // injected from cache
      "function_call",  // assistant tool_call
      "function_call_output", // tool result
    ]);
    const reasoning = followUp.input[1];
    expect(reasoning.id).toBe("rs_resp_1");
    expect(reasoning.encrypted_content).toBe("ENC_ABC");
  });

  it("binds parallel function_calls to a shared reasoning item (de-duped on inject)", () => {
    const state = freshState();
    feed([
      { type: "response.output_item.added", item: { id: "rs_par", type: "reasoning" } },
      {
        type: "response.output_item.done",
        item: { id: "rs_par", type: "reasoning", summary: [], encrypted_content: "ENC_PAR" },
      },
      // 3 parallel function_calls share the one reasoning item above
      {
        type: "response.output_item.added",
        item: { id: "fc1", type: "function_call", call_id: "call_1", name: "read" },
      },
      {
        type: "response.output_item.added",
        item: { id: "fc2", type: "function_call", call_id: "call_2", name: "read" },
      },
      {
        type: "response.output_item.added",
        item: { id: "fc3", type: "function_call", call_id: "call_3", name: "read" },
      },
      { type: "response.completed", response: {} },
    ], state);

    expect(getReasoningForCallId("call_1")?.encrypted_content).toBe("ENC_PAR");
    expect(getReasoningForCallId("call_2")?.encrypted_content).toBe("ENC_PAR");
    expect(getReasoningForCallId("call_3")?.encrypted_content).toBe("ENC_PAR");

    const followUp = openaiToOpenAIResponsesRequest("gpt-5.4", {
      messages: [
        { role: "user", content: "read 3 files" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "read", arguments: "{}" } },
            { id: "call_2", type: "function", function: { name: "read", arguments: "{}" } },
            { id: "call_3", type: "function", function: { name: "read", arguments: "{}" } },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: "a" },
        { role: "tool", tool_call_id: "call_2", content: "b" },
        { role: "tool", tool_call_id: "call_3", content: "c" },
      ],
    }, true);

    // Exactly ONE reasoning item should be injected even though there are 3 calls
    const reasoningItems = followUp.input.filter(i => i.type === "reasoning");
    expect(reasoningItems).toHaveLength(1);
    expect(reasoningItems[0].id).toBe("rs_par");

    const types = followUp.input.map(i => i.type);
    expect(types).toEqual([
      "message",
      "reasoning",
      "function_call", "function_call", "function_call",
      "function_call_output", "function_call_output", "function_call_output",
    ]);
  });

  it("falls back to response.completed.output[] when streaming events lack encrypted_content", () => {
    const state = freshState();
    feed([
      // No encrypted_content in the streaming done event
      { type: "response.output_item.added", item: { id: "rs_late", type: "reasoning" } },
      {
        type: "response.output_item.done",
        item: { id: "rs_late", type: "reasoning", summary: [] },
      },
      {
        type: "response.output_item.added",
        item: { id: "fc_late", type: "function_call", call_id: "call_late", name: "read" },
      },
      // ...but the final response.completed event includes the full output array
      {
        type: "response.completed",
        response: {
          id: "resp_late",
          output: [
            { id: "rs_late", type: "reasoning", summary: [], encrypted_content: "ENC_LATE" },
            { id: "fc_late", type: "function_call", call_id: "call_late", name: "read", arguments: "{}" },
          ],
        },
      },
    ], state);

    expect(getReasoningForCallId("call_late")?.encrypted_content).toBe("ENC_LATE");
  });

  it("does not inject reasoning when cache miss (graceful fallback)", () => {
    const followUp = openaiToOpenAIResponsesRequest("gpt-5.4", {
      messages: [
        { role: "user", content: "hi" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "call_unknown", type: "function", function: { name: "read", arguments: "{}" } },
          ],
        },
        { role: "tool", tool_call_id: "call_unknown", content: "x" },
      ],
    }, true);

    const types = followUp.input.map(i => i.type);
    expect(types).toEqual(["message", "function_call", "function_call_output"]);
  });
});
