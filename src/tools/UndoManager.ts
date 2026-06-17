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
