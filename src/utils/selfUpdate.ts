import { spawn } from 'node:child_process';

const MODULE_NAME = 'wardayacode';

/**
 * Runs `npm install -g wardayacode@latest`, streaming npm's own output to the
 * terminal so the user sees install progress. Resolves true on a clean exit
 * (code 0) and false on any non-zero exit or spawn error — it never throws.
 */
export function runSelfUpdate(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['install', '-g', `${MODULE_NAME}@latest`], {
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}
