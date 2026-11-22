/** Sends typed requests through the public simulation host port. */
import {
  simulationProtocolVersion as version,
  type CommandPayload,
  type SimulationCommand,
  type SimulationHost,
} from '../../packages/contracts/src';

export const options = { sessionId: 'scenario', seed: 0 };

export function command(
  commandId: string,
  expectedRevision: number,
  payload: CommandPayload,
): SimulationCommand {
  return { version, type: 'command', sessionId: options.sessionId, commandId, expectedRevision, payload };
}

export function submit(
  host: SimulationHost,
  commandId: string,
  revision: number,
  payload: CommandPayload,
) {
  const reply = host.handle(command(commandId, revision, payload));
  if (reply.type !== 'result') throw new Error('Expected a command result');
  return reply;
}

export function snapshot(host: SimulationHost) {
  const reply = host.handle({ version, type: 'read', sessionId: options.sessionId });
  if (reply.type !== 'snapshot') throw new Error('Expected a session snapshot');
  return reply.snapshot;
}
