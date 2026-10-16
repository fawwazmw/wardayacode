import { describe, it, expect, vi } from 'vitest';
import { MockLanguageModelV1, simulateReadableStream } from 'ai/test';
import { Agent } from '../src/agent/Agent.js';
import { ToolRegistry } from '../src/tools/ToolRegistry.js';
import { Tool } from '../src/tools/Tool.js';
import { PermissionSystem } from '../src/permissions/PermissionSystem.js';
import type { ToolDefinition, ToolResult } from '../src/types.js';

/** A mock language model that returns a different part-sequence per call. */
function streamModel(sequences: unknown[][]) {
  let call = 0;
  return new MockLanguageModelV1({
    doStream: async () => {
      const parts = sequences[Math.min(call, sequences.length - 1)]!;
      call++;
      return {
        stream: simulateReadableStream({ chunks: parts as never[] }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

class EchoTool extends Tool {
  definition: ToolDefinition = {
    name: 'echo',
    description: 'Echo text back',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'text' } },
      required: ['text'],
    },
    concurrency: 'concurrent',
    requiresPermission: false,
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return { success: true, content: `pong:${String(input.text)}` };
  }
}

function makeAgent(model: MockLanguageModelV1, registry = new ToolRegistry()): Agent {
  return new Agent({
    model,
    toolRegistry: registry,
    permissions: new PermissionSystem('internal'),
  });
}

describe('Agent.run', () => {
  it('streams a text completion and emits text-delta / usage / done', async () => {
    const model = streamModel([
      [
        { type: 'text-delta', textDelta: 'hello' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 } },
      ],
    ]);
    const agent = makeAgent(model);

    const deltas: string[] = [];
    agent.on('text-delta', d => deltas.push(d));
    const done = vi.fn();
    agent.on('done', done);
    const usage = vi.fn();
    agent.on('usage', usage);

    const result = await agent.run([{ role: 'user', content: 'hi' }]);

    expect(result).toBe('hello');
    expect(deltas.join('')).toBe('hello');
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ text: 'hello' }));
    expect(usage).toHaveBeenCalled();
  });

  it('executes a tool, then completes with the follow-up response', async () => {
    const registry = new ToolRegistry();
    registry.register(new EchoTool());

    const model = streamModel([
      [
        { type: 'tool-call', toolCallId: 'c1', toolName: 'echo', args: '{"text":"hi"}' },
        { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 5, completionTokens: 2 } },
      ],
      [
        { type: 'text-delta', textDelta: 'done' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 6, completionTokens: 3 } },
      ],
    ]);
    const agent = makeAgent(model, registry);

    const starts: Array<{ toolName: string; toolCallId?: string }> = [];
    const results: Array<{ toolName: string; toolCallId?: string; success: boolean }> = [];
    agent.on('tool-call-start', p => starts.push({ toolName: p.toolName, toolCallId: p.toolCallId }));
    agent.on('tool-call-result', p => results.push({ toolName: p.toolName, toolCallId: p.toolCallId, success: p.result.success }));

    const text = await agent.run([{ role: 'user', content: 'go' }]);

    expect(text).toBe('done');
    expect(starts.map(s => s.toolName)).toEqual(['echo']);
    expect(results.map(r => [r.toolName, r.success])).toEqual([['echo', true]]);
  });

  it('does not retry when the abort signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const model = new MockLanguageModelV1({
      doStream: async () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      },
    });
    const agent = makeAgent(model);

    await expect(
      agent.run([{ role: 'user', content: 'hi' }], controller.signal),
    ).rejects.toThrow();
  });
});
