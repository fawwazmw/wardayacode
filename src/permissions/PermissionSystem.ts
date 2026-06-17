import { PermissionMode, PermissionRule, PermissionResult, ToolUse } from '../types.js';
import { minimatch } from 'minimatch';

export type PermissionPromptHandler = (
  toolName: string,
  args: Record<string, unknown>,
  reason: string
) => Promise<'allow' | 'deny' | 'always'>;

export class PermissionSystem {
  private mode: PermissionMode;
  private rules: PermissionRule[] = [];
  private sessionAllowList = new Set<string>();
  private promptHandler?: PermissionPromptHandler;

  constructor(mode: PermissionMode = 'default') {
    this.mode = mode;
    this.loadDefaultRules();
  }

  setPromptHandler(handler: PermissionPromptHandler): void {
    this.promptHandler = handler;
  }

  private loadDefaultRules(): void {
    switch (this.mode) {
      case 'default':
        this.rules = [
          { tool: 'bash', action: 'deny', reason: 'Bash requires approval in default mode' },
          { tool: 'git', action: 'deny', reason: 'Git requires approval in default mode' },
          { tool: 'write_file', action: 'deny', reason: 'File write requires approval in default mode' },
          { tool: 'edit_file', action: 'deny', reason: 'File edit requires approval in default mode' },
          { tool: '*', action: 'allow' },
        ];
        break;

      case 'plan':
        this.rules = [
          { tool: 'bash', action: 'deny', reason: 'Bash disabled in plan mode' },
          { tool: 'git', action: 'deny', reason: 'Git disabled in plan mode' },
          { tool: 'write_file', action: 'deny', reason: 'File write disabled in plan mode' },
          { tool: 'edit_file', action: 'deny', reason: 'File edit disabled in plan mode' },
          { tool: '*', action: 'allow' },
        ];
        break;

      case 'acceptEdits':
        this.rules = [
          { tool: 'bash', action: 'deny', reason: 'Bash requires approval in acceptEdits mode' },
          { tool: 'git', action: 'deny', reason: 'Git requires approval in acceptEdits mode' },
          { tool: '*', action: 'allow' },
        ];
        break;

      case 'auto':
        this.rules = [
          { tool: '*', action: 'allow' },
        ];
        break;

      case 'internal':
        this.rules = [{ tool: '*', action: 'allow' }];
        break;
    }
  }

  async check(toolUse: ToolUse): Promise<PermissionResult> {
    if (this.sessionAllowList.has(toolUse.name)) {
      return { allowed: true };
    }

    for (const rule of this.rules) {
      if (this.matchesRule(toolUse, rule)) {
        if (rule.action === 'deny') {
          if (this.mode === 'plan') {
            return { allowed: false, reason: rule.reason ?? 'Denied by permission rule' };
          }

          if (this.promptHandler) {
            const decision = await this.promptHandler(
              toolUse.name,
              toolUse.input,
              rule.reason ?? 'This tool requires approval'
            );

            if (decision === 'always') {
              this.sessionAllowList.add(toolUse.name);
              return { allowed: true };
            }

            return {
              allowed: decision === 'allow',
              reason: decision === 'deny' ? 'User denied permission' : undefined,
            };
          }

          return { allowed: false, reason: rule.reason ?? 'Denied by permission rule' };
        } else {
          return { allowed: true };
        }
      }
    }

    return { allowed: false, reason: 'No matching permission rule' };
  }

  private matchesRule(toolUse: ToolUse, rule: PermissionRule): boolean {
    if (rule.tool !== '*' && rule.tool !== toolUse.name) {
      return false;
    }

    if (rule.pattern && toolUse.input?.path) {
      const path = String(toolUse.input.path);
      if (!minimatch(path, rule.pattern)) {
        return false;
      }
    }

    return true;
  }

  addRule(rule: PermissionRule): void {
    this.rules.unshift(rule);
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
    this.rules = [];
    this.sessionAllowList.clear();
    this.loadDefaultRules();
  }

  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  getSessionAllowList(): string[] {
    return [...this.sessionAllowList];
  }
}
