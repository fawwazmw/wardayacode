import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { Tool } from './Tool.js';
import { ToolDefinition, ToolResult } from '../types.js';
import { UndoManager } from './UndoManager.js';
import { assertPathContained } from './pathSafety.js';

export class WriteFileTool extends Tool {
  private undoManager?: UndoManager;
  private readonly rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    super();
    this.rootDir = rootDir;
  }

  definition: ToolDefinition = {
    name: 'write_file',
    description:
      'Write content to a file. Creates the file if it does not exist. ' +
      'Creates parent directories recursively if needed.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['filePath', 'content'],
    },
    concurrency: 'exclusive',
    requiresPermission: true,
  };

  setUndoManager(manager: UndoManager): void {
    this.undoManager = manager;
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    if (!this.validateInput(input)) {
      return { success: false, error: 'Missing required fields: filePath, content' };
    }

    const filePath = resolve(input.filePath as string);
    const content = input.content as string;

    try {
      assertPathContained(filePath, this.rootDir);

      if (this.undoManager) {
        await this.undoManager.saveSnapshot(filePath, 'write_file');
      }

      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf-8');

      if (this.undoManager) {
        await this.undoManager.recordNewContent(filePath);
      }

      const lineCount = content.split('\n').length;

      return {
        success: true,
        content: `Wrote ${lineCount} lines to ${filePath}`,
        metadata: {
          filePath,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
          lineCount,
        },
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EACCES') {
        return { success: false, error: `Permission denied: ${filePath}` };
      }
      return { success: false, error: `Failed to write file: ${err.message}` };
    }
  }
}
