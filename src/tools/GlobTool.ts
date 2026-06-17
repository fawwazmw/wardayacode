import { glob } from 'glob';
import { resolve } from 'node:path';
import { Tool } from './Tool.js';
import { ToolDefinition, ToolResult } from '../types.js';
import { assertPathContained } from './pathSafety.js';

export class GlobTool extends Tool {
  private readonly rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    super();
    this.rootDir = rootDir;
  }

  definition: ToolDefinition = {
    name: 'glob',
    description:
      'Find files matching a glob pattern. Returns sorted list of matching file paths. ' +
      'Supports patterns like "**/*.ts", "src/**/*.js", etc.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files against (e.g. "**/*.ts")',
        },
        path: {
          type: 'string',
          description: 'Directory to search in. Defaults to current working directory.',
        },
      },
      required: ['pattern'],
    },
    concurrency: 'concurrent',
    requiresPermission: false,
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    if (!this.validateInput(input)) {
      return { success: false, error: 'Missing required field: pattern' };
    }

    const pattern = input.pattern as string;
    const searchPath = input.path ? resolve(input.path as string) : process.cwd();

    try {
      assertPathContained(searchPath, this.rootDir);
      const matches = await glob(pattern, {
        cwd: searchPath,
        absolute: true,
        nodir: false,
        dot: false,
      });

      const sorted = matches.sort();

      if (sorted.length === 0) {
        return {
          success: true,
          content: 'No files matched the pattern.',
          metadata: { pattern, searchPath, matchCount: 0 },
        };
      }

      return {
        success: true,
        content: sorted.join('\n'),
        metadata: { pattern, searchPath, matchCount: sorted.length },
      };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: `Glob search failed: ${err.message}` };
    }
  }
}
