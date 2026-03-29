import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

interface EnvConfig {
  apiPort: number;
  devPort: number;
  playgroundPort: number;
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

export const resolveWorktreePorts = (
  name: string,
): { apiPort: number; devPort: number; playgroundPort: number } => {
  if (name === 'main') {
    return { apiPort: 4400, devPort: 5173, playgroundPort: 5174 };
  }

  const hash = fnv1a(name);
  const pairBase = DEV_PORT_MIN + (hash % Math.floor(DEV_PORT_RANGE / 2)) * 2;
  return {
    apiPort: API_PORT_MIN + (hash % API_PORT_RANGE),
    devPort: pairBase,
    playgroundPort: pairBase + 1,
  };
};

export const buildEnvContent = ({ apiPort, devPort, playgroundPort, dbPath }: EnvConfig): string =>
  `API_PORT=${apiPort}\nDEV_PORT=${devPort}\nPLAYGROUND_PORT=${playgroundPort}\nDB_PATH=${dbPath}\n`;

const getWorktreeRoot = (): string =>
  execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

const main = () => {
  const worktreeRoot = getWorktreeRoot();
  const name = basename(worktreeRoot);
  const { apiPort, devPort, playgroundPort } = resolveWorktreePorts(name);
  const dbPath = join(worktreeRoot, '.data', 'app.db');

  const content = buildEnvContent({ apiPort, devPort, playgroundPort, dbPath });
  const envPath = join(worktreeRoot, '.env.local');
  writeFileSync(envPath, content);

  const summary = `wrote ${envPath}\n  API_PORT=${apiPort}\n  DEV_PORT=${devPort}\n  PLAYGROUND_PORT=${playgroundPort}\n  DB_PATH=${dbPath}\n`;
  process.stdout.write(summary);
};

main();
