/**
 * Multiplexer factory - creates the appropriate multiplexer instance
 */

import type { MultiplexerConfig, MultiplexerType } from '../config/schema';
import { log } from '../utils/logger';
import type { Multiplexer } from './types';
import { ZellijMultiplexer } from './zellij';

const multiplexerCache = new Map<MultiplexerType, Multiplexer>();

/**
 * Create or retrieve a multiplexer instance based on config
 */
export function getMultiplexer(config: MultiplexerConfig): Multiplexer | null {
  const { type } = config;

  if (type === 'none') {
    return null;
  }

  // Return cached instance if available
  const cached = multiplexerCache.get(type);
  if (cached) {
    return cached;
  }

  // Create new instance
  switch (type) {
    case 'zellij':
      break;
    default:
      log(`[multiplexer] Unknown type: ${type}`);
      return null;
  }

  const multiplexer = new ZellijMultiplexer(
    config.layout,
    config.main_pane_size,
  );
  multiplexerCache.set(type, multiplexer);
  log(`[multiplexer] Created ${type} instance`);

  return multiplexer;
}

/**
 * Clear the multiplexer cache (useful for testing)
 */
export function clearMultiplexerCache(): void {
  multiplexerCache.clear();
}

/**
 * Start background availability check for a multiplexer
 */
export function startAvailabilityCheck(config: MultiplexerConfig): void {
  const multiplexer = getMultiplexer(config);
  if (multiplexer) {
    // Fire and forget - don't await
    multiplexer.isAvailable().catch(() => {});
  }
}
