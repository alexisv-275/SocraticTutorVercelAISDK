import type { Diagnosis, StudentAction, StudySession } from '../domain/contracts.js';

export function hasPriorSuccess(state: StudySession): boolean {
  // Un cambio de tema corta la evidencia activa aunque se regrese al mismo concepto.
  const boundary = state.history.findLastIndex(event => event.strategy === 'CHANGE_TOPIC');
  return state.history.slice(boundary + 1).some(event => event.conceptId === state.conceptId
    && event.topicId === state.topicId && event.result === 'CORRECT'
    && event.questionType !== 'TRANSFER');
}

export function evaluateAnswer(state: StudySession, action: StudentAction): Diagnosis {
  if (action.action !== 'ANSWER') return { result: 'NOT_APPLICABLE', evidence: 'INSUFFICIENT', difficultyDetected: null, requiresVerification: false };
  const question = state.currentQuestion;
  if (!question || question.id !== action.questionId) throw new Error('Pregunta no vigente.');
  const correct = action.selectedOptionId === question.correctOptionId;
  const verified = correct && question.questionType === 'TRANSFER'
    && (state.comprehension === 'PENDING_VERIFICATION' || state.comprehension === 'VERIFIED') && hasPriorSuccess(state);
  return {
    result: correct ? 'CORRECT' : 'INCORRECT',
    evidence: verified ? 'CONSISTENT' : correct ? 'PARTIAL' : 'INSUFFICIENT',
    difficultyDetected: correct ? null : question.questionType === 'TRANSFER'
      ? 'La opción elegida no coincide con la clave en la transferencia.'
      : 'La opción elegida no coincide con la clave del concepto activo.',
    requiresVerification: correct && !verified,
  };
}
