import { describe, it, expect } from 'vitest';
import { stripReasoningMiddleware } from '../src/providers/stripReasoningMiddleware.js';

// Helper: build a ReadableStream from an array of stream parts.
function streamOf(parts: Array<Record<string, unknown>>): ReadableStream {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

// Helper: drain a ReadableStream into an array.
async function drain(stream: ReadableStream): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value as Record<string, unknown>);
  }
  return out;
}

describe('stripReasoningMiddleware', () => {
  it('removes reasoning, reasoning-signature, and redacted-reasoning parts', async () => {
    const upstream = streamOf([
      { type: 'reasoning', textDelta: 'let me think' },
      { type: 'reasoning-signature', signature: 'abc' },
      { type: 'text-delta', textDelta: 'Hello' },
      { type: 'redacted-reasoning', data: 'xxx' },
      { type: 'text-delta', textDelta: ' world' },
      { type: 'finish', finishReason: 'stop' },
    ]);

    const wrapped = await stripReasoningMiddleware.wrapStream!({
      doStream: async () => ({ stream: upstream }) as never,
      doGenerate: async () => ({}) as never,
      params: {} as never,
      model: {} as never,
    });

    const parts = await drain((wrapped as { stream: ReadableStream }).stream);
    const types = parts.map((p) => p.type);

    expect(types).toEqual(['text-delta', 'text-delta', 'finish']);
    expect(parts.map((p) => p.textDelta).filter(Boolean)).toEqual(['Hello', ' world']);
  });

  it('passes a clean stream through unchanged', async () => {
    const upstream = streamOf([
      { type: 'text-delta', textDelta: 'no thinking here' },
      { type: 'finish', finishReason: 'stop' },
    ]);

    const wrapped = await stripReasoningMiddleware.wrapStream!({
      doStream: async () => ({ stream: upstream }) as never,
      doGenerate: async () => ({}) as never,
      params: {} as never,
      model: {} as never,
    });

    const parts = await drain((wrapped as { stream: ReadableStream }).stream);
    expect(parts.map((p) => p.type)).toEqual(['text-delta', 'finish']);
  });

  it('handles a reasoning-signature with no preceding reasoning (the proxy bug) without error', async () => {
    // This is the exact malformed shape that makes the AI SDK throw
    // "reasoning-signature without reasoning". The middleware drops it.
    const upstream = streamOf([
      { type: 'reasoning-signature', signature: 'orphan' },
      { type: 'text-delta', textDelta: 'answer' },
      { type: 'finish', finishReason: 'stop' },
    ]);

    const wrapped = await stripReasoningMiddleware.wrapStream!({
      doStream: async () => ({ stream: upstream }) as never,
      doGenerate: async () => ({}) as never,
      params: {} as never,
      model: {} as never,
    });

    const parts = await drain((wrapped as { stream: ReadableStream }).stream);
    expect(parts.map((p) => p.type)).toEqual(['text-delta', 'finish']);
  });

  it('preserves non-stream fields returned by doStream (e.g. rawCall)', async () => {
    const upstream = streamOf([{ type: 'finish', finishReason: 'stop' }]);
    const wrapped = await stripReasoningMiddleware.wrapStream!({
      doStream: async () =>
        ({ stream: upstream, rawCall: { rawPrompt: null, rawSettings: {} } }) as never,
      doGenerate: async () => ({}) as never,
      params: {} as never,
      model: {} as never,
    });

    expect((wrapped as { rawCall: unknown }).rawCall).toEqual({
      rawPrompt: null,
      rawSettings: {},
    });
  });
});
