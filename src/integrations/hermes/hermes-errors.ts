export class RuntimeIntegrationError extends Error {
  readonly service: 'hermes' | 'paperclip';
  readonly code: string;
  readonly status?: number;
  readonly causeDetail?: unknown;

  constructor(message: string, options: { service: 'hermes' | 'paperclip'; code?: string; status?: number; cause?: unknown }) {
    super(message);
    this.name = 'RuntimeIntegrationError';
    this.service = options.service;
    this.code = options.code ?? 'RUNTIME_INTEGRATION_ERROR';
    this.status = options.status;
    this.causeDetail = options.cause;
  }
}

export class RuntimeTimeoutError extends RuntimeIntegrationError {
  constructor(service: 'hermes' | 'paperclip', timeoutMs: number) {
    super(`${service} request timed out after ${timeoutMs}ms`, {
      service,
      code: 'RUNTIME_TIMEOUT',
    });
    this.name = 'RuntimeTimeoutError';
  }
}

export class RuntimeConfigError extends RuntimeIntegrationError {
  constructor(service: 'hermes' | 'paperclip', message: string) {
    super(message, {
      service,
      code: 'RUNTIME_CONFIG_MISSING',
    });
    this.name = 'RuntimeConfigError';
  }
}
