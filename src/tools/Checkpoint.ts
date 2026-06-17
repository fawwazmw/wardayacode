import { spawn } from 'node:child_process';

export class Checkpoint {
  private projectRoot: string;
  private stashCreated = false;

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
      this.stashCreated = true;
      return true;
    } catch {
      return false;
    }
  }

  async rollback(): Promise<boolean> {
    if (!this.stashCreated) return false;

    try {
      await this.runGit(['stash', 'pop']);
      this.stashCreated = false;
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
      return await this.runGit(['diff', '--stat']);
    } catch {
      return '';
    }
  }

  async getDetailedDiff(): Promise<string> {
    try {
      return await this.runGit(['diff']);
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
