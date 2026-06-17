import fs from 'fs/promises';
import path from 'path';

export interface SessionListEntry {
  id: string;
  createdAt: Date;
  messageCount: number;
  sizeBytes: number;
  firstMessage?: string;
}

export class SessionManager {
  private sessionDir: string;

  constructor(projectRoot: string) {
    this.sessionDir = path.join(projectRoot, '.wardayacode');
  }

  async list(): Promise<SessionListEntry[]> {
    try {
      const entries = await fs.readdir(this.sessionDir);
      const jsonlFiles = entries.filter(e => e.endsWith('.jsonl'));

      const sessions: SessionListEntry[] = [];

      for (const file of jsonlFiles) {
        const filePath = path.join(this.sessionDir, file);
        try {
          const stat = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim());

          let firstMessage: string | undefined;
          if (lines.length > 0) {
            try {
              const parsed = JSON.parse(lines[0]!) as { content?: string; role?: string };
              if (parsed.role === 'user' && parsed.content) {
                firstMessage = parsed.content.slice(0, 80);
              }
            } catch {
              // skip — unparseable JSONL line
            }
          }

          sessions.push({
            id: file.replace('.jsonl', ''),
            createdAt: stat.birthtime,
            messageCount: lines.length,
            sizeBytes: stat.size,
            firstMessage,
          });
        } catch {
          continue;
        }
      }

      sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return sessions;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    const filePath = path.join(this.sessionDir, `${sessionId}.jsonl`);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getSessionDir(): Promise<string> {
    return this.sessionDir;
  }
}
