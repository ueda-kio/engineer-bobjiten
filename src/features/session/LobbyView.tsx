import { PrimaryButton } from "../../components/buttons";
import { MAX_ROUNDS_PER_PLAYER, MIN_PLAYERS } from "../../domain/rules";
import type { EndCondition, Player, SessionAction } from "../../domain/session";
import { Scoreboard } from "./Scoreboard";

const ROUND_OPTIONS = [1, 2, 3, 4, 5].filter((rounds) => rounds <= MAX_ROUNDS_PER_PLAYER);

type LobbyProps = {
  players: Player[];
  hostId: string | null;
  endCondition: EndCondition;
  awayPlayerIds: string[];
  vacantPlayerIds: string[];
  /** Design 7.1: setting the end condition and starting belong to the host. */
  canStart: boolean;
  canSetEndCondition: boolean;
  canReleaseSeat: (playerId: string) => boolean;
  dispatch: (action: SessionAction) => void;
  onReleaseSeat: (playerId: string) => void;
};

/**
 * Waiting to start. Nobody is registered from here any more: joining the room
 * is what puts you on the roster, so identity is settled in one place.
 */
export const LobbyView = ({
  players,
  hostId,
  endCondition,
  awayPlayerIds,
  vacantPlayerIds,
  canStart,
  canSetEndCondition,
  canReleaseSeat,
  dispatch,
  onReleaseSeat,
}: LobbyProps) => (
  <section className="flex flex-col gap-8">
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500">
        参加者 {players.length} 名
      </h2>

      {players.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-500">
          まだ誰も入室していない
        </p>
      ) : (
        <Scoreboard
          players={players}
          scores={{}}
          presentCounts={{}}
          hostId={hostId}
          awayPlayerIds={awayPlayerIds}
          vacantPlayerIds={vacantPlayerIds}
          canReleaseSeat={canReleaseSeat}
          onReleaseSeat={onReleaseSeat}
        />
      )}
    </div>

    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500">終了条件</h2>

      {canSetEndCondition ? (
        <div className="flex flex-wrap gap-2">
          {ROUND_OPTIONS.map((rounds) => (
            <button
              key={rounds}
              type="button"
              onClick={() => dispatch({ type: "setEndCondition", roundsPerPlayer: rounds })}
              className={`rounded-xl border px-4 py-2 text-sm ${
                endCondition.roundsPerPlayer === rounds
                  ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
                  : "border-slate-700 text-slate-300"
              }`}
            >
              各 {rounds} 問
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          全員 {endCondition.roundsPerPlayer} 問出題で終了。設定と開始はホストが行う
        </p>
      )}
    </div>

    {canStart && (
      <PrimaryButton
        disabled={players.length < MIN_PLAYERS}
        onClick={() => dispatch({ type: "startGame" })}
      >
        {players.length < MIN_PLAYERS
          ? `あと ${MIN_PLAYERS - players.length} 名で開始できる`
          : "ゲームを開始"}
      </PrimaryButton>
    )}
  </section>
);
