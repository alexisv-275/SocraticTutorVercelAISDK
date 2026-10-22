import { createAnthropic } from '@ai-sdk/anthropic';
import type { ModelConfig } from './env.js';

export function createClaude(config: ModelConfig) {
  // Proveedor directo; no requiere cuenta ni despliegue en Vercel.
  return createAnthropic({ apiKey: config.apiKey })(config.model);
}
