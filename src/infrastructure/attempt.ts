export interface TokenUsage { inputTokens?: number; outputTokens?: number; totalTokens?: number }
export interface LLMAttempt {
  callId: string;
  roleOrAgent: 'Tutor';
  model: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'SUCCEEDED' | 'FAILED';
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  providerTotalTokens: number | null;
  error: string | null;
}
export type AttemptRecorder = (attempt: LLMAttempt) => void;
export function normalizeUsage(usage?: TokenUsage) {
  const valid = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
  const inputTokens = valid(usage?.inputTokens);
  const outputTokens = valid(usage?.outputTokens);
  return { inputTokens, outputTokens, totalTokens: inputTokens === null || outputTokens === null ? null : inputTokens + outputTokens,
    providerTotalTokens: valid(usage?.totalTokens) };
}
