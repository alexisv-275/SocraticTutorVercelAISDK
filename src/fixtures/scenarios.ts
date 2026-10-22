import { StudySessionSchema, type HistoryEvent, type StudentAction, type StudySession } from '../domain/contracts.js';
import { QUESTIONS } from './questions.js';

export const SCENARIO_IDS = ['E1', 'E2', 'E3', 'E4', 'E5'] as const;
export type ScenarioId = typeof SCENARIO_IDS[number];
export function createS0(): StudySession {
  return StudySessionSchema.parse({ sessionId: 'test-session', topicId: 'scrum-roles', conceptId: 'product-owner',
    currentQuestion: QUESTIONS.Q01, consecutiveErrors: 0, helpLevel: 'NONE', comprehension: 'UNASSESSED',
    history: [], resolvedSituations: 0 });
}
function priorAnswer(correct: boolean): HistoryEvent {
  return { topicId: 'scrum-roles', conceptId: 'product-owner', questionId: 'Q01', questionType: 'INITIAL',
    action: { action: 'ANSWER', questionId: 'Q01', selectedOptionId: correct ? 'B' : 'A' },
    result: correct ? 'CORRECT' : 'INCORRECT', strategy: correct ? 'VERIFY' : 'HINT',
    helpLevel: correct ? 'NONE' : 'HINT', comprehension: correct ? 'PENDING_VERIFICATION' : 'IN_PROGRESS' };
}
export function loadScenario(id: ScenarioId): { state: StudySession; action: StudentAction } {
  const state = createS0();
  if (id === 'E3' || id === 'E5') {
    state.currentQuestion = structuredClone(QUESTIONS.Q02);
    state.consecutiveErrors = 1;
    state.helpLevel = 'HINT';
    state.comprehension = 'IN_PROGRESS';
    state.history = [priorAnswer(false)];
  } else if (id === 'E4') {
    state.currentQuestion = structuredClone(QUESTIONS.Q03);
    state.comprehension = 'PENDING_VERIFICATION';
    state.history = [priorAnswer(true)];
  }
  const action: StudentAction = id === 'E5' ? { action: 'CHANGE_TOPIC', targetTopicId: 'scrum-events' }
    : { action: 'ANSWER', questionId: state.currentQuestion!.id, selectedOptionId: id === 'E1' ? 'B' : 'A' };
  return { state: StudySessionSchema.parse(state), action };
}
