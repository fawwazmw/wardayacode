import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { glob } from 'glob';
import { Tool } from './Tool.js';
import { ToolDefinition, ToolResult } from '../types.js';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

export class GrepTool extends Tool {
  definition: ToolDefinition = {
    name: 'grep',
    description:
      'Search file contents using a regular expression pattern. ' +
      'Returns matching lines with file paths and line numbers. ' +
      'Use include to filter by file type (e.g. "*.ts").',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regular expression pattern to search for',
        },
        path: {
          type: 'string',
          description: 'Directory to search in. Defaults to current working directory.',
        },
        include: {
          type: 'string',
          description: 'Glob pattern to filter files (e.g. "*.ts", "*.{js,jsx}")',
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
    const include = (input.include as string) || '**/*';

    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      return { success: false, error: `Invalid regex pattern: ${pattern}` };
    }

    try {
      const filePattern = include.includes('/') || include.startsWith('**')
        ? include
        : `**/${include}`;

      const files = await glob(filePattern, {
        cwd: searchPath,
        absolute: true,
        nodir: true,
        dot: false,
      });

      const matches: GrepMatch[] = [];
      const MAX_MATCHES = 500;

      for (const file of files) {
        if (matches.length >= MAX_MATCHES) break;

        try {
          const content = await readFile(file, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const lineContent = lines[i] ?? '';
            if (regex.test(lineContent)) {
              matches.push({
                file: relative(searchPath, file),
                line: i + 1,
                content: lineContent,
              });
              if (matches.length >= MAX_MATCHES) break;
            }
          }
        } catch {
          continue;
        }
      }

      if (matches.length === 0) {
        return {
          success: true,
          content: 'No matches found.',
          metadata: { pattern, searchPath, include, matchCount: 0 },
        };
      }

      const output = matches
        .map((m) => `${m.file}:${m.line}: ${m.content}`)
        .join('\n');

      return {
        success: true,
        content: output,
        metadata: {
          pattern,
          searchPath,
          include,
          matchCount: matches.length,
          truncated: matches.length >= MAX_MATCHES,
        },
      };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: `Grep search failed: ${err.message}` };
    }
  }
}
