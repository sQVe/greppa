import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

interface EnvConfig {
  apiPort: number;
  devPort: number;
  dbPath: string;
}

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

const API_PORT_MIN = 3100;
const API_PORT_RANGE = 900;
const DEV_PORT_MIN = 5100;
const DEV_PORT_RANGE = 900;

export const fnv1a = (input: string): number => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash >>> 0;
};

export const resolveWorktreePorts = (name: string): { apiPort: number; devPort: number } => {
  if (name === 'main') {
    return { apiPort: 4400, devPort: 5173 };
  }

  const hash = fnv1a(name);
  return {
    apiPort: API_PORT_MIN + (hash % API_PORT_RANGE),
    devPort: DEV_PORT_MIN + (hash % DEV_PORT_RANGE),
  };
};

export const buildEnvContent = ({ apiPort, devPort, dbPath }: EnvConfig): string =>
  `API_PORT=${apiPort}\nDEV_PORT=${devPort}\nDB_PATH=${dbPath}\n`;

const getWorktreeRoot = (): string =>
  execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

const main = () => {
  const worktreeRoot = getWorktreeRoot();
  const name = basename(worktreeRoot);
  const { apiPort, devPort } = resolveWorktreePorts(name);
  const dbPath = join(worktreeRoot, '.data', 'app.db');

  const content = buildEnvContent({ apiPort, devPort, dbPath });
  const envPath = join(worktreeRoot, '.env.local');
  writeFileSync(envPath, content);

  const summary = `wrote ${envPath}\n  API_PORT=${apiPort}\n  DEV_PORT=${devPort}\n  DB_PATH=${dbPath}\n`;
  process.stdout.write(summary);
};

main();
