import { TOPICS, TOPIC_CONCEPTS } from '../academic/context.js';
import { TutorGenerationSchema, PublicTurnResponseSchema, QUESTION_ACTIONS, type PublicTurnResponse, type StudySession } from './contracts.js';
import type { TutorInput } from '../services/tutor-contract.js';

export class InvalidGenerationError extends Error {}
export function validateGeneration(value: unknown, input: TutorInput) {
  const parsed = TutorGenerationSchema.safeParse(value);
  if (!parsed.success) throw new InvalidGenerationError('La salida no cumple el esquema del Tutor.');
  const output = parsed.data;
  const fail = (message: string): never => { throw new InvalidGenerationError(message); };
  const strategy = input.decision.strategy;
  if (strategy === 'START_TOPIC') {
    if (output.kind !== 'TOPIC_CHOICES' || output.question !== null || output.topics?.length !== 3
      || new Set(output.topics.map(t => t.id)).size !== 3
      || output.topics.some(t => !TOPICS.some(known => known.id === t.id && known.title === t.title))) {
      fail('El inicio debe presentar los tres temas únicos del corpus.');
    }
    return output;
  }
  if (output.kind !== 'QUESTION' || !output.question || output.topics !== null) fail('La estrategia requiere una pregunta y una nueva oportunidad de respuesta.');
  const q = output.question!;
  const topic = input.state.topicId;
  if (!topic || !TOPIC_CONCEPTS[topic].includes(q.conceptId)) fail('Concepto ajeno al tema activo.');
  if (strategy !== 'CHANGE_TOPIC' && q.conceptId !== input.state.conceptId) fail('La intervención debe conservar el concepto activo.');
  const expected = { VERIFY: 'TRANSFER', HINT: 'REFORMULATION', SIMPLIFY: 'SIMPLIFIED', CHANGE_TOPIC: 'INITIAL', DEEPEN: 'TRANSFER', CHECKPOINT: 'TRANSFER' }[strategy];
  if (q.questionType !== expected || q.difficulty !== input.decision.difficulty) fail('Tipo o dificultad incoherentes con la estrategia.');
  if (new Set(Object.values(q.options).map(t => t.toLocaleLowerCase())).size !== 3) fail('Las opciones deben ser diferentes.');
  if (q.text === input.state.currentQuestion?.text) fail('Se requiere una nueva pregunta o reformulación.');
  return output;
}

export function publicResponse(message: string, state: StudySession | undefined, topics: PublicTurnResponse['topics'] = null): PublicTurnResponse {
  const q = state?.currentQuestion;
  // Lista positiva: nunca serializar una pregunta privada y quitar solo algunos campos.
  return PublicTurnResponseSchema.parse({ message, question: q ? { id: q.id, text: q.text, options: { ...q.options } } : null,
    topics, actions: q ? [...QUESTION_ACTIONS] : [] });
}
