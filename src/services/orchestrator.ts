import { randomUUID } from 'node:crypto';
import { getContext } from '../academic/context.js';
import { StudentActionSchema, type Diagnosis, type StudySession, type PublicTurnResponse } from '../domain/contracts.js';
import { publicResponse, validateGeneration } from '../domain/validation.js';
import { MemorySessionStore } from '../infrastructure/memory-store.js';
import { MetricsCollector } from '../infrastructure/metrics.js';
import { TutorError } from './tutor.js';
import { evaluateAnswer } from './diagnostic.js';
import { selectStrategy } from './strategy.js';
import type { Tutor, TutorInput } from './tutor-contract.js';

const NO_DIAGNOSIS: Diagnosis = { result: 'NOT_APPLICABLE', evidence: 'INSUFFICIENT', difficultyDetected: null, requiresVerification: false };

export class StudyOrchestrator {
  private readonly busy = new Set<string>();
  constructor(private readonly store: MemorySessionStore, private readonly tutor: Tutor, readonly metrics = new MetricsCollector()) {}
  loadSession(state: StudySession): void {
    if (this.busy.has(state.sessionId)) throw new Error('La sesión tiene un turno en curso.');
    this.store.save(state);
  }
  getSession(id: string) { return this.store.get(id); }

  async startSession(sessionId: string = randomUUID(), scenarioId: string | null = null): Promise<PublicTurnResponse> {
    const turn = this.metrics.startTurn(sessionId, scenarioId);
    if (this.store.get(sessionId) || this.busy.has(sessionId)) {
      const response = publicResponse('La sesión ya existe.', this.store.get(sessionId));
      this.metrics.finishTurn(turn, 'CLARIFICATION', 'SESSION_EXISTS');
      return response;
    }
    this.busy.add(sessionId);
    const state: StudySession = { sessionId, topicId: null, conceptId: null, currentQuestion: null,
      consecutiveErrors: 0, helpLevel: 'NONE', comprehension: 'UNASSESSED', history: [], resolvedSituations: 0 };
    try {
      const input: TutorInput = { context: getContext(null, null), state, diagnosis: NO_DIAGNOSIS, decision: selectStrategy(state, null, NO_DIAGNOSIS) };
      turn.metric.strategy = input.decision.strategy; turn.metric.pedagogicalDecision = input.decision; turn.metric.result = NO_DIAGNOSIS.result;
      const output = validateGeneration(await this.tutor.generateIntervention(structuredClone(input), a => this.metrics.recordLLMAttempt(turn, a)), input);
      const response = publicResponse(output.message, state, output.topics);
      this.store.save(state);
      this.metrics.finishTurn(turn, 'SUCCEEDED');
      return response;
    } catch (error) {
      const response = publicResponse('No se pudo iniciar la sesión. Intenta de nuevo.', undefined);
      this.metrics.finishTurn(turn, 'FAILED', error instanceof TutorError ? error.code : 'GENERATION_FAILED');
      return response;
    } finally { this.busy.delete(sessionId); }
  }

  async handleTurn(sessionId: string, rawAction: unknown, scenarioId: string | null = null): Promise<PublicTurnResponse> {
    const turn = this.metrics.startTurn(sessionId, scenarioId);
    const original = this.store.get(sessionId);
    const clarify = (message: string, error: string) => {
      const response = publicResponse(message, original);
      this.metrics.finishTurn(turn, 'CLARIFICATION', error);
      return response;
    };
    if (!original) return clarify('La sesión no existe. Inicia una sesión.', 'SESSION_NOT_FOUND');
    if (this.busy.has(sessionId)) return clarify('Espera a que termine el turno actual.', 'TURN_IN_PROGRESS');
    const parsed = StudentActionSchema.safeParse(rawAction);
    if (!parsed.success || (parsed.data.action !== 'CHANGE_TOPIC' && parsed.data.questionId !== original.currentQuestion?.id)) {
      return clarify('Selecciona una opción válida para la pregunta vigente o un tema disponible.', 'INVALID_ACTION');
    }
    this.busy.add(sessionId);
    try {
      const action = parsed.data;
      const diagnosis = evaluateAnswer(original, action);
      const decision = selectStrategy(original, action, diagnosis);
      turn.metric.strategy = decision.strategy; turn.metric.pedagogicalDecision = decision; turn.metric.result = diagnosis.result;
      const draft = structuredClone(original);
      if (action.action === 'CHANGE_TOPIC') {
        draft.topicId = action.targetTopicId;
        draft.conceptId = null;
        draft.currentQuestion = null;
        draft.consecutiveErrors = 0;
        draft.helpLevel = 'NONE';
        draft.comprehension = 'UNASSESSED';
      } else if (action.action === 'ANSWER') {
        draft.consecutiveErrors = diagnosis.result === 'INCORRECT' ? original.consecutiveErrors + 1 : 0;
        draft.comprehension = diagnosis.result === 'INCORRECT' ? 'IN_PROGRESS'
          : diagnosis.evidence === 'CONSISTENT' ? 'VERIFIED' : 'PENDING_VERIFICATION';
        if (diagnosis.evidence === 'CONSISTENT') draft.resolvedSituations += 1;
      }
      if (decision.strategy === 'HINT') draft.helpLevel = 'HINT';
      if (decision.strategy === 'SIMPLIFY') draft.helpLevel = 'EXPLANATION';
      const input: TutorInput = { context: getContext(draft.topicId, draft.conceptId), decision, state: draft, diagnosis, action };
      const output = validateGeneration(await this.tutor.generateIntervention(structuredClone(input), a => this.metrics.recordLLMAttempt(turn, a)), input);
      const generated = output.question!;
      draft.currentQuestion = { ...generated, id: `q-${randomUUID()}` };
      draft.conceptId = generated.conceptId;
      draft.history.push({ topicId: action.action === 'CHANGE_TOPIC' ? draft.topicId : original.topicId,
        conceptId: action.action === 'CHANGE_TOPIC' ? draft.conceptId : original.conceptId,
        questionId: action.action === 'CHANGE_TOPIC' ? null : original.currentQuestion!.id,
        questionType: action.action === 'CHANGE_TOPIC' ? null : original.currentQuestion!.questionType,
        action, result: diagnosis.result, strategy: decision.strategy, helpLevel: draft.helpLevel, comprehension: draft.comprehension });
      const response = publicResponse(output.message, draft);
      // Único commit: una generación fallida nunca adelanta el estado pedagógico.
      this.store.save(draft);
      this.metrics.finishTurn(turn, 'SUCCEEDED');
      return response;
    } catch (error) {
      const response = publicResponse('No se pudo generar la intervención. Tu progreso se conserva; puedes reintentar.', original);
      this.metrics.finishTurn(turn, 'FAILED', error instanceof TutorError ? error.code : 'GENERATION_FAILED');
      return response;
    } finally { this.busy.delete(sessionId); }
  }
}
