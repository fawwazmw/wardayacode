import { spawn } from 'node:child_process';

const MODULE_NAME = 'wardayacode';
const UPDATE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Runs `npm install -g wardayacode@latest`, streaming npm's own output to the
 * terminal so the user sees install progress. Resolves true on a clean exit
 * (code 0) and false on any non-zero exit, spawn error, or timeout — it never
 * throws and never hangs indefinitely (npm can stall on a network prompt).
 */
export function runSelfUpdate(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['install', '-g', `${MODULE_NAME}@latest`], {
      stdio: 'inherit',
    });

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // process may have already exited
      }
      finish(false);
    }, UPDATE_TIMEOUT_MS);

    child.on('close', (code) => finish(code === 0));
    child.on('error', () => finish(false));
  });
}
