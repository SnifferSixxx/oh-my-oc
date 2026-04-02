/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { generateLiteConfig, MODEL_MAPPINGS } from './providers';

describe('providers', () => {
  test('MODEL_MAPPINGS has exactly 4 providers', () => {
    const keys = Object.keys(MODEL_MAPPINGS);
    expect(keys.sort()).toEqual(['copilot', 'kimi', 'openai', 'zai-plan']);
  });

  test('generateLiteConfig always generates openai preset', () => {
    const config = generateLiteConfig({
      multiplexerType: 'none',
      installSkills: false,
      installCustomSkills: false,
    });

    expect(config.preset).toBe('openai');
    const agents = (config.presets as any).openai;
    expect(agents).toBeDefined();
    expect(agents.orchestrator.model).toBe('openai/gpt-5.4');
    expect(agents.orchestrator.variant).toBeUndefined();
    expect(agents.fixer.model).toBe('openai/gpt-5.4-mini');
    expect(agents.fixer.variant).toBe('low');
  });

  test('generateLiteConfig uses correct OpenAI models', () => {
    const config = generateLiteConfig({
      multiplexerType: 'none',
      installSkills: false,
      installCustomSkills: false,
    });

    const agents = (config.presets as any).openai;
    expect(agents.orchestrator.model).toBe(
      MODEL_MAPPINGS.openai.orchestrator.model,
    );
    expect(agents.oracle.model).toBe('openai/gpt-5.4');
    expect(agents.oracle.variant).toBe('high');
    expect(agents.librarian.model).toBe('openai/gpt-5.4-mini');
    expect(agents.librarian.variant).toBe('low');
    expect(agents.explorer.model).toBe('openai/gpt-5.4-mini');
    expect(agents.explorer.variant).toBe('low');
    expect(agents.designer.model).toBe('openai/gpt-5.4-mini');
    expect(agents.designer.variant).toBe('medium');
  });

  test('generateLiteConfig enables zellij when requested', () => {
    const config = generateLiteConfig({
      multiplexerType: 'zellij',
      installSkills: false,
      installCustomSkills: false,
    });

    expect(config.multiplexer).toBeDefined();
    expect((config.multiplexer as any).type).toBe('zellij');
  });

  test('generateLiteConfig includes default skills', () => {
    const config = generateLiteConfig({
      multiplexerType: 'none',
      installSkills: true,
      installCustomSkills: false,
    });

    const agents = (config.presets as any).openai;
    // Orchestrator should always have '*'
    expect(agents.orchestrator.skills).toEqual(['*']);

    // Designer should have 'agent-browser'
    expect(agents.designer.skills).toContain('agent-browser');

    // Fixer should have no skills by default (empty recommended list)
    expect(agents.fixer.skills).toEqual([]);
  });

  test('generateLiteConfig includes mcps field', () => {
    const config = generateLiteConfig({
      multiplexerType: 'none',
      installSkills: false,
      installCustomSkills: false,
    });

    const agents = (config.presets as any).openai;
    expect(agents.orchestrator.mcps).toBeDefined();
    expect(Array.isArray(agents.orchestrator.mcps)).toBe(true);
    expect(agents.librarian.mcps).toBeDefined();
    expect(Array.isArray(agents.librarian.mcps)).toBe(true);
  });

  test('generateLiteConfig openai includes correct mcps', () => {
    const config = generateLiteConfig({
      multiplexerType: 'none',
      installSkills: false,
      installCustomSkills: false,
    });

    const agents = (config.presets as any).openai;
    expect(agents.orchestrator.mcps).toContain('*');
    expect(agents.librarian.mcps).toContain('websearch');
    expect(agents.librarian.mcps).toContain('context7');
    expect(agents.librarian.mcps).toContain('grep_app');
    expect(agents.designer.mcps).toEqual([]);
  });
});
