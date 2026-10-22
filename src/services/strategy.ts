import type { Diagnosis, StrategyDecision, StudentAction, StudySession } from '../domain/contracts.js';

export function selectStrategy(state: StudySession, action: StudentAction | null, diagnosis: Diagnosis): StrategyDecision {
  if (!action) return { strategy: 'START_TOPIC', difficulty: 'LOW', justification: 'RP01: presentar temas del material.' };
  if (action.action === 'CHANGE_TOPIC') return { strategy: 'CHANGE_TOPIC', difficulty: 'LOW', justification: 'RP07: respetar el tema elegido.' };
  // La pista explícita tiene prioridad y no representa un error del estudiante.
  if (action.action === 'REQUEST_HINT') return { strategy: 'HINT', difficulty: state.currentQuestion!.difficulty, justification: 'RP07: ayuda solicitada sin sumar errores.' };
  if (diagnosis.result === 'INCORRECT') {
    if (state.consecutiveErrors + 1 >= 2) return { strategy: 'SIMPLIFY', difficulty: 'LOW', justification: 'RP05: dos o más errores del mismo concepto; explicar y simplificar.' };
    return { strategy: 'HINT', difficulty: state.currentQuestion!.difficulty,
      justification: state.currentQuestion!.questionType === 'TRANSFER' ? 'RP06: transferencia fallida; reforzar sin declarar dominio.' : 'RP04: primer error; orientar y permitir reintento.' };
  }
  if (diagnosis.result === 'CORRECT' && diagnosis.evidence === 'CONSISTENT') {
    return { strategy: 'DEEPEN', difficulty: 'MEDIUM', justification: 'RP06: acierto y transferencia positiva; explorar otra situación.' };
  }
  return { strategy: 'VERIFY', difficulty: 'MEDIUM', justification: 'RP03: el acierto requiere evidencia de transferencia.' };
}
