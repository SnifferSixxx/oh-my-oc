const CLAUDE_CODE_SYSTEM_PROMPT =
  "You are Claude Code, Anthropic's official CLI for Claude.";

interface MessageInfo {
  role: string;
  agent?: string;
  providerID?: string;
  provider?: string;
  modelID?: string;
  model?: {
    providerID?: string;
    modelID?: string;
  };
  [key: string]: unknown;
}

interface MessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface MessageWithParts {
  info: MessageInfo;
  parts: MessagePart[];
}

function getProviderID(message: MessageWithParts): string | undefined {
  return (
    message.info.providerID ??
    message.info.model?.providerID ??
    (typeof message.info.provider === 'string'
      ? message.info.provider
      : undefined)
  );
}

function shouldInjectForAnthropic(messages: MessageWithParts[]): boolean {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const providerID = getProviderID(messages[index]);
    if (providerID) {
      return providerID === 'anthropic';
    }
  }

  return false;
}

export function createAnthropicClaudeCodePromptHook(enabled = false) {
  return {
    'experimental.chat.messages.transform': async (
      _input: Record<string, never>,
      output: { messages: MessageWithParts[] },
    ): Promise<void> => {
      if (!enabled) return;

      const { messages } = output;
      if (messages.length === 0 || !shouldInjectForAnthropic(messages)) {
        return;
      }

      let lastUserMessageIndex = -1;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].info.role === 'user') {
          lastUserMessageIndex = i;
          break;
        }
      }

      if (lastUserMessageIndex === -1) {
        return;
      }

      const lastUserMessage = messages[lastUserMessageIndex];
      const textPartIndex = lastUserMessage.parts.findIndex(
        (part) => part.type === 'text' && part.text !== undefined,
      );

      if (textPartIndex === -1) {
        return;
      }

      const originalText = lastUserMessage.parts[textPartIndex].text ?? '';
      if (originalText.startsWith(CLAUDE_CODE_SYSTEM_PROMPT)) {
        return;
      }

      lastUserMessage.parts[textPartIndex].text =
        `${CLAUDE_CODE_SYSTEM_PROMPT}\n\n---\n\n${originalText}`;
    },
  };
}

export { CLAUDE_CODE_SYSTEM_PROMPT };
