import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'node:readline';
import path from 'path';

export interface SessionListEntry {
  id: string;
  createdAt: Date;
  messageCount: number;
  sizeBytes: number;
  firstMessage?: string;
}

/**
 * Count non-empty lines and capture the first one without loading the whole
 * session file into memory (sessions can grow large).
 */
async function scanSessionFile(filePath: string): Promise<{ messageCount: number; firstLine: string | null }> {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let messageCount = 0;
  let firstLine: string | null = null;

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (firstLine === null) firstLine = line;
      messageCount++;
    }
  } finally {
    rl.close();
  }

  return { messageCount, firstLine };
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
          const { messageCount, firstLine } = await scanSessionFile(filePath);

          let firstMessage: string | undefined;
          if (firstLine) {
            try {
              const parsed = JSON.parse(firstLine) as { content?: string; role?: string };
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
            messageCount,
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
