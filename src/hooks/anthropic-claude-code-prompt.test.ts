import { describe, expect, test } from 'bun:test';
import {
  CLAUDE_CODE_SYSTEM_PROMPT,
  createAnthropicClaudeCodePromptHook,
} from './anthropic-claude-code-prompt';

describe('createAnthropicClaudeCodePromptHook', () => {
  test('prepends Claude Code prompt for Anthropic requests', async () => {
    const hook = createAnthropicClaudeCodePromptHook(true);
    const output = {
      messages: [
        {
          info: { role: 'user', providerID: 'anthropic' },
          parts: [{ type: 'text', text: 'hello' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[0].parts[0].text).toBe(
      `${CLAUDE_CODE_SYSTEM_PROMPT}\n\n---\n\nhello`,
    );
  });

  test('supports provider info nested under info.model', async () => {
    const hook = createAnthropicClaudeCodePromptHook(true);
    const output = {
      messages: [
        {
          info: {
            role: 'assistant',
            model: { providerID: 'anthropic', modelID: 'claude-sonnet-4-6' },
          },
          parts: [{ type: 'text', text: 'previous' }],
        },
        {
          info: { role: 'user' },
          parts: [{ type: 'text', text: 'hello' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[1].parts[0].text).toBe(
      `${CLAUDE_CODE_SYSTEM_PROMPT}\n\n---\n\nhello`,
    );
  });

  test('skips non-Anthropic requests', async () => {
    const hook = createAnthropicClaudeCodePromptHook(true);
    const output = {
      messages: [
        {
          info: { role: 'user', providerID: 'openai' },
          parts: [{ type: 'text', text: 'hello' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[0].parts[0].text).toBe('hello');
  });

  test('is a no-op when disabled', async () => {
    const hook = createAnthropicClaudeCodePromptHook(false);
    const output = {
      messages: [
        {
          info: { role: 'user', providerID: 'anthropic' },
          parts: [{ type: 'text', text: 'hello' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[0].parts[0].text).toBe('hello');
  });
});
