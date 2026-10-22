import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCENARIO_IDS, createS0, loadScenario } from '../fixtures/scenarios.js';
import { QUESTIONS } from '../fixtures/questions.js';
import { StudentActionSchema } from '../domain/contracts.js';

test('H1: S0 y las cinco cargas coinciden con el contrato y son independientes', () => {
  assert.deepEqual(createS0(), { sessionId: 'test-session', topicId: 'scrum-roles', conceptId: 'product-owner',
    currentQuestion: QUESTIONS.Q01, consecutiveErrors: 0, helpLevel: 'NONE', comprehension: 'UNASSESSED', history: [], resolvedSituations: 0 });
  const expected = [
    ['Q01', 0, 'NONE', 'UNASSESSED', 0, 'ANSWER', 'B'],
    ['Q01', 0, 'NONE', 'UNASSESSED', 0, 'ANSWER', 'A'],
    ['Q02', 1, 'HINT', 'IN_PROGRESS', 1, 'ANSWER', 'A'],
    ['Q03', 0, 'NONE', 'PENDING_VERIFICATION', 1, 'ANSWER', 'A'],
    ['Q02', 1, 'HINT', 'IN_PROGRESS', 1, 'CHANGE_TOPIC', 'scrum-events'],
  ];
  SCENARIO_IDS.forEach((id, index) => {
    const { state: s, action: a } = loadScenario(id);
    assert.deepEqual([s.currentQuestion?.id, s.consecutiveErrors, s.helpLevel, s.comprehension, s.history.length,
      a.action, a.action === 'ANSWER' ? a.selectedOptionId : a.action === 'CHANGE_TOPIC' ? a.targetTopicId : null], expected[index]);
    assert.ok(StudentActionSchema.safeParse(a).success);
    if (id === 'E3' || id === 'E5') assert.equal(s.history[0]?.result, 'INCORRECT');
    if (id === 'E4') assert.equal(s.history[0]?.result, 'CORRECT');
    s.currentQuestion!.options.A = 'mutación';
    assert.notEqual(loadScenario(id).state.currentQuestion!.options.A, 'mutación');
  });
});

test('H1: textos y claves Q01–Q03 literales del contrato', () => {
  const contract = readFileSync('Contrato-pedagogico-y-pruebas.md', 'utf8');
  for (const q of Object.values(QUESTIONS)) {
    assert.ok(contract.includes(q.text));
    for (const option of Object.values(q.options)) assert.ok(contract.includes(option));
  }
  assert.deepEqual(Object.values(QUESTIONS).map(q => q.correctOptionId), ['B', 'C', 'B']);
});
