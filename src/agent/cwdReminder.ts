import type { CoreMessage, CoreUserMessage, TextPart } from 'ai';

/**
 * A stable marker that lets us detect a reminder we previously injected, so we
 * never stack the same note twice on a message that survives across turns.
 */
const CWD_REMINDER_MARKER = '<cwd-reminder>';

/**
 * Build the recency reminder appended to the latest user turn. Models weight
 * recent tokens more heavily than the system prompt prior, so restating the
 * working directory right next to the user's request is the most reliable way
 * to stop the model inventing a sandbox-style path.
 */
export function buildCwdReminder(cwd: string): string {
  return (
    `${CWD_REMINDER_MARKER} The working directory is exactly: ${cwd}. ` +
    `All paths resolve against it. Never invent or guess any other location ` +
    `(no "/Users/...", "/workspace/...", or sandbox-style paths).`
  );
}

function alreadyInjected(content: CoreMessage['content']): boolean {
  if (typeof content === 'string') {
    return content.includes(CWD_REMINDER_MARKER);
  }
  if (Array.isArray(content)) {
    return content.some(
      (part) =>
        part.type === 'text' &&
        typeof part.text === 'string' &&
        part.text.includes(CWD_REMINDER_MARKER),
    );
  }
  return false;
}

/**
 * Append a fresh cwd reminder to the LAST user message. Returns a new array and
 * leaves the input (and its message objects) untouched. No-ops when there is no
 * user message, or when the last user message already carries a reminder.
 */
export function injectCwdReminder(
  messages: CoreMessage[],
  cwd: string,
): CoreMessage[] {
  // Find the last user message.
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return messages;

  const target = messages[lastUserIdx] as CoreUserMessage;
  if (alreadyInjected(target.content)) return messages;

  const reminder = buildCwdReminder(cwd);
  const reminderPart: TextPart = { type: 'text', text: reminder };

  let nextContent: CoreUserMessage['content'];
  if (typeof target.content === 'string') {
    nextContent = `${target.content}\n\n${reminder}`;
  } else if (Array.isArray(target.content)) {
    nextContent = [...target.content, reminderPart];
  } else {
    // Unknown content shape — leave it alone rather than risk corrupting it.
    return messages;
  }

  const next = messages.slice();
  next[lastUserIdx] = { ...target, content: nextContent };
  return next;
}
