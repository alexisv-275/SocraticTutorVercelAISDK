import { QuestionSchema } from '../domain/contracts.js';

export const QUESTIONS = {
  Q01: QuestionSchema.parse({
    id: 'Q01', text: 'En Scrum, ¿quién es responsable de maximizar el valor del producto?',
    options: { A: 'Developers.', B: 'Product Owner.', C: 'Scrum Master.' },
    correctOptionId: 'B', questionType: 'INITIAL', difficulty: 'LOW', conceptId: 'product-owner',
  }),
  Q02: QuestionSchema.parse({
    id: 'Q02', text: 'Varios interesados solicitan funcionalidades diferentes. ¿Quién responde por la gestión efectiva del Product Backlog?',
    options: { A: 'Scrum Master.', B: 'Developers.', C: 'Product Owner.' },
    correctOptionId: 'C', questionType: 'REFORMULATION', difficulty: 'MEDIUM', conceptId: 'product-owner',
  }),
  Q03: QuestionSchema.parse({
    id: 'Q03', text: 'Dos funcionalidades compiten por prioridad: una es la más solicitada y otra parece aportar más valor. ¿Qué actuación corresponde mejor con Scrum?',
    options: { A: 'Implementar siempre la más solicitada.', B: 'El Product Owner evalúa el valor y ordena el Product Backlog.', C: 'El Scrum Master decide unilateralmente la prioridad.' },
    correctOptionId: 'B', questionType: 'TRANSFER', difficulty: 'MEDIUM', conceptId: 'product-owner',
  }),
};
