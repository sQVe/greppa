import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface EnvConfig {
  apiPort: number;
  devPort: number;
  playgroundPort: number;
  dbPath: string;
  caddyDomain: string;
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

export const resolveCaddyDomain = (name: string): string =>
  name === 'main' ? 'greppa.localhost' : `${name}.greppa.localhost`;

interface CaddySnippetConfig {
  name: string;
  apiPort: number;
  devPort: number;
  playgroundPort: number;
}

export const buildCaddySnippet = ({ name, apiPort, devPort, playgroundPort }: CaddySnippetConfig): string => {
  const domain = resolveCaddyDomain(name);
  return [
    `${domain} {`,
    `  handle /api/* {`,
    `    reverse_proxy localhost:${apiPort}`,
    `  }`,
    `  reverse_proxy localhost:${devPort}`,
    `}`,
    '',
    `playground.${domain} {`,
    `  reverse_proxy localhost:${playgroundPort}`,
    `}`,
    '',
  ].join('\n');
};

export const buildEnvContent = ({ apiPort, devPort, playgroundPort, dbPath, caddyDomain }: EnvConfig): string =>
  `API_PORT=${apiPort}\nDEV_PORT=${devPort}\nPLAYGROUND_PORT=${playgroundPort}\nDB_PATH=${dbPath}\nCADDY_DOMAIN=${caddyDomain}\n`;

interface WriteCaddySnippetConfig {
  name: string;
  apiPort: number;
  devPort: number;
  playgroundPort: number;
  caddyDir: string;
}

export const writeCaddySnippet = ({ name, apiPort, devPort, playgroundPort, caddyDir }: WriteCaddySnippetConfig) => {
  mkdirSync(caddyDir, { recursive: true });
  const snippet = buildCaddySnippet({ name, apiPort, devPort, playgroundPort });
  writeFileSync(join(caddyDir, `${name}.caddy`), snippet);
};

export const reloadCaddy = (caddyfilePath: string) => {
  try {
    execFileSync('caddy', ['reload', '--config', caddyfilePath], {
      stdio: 'ignore',
    });
  } catch (error: unknown) {
    const code =
      error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === 'ENOENT') {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`warning: caddy reload failed: ${message}\n`);
  }
};

export const writeCaddyfile = (caddyDir: string) => {
  const caddyfilePath = join(caddyDir, 'Caddyfile');
  if (existsSync(caddyfilePath)) {
    return;
  }

  writeFileSync(caddyfilePath, 'import ./*.caddy\n');
};

const getWorktreeRoot = (): string =>
  execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

const main = () => {
  const worktreeRoot = getWorktreeRoot();
  const name = basename(worktreeRoot);
  const { apiPort, devPort, playgroundPort } = resolveWorktreePorts(name);
  const dbPath = join(worktreeRoot, '.data', 'app.db');
  const caddyDomain = resolveCaddyDomain(name);

  const content = buildEnvContent({ apiPort, devPort, playgroundPort, dbPath, caddyDomain });
  const envPath = join(worktreeRoot, '.env.local');
  writeFileSync(envPath, content);

  const caddyDir = join(homedir(), '.config', 'caddy', 'greppa');
  writeCaddySnippet({ name, apiPort, devPort, playgroundPort, caddyDir });
  writeCaddyfile(caddyDir);
  reloadCaddy(join(caddyDir, 'Caddyfile'));

  const summary = `wrote ${envPath}\n  API_PORT=${apiPort}\n  DEV_PORT=${devPort}\n  PLAYGROUND_PORT=${playgroundPort}\n  DB_PATH=${dbPath}\n  CADDY_DOMAIN=${caddyDomain}\nwrote ${join(caddyDir, `${name}.caddy`)}\n`;
  process.stdout.write(summary);
};

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main();
}
