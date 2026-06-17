import fs from 'fs/promises';
import path from 'path';

export interface ProjectInfo {
  name?: string;
  type: 'node' | 'python' | 'rust' | 'go' | 'java' | 'unknown';
  framework?: string;
  language?: string;
  testRunner?: string;
  packageManager?: string;
  hasGit: boolean;
  contextFileContent?: string;
}

const CONTEXT_FILE_NAMES = [
  'WARDAYA.md',
  '.wardayacode.md',
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
];

export async function gatherProjectContext(projectRoot: string): Promise<ProjectInfo> {
  const info: ProjectInfo = {
    type: 'unknown',
    hasGit: false,
  };

  const checks = await Promise.allSettled([
    detectNodeProject(projectRoot, info),
    detectPythonProject(projectRoot, info),
    detectRustProject(projectRoot, info),
    detectGoProject(projectRoot, info),
    detectGit(projectRoot, info),
    loadContextFile(projectRoot, info),
  ]);

  return info;
}

async function detectNodeProject(root: string, info: ProjectInfo): Promise<void> {
  try {
    const pkgJson = await fs.readFile(path.join(root, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgJson) as Record<string, unknown>;
    info.type = 'node';
    info.name = pkg.name as string | undefined;
    info.language = 'TypeScript';

    const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };

    if (deps['next']) info.framework = 'Next.js';
    else if (deps['nuxt']) info.framework = 'Nuxt';
    else if (deps['@angular/core']) info.framework = 'Angular';
    else if (deps['vue']) info.framework = 'Vue';
    else if (deps['react']) info.framework = 'React';
    else if (deps['express']) info.framework = 'Express';
    else if (deps['fastify']) info.framework = 'Fastify';
    else if (deps['hono']) info.framework = 'Hono';

    if (deps['vitest']) info.testRunner = 'vitest';
    else if (deps['jest']) info.testRunner = 'jest';
    else if (deps['mocha']) info.testRunner = 'mocha';

    try {
      await fs.access(path.join(root, 'tsconfig.json'));
      info.language = 'TypeScript';
    } catch {
      info.language = 'JavaScript';
    }

    try {
      await fs.access(path.join(root, 'bun.lockb'));
      info.packageManager = 'bun';
    } catch {
      try {
        await fs.access(path.join(root, 'pnpm-lock.yaml'));
        info.packageManager = 'pnpm';
      } catch {
        try {
          await fs.access(path.join(root, 'yarn.lock'));
          info.packageManager = 'yarn';
        } catch {
          info.packageManager = 'npm';
        }
      }
    }
  } catch { /* no package.json */ }
}

async function detectPythonProject(root: string, info: ProjectInfo): Promise<void> {
  if (info.type !== 'unknown') return;
  const pyFiles = ['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile'];
  for (const f of pyFiles) {
    try {
      await fs.access(path.join(root, f));
      info.type = 'python';
      info.language = 'Python';

      try {
        const content = await fs.readFile(path.join(root, 'pyproject.toml'), 'utf-8');
        if (content.includes('django')) info.framework = 'Django';
        else if (content.includes('fastapi')) info.framework = 'FastAPI';
        else if (content.includes('flask')) info.framework = 'Flask';

        if (content.includes('pytest')) info.testRunner = 'pytest';
      } catch { /* no pyproject.toml */ }

      return;
    } catch { continue; }
  }
}

async function detectRustProject(root: string, info: ProjectInfo): Promise<void> {
  if (info.type !== 'unknown') return;
  try {
    await fs.access(path.join(root, 'Cargo.toml'));
    info.type = 'rust';
    info.language = 'Rust';
    info.testRunner = 'cargo test';
    info.packageManager = 'cargo';
  } catch { /* not rust */ }
}

async function detectGoProject(root: string, info: ProjectInfo): Promise<void> {
  if (info.type !== 'unknown') return;
  try {
    await fs.access(path.join(root, 'go.mod'));
    info.type = 'go';
    info.language = 'Go';
    info.testRunner = 'go test';
  } catch { /* not go */ }
}

async function detectGit(root: string, info: ProjectInfo): Promise<void> {
  try {
    await fs.access(path.join(root, '.git'));
    info.hasGit = true;
  } catch {
    info.hasGit = false;
  }
}

async function loadContextFile(root: string, info: ProjectInfo): Promise<void> {
  for (const name of CONTEXT_FILE_NAMES) {
    try {
      const content = await fs.readFile(path.join(root, name), 'utf-8');
      info.contextFileContent = content.slice(0, 8000);
      return;
    } catch { continue; }
  }
}

export function formatProjectContext(info: ProjectInfo): string {
  const parts: string[] = [];

  if (info.name) parts.push(`Project: ${info.name}`);
  if (info.type !== 'unknown') parts.push(`Type: ${info.type}`);
  if (info.language) parts.push(`Language: ${info.language}`);
  if (info.framework) parts.push(`Framework: ${info.framework}`);
  if (info.testRunner) parts.push(`Test runner: ${info.testRunner}`);
  if (info.packageManager) parts.push(`Package manager: ${info.packageManager}`);
  parts.push(`Git: ${info.hasGit ? 'yes' : 'no'}`);

  let result = parts.join('\n');

  if (info.contextFileContent) {
    result += `\n\n--- Project Instructions ---\n${info.contextFileContent}`;
  }

  return result;
}
