/** Validates incoming host messages and normalizes payloads for retry comparison. */
import {
  simulationProtocolVersion,
  type CommandPayload,
  type SimulationRequest,
} from '../../contracts/src';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function parsePayload(value: unknown): CommandPayload | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 2) return;

  switch (value.type) {
    case 'advance':
      if (isInteger(value.days)) return { type: 'advance', days: value.days };
      return;
    case 'advance-through':
      if (isInteger(value.day)) return { type: 'advance-through', day: value.day };
      return;
    case 'resolve-alert':
      if (isIdentifier(value.alertId)) return { type: 'resolve-alert', alertId: value.alertId };
  }
}

/** Returns an owned request with canonical field order, or undefined for malformed input. */
export function parseRequest(value: unknown): SimulationRequest | undefined {
  if (
    !isRecord(value) ||
    value.version !== simulationProtocolVersion ||
    !isIdentifier(value.sessionId)
  ) return;

  const { sessionId, commandId, expectedRevision } = value;
  if (value.type === 'read') {
    return { version: simulationProtocolVersion, type: 'read', sessionId };
  }

  if (
    value.type !== 'command' ||
    !isIdentifier(commandId) ||
    !isInteger(expectedRevision) ||
    expectedRevision < 0
  ) return;

  const payload = parsePayload(value.payload);
  if (!payload) return;

  return Object.freeze({
    version: simulationProtocolVersion,
    type: 'command',
    sessionId,
    commandId,
    expectedRevision,
    payload: Object.freeze(payload),
  });
}
