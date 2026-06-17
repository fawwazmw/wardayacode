import { readFile, writeFile } from 'node:fs/promises';

interface UndoEntry {
  filePath: string;
  previousContent: string;
  newContent: string;
  toolName: string;
  timestamp: number;
}

const MAX_UNDO_STACK = 50;

export class UndoManager {
  private stack: UndoEntry[] = [];

  async saveSnapshot(filePath: string, toolName: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      this.stack.push({
        filePath,
        previousContent: content,
        newContent: '',
        toolName,
        timestamp: Date.now(),
      });

      if (this.stack.length > MAX_UNDO_STACK) {
        this.stack.shift();
      }
    } catch {
      // file doesn't exist yet (write_file creating new) — store empty
      this.stack.push({
        filePath,
        previousContent: '',
        newContent: '',
        toolName,
        timestamp: Date.now(),
      });
    }
  }

  async recordNewContent(filePath: string): Promise<void> {
    const entry = this.stack[this.stack.length - 1];
    if (entry && entry.filePath === filePath && entry.newContent === '') {
      try {
        entry.newContent = await readFile(filePath, 'utf-8');
      } catch {
        // file may have been deleted — leave newContent empty
      }
    }
  }

  async undo(): Promise<{ filePath: string; toolName: string } | null> {
    const entry = this.stack.pop();
    if (!entry) return null;

    await writeFile(entry.filePath, entry.previousContent, 'utf-8');
    return { filePath: entry.filePath, toolName: entry.toolName };
  }

  getLastEntry(): UndoEntry | undefined {
    return this.stack[this.stack.length - 1];
  }

  getStackSize(): number {
    return this.stack.length;
  }

  clear(): void {
    this.stack = [];
  }
}
