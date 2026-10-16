import { spawn } from 'node:child_process';

export class Checkpoint {
  private projectRoot: string;
  /** Number of stashes created by this Checkpoint (supports multiple). */
  private stashCount = 0;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async isGitRepo(): Promise<boolean> {
    return this.runGit(['rev-parse', '--is-inside-work-tree'])
      .then(() => true)
      .catch(() => false);
  }

  async createCheckpoint(message: string): Promise<boolean> {
    if (!(await this.isGitRepo())) return false;

    try {
      const status = await this.runGit(['status', '--porcelain']);
      if (status.trim().length === 0) return false;

      await this.runGit(['stash', 'push', '-m', `wardayacode: ${message}`]);
      this.stashCount++;
      return true;
    } catch {
      return false;
    }
  }

  async rollback(): Promise<boolean> {
    if (this.stashCount === 0) return false;

    try {
      // Pop the most recent stash that WE created rather than the top of the
      // stack: the user may have stashed their own work after the checkpoint,
      // and a blind `stash pop` would restore the wrong one.
      const list = await this.runGit(['stash', 'list', '--format=%gd %s']);
      const lines = list.split('\n').filter(l => l.trim().length > 0);
      const index = lines.findIndex(l => l.includes('wardayacode:'));

      if (index === -1) {
        this.stashCount = 0;
        return false;
      }

      await this.runGit(['stash', 'pop', `stash@{${index}}`]);
      this.stashCount = Math.max(0, this.stashCount - 1);
      return true;
    } catch {
      return false;
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.runGit(['status', '--porcelain']);
      return status.trim().length > 0;
    } catch {
      return false;
    }
  }

  async getDiff(): Promise<string> {
    try {
      return await this.runGit(['diff']);
    } catch {
      return '';
    }
  }

  /** Summarize changed files (file names only, no content). */
  async getDiffSummary(): Promise<string> {
    try {
      return await this.runGit(['diff', '--stat']);
    } catch {
      return '';
    }
  }

  private runGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, {
        cwd: this.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || `git exited with code ${code}`));
      });

      proc.on('error', reject);
    });
  }
}
