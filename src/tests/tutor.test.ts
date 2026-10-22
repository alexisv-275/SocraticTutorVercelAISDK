import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { getContext } from '../academic/context.js';
import { createS0 } from '../fixtures/scenarios.js';
import { MockTutor } from '../fixtures/mock-tutor.js';
import { ClaudeTutor, TutorError } from '../services/tutor.js';
import { buildPrompt } from '../services/prompt.js';
import type { TutorInput } from '../services/tutor-contract.js';
import type { LLMAttempt } from '../infrastructure/attempt.js';
import { normalizeUsage } from '../infrastructure/attempt.js';
import { parseConfig, publicConfig } from '../config/env.js';
import { validateGeneration } from '../domain/validation.js';

export const tutorInput = (): TutorInput => ({ state: createS0(), context: getContext('scrum-roles', 'product-owner'),
  diagnosis: { result: 'CORRECT', evidence: 'PARTIAL', difficultyDetected: null, requiresVerification: true },
  decision: { strategy: 'VERIFY', difficulty: 'MEDIUM', justification: 'RP03' } });
export function modelResponse(text: string) {
  return { content: [{ type: 'text' as const, text }], finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: { inputTokens: { total: 20, noCache: 20, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } }, warnings: [] };
}
const config = { model: 'offline-test', temperature: 0, maxOutputTokens: 1200 };
const noWait = async () => {};

test('H3: generateText + Output.object reales, proveedor simulado, un solo intento', async () => {
  const input = tutorInput(); const output = await new MockTutor().generateIntervention(input);
  const model = new MockLanguageModelV4({ doGenerate: modelResponse(JSON.stringify(output)) });
  const attempts: LLMAttempt[] = [];
  assert.deepEqual(await new ClaudeTutor(model, config, noWait).generateIntervention(input, a => attempts.push(a)), output);
  assert.equal(model.doGenerateCalls.length, 1); assert.equal(attempts.length, 1);
  assert.equal(attempts[0]?.totalTokens, 30); assert.equal(attempts[0]?.status, 'SUCCEEDED');
  assert.equal(model.doGenerateCalls[0]?.responseFormat?.type, 'json');
  assert.equal(model.doGenerateCalls[0]?.temperature, 0);
});

test('H3: salida JSON inválida se repite una vez y conserva uso de ambos intentos', async () => {
  const input = tutorInput(); const output = await new MockTutor().generateIntervention(input);
  const model = new MockLanguageModelV4({ doGenerate: [modelResponse('no es JSON'), modelResponse(JSON.stringify(output))] });
  const attempts: LLMAttempt[] = [];
  await new ClaudeTutor(model, config, noWait).generateIntervention(input, a => attempts.push(a));
  assert.equal(model.doGenerateCalls.length, 2);
  assert.deepEqual(attempts.map(a => a.status), ['FAILED', 'SUCCEEDED']);
  assert.deepEqual(attempts.map(a => a.totalTokens), [30, 30]);
});

test('H3: dos salidas estructuralmente incorrectas agotan el límite', async () => {
  const input = tutorInput(); const output = await new MockTutor().generateIntervention(input);
  output.question!.questionType = 'INITIAL';
  const model = new MockLanguageModelV4({ doGenerate: modelResponse(JSON.stringify(output)) });
  const attempts: LLMAttempt[] = [];
  await assert.rejects(new ClaudeTutor(model, config, noWait).generateIntervention(input, a => attempts.push(a)), TutorError);
  assert.equal(model.doGenerateCalls.length, 2); assert.equal(attempts.length, 2);
  assert.ok(attempts.every(a => a.error === 'INVALID_OUTPUT'));
});

test('H3: 401 no se repite; 429 y 503 solo una vez; fallos sin uso quedan null', async () => {
  for (const statusCode of [401, 429, 503]) {
    const model = new MockLanguageModelV4({ doGenerate: async () => { throw new APICallError({ message: 'secreto-no-exportar', statusCode,
      url: 'https://example.invalid', requestBodyValues: {} }); } });
    const attempts: LLMAttempt[] = [];
    await assert.rejects(new ClaudeTutor(model, config, noWait).generateIntervention(tutorInput(), a => attempts.push(a)), TutorError);
    assert.equal(model.doGenerateCalls.length, statusCode === 401 ? 1 : 2);
    assert.ok(attempts.every(a => a.inputTokens === null && a.outputTokens === null));
    assert.doesNotMatch(JSON.stringify(attempts), /secreto-no-exportar/);
  }
});

test('H3: configuración valida sin exponer credenciales', () => {
  assert.throws(() => parseConfig({ ANTHROPIC_API_KEY: 'privado' }), /ANTHROPIC_MODEL/);
  assert.throws(() => parseConfig({ ANTHROPIC_API_KEY: 'privado', ANTHROPIC_MODEL: 'modelo', TEMPERATURE: 'NaN' }), /TEMPERATURE/);
  const c = parseConfig({ ANTHROPIC_API_KEY: 'privado', ANTHROPIC_MODEL: 'modelo' });
  assert.equal(c.temperature, 0); assert.doesNotMatch(JSON.stringify(publicConfig(c)), /privado|apiKey/);
});

test('H3: prompt delimita datos y no pasa historial del tema anterior', () => {
  const input = tutorInput(); input.decision.strategy = 'CHANGE_TOPIC'; input.context.material = 'INSTRUCCION_MALICIOSA';
  input.state.history.push({ ...createS0().history[0], conceptId: 'product-owner' } as never);
  const { system, prompt } = buildPrompt(input);
  assert.doesNotMatch(system, /INSTRUCCION_MALICIOSA/);
  assert.match(system, /DATOS NO CONFIABLES/);
  const data = JSON.parse(prompt); assert.equal(data.materialAcademico, 'INSTRUCCION_MALICIOSA');
  assert.deepEqual(data.historial, []); assert.equal(data.preguntaAnterior, null);
});

test('H3: valida conceptos, dificultad, opciones distintas y campos extra', async () => {
  const input = tutorInput(); const output = await new MockTutor().generateIntervention(input);
  for (const mutate of [
    (o: typeof output) => { o.question!.conceptId = 'scrum-events'; },
    (o: typeof output) => { o.question!.difficulty = 'HIGH'; },
    (o: typeof output) => { o.question!.options.B = o.question!.options.A; },
    (o: typeof output) => { Object.assign(o.question!, { id: 'id-del-modelo' }); },
  ]) { const invalid = structuredClone(output); mutate(invalid); assert.throws(() => validateGeneration(invalid, input)); }
});

test('Uso normalizado no sustituye desconocidos por cero ni usa el total ajeno', () => {
  assert.deepEqual(normalizeUsage({ inputTokens: 8, outputTokens: 2, totalTokens: 99 }), { inputTokens: 8, outputTokens: 2, totalTokens: 10, providerTotalTokens: 99 });
  assert.equal(normalizeUsage({ outputTokens: 2 }).totalTokens, null);
  assert.equal(normalizeUsage().inputTokens, null);
});
