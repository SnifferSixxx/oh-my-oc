import { describe, expect, test } from 'bun:test';
import { DEFAULT_AGENT_MCPS, getAgentMcpList, parseList } from './agent-mcps';

describe('parseList', () => {
  test('empty list returns empty array', () => {
    expect(parseList([], ['mcp1', 'mcp2'])).toEqual([]);
  });

  test('wildcard includes all available', () => {
    expect(parseList(['*'], ['mcp1', 'mcp2', 'mcp3'])).toEqual([
      'mcp1',
      'mcp2',
      'mcp3',
    ]);
  });

  test('orchestrator defaults to no MCPs (delegates to librarian)', () => {
    expect(
      parseList(DEFAULT_AGENT_MCPS.orchestrator, [
        'websearch',
        'context7',
        'grep_app',
        'custom-mcp',
      ]),
    ).toEqual([]);
  });

  test('orchestrator auto-allows Engram when engram is enabled', () => {
    expect(getAgentMcpList('orchestrator', { engram: true })).toEqual([
      'engram',
    ]);
  });

  test('explicit orchestrator mcps override Engram auto-allow', () => {
    expect(
      getAgentMcpList('orchestrator', {
        engram: true,
        agents: { orchestrator: { mcps: ['context7'] } },
      }),
    ).toEqual(['context7']);
  });

  test('wildcard with exclusions', () => {
    expect(parseList(['*', '!mcp2'], ['mcp1', 'mcp2', 'mcp3'])).toEqual([
      'mcp1',
      'mcp3',
    ]);
  });

  test('exclude wildcard returns empty', () => {
    expect(parseList(['!*'], ['mcp1', 'mcp2'])).toEqual([]);
  });

  test('specific items only', () => {
    expect(
      parseList(['mcp1', 'mcp3'], ['mcp1', 'mcp2', 'mcp3', 'mcp4']),
    ).toEqual(['mcp1', 'mcp3']);
  });

  test('specific items with exclusions', () => {
    expect(
      parseList(['mcp1', 'mcp3', '!mcp3'], ['mcp1', 'mcp2', 'mcp3']),
    ).toEqual(['mcp1']);
  });

  test('exclusions without matching allows', () => {
    expect(parseList(['!mcp2'], ['mcp1', 'mcp2', 'mcp3'])).toEqual([]);
  });
});
