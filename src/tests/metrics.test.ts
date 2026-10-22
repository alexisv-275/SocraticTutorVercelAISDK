import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { createAnthropic } from '@ai-sdk/anthropic';
import { MockLanguageModelV4 } from 'ai/test';
import { MetricsCollector } from '../infrastructure/metrics.js';
import { normalizeUsage, type LLMAttempt } from '../infrastructure/attempt.js';
import { getContext } from '../academic/context.js';
import { createS0 } from '../fixtures/scenarios.js';
import { MockTutor } from '../fixtures/mock-tutor.js';
import { ClaudeTutor } from '../services/tutor.js';
import { StudyOrchestrator } from '../services/orchestrator.js';
import { MemorySessionStore } from '../infrastructure/memory-store.js';
import type { TutorInput } from '../services/tutor-contract.js';

function attempt(inputTokens?: number, outputTokens?: number): LLMAttempt {
  return { callId: randomUUID(), roleOrAgent: 'Tutor', model: 'test-only', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    durationMs: 9000, status: 'SUCCEEDED', ...normalizeUsage({ inputTokens, outputTokens }), error: null };
}

test('H5: agrega intentos una vez, preserva null y mide latencia de pared', async () => {
  const collector = new MetricsCollector();
  const turn = collector.startTurn('session', 'E1');
  collector.recordLLMAttempt(turn, attempt(20, 10)); collector.recordLLMAttempt(turn, attempt(30, 5));
  await delay(15); collector.finishTurn(turn, 'SUCCEEDED');
  const metric = collector.export()[0]!;
  assert.equal(metric.llmCalls, 2); assert.equal(metric.inputTokens, 50); assert.equal(metric.outputTokens, 15); assert.equal(metric.totalTokens, 65);
  assert.ok(metric.latencyMs >= 10); assert.ok(metric.latencyMs < 18000);
  assert.ok(metric.llmAttempts.every(a => a.runId === metric.runId && a.turnId === metric.turnId));
  const failed = collector.startTurn('session', 'E2');
  collector.recordLLMAttempt(failed, attempt(20, 10)); collector.recordLLMAttempt(failed, attempt(undefined, 4));
  collector.finishTurn(failed, 'FAILED', 'API_CONNECTION');
  const failure = collector.export()[1]!;
  assert.equal(failure.inputTokens, null); assert.equal(failure.outputTokens, 14); assert.equal(failure.totalTokens, null);
  metric.llmAttempts.length = 0; assert.equal(collector.export()[0]?.llmAttempts.length, 2);
});

test('H5: aclaraciones contabilizan cero llamadas y ninguna mutación', async () => {
  const orchestrator = new StudyOrchestrator(new MemorySessionStore(), new MockTutor());
  const state = createS0(); orchestrator.loadSession(state);
  await orchestrator.handleTurn(state.sessionId, {});
  const metric = orchestrator.metrics.export()[0]!;
  assert.equal(metric.status, 'CLARIFICATION'); assert.equal(metric.llmCalls, 0); assert.equal(metric.totalTokens, 0);
  assert.equal(metric.strategy, null); assert.deepEqual(orchestrator.getSession(state.sessionId), state);
});

test('H5: adapter Anthropic + SDK serializan la petición y contabilizan uso sin conexión HTTP real', async () => {
  const input: TutorInput = { state: createS0(), context: getContext('scrum-roles', 'product-owner'),
    diagnosis: { result: 'CORRECT', evidence: 'PARTIAL', difficultyDetected: null, requiresVerification: true },
    decision: { strategy: 'VERIFY', difficulty: 'MEDIUM', justification: 'RP03' } };
  const output = await new MockTutor().generateIntervention(input);
  let requests = 0; let request: Record<string, unknown> | undefined;
  const provider = createAnthropic({ apiKey: 'test-only-not-a-secret', fetch: async (_url, init) => {
    requests += 1; request = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant',
      content: [{ type: 'text', text: JSON.stringify(output) }], model: 'claude-sonnet-4-5',
      stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 20, output_tokens: 10 } }),
    { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const attempts: LLMAttempt[] = [];
  const tutor = new ClaudeTutor(provider('claude-sonnet-4-5'), { model: 'claude-sonnet-4-5', temperature: 0, maxOutputTokens: 1200 });
  assert.deepEqual(await tutor.generateIntervention(input, a => attempts.push(a)), output);
  assert.equal(requests, 1); assert.equal(request?.max_tokens, 1200); assert.equal(request?.temperature, 0);
  assert.equal(attempts[0]?.inputTokens, 20); assert.equal(attempts[0]?.outputTokens, 10); assert.equal(attempts[0]?.totalTokens, 30);
});

test('H5: SDK sin datos de tokens conserva null incluso en una generación válida', async () => {
  const input: TutorInput = { state: createS0(), context: getContext('scrum-roles', 'product-owner'),
    diagnosis: { result: 'CORRECT', evidence: 'PARTIAL', difficultyDetected: null, requiresVerification: true },
    decision: { strategy: 'VERIFY', difficulty: 'MEDIUM', justification: 'RP03' } };
  const output = await new MockTutor().generateIntervention(input);
  const model = new MockLanguageModelV4({ doGenerate: { content: [{ type: 'text', text: JSON.stringify(output) }],
    finishReason: { unified: 'stop', raw: 'stop' }, warnings: [], usage: {
      inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: undefined, text: undefined, reasoning: undefined },
    } } });
  const attempts: LLMAttempt[] = [];
  await new ClaudeTutor(model, { model: 'test', temperature: 0, maxOutputTokens: 1200 }).generateIntervention(input, a => attempts.push(a));
  assert.equal(attempts[0]?.inputTokens, null); assert.equal(attempts[0]?.outputTokens, null); assert.equal(attempts[0]?.totalTokens, null);
});
