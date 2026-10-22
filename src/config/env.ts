import { config as dotenv } from 'dotenv';
import { z } from 'zod';

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().trim().min(1),
  ANTHROPIC_MODEL: z.string().trim().min(1),
  TEMPERATURE: z.coerce.number().min(0).max(1).default(0),
  MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).max(16384).default(1200),
});
export interface ModelConfig { apiKey: string; model: string; temperature: number; maxOutputTokens: number }
export class ConfigurationError extends Error {}
export function parseConfig(env: Record<string, string | undefined>): ModelConfig {
  const result = EnvSchema.safeParse(env);
  if (!result.success) throw new ConfigurationError(`Revisa .env: ${[...new Set(result.error.issues.map(i => i.path.join('.')))].join(', ')}. Usa .env.example.`);
  const e = result.data;
  return { apiKey: e.ANTHROPIC_API_KEY, model: e.ANTHROPIC_MODEL, temperature: e.TEMPERATURE, maxOutputTokens: e.MAX_OUTPUT_TOKENS };
}
export function loadConfig(): ModelConfig {
  dotenv({ quiet: true });
  return parseConfig(process.env);
}
export function publicConfig(config: ModelConfig) {
  return { model: config.model, temperature: config.temperature, maxOutputTokens: config.maxOutputTokens,
    maxRetries: 0, explicitRetries: 1, timeoutMs: 45000 };
}
