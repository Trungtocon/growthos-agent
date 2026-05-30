import { createHermesAdapter } from '../hermes/hermes-adapter';
import { RuntimeIntegrationError } from '../hermes/hermes-errors';
import { createPaperclipAdapter } from '../paperclip/paperclip-adapter';
import type { RuntimeEnv } from './runtime-config';
import { resolveRuntimeConfig } from './runtime-config';
import type { RuntimeMode, RuntimeServiceHealth } from './runtime-types';

export interface RuntimeHealthReport {
  mode: RuntimeMode;
  requestedMode: RuntimeMode;
  hermes: RuntimeServiceHealth;
  paperclip: RuntimeServiceHealth;
  checkedAt: string;
}

function offlineHealth(service: RuntimeServiceHealth['service'], mode: RuntimeMode, error: unknown): RuntimeServiceHealth {
  const message = error instanceof RuntimeIntegrationError ? error.message : `${service} health check failed`;
  return {
    service,
    mode,
    status: 'offline',
    message,
    checkedAt: new Date().toISOString(),
  };
}

export async function checkRuntimeHealth(env?: RuntimeEnv): Promise<RuntimeHealthReport> {
  const config = resolveRuntimeConfig(env);
  const hermes = createHermesAdapter(config.hermes.mode, config.hermes);
  const paperclip = createPaperclipAdapter(config.paperclip.mode, config.paperclip);

  const [hermesHealth, paperclipHealth] = await Promise.all([
    hermes.healthCheck().catch((error) => offlineHealth('hermes', config.hermes.mode, error)),
    paperclip.healthCheck().catch((error) => offlineHealth('paperclip', config.paperclip.mode, error)),
  ]);

  return {
    mode: config.mode,
    requestedMode: config.requestedMode,
    hermes: hermesHealth,
    paperclip: paperclipHealth,
    checkedAt: new Date().toISOString(),
  };
}
