import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Tool } from './Tool.js';
import { ToolDefinition, ToolResult } from '../types.js';
import { assertPathContained } from './pathSafety.js';

export class ReadFileTool extends Tool {
  private readonly rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    super();
    this.rootDir = rootDir;
  }

  definition: ToolDefinition = {
    name: 'read_file',
    description:
      'Read the contents of a file. Returns content with line numbers prefixed. ' +
      'Use offset and limit to read specific sections of large files.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute path to the file to read',
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (1-indexed). Defaults to 1.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of lines to read. Defaults to 2000.',
        },
      },
      required: ['filePath'],
    },
    concurrency: 'concurrent',
    requiresPermission: false,
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    if (!this.validateInput(input)) {
      return { success: false, error: 'Missing required field: filePath' };
    }

    const filePath = resolve(input.filePath as string);
    const offset = Math.max(1, (input.offset as number) || 1);
    const limit = (input.limit as number) || 2000;

    try {
      assertPathContained(filePath, this.rootDir);
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        return {
          success: false,
          error: `Path is a directory, not a file: ${filePath}`,
        };
      }

      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const totalLines = lines.length;

      const startIdx = offset - 1;
      const endIdx = Math.min(startIdx + limit, totalLines);
      const selectedLines = lines.slice(startIdx, endIdx);

      const numberedContent = selectedLines
        .map((line, i) => `${startIdx + i + 1}: ${line}`)
        .join('\n');

      return {
        success: true,
        content: numberedContent,
        metadata: {
          filePath,
          totalLines,
          startLine: offset,
          endLine: endIdx,
          truncated: endIdx < totalLines,
        },
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return { success: false, error: `File not found: ${filePath}` };
      }
      if (err.code === 'EACCES') {
        return { success: false, error: `Permission denied: ${filePath}` };
      }
      return { success: false, error: `Failed to read file: ${err.message}` };
    }
  }
}
