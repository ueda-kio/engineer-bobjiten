/**
 * Reads untrusted frames off the wire.
 *
 * This is the one place allowed to distrust its input. It matters more than it
 * looks: `reduceSession` switches exhaustively over `SessionAction` with no
 * default case, so an unrecognised `type` would fall through every branch and
 * return `undefined` — wiping the room's state rather than being ignored.
 * Checking the shape here keeps that guarantee out of the reducer.
 */

import type { HelpKind, SessionAction } from "../src/domain/session";
import type { ClientMessage } from "../src/sync/protocol";

export const parseClientMessage = (raw: string | ArrayBuffer): ClientMessage | null => {
  if (typeof raw !== "string") return null;

  const parsed: unknown = tryParse(raw);
  if (!isRecord(parsed)) return null;

  switch (parsed.type) {
    case "join":
      return isString(parsed.name) &&
        isOptionalString(parsed.token) &&
        isOptionalString(parsed.claimPlayerId)
        ? {
            type: "join",
            name: parsed.name,
            ...(isString(parsed.token) ? { token: parsed.token } : {}),
            ...(isString(parsed.claimPlayerId) ? { claimPlayerId: parsed.claimPlayerId } : {}),
          }
        : null;

    case "releaseSeat":
      return isString(parsed.playerId) ? { type: "releaseSeat", playerId: parsed.playerId } : null;

    case "action": {
      const action = toAction(parsed.action);
      return action ? { type: "action", action } : null;
    }

    default:
      return null;
  }
};

const HELP_KINDS: HelpKind[] = ["category", "whitelist", "oneKatakana"];

/** Accepts `addPlayer` structurally so the room can refuse it as a denial. */
const toAction = (value: unknown): SessionAction | null => {
  if (!isRecord(value)) return null;

  switch (value.type) {
    case "addPlayer":
      return isString(value.id) && isString(value.name)
        ? { type: "addPlayer", id: value.id, name: value.name }
        : null;

    case "setEndCondition":
      return isPositiveInteger(value.roundsPerPlayer)
        ? { type: "setEndCondition", roundsPerPlayer: value.roundsPerPlayer }
        : null;

    case "selectTopic":
      return isString(value.topicId) ? { type: "selectTopic", topicId: value.topicId } : null;

    case "useHelp":
      return isHelpKind(value.kind) ? { type: "useHelp", kind: value.kind } : null;

    case "acceptKatakanaReport":
      return isString(value.reporterId)
        ? { type: "acceptKatakanaReport", reporterId: value.reporterId }
        : null;

    case "confirmAnswerer":
      return isString(value.playerId)
        ? { type: "confirmAnswerer", playerId: value.playerId }
        : null;

    case "startGame":
    case "redraw":
    case "next":
    case "restart":
    case "forceSkip":
      return { type: value.type };

    default:
      return null;
  }
};

const tryParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isOptionalString = (value: unknown): boolean => value === undefined || isString(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isHelpKind = (value: unknown): value is HelpKind => HELP_KINDS.some((kind) => kind === value);
