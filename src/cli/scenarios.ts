import { pathToFileURL } from 'node:url';
import { RUBRIC } from '../domain/rules.js';
import { loadScenario, SCENARIO_IDS, type ScenarioId } from '../fixtures/scenarios.js';
import type { PublicTurnResponse } from '../domain/contracts.js';
import { createRuntime, reportCliError, saveReport } from './runtime.js';

export async function runScenarios(mock: boolean, includeStart = false, ids: readonly ScenarioId[] = SCENARIO_IDS) {
  const runtime = createRuntime(mock);
  const scenarios = [];
  for (const id of ids) {
    const { state, action } = loadScenario(id);
    // Cada caso recibe una copia limpia; no hay llamadas de inicialización ocultas.
    const before = structuredClone(state);
    runtime.orchestrator.loadSession(state);
    const response = await runtime.orchestrator.handleTurn(state.sessionId, action, id);
    scenarios.push({ scenarioId: id, action, publicResponse: response,
      privateEvaluation: { before, after: runtime.orchestrator.getSession(state.sessionId) },
      rubric: { criteria: RUBRIC[id], passedChecks: null, applicableChecks: null, criticalFailures: null, notes: null },
    });
  }
  let startCheck: PublicTurnResponse | null = null;
  if (includeStart) startCheck = await runtime.orchestrator.startSession('start-check', 'RP01');
  return { ...runtime.metadata, generatedAt: new Date().toISOString(),
    notice: mock ? 'SIMULACIÓN SIN CLAUDE. No acredita calidad pedagógica ni eficiencia real.' : 'Evaluación pedagógica manual pendiente.',
    privacy: 'privateEvaluation contiene claves para el evaluador; no mostrar este archivo al estudiante.',
    scenarios, startCheck, metrics: runtime.metrics.export() };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--mock' && a !== '--include-start')) {
    console.error('Uso: npm run scenarios -- [--mock] [--include-start]'); process.exitCode = 1; return;
  }
  const report = await runScenarios(args.includes('--mock'), args.includes('--include-start'));
  const file = await saveReport('scenarios', report.runId, report);
  console.log(report.notice);
  for (const metric of report.metrics) console.log(`${metric.scenarioId}: ${metric.status} | ${metric.strategy} | llamadas=${metric.llmCalls} | tokens=${metric.totalTokens ?? 'null'} | ${metric.latencyMs.toFixed(1)} ms`);
  console.log(`Reporte privado de evaluación: ${file}`);
  if (report.metrics.some(m => m.status === 'FAILED')) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(reportCliError);
