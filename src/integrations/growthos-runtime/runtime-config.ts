import { resolveHermesConfig, type HermesConnectorConfig, type HermesEnv } from '../hermes/hermes-config';
import { resolvePaperclipConfig, type PaperclipConnectorConfig, type PaperclipEnv } from '../paperclip/paperclip-config';
import type { RuntimeMode } from './runtime-types';

export type RuntimeEnv = HermesEnv & PaperclipEnv;

export interface RuntimeConnectorConfig {
  requestedMode: RuntimeMode;
  mode: RuntimeMode;
  hermes: HermesConnectorConfig;
  paperclip: PaperclipConnectorConfig;
}

function currentEnv(): RuntimeEnv {
  return (typeof import.meta !== 'undefined' ? import.meta.env : {}) as RuntimeEnv;
}

function normalizeMode(value?: string): RuntimeMode {
  return value === 'sandbox' ? 'sandbox' : 'mock';
}

export function resolveRuntimeConfig(env: RuntimeEnv = currentEnv()): RuntimeConnectorConfig {
  const requestedMode = normalizeMode(env.VITE_RUNTIME_MODE);
  const hermes = resolveHermesConfig(env, requestedMode);
  const paperclip = resolvePaperclipConfig(env, requestedMode);
  const mode = requestedMode === 'sandbox' && hermes.mode === 'sandbox' && paperclip.mode === 'sandbox' ? 'sandbox' : 'mock';

  return {
    requestedMode,
    mode,
    hermes,
    paperclip,
  };
}
