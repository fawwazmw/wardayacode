import { readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Tool } from './Tool.js';
import { ToolDefinition, ToolResult } from '../types.js';
import { assertPathContained } from './pathSafety.js';

export class ListFilesTool extends Tool {
  private readonly rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    super();
    this.rootDir = rootDir;
  }

  definition: ToolDefinition = {
    name: 'list_files',
    description:
      'List the contents of a directory. ' +
      'Entries are returned one per line with a trailing "/" for subdirectories.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the directory to list. Defaults to current working directory.',
        },
      },
      required: [],
    },
    concurrency: 'concurrent',
    requiresPermission: false,
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = input.path ? resolve(input.path as string) : process.cwd();

    try {
      assertPathContained(dirPath, this.rootDir);
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${dirPath}`,
        };
      }

      const entries = await readdir(dirPath);
      const results: string[] = [];

      for (const entry of entries) {
        try {
          const entryPath = join(dirPath, entry);
          const entryStat = await stat(entryPath);
          results.push(entryStat.isDirectory() ? `${entry}/` : entry);
        } catch {
          // Skip entries we can't stat
          results.push(entry);
        }
      }

      results.sort();

      if (results.length === 0) {
        return {
          success: true,
          content: '(empty directory)',
          metadata: { path: dirPath, entryCount: 0 },
        };
      }

      return {
        success: true,
        content: results.join('\n'),
        metadata: { path: dirPath, entryCount: results.length },
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return { success: false, error: `Directory not found: ${dirPath}` };
      }
      if (err.code === 'EACCES') {
        return { success: false, error: `Permission denied: ${dirPath}` };
      }
      return { success: false, error: `Failed to list directory: ${err.message}` };
    }
  }
}
