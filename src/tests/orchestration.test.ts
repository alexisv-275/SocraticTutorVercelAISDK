import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { createS0, loadScenario, SCENARIO_IDS } from '../fixtures/scenarios.js';
import { MockTutor } from '../fixtures/mock-tutor.js';
import { runScenarios } from '../cli/scenarios.js';
import { MemorySessionStore } from '../infrastructure/memory-store.js';
import { MetricsCollector } from '../infrastructure/metrics.js';
import { StudyOrchestrator } from '../services/orchestrator.js';
import { ClaudeTutor } from '../services/tutor.js';
import type { Tutor } from '../services/tutor-contract.js';

test('H4: runner carga cinco estados limpios, RP01 separado, rúbrica pendiente y cero llamadas reales', async () => {
  const report = await runScenarios(true, true);
  assert.deepEqual(report.scenarios.map(s => s.scenarioId), [...SCENARIO_IDS]);
  for (const scenario of report.scenarios) {
    assert.deepEqual(scenario.privateEvaluation.before, loadScenario(scenario.scenarioId).state);
    assert.equal(scenario.rubric.passedChecks, null); assert.equal(scenario.rubric.criticalFailures, null);
  }
  assert.equal(report.startCheck?.topics?.length, 3);
  assert.equal(report.metrics.length, 6);
  assert.ok(report.metrics.every(m => m.llmCalls === 0 && m.mode === 'mock' && m.status === 'SUCCEEDED'));
});

test('H4: dos intentos fallidos conservan estado y se registran, incluido cambio de tema', async () => {
  for (const id of ['E2', 'E5'] as const) {
    const model = new MockLanguageModelV4({ doGenerate: async () => { throw new APICallError({ message: 'error simulado',
      url: 'https://example.invalid', requestBodyValues: {}, statusCode: 503 }); } });
    const metrics = new MetricsCollector(undefined, 'claude', 'modelo-simulado');
    const tutor = new ClaudeTutor(model, { model: 'modelo-simulado', temperature: 0, maxOutputTokens: 1200 }, async () => {});
    const orchestrator = new StudyOrchestrator(new MemorySessionStore(), tutor, metrics);
    const { state, action } = loadScenario(id); orchestrator.loadSession(state);
    await orchestrator.handleTurn(state.sessionId, action, id);
    assert.deepEqual(orchestrator.getSession(state.sessionId), state);
    const turn = metrics.export()[0]!;
    assert.equal(turn.status, 'FAILED'); assert.equal(turn.llmCalls, 2); assert.equal(turn.totalTokens, null);
    assert.equal(turn.error, 'API_503');
  }
});

test('H4: turnos simultáneos no sobrescriben estado y la respuesta antigua se rechaza', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const mock = new MockTutor();
  const tutor: Tutor = { generateIntervention: async input => { await gate; return mock.generateIntervention(input); } };
  const orchestrator = new StudyOrchestrator(new MemorySessionStore(), tutor);
  const state = createS0(); orchestrator.loadSession(state);
  const action = { action: 'ANSWER', questionId: 'Q01', selectedOptionId: 'B' };
  const first = orchestrator.handleTurn(state.sessionId, action);
  const second = await orchestrator.handleTurn(state.sessionId, action);
  assert.match(second.message, /Espera/);
  release(); await first;
  assert.equal(orchestrator.getSession(state.sessionId)?.history.length, 1);
  await orchestrator.handleTurn(state.sessionId, action);
  assert.equal(mock.calls, 1);
});

test('H4: fallo de inicio no crea sesión parcial y puede reintentarse', async () => {
  let failed = true; const mock = new MockTutor();
  const tutor: Tutor = { generateIntervention: async input => { if (failed) throw new Error('error'); return mock.generateIntervention(input); } };
  const orchestrator = new StudyOrchestrator(new MemorySessionStore(), tutor);
  await orchestrator.startSession('nueva'); assert.equal(orchestrator.getSession('nueva'), undefined);
  failed = false;
  await orchestrator.startSession('nueva'); assert.ok(orchestrator.getSession('nueva'));
});

test('RP06: nuevas transferencias acertadas mantienen VERIFIED; evidencia previa al cambio no verifica', async () => {
  const orchestrator = new StudyOrchestrator(new MemorySessionStore(), new MockTutor());
  const { state } = loadScenario('E4'); orchestrator.loadSession(state);
  await orchestrator.handleTurn(state.sessionId, { action: 'ANSWER', questionId: 'Q03', selectedOptionId: 'B' });
  const question = orchestrator.getSession(state.sessionId)!.currentQuestion!;
  await orchestrator.handleTurn(state.sessionId, { action: 'ANSWER', questionId: question.id, selectedOptionId: question.correctOptionId });
  assert.equal(orchestrator.getSession(state.sessionId)?.comprehension, 'VERIFIED');
  state.history.push({ ...state.history[0]!, strategy: 'CHANGE_TOPIC', result: 'NOT_APPLICABLE' });
  orchestrator.loadSession(state);
  await orchestrator.handleTurn(state.sessionId, { action: 'ANSWER', questionId: 'Q03', selectedOptionId: 'B' });
  assert.equal(orchestrator.getSession(state.sessionId)?.comprehension, 'PENDING_VERIFICATION');
});
