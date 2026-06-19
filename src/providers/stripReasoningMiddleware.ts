import type { LanguageModelV1Middleware } from 'ai';

/**
 * Stream parts emitted by the provider for extended-thinking / reasoning.
 * wardayacode does not render reasoning, and some proxies forward these
 * chunks out of order (e.g. a `reasoning-signature` without a preceding
 * `reasoning`), which makes the AI SDK throw
 * "reasoning-signature without reasoning" and aborts the whole response.
 */
const REASONING_PART_TYPES = new Set([
  'reasoning',
  'reasoning-signature',
  'redacted-reasoning',
]);

/**
 * Response-side middleware that drops all reasoning stream parts before they
 * reach the AI SDK's stream consumer.
 *
 * Why response-side: the provider only *requests* thinking when explicitly told
 * to (which wardayacode never does), yet some proxies inject thinking blocks
 * unsolicited — and sometimes malformed. We can't prevent that from the request
 * side, so we sanitize the response instead. This makes wardayacode resilient to
 * any baseURL/proxy/provider that returns reasoning, with no behavioral loss
 * since reasoning is not displayed.
 */
export const stripReasoningMiddleware: LanguageModelV1Middleware = {
  middlewareVersion: 'v1',
  wrapStream: async ({ doStream }) => {
    const result = await doStream();

    const filtered = (result.stream as ReadableStream).pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          const part = chunk as { type?: string };
          if (part?.type && REASONING_PART_TYPES.has(part.type)) {
            return; // drop reasoning chunk
          }
          controller.enqueue(chunk);
        },
      }),
    );

    return { ...result, stream: filtered };
  },
};
