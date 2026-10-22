import { z } from 'zod';

export const TopicIdSchema = z.enum(['scrum-roles', 'scrum-events', 'scrum-backlog']);
export const ConceptIdSchema = z.enum(['product-owner', 'scrum-master', 'developers', 'scrum-events', 'product-backlog']);
export const OptionIdSchema = z.enum(['A', 'B', 'C']);
export const DifficultySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const QuestionTypeSchema = z.enum(['INITIAL', 'REFORMULATION', 'TRANSFER', 'SIMPLIFIED']);
export const HelpLevelSchema = z.enum(['NONE', 'HINT', 'EXPLANATION']);
export const ComprehensionSchema = z.enum(['UNASSESSED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'VERIFIED']);
export const StrategySchema = z.enum(['START_TOPIC', 'DEEPEN', 'HINT', 'SIMPLIFY', 'VERIFY', 'CHANGE_TOPIC', 'CHECKPOINT']);
const text = z.string().trim().min(1);

export const StudentActionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('ANSWER'), questionId: text, selectedOptionId: OptionIdSchema }),
  z.strictObject({ action: z.literal('REQUEST_HINT'), questionId: text }),
  z.strictObject({ action: z.literal('CHANGE_TOPIC'), targetTopicId: TopicIdSchema }),
]);

export const GeneratedQuestionSchema = z.strictObject({
  text,
  options: z.strictObject({ A: text, B: text, C: text }),
  correctOptionId: OptionIdSchema,
  questionType: QuestionTypeSchema,
  difficulty: DifficultySchema,
  conceptId: ConceptIdSchema,
  privateRationale: text,
});
export const QuestionSchema = GeneratedQuestionSchema.omit({ privateRationale: true }).extend({
  id: text,
  privateRationale: text.optional(),
});
export const TopicSchema = z.strictObject({ id: TopicIdSchema, title: text });

// Un objeto raíz con campos nulos funciona también en los esquemas del proveedor.
export const TutorGenerationSchema = z.strictObject({
  kind: z.enum(['QUESTION', 'TOPIC_CHOICES', 'FEEDBACK']),
  message: text,
  question: GeneratedQuestionSchema.nullable(),
  topics: z.array(TopicSchema).nullable(),
});

export const DiagnosisSchema = z.strictObject({
  result: z.enum(['CORRECT', 'INCORRECT', 'UNCERTAIN', 'NOT_APPLICABLE']),
  evidence: z.enum(['INSUFFICIENT', 'PARTIAL', 'CONSISTENT']),
  difficultyDetected: text.nullable(),
  requiresVerification: z.boolean(),
});
export const StrategyDecisionSchema = z.strictObject({
  strategy: StrategySchema,
  difficulty: DifficultySchema,
  justification: text,
});
export const HistoryEventSchema = z.strictObject({
  topicId: TopicIdSchema.nullable(),
  conceptId: ConceptIdSchema.nullable(),
  questionId: text.nullable(),
  questionType: QuestionTypeSchema.nullable(),
  action: StudentActionSchema.nullable(),
  result: DiagnosisSchema.shape.result,
  strategy: StrategySchema,
  helpLevel: HelpLevelSchema,
  comprehension: ComprehensionSchema,
});
export const StudySessionSchema = z.strictObject({
  sessionId: text,
  topicId: TopicIdSchema.nullable(),
  conceptId: ConceptIdSchema.nullable(),
  currentQuestion: QuestionSchema.nullable(),
  consecutiveErrors: z.number().int().nonnegative(),
  helpLevel: HelpLevelSchema,
  comprehension: ComprehensionSchema,
  history: z.array(HistoryEventSchema),
  resolvedSituations: z.number().int().nonnegative(),
});
export const PublicQuestionSchema = z.strictObject({
  id: text, text, options: GeneratedQuestionSchema.shape.options,
});
export const PublicTurnResponseSchema = z.strictObject({
  message: text,
  question: PublicQuestionSchema.nullable(),
  topics: z.array(TopicSchema).nullable(),
  actions: z.array(z.enum(['4. Necesito una pista', '5. Cambiar de tema'])),
});

export type TopicId = z.infer<typeof TopicIdSchema>;
export type ConceptId = z.infer<typeof ConceptIdSchema>;
export type StudentAction = z.infer<typeof StudentActionSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type StudySession = z.infer<typeof StudySessionSchema>;
export type Diagnosis = z.infer<typeof DiagnosisSchema>;
export type StrategyDecision = z.infer<typeof StrategyDecisionSchema>;
export type TutorGeneration = z.infer<typeof TutorGenerationSchema>;
export type PublicTurnResponse = z.infer<typeof PublicTurnResponseSchema>;
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;
export const QUESTION_ACTIONS: PublicTurnResponse['actions'] = ['4. Necesito una pista', '5. Cambiar de tema'];
