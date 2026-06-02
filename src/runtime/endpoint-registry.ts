export type BackendEndpointStatus = 'ready' | 'degraded' | 'missing_config' | 'blocked';

export interface BackendEndpointDefinition {
  id: 'runtime' | 'worker' | 'approval' | 'governance' | 'artifact' | 'evaluation';
  path: string;
  method: 'GET' | 'POST';
  version: string;
  owner: string;
  status: BackendEndpointStatus;
}

const endpoints: BackendEndpointDefinition[] = [
  { id: 'runtime', path: '/api/runtime/runs', method: 'POST', version: 'v1', owner: 'Runtime Orchestrator', status: 'degraded' },
  { id: 'worker', path: '/api/workers/control', method: 'POST', version: 'v1', owner: 'Worker Runtime', status: 'degraded' },
  { id: 'approval', path: '/api/approvals/submit', method: 'POST', version: 'v1', owner: 'Approval Execution', status: 'degraded' },
  { id: 'governance', path: '/api/governance/evaluate', method: 'POST', version: 'v1', owner: 'Governance Engine', status: 'degraded' },
  { id: 'artifact', path: '/api/artifacts/export', method: 'POST', version: 'v1', owner: 'Artifact Registry', status: 'degraded' },
  { id: 'evaluation', path: '/api/evaluation/run', method: 'POST', version: 'v1', owner: 'Evaluation Engine', status: 'degraded' },
];

export function getEndpointRegistry(): BackendEndpointDefinition[] {
  return endpoints.map((endpoint) => ({ ...endpoint }));
}

