import type { AcademicContext } from '../academic/context.js';
import type { Diagnosis, StrategyDecision, StudentAction, StudySession, TutorGeneration } from '../domain/contracts.js';
import type { AttemptRecorder } from '../infrastructure/attempt.js';

export interface TutorInput {
  context: AcademicContext;
  decision: StrategyDecision;
  state: StudySession;
  diagnosis: Diagnosis;
  action?: StudentAction | null;
}
export interface Tutor {
  generateIntervention(input: TutorInput, recordAttempt?: AttemptRecorder): Promise<TutorGeneration>;
}
