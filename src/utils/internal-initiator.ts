export const SLIM_INTERNAL_INITIATOR_MARKER =
  '<!-- SLIM_INTERNAL_INITIATOR -->';

const SLIM_INTERNAL_INITIATOR_METADATA_KEY = 'slimInternalInitiator';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createInternalAgentTextPart(text: string): {
  type: 'text';
  text: string;
  metadata: Record<string, unknown>;
} {
  return {
    type: 'text',
    text,
    metadata: {
      [SLIM_INTERNAL_INITIATOR_METADATA_KEY]: true,
    },
  };
}

export function hasInternalInitiatorMarker(part: unknown): boolean {
  if (!isRecord(part) || part.type !== 'text') {
    return false;
  }

  if (typeof part.text !== 'string') {
    return false;
  }

  if (part.text.includes(SLIM_INTERNAL_INITIATOR_MARKER)) {
    return true;
  }

  if (!isRecord(part.metadata)) {
    return false;
  }

  return part.metadata[SLIM_INTERNAL_INITIATOR_METADATA_KEY] === true;
}
