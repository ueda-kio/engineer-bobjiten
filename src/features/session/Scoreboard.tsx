import type { Player } from "../../domain/session";

type ScoreboardProps = {
  players: Player[];
  scores: Record<string, number>;
  presentCounts: Record<string, number>;
  presenterId?: string;
  hostId: string | null;
  /** Registered but not connected right now (design 6.5). */
  awayPlayerIds: string[];
  /** Seats the host has freed for somebody to take over (design 6.4). */
  vacantPlayerIds: string[];
  /** Given only to the host; the server checks again with `canReleaseSeat`. */
  onReleaseSeat?: (playerId: string) => void;
};

/** Players in registration order, with who is presenting and who is missing. */
export const Scoreboard = ({
  players,
  scores,
  presentCounts,
  presenterId,
  hostId,
  awayPlayerIds,
  vacantPlayerIds,
  onReleaseSeat,
}: ScoreboardProps) => (
  <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60">
    {players.map((player) => {
      const vacant = vacantPlayerIds.includes(player.id);
      const away = awayPlayerIds.includes(player.id);

      return (
        <li key={player.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-200">
            <span className={away || vacant ? "text-slate-500" : undefined}>{player.name}</span>

            {player.id === hostId && (
              <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                ホスト
              </span>
            )}
            {player.id === presenterId && (
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
                出題中
              </span>
            )}
            {vacant ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                空席
              </span>
            ) : (
              away && (
                <span className="rounded-full bg-slate-700/40 px-2 py-0.5 text-xs text-slate-400">
                  離脱中
                </span>
              )
            )}

            {/* Releasing your own seat would leave nobody able to host. */}
            {onReleaseSeat && !vacant && player.id !== hostId && (
              <button
                type="button"
                onClick={() => onReleaseSeat(player.id)}
                className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400"
              >
                席を解放
              </button>
            )}
          </span>

          <span className="flex shrink-0 items-baseline gap-2">
            <span className="text-xs text-slate-500">{presentCounts[player.id] ?? 0} 問出題</span>
            <span className="text-base font-bold text-slate-100">{scores[player.id] ?? 0}</span>
          </span>
        </li>
      );
    })}
  </ul>
);
