import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { pathToFileURL } from 'node:url';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { HookSystem } from './HookSystem.js';
import { Tool } from '../tools/Tool.js';
import type {
  JSONSchema,
  ToolDefinition,
  ToolResult,
  HookContext,
  HookEvent,
  HookResult,
} from '../types.js';
import { logger } from '../utils/logger.js';

/** A tool a plugin can register, described declaratively. */
export interface PluginToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute: (input: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
}

export interface PluginHookDefinition {
  event: HookEvent;
  name?: string;
  handler: (context: HookContext) => Promise<HookResult> | HookResult;
}

export interface PluginApi {
  projectRoot: string;
  registerTool: (tool: PluginToolDefinition | Tool) => void;
  registerHook: (hook: PluginHookDefinition) => void;
  log: (message: string) => void;
}

export interface DiscoveredPlugin {
  name: string;
  path: string;
  trusted: boolean;
  project: boolean;
}

/** Wraps a plugin-provided tool descriptor in the Tool base class. */
class PluginTool extends Tool {
  definition: ToolDefinition;
  private readonly fn: PluginToolDefinition['execute'];

  constructor(def: PluginToolDefinition) {
    super();
    this.definition = {
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema,
      concurrency: 'exclusive',
      requiresPermission: false,
    };
    this.fn = def.execute;
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return this.fn(input);
  }
}

/** Persists trusted project roots for plugins (mirrors HookTrustStore). */
export class PluginTrustStore {
  constructor(private readonly filePath: string) {}

  private async read(): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as { projects?: unknown };
      return Array.isArray(parsed.projects) ? (parsed.projects as string[]) : [];
    } catch {
      return [];
    }
  }

  async isTrusted(projectRoot: string): Promise<boolean> {
    return (await this.read()).includes(projectRoot);
  }

  async trust(projectRoot: string): Promise<void> {
    const projects = await this.read();
    if (!projects.includes(projectRoot)) projects.push(projectRoot);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify({ projects }, null, 2), 'utf-8');
  }
}

export function getUserPluginTrustPath(): string {
  return path.join(os.homedir(), '.config', 'wardayacode', 'plugins-trust.json');
}

function getPluginDirs(projectRoot: string): { dir: string; project: boolean }[] {
  return [
    { dir: path.join(projectRoot, '.wardayacode', 'plugins'), project: true },
    { dir: path.join(os.homedir(), '.config', 'wardayacode', 'plugins'), project: false },
  ];
}

/** Discover `*.js`/`*.mjs` plugins in the project and user plugin directories. */
export async function discoverPlugins(
  projectRoot: string,
  projectTrusted: boolean,
): Promise<DiscoveredPlugin[]> {
  const plugins: DiscoveredPlugin[] = [];

  for (const { dir, project } of getPluginDirs(projectRoot)) {
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!/\.m?js$/.test(file)) continue;
      plugins.push({
        name: file.replace(/\.m?js$/, ''),
        path: path.join(dir, file),
        trusted: project ? projectTrusted : true,
        project,
      });
    }
  }

  return plugins;
}

/**
 * Discovers and loads plugins. Only trusted plugins are imported (project
 * plugins run arbitrary JS, so they stay inactive until `/plugins trust`).
 */
export class PluginRuntime {
  private plugins: DiscoveredPlugin[] = [];
  private loadedNames: string[] = [];

  constructor(
    private readonly registry: ToolRegistry,
    private readonly hookSystem: HookSystem,
    private readonly projectRoot: string,
    private readonly trustStore: PluginTrustStore = new PluginTrustStore(getUserPluginTrustPath()),
  ) {}

  async activate(): Promise<DiscoveredPlugin[]> {
    const projectTrusted = await this.trustStore.isTrusted(this.projectRoot);
    this.plugins = await discoverPlugins(this.projectRoot, projectTrusted);
    this.loadedNames = [];

    for (const plugin of this.plugins) {
      if (!plugin.trusted) continue;
      try {
        await this.loadPlugin(plugin);
        this.loadedNames.push(plugin.name);
      } catch (error) {
        logger.warn('plugin failed to load', {
          plugin: plugin.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return this.plugins;
  }

  private async loadPlugin(plugin: DiscoveredPlugin): Promise<void> {
    // Cache-bust so `/plugins reload` picks up edited files.
    const url = `${pathToFileURL(plugin.path).href}?v=${Date.now()}`;
    const mod = (await import(url)) as Record<string, unknown>;

    const api: PluginApi = {
      projectRoot: this.projectRoot,
      registerTool: tool => {
        const instance = tool instanceof Tool ? tool : new PluginTool(tool as PluginToolDefinition);
        this.registry.register(instance);
      },
      registerHook: hook => {
        this.hookSystem.register({
          event: hook.event,
          name: hook.name ?? `${plugin.name}:${hook.event}`,
          handler: async (context: HookContext) =>
            (await hook.handler(context)) ?? { proceed: true },
        });
      },
      log: message => logger.debug(`[plugin ${plugin.name}] ${message}`),
    };

    const setup = mod.default ?? mod.setup;
    if (typeof setup === 'function') {
      await (setup as (api: PluginApi) => unknown)(api);
    }
    if (Array.isArray(mod.tools)) {
      for (const tool of mod.tools) api.registerTool(tool as PluginToolDefinition);
    }
    if (Array.isArray(mod.hooks)) {
      for (const hook of mod.hooks) api.registerHook(hook as PluginHookDefinition);
    }
  }

  getPlugins(): DiscoveredPlugin[] {
    return [...this.plugins];
  }

  getLoadedNames(): string[] {
    return [...this.loadedNames];
  }

  hasActivePlugins(): boolean {
    return this.loadedNames.length > 0;
  }

  async trustProject(): Promise<void> {
    await this.trustStore.trust(this.projectRoot);
    await this.activate();
  }

  async status(): Promise<string> {
    const projectTrusted = await this.trustStore.isTrusted(this.projectRoot);
    const plugins = this.plugins.length
      ? this.plugins
      : await discoverPlugins(this.projectRoot, projectTrusted);

    if (plugins.length === 0) {
      return 'No plugins found.\nAdd .js/.mjs files to .wardayacode/plugins/ or ~/.config/wardayacode/plugins/.\nA plugin default-exports `function (api) {}` and/or `tools`/`hooks` arrays.';
    }

    const lines = plugins.map(p => {
      const state = !p.trusted ? 'untrusted' : this.loadedNames.includes(p.name) ? 'active' : 'error';
      return `  ${p.name.padEnd(20)} ${state.padEnd(10)} ${p.project ? 'project' : 'user'}`;
    });

    const untrusted = plugins.filter(p => !p.trusted).length;
    const footer =
      untrusted > 0
        ? `\n\n${untrusted} project plugin(s) are not trusted and will not run.\nRun /plugins trust to allow project plugins for ${this.projectRoot}.`
        : '';

    return `Plugins:\n${lines.join('\n')}${footer}`;
  }
}
