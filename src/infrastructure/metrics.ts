import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Diagnosis, StrategyDecision } from '../domain/contracts.js';
import type { LLMAttempt } from './attempt.js';

export interface TurnMetric {
  runId: string;
  turnId: string;
  architecture: 'ai-sdk';
  mode: 'mock' | 'claude';
  scenarioId: string | null;
  sessionId: string;
  model: string | null;
  strategy: StrategyDecision['strategy'] | null;
  pedagogicalDecision: StrategyDecision | null;
  result: Diagnosis['result'] | null;
  status: 'SUCCEEDED' | 'FAILED' | 'CLARIFICATION';
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  llmCalls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  error: string | null;
  llmAttempts: (LLMAttempt & { runId: string; turnId: string })[];
}
export interface TurnHandle { metric: TurnMetric; start: number }

function sumKnown(attempts: LLMAttempt[], key: 'inputTokens' | 'outputTokens'): number | null {
  return attempts.some(a => a[key] === null) ? null : attempts.reduce((sum, a) => sum + a[key]!, 0);
}

export class MetricsCollector {
  private readonly turns: TurnMetric[] = [];
  constructor(readonly runId = randomUUID(), readonly mode: 'mock' | 'claude' = 'mock', readonly model: string | null = null) {}
  startTurn(sessionId: string, scenarioId: string | null = null): TurnHandle {
    return { start: performance.now(), metric: { runId: this.runId, turnId: randomUUID(), architecture: 'ai-sdk', mode: this.mode,
      scenarioId, sessionId, model: this.model, strategy: null, pedagogicalDecision: null, result: null,
      status: 'CLARIFICATION', startedAt: new Date().toISOString(), finishedAt: '', latencyMs: 0, llmCalls: 0,
      inputTokens: 0, outputTokens: 0, totalTokens: 0, error: null, llmAttempts: [] } };
  }
  recordLLMAttempt(turn: TurnHandle, attempt: LLMAttempt): void {
    turn.metric.llmAttempts.push({ ...structuredClone(attempt), runId: this.runId, turnId: turn.metric.turnId });
  }
  finishTurn(turn: TurnHandle, status: TurnMetric['status'], error: string | null = null): void {
    const m = turn.metric;
    m.status = status; m.error = error;
    m.finishedAt = new Date().toISOString(); m.latencyMs = performance.now() - turn.start;
    m.llmCalls = m.llmAttempts.length;
    m.inputTokens = sumKnown(m.llmAttempts, 'inputTokens'); m.outputTokens = sumKnown(m.llmAttempts, 'outputTokens');
    m.totalTokens = m.inputTokens === null || m.outputTokens === null ? null : m.inputTokens + m.outputTokens;
    this.turns.push(structuredClone(m));
  }
  export(): TurnMetric[] { return structuredClone(this.turns); }
}
