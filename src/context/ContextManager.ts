import type { CoreMessage } from 'ai';
import { Message, CompactedContext } from '../types.js';

const MAX_TOOL_RESULT_LENGTH = 2000;
const OLD_MESSAGE_THRESHOLD = 20;
const TOOL_RESULT_SUMMARY_LENGTH = 500;
const COMPACTION_THRESHOLD = 0.7;

export class ContextManager {
  private transcript: Message[] = [];
  private workingDirectory: string;
  private maxContextTokens: number;

  constructor(workingDirectory: string = process.cwd(), maxContextTokens = 100_000) {
    this.workingDirectory = workingDirectory;
    this.maxContextTokens = maxContextTokens;
  }

  addMessage(message: Message): void {
    this.transcript.push(message);
  }

  async compact(): Promise<CompactedContext> {
    let messages = [...this.transcript];
    const appliedLayers: number[] = [];

    // Layer 1: Deduplicate identical consecutive messages
    messages = this.deduplicateMessages(messages);
    appliedLayers.push(1);

    // Layer 2: Truncate old tool results (keep recent ones full)
    const tokenEstimate = this.estimateTokens(messages);
    if (tokenEstimate > this.maxContextTokens * 0.5) {
      messages = this.truncateOldToolResults(messages);
      appliedLayers.push(2);
    }

    // Layer 3: Sliding window — drop oldest user/assistant pairs if still over budget
    if (this.estimateTokens(messages) > this.maxContextTokens * 0.8) {
      messages = this.applySlidingWindow(messages);
      appliedLayers.push(3);
    }

    return {
      messages,
      tokenCount: this.estimateTokens(messages),
      compactionLayers: appliedLayers,
    };
  }

  private deduplicateMessages(messages: Message[]): Message[] {
    const result: Message[] = [];
    for (const msg of messages) {
      const prev = result[result.length - 1];
      if (prev && prev.role === msg.role && prev.content === msg.content) {
        continue;
      }
      result.push(msg);
    }
    return result;
  }

  private truncateOldToolResults(messages: Message[]): Message[] {
    const recentBoundary = Math.max(0, messages.length - OLD_MESSAGE_THRESHOLD);

    return messages.map((msg, idx) => {
      if (idx >= recentBoundary) return msg;
      if (msg.type !== 'tool_result' || !msg.content) return msg;

      if (msg.content.length <= MAX_TOOL_RESULT_LENGTH) return msg;

      const truncated = msg.content.slice(0, TOOL_RESULT_SUMMARY_LENGTH);
      const lineCount = msg.content.split('\n').length;
      return {
        ...msg,
        content: `${truncated}\n... (truncated, ${lineCount} lines total)`,
      };
    });
  }

  private applySlidingWindow(messages: Message[]): Message[] {
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    let currentTokens = this.estimateTokens(systemMessages);
    const kept: Message[] = [];

    // Walk backwards, keeping recent messages first
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const msg = nonSystem[i]!;
      const msgTokens = Math.ceil(msg.content.length * 0.4) + 4;

      if (currentTokens + msgTokens > this.maxContextTokens * 0.9) {
        break;
      }

      kept.unshift(msg);
      currentTokens += msgTokens;
    }

    // Prepend a summary marker if we dropped messages
    if (kept.length < nonSystem.length) {
      const droppedCount = nonSystem.length - kept.length;
      const summaryMsg: Message = {
        id: 'compaction-marker',
        role: 'system',
        content: `[Context compacted: ${droppedCount} older messages removed to fit context window]`,
        timestamp: Date.now(),
      };
      return [...systemMessages, summaryMsg, ...kept];
    }

    return [...systemMessages, ...kept];
  }

  private estimateTokens(messages: Message[]): number {
    // ~0.4 tokens per char + 4-token overhead per message for role/formatting
    return messages.reduce((sum, msg) => sum + Math.ceil(msg.content.length * 0.4) + 4, 0);
  }

  getMessages(): Message[] {
    return [...this.transcript];
  }

  getMessageCount(): number {
    return this.transcript.length;
  }

  clear(): void {
    this.transcript = [];
  }

  shouldCompact(): boolean {
    return this.estimateTokens(this.transcript) > this.maxContextTokens * COMPACTION_THRESHOLD;
  }

  toCoreMessages(): CoreMessage[] {
    return this.transcript
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  addCoreMessage(role: 'user' | 'assistant', content: string): void {
    this.addMessage({
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
    });
  }

  getWorkingDirectory(): string {
    return this.workingDirectory;
  }
}
