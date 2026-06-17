import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Tool } from './Tool.js';
import { ToolDefinition, ToolResult } from '../types.js';
import { UndoManager } from './UndoManager.js';
import { generateDiff } from './DiffView.js';
import { assertPathContained } from './pathSafety.js';

export class EditFileTool extends Tool {
  private undoManager?: UndoManager;
  private readonly rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    super();
    this.rootDir = rootDir;
  }

  definition: ToolDefinition = {
    name: 'edit_file',
    description:
      'Edit a file by replacing an exact string match with new content. ' +
      'Fails if oldString is not found or matches multiple locations (unless replaceAll is true).',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute path to the file to edit',
        },
        oldString: {
          type: 'string',
          description: 'The exact string to find and replace',
        },
        newString: {
          type: 'string',
          description: 'The replacement string',
        },
        replaceAll: {
          type: 'boolean',
          description: 'Replace all occurrences instead of requiring a unique match. Defaults to false.',
        },
      },
      required: ['filePath', 'oldString', 'newString'],
    },
    concurrency: 'exclusive',
    requiresPermission: true,
  };

  setUndoManager(manager: UndoManager): void {
    this.undoManager = manager;
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    if (!this.validateInput(input)) {
      return { success: false, error: 'Missing required fields: filePath, oldString, newString' };
    }

    const filePath = resolve(input.filePath as string);
    const oldString = input.oldString as string;
    const newString = input.newString as string;
    const replaceAll = (input.replaceAll as boolean) || false;

    try {
      assertPathContained(filePath, this.rootDir);
      const content = await readFile(filePath, 'utf-8');
      const occurrences = this.countOccurrences(content, oldString);

      if (occurrences === 0) {
        return {
          success: false,
          error: 'oldString not found in file content. Ensure the string matches exactly, including whitespace and indentation.',
        };
      }

      if (occurrences > 1 && !replaceAll) {
        return {
          success: false,
          error: `Found ${occurrences} matches for oldString. Provide more surrounding context to identify a unique match, or set replaceAll: true to replace all occurrences.`,
        };
      }

      if (this.undoManager) {
        await this.undoManager.saveSnapshot(filePath, 'edit_file');
      }

      let newContent: string;
      if (replaceAll) {
        newContent = content.split(oldString).join(newString);
      } else {
        const idx = content.indexOf(oldString);
        newContent = content.substring(0, idx) + newString + content.substring(idx + oldString.length);
      }

      await writeFile(filePath, newContent, 'utf-8');

      if (this.undoManager) {
        await this.undoManager.recordNewContent(filePath);
      }

      const diff = generateDiff(content, newContent, filePath);

      return {
        success: true,
        content: `Edited ${filePath} (${replaceAll ? occurrences : 1} replacement${occurrences > 1 ? 's' : ''})\n\n${diff}`,
        metadata: {
          filePath,
          replacements: replaceAll ? occurrences : 1,
        },
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return { success: false, error: `File not found: ${filePath}` };
      }
      return { success: false, error: `Failed to edit file: ${err.message}` };
    }
  }

  private countOccurrences(text: string, search: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(search, pos)) !== -1) {
      count++;
      pos += search.length;
    }
    return count;
  }
}
