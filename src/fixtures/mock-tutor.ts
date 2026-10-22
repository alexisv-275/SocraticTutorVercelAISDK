import { TOPICS } from '../academic/context.js';
import type { TutorGeneration } from '../domain/contracts.js';
import type { Tutor, TutorInput } from '../services/tutor-contract.js';

// Doble local de prueba: nunca se registra como llamada ni respuesta real de Claude.
export class MockTutor implements Tutor {
  calls = 0;
  async generateIntervention(input: TutorInput): Promise<TutorGeneration> {
    this.calls += 1;
    const { strategy, difficulty } = input.decision;
    if (strategy === 'START_TOPIC') return { kind: 'TOPIC_CHOICES', message: 'Elige un tema del material.', question: null, topics: TOPICS.map(t => ({ ...t })) };
    const conceptId = input.state.conceptId ?? input.context.concepts[0]!;
    const questionType = strategy === 'HINT' ? 'REFORMULATION' : strategy === 'SIMPLIFY' ? 'SIMPLIFIED' : strategy === 'CHANGE_TOPIC' ? 'INITIAL' : 'TRANSFER';
    const isEvents = conceptId === 'scrum-events';
    const isBacklog = conceptId === 'product-backlog';
    return { kind: 'QUESTION', topics: null,
      message: strategy === 'HINT' ? 'Considera quién se ocupa del valor y quién facilita la efectividad del marco.'
        : strategy === 'SIMPLIFY' ? 'El Product Owner se responsabiliza del valor del producto. Revisemos una situación más sencilla.'
        : strategy === 'CHANGE_TOPIC' ? 'Comencemos con el tema elegido, dentro de lo que describe el material.'
        : 'Exploremos otra situación para comprobar tu comprensión.',
      question: { text: isEvents ? `¿Qué pareja aparece como eventos de Scrum en el material? (Caso ${this.calls})`
        : isBacklog ? `Si cambian las prioridades del producto, ¿quién responde por ordenar el Product Backlog? (Caso ${this.calls})`
        : strategy === 'SIMPLIFY' ? `Se busca mejorar el valor del producto. ¿A quién corresponde esa responsabilidad? (Caso ${this.calls})`
        : `Un equipo debe ordenar iniciativas según su valor. ¿Quién responde por esa gestión? (Caso ${this.calls})`,
        options: isEvents ? { A: 'Sprint Planning y Daily Scrum.', B: 'Product Owner y Developers.', C: 'Scrum Master y Product Owner.' }
          : { A: 'Scrum Master.', B: 'Developers.', C: 'Product Owner.' },
        correctOptionId: isEvents ? 'A' : 'C', questionType, difficulty, conceptId,
        privateRationale: 'Justificación privada del mock basada en el contexto provisional.' } };
  }
}
