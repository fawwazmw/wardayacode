import fs from 'fs/promises';
import path from 'path';
import crypto from 'node:crypto';
import { SessionMessage, PermissionMode } from '../types.js';

export class Session {
  private id: string;
  private transcriptPath: string;
  private messages: SessionMessage[] = [];
  private permissionsApplied: PermissionMode;
  private projectRoot: string;

  constructor(id: string, projectRoot: string, mode: PermissionMode) {
    this.id = id;
    this.projectRoot = projectRoot;
    this.transcriptPath = path.join(projectRoot, '.wardayacode', `${id}.jsonl`);
    this.permissionsApplied = mode;
  }

  /**
   * Load session from disk
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.transcriptPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      for (const line of lines) {
        this.messages.push(JSON.parse(line));
      }
    } catch (error) {
      // New session - file doesn't exist yet
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Append a message to the session (append-only)
   */
  async append(message: Omit<SessionMessage, 'timestamp'>): Promise<void> {
    const sessionMessage: SessionMessage = {
      ...message,
      timestamp: Date.now(),
    };

    this.messages.push(sessionMessage);

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.transcriptPath), { recursive: true });

    // Append-only: never destructively edit
    const line = JSON.stringify(sessionMessage) + '\n';
    await fs.appendFile(this.transcriptPath, line);
  }

  /**
   * Get all messages
   */
  getMessages(): SessionMessage[] {
    return [...this.messages];
  }

  /**
   * Get session ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get permission mode applied to this session
   */
  getPermissionMode(): PermissionMode {
    return this.permissionsApplied;
  }

  /**
   * Export session as markdown
   */
  async export(): Promise<string> {
    const lines = [
      `# Session ${this.id}`,
      `**Date:** ${new Date().toISOString()}`,
      `**Permission Mode:** ${this.permissionsApplied}`,
      '',
    ];

    for (const msg of this.messages) {
      const timestamp = new Date(msg.timestamp).toISOString();
      lines.push(`## ${msg.role.toUpperCase()} (${timestamp})`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Create a new session
   */
  static async create(projectRoot: string, mode: PermissionMode = 'default'): Promise<Session> {
    const id = crypto.randomUUID();
    const session = new Session(id, projectRoot, mode);
    await session.load();
    return session;
  }
}
