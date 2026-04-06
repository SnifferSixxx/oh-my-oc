import { describe, expect, test } from 'bun:test';
import { createInternalAgentTextPart } from '../../utils';
import { createPhaseReminderHook, PHASE_REMINDER } from './index';

describe('createPhaseReminderHook', () => {
  test('prepends reminder for orchestrator sessions', async () => {
    const hook = createPhaseReminderHook();
    const output = {
      messages: [
        {
          info: { role: 'user', agent: 'orchestrator' },
          parts: [{ type: 'text', text: 'hello' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[0].parts[0].text).toBe(
      `${PHASE_REMINDER}\n\n---\n\nhello`,
    );
  });

  test('skips non-orchestrator sessions', async () => {
    const hook = createPhaseReminderHook();
    const output = {
      messages: [
        {
          info: { role: 'user', agent: 'explorer' },
          parts: [{ type: 'text', text: 'hello' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[0].parts[0].text).toBe('hello');
  });

  test('skips internal notification turns', async () => {
    const hook = createPhaseReminderHook();
    const output = {
      messages: [
        {
          info: { role: 'user' },
          parts: [
            createInternalAgentTextPart('[Background task "x" completed]'),
          ],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[0].parts[0].text).toBe(
      '[Background task "x" completed]',
    );
    expect(output.messages[0].parts[0].text).not.toContain(PHASE_REMINDER);
  });

  test('is a no-op when disabled', async () => {
    const hook = createPhaseReminderHook(false);
    const output = {
      messages: [
        {
          info: { role: 'user', agent: 'orchestrator' },
          parts: [{ type: 'text', text: 'hello' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[0].parts[0].text).toBe('hello');
  });
});
