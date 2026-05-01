import type { PgClient } from './pg-client.js';
import { mockPgClient } from './mock-pg-client.js';

let activeClient: PgClient = mockPgClient;

export function getPgClient(): PgClient {
  return activeClient;
}

export function setPgClient(client: PgClient): void {
  activeClient = client;
}

export * from './pg-client.js';
