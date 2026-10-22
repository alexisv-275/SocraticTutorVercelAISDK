import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CORPUS, corpusHash } from '../academic/context.js';
import { createClaude } from '../config/claude.js';
import { loadConfig, publicConfig, ConfigurationError } from '../config/env.js';
import { MockTutor } from '../fixtures/mock-tutor.js';
import { MemorySessionStore } from '../infrastructure/memory-store.js';
import { MetricsCollector } from '../infrastructure/metrics.js';
import { StudyOrchestrator } from '../services/orchestrator.js';
import { ClaudeTutor } from '../services/tutor.js';

export function createRuntime(mock: boolean) {
  const config = mock ? null : loadConfig();
  const metrics = new MetricsCollector(randomUUID(), mock ? 'mock' : 'claude', config?.model ?? null);
  const tutor = config ? new ClaudeTutor(createClaude(config), config) : new MockTutor();
  return { orchestrator: new StudyOrchestrator(new MemorySessionStore(), tutor, metrics), metrics,
    metadata: { architecture: 'ai-sdk', mode: mock ? 'mock' : 'claude', runId: metrics.runId,
      configuration: config ? publicConfig(config) : null, corpus: { ...CORPUS, sha256: corpusHash } } };
}
export async function saveReport(prefix: string, runId: string, report: unknown): Promise<string> {
  const directory = resolve('outputs'); await mkdir(directory, { recursive: true });
  const file = resolve(directory, `${prefix}-${runId}.json`);
  await writeFile(file, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  return file;
}
export function reportCliError(error: unknown) {
  console.error(error instanceof ConfigurationError ? error.message : 'No se pudo completar la ejecución o guardar el reporte. Revisa los permisos y la configuración.');
  process.exitCode = 1;
}
