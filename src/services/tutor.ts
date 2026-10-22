import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { APICallError, generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, type LanguageModel } from 'ai';
import { TutorGenerationSchema, type TutorGeneration } from '../domain/contracts.js';
import { InvalidGenerationError, validateGeneration } from '../domain/validation.js';
import { normalizeUsage, type AttemptRecorder, type TokenUsage } from '../infrastructure/attempt.js';
import type { ModelConfig } from '../config/env.js';
import { buildPrompt } from './prompt.js';
import type { Tutor, TutorInput } from './tutor-contract.js';

export class TutorError extends Error {
  constructor(public readonly code: string) { super(code); }
}
export function classifyError(error: unknown): { code: string; retryable: boolean } {
  if (error instanceof InvalidGenerationError || NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
    return { code: 'INVALID_OUTPUT', retryable: true };
  }
  if (APICallError.isInstance(error)) return { code: `API_${error.statusCode ?? 'CONNECTION'}`, retryable: error.isRetryable };
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return { code: 'TIMEOUT', retryable: true };
  return { code: 'GENERATION_FAILED', retryable: false };
}

export class ClaudeTutor implements Tutor {
  constructor(private readonly model: LanguageModel, private readonly config: Pick<ModelConfig, 'model' | 'temperature' | 'maxOutputTokens'>,
    private readonly pause: (ms: number) => Promise<unknown> = delay) {}

  async generateIntervention(input: TutorInput, recordAttempt: AttemptRecorder = () => {}): Promise<TutorGeneration> {
    const prompt = buildPrompt(input);
    for (let index = 0; index < 2; index += 1) {
      const startedAt = new Date().toISOString();
      const start = performance.now();
      let usage: TokenUsage | undefined;
      try {
        const result = await generateText({ model: this.model, ...prompt,
          output: Output.object({ schema: TutorGenerationSchema }),
          temperature: this.config.temperature, maxOutputTokens: this.config.maxOutputTokens,
          maxRetries: 0, abortSignal: AbortSignal.timeout(45000),
        });
        // totalUsage ya agrega el uso del SDK: jamás sumar también usage.
        usage = result.totalUsage;
        const output = validateGeneration(result.output, input);
        recordAttempt({ callId: randomUUID(), roleOrAgent: 'Tutor', model: this.config.model, startedAt,
          finishedAt: new Date().toISOString(), durationMs: performance.now() - start,
          status: 'SUCCEEDED', ...normalizeUsage(usage), error: null });
        return output;
      } catch (error) {
        if (!usage && NoObjectGeneratedError.isInstance(error)) usage = error.usage;
        const failure = classifyError(error);
        recordAttempt({ callId: randomUUID(), roleOrAgent: 'Tutor', model: this.config.model, startedAt,
          finishedAt: new Date().toISOString(), durationMs: performance.now() - start,
          status: 'FAILED', ...normalizeUsage(usage), error: failure.code });
        // Solo un reintento explícito; errores de autenticación/configuración no se repiten.
        if (index === 0 && failure.retryable) { await this.pause(500); continue; }
        throw new TutorError(failure.code);
      }
    }
    throw new TutorError('GENERATION_FAILED');
  }
}
