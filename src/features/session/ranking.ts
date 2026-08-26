import type { Player } from "../../domain/session";

/**
 * Display order for the result screen: highest score first.
 * The design does not specify tie-breaking, so ties keep registration order.
 */
export const rankPlayers = (players: Player[], scores: Record<string, number>): Player[] =>
  [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
