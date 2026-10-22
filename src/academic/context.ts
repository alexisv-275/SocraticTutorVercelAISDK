import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { ConceptId, TopicId } from '../domain/contracts.js';

export const TOPICS = [
  { id: 'scrum-roles', title: 'Responsabilidades en Scrum' },
  { id: 'scrum-events', title: 'Eventos de Scrum' },
  { id: 'scrum-backlog', title: 'Gestión del Product Backlog' },
] as const;
export const TOPIC_CONCEPTS: Record<TopicId, readonly ConceptId[]> = {
  'scrum-roles': ['product-owner', 'scrum-master', 'developers'],
  'scrum-events': ['scrum-events'],
  'scrum-backlog': ['product-backlog'],
};
export const CORPUS = {
  id: 'contrato-v0.3-provisional',
  status: 'PROVISIONAL' as const,
  source: 'Contrato-pedagogico-y-pruebas.md, sección 4',
  limitation: 'El texto solo nombra eventos; no permite enseñar su propósito. Pendiente el Markdown académico común del usuario.',
};
const material = readFileSync(new URL('./scrum.md', import.meta.url), 'utf8');
export const corpusHash = createHash('sha256').update(material).digest('hex');

// El corpus breve completo evita perder contexto y no requiere recuperación documental.
export function getContext(topicId: TopicId | null, conceptId: ConceptId | null) {
  return { ...CORPUS, sha256: corpusHash, material, topicId, conceptId, topics: TOPICS,
    concepts: topicId ? TOPIC_CONCEPTS[topicId] : [] };
}
export type AcademicContext = ReturnType<typeof getContext>;
