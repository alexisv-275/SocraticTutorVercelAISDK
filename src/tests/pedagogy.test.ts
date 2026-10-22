import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createS0, loadScenario, SCENARIO_IDS } from '../fixtures/scenarios.js';
import { MockTutor } from '../fixtures/mock-tutor.js';
import { StudyOrchestrator } from '../services/orchestrator.js';
import { MemorySessionStore } from '../infrastructure/memory-store.js';
import { PublicTurnResponseSchema } from '../domain/contracts.js';
import type { Tutor } from '../services/tutor-contract.js';

function setup(tutor: Tutor = new MockTutor()) {
  const store = new MemorySessionStore();
  return { store, orchestrator: new StudyOrchestrator(store, tutor) };
}

for (const id of SCENARIO_IDS) test(`H2: ${id}, reglas de progreso y privacidad`, async () => {
  const { state, action } = loadScenario(id);
  const { orchestrator } = setup();
  orchestrator.loadSession(state);
  const response = await orchestrator.handleTurn(state.sessionId, action);
  const next = orchestrator.getSession(state.sessionId)!;
  const expected = { E1: ['VERIFY', 0, 'PENDING_VERIFICATION', 'TRANSFER'], E2: ['HINT', 1, 'IN_PROGRESS', 'REFORMULATION'],
    E3: ['SIMPLIFY', 2, 'IN_PROGRESS', 'SIMPLIFIED'], E4: ['HINT', 1, 'IN_PROGRESS', 'REFORMULATION'],
    E5: ['CHANGE_TOPIC', 0, 'UNASSESSED', 'INITIAL'] }[id];
  assert.deepEqual([next.history.at(-1)?.strategy, next.consecutiveErrors, next.comprehension, next.currentQuestion?.questionType], expected);
  assert.deepEqual(next.history.slice(0, -1), state.history);
  assert.ok(PublicTurnResponseSchema.safeParse(response).success);
  assert.doesNotMatch(JSON.stringify(response), /correctOptionId|privateRationale|diagnosis|questionType|difficulty|conceptId/);
  assert.deepEqual(response.actions, ['4. Necesito una pista', '5. Cambiar de tema']);
  assert.notEqual(next.currentQuestion?.id, state.currentQuestion?.id);
  if (id === 'E3') { assert.equal(next.currentQuestion?.difficulty, 'LOW'); assert.equal(next.helpLevel, 'EXPLANATION'); }
  if (id === 'E5') { assert.equal(next.topicId, 'scrum-events'); assert.equal(next.helpLevel, 'NONE'); assert.equal(next.conceptId, 'scrum-events'); }
});

test('RP09: entradas inválidas o antiguas no mutan ni invocan Tutor', async () => {
  const tutor = new MockTutor();
  const { orchestrator } = setup(tutor);
  const state = createS0(); orchestrator.loadSession(state);
  for (const action of [null, {}, { action: 'ANSWER', questionId: 'Q01', selectedOptionId: 'D' },
    { action: 'REQUEST_HINT', questionId: 'Q00' }, { action: 'CHANGE_TOPIC', targetTopicId: 'desconocido' },
    { action: 'ANSWER', questionId: 'Q01', selectedOptionId: 'A', extra: true }]) {
    await orchestrator.handleTurn(state.sessionId, action);
    assert.deepEqual(orchestrator.getSession(state.sessionId), state);
  }
  assert.equal(tutor.calls, 0);
});

test('RP07: pedir pista sin error no suma errores ni evidencia', async () => {
  const { orchestrator } = setup(); const state = createS0(); orchestrator.loadSession(state);
  await orchestrator.handleTurn(state.sessionId, { action: 'REQUEST_HINT', questionId: 'Q01' });
  const next = orchestrator.getSession(state.sessionId)!;
  assert.equal(next.consecutiveErrors, 0); assert.equal(next.helpLevel, 'HINT'); assert.equal(next.comprehension, 'UNASSESSED');
});

test('RP06: solo acierto anterior y transferencia correcta verifican', async () => {
  for (const previous of [true, false]) {
    const { orchestrator } = setup(); const { state } = loadScenario('E4');
    if (!previous) state.history = [];
    orchestrator.loadSession(state);
    await orchestrator.handleTurn(state.sessionId, { action: 'ANSWER', questionId: 'Q03', selectedOptionId: 'B' });
    assert.equal(orchestrator.getSession(state.sessionId)?.comprehension, previous ? 'VERIFIED' : 'PENDING_VERIFICATION');
  }
});

test('Fallo o salida inválida del Tutor no confirma estado ni ayuda', async () => {
  for (const tutor of [
    { generateIntervention: async () => { throw new Error('Fallo'); } },
    { generateIntervention: async () => ({ kind: 'FEEDBACK', message: 'Sin pregunta', question: null, topics: null } as const) },
  ]) {
    const { orchestrator } = setup(tutor); const state = createS0(); orchestrator.loadSession(state);
    await orchestrator.handleTurn(state.sessionId, { action: 'ANSWER', questionId: 'Q01', selectedOptionId: 'A' });
    assert.deepEqual(orchestrator.getSession(state.sessionId), state);
  }
});

test('El almacén aísla copias al leer y al guardar', () => {
  const store = new MemorySessionStore(); const state = createS0(); store.save(state);
  state.history.push({} as never); store.get(state.sessionId)!.consecutiveErrors = 42;
  assert.deepEqual(store.get(state.sessionId), createS0());
});

test('RP01: inicio sin tema y selección posterior, sin cuarto tipo de acción', async () => {
  const { orchestrator } = setup();
  const response = await orchestrator.startSession('inicio');
  assert.equal(response.topics?.length, 3); assert.equal(response.question, null); assert.deepEqual(response.actions, []);
  await orchestrator.handleTurn('inicio', { action: 'CHANGE_TOPIC', targetTopicId: 'scrum-roles' });
  assert.ok(orchestrator.getSession('inicio')?.currentQuestion);
});
