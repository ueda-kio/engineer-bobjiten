import { PrimaryButton } from "../../components/buttons";
import type { JoinRejection } from "../../domain/connection";
import type { Player } from "../../domain/session";
import type { ConnectionStatus, Notice } from "../../sync/client";

const REJECTION_TEXT: Record<JoinRejection, string> = {
  seatUnavailable: "その席には座れない。既に誰かが使っている",
  seatAmbiguous: "どの席か決められなかった",
  newPlayersNotAccepted: "ゲームが始まっているため、新しい参加はできない",
};

/** A banner over the board, so a hiccup never blanks what is already on screen. */
export const ConnectionBanner = ({
  status,
  onRetry,
}: {
  status: ConnectionStatus;
  onRetry: () => void;
}) => {
  if (status.kind === "connecting" || status.kind === "joining") {
    return <Banner tone="quiet">接続している…</Banner>;
  }

  if (status.kind === "reconnecting") {
    return <Banner tone="warn">接続が切れた。再接続している（{status.attempt + 1} 回目）</Banner>;
  }

  if (status.kind === "gaveUp") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
        <p className="text-sm leading-6 text-amber-100">
          {status.rejoinable
            ? "しばらく接続できなかった。席は残っているので、そのまま戻れる"
            : "サーバに接続できなかった"}
        </p>
        <PrimaryButton onClick={onRetry}>再接続する</PrimaryButton>
      </div>
    );
  }

  if (status.kind === "rejected") {
    return <Banner tone="warn">{REJECTION_TEXT[status.reason]}</Banner>;
  }

  return null;
};

/** Transient feedback for one operation; never replaces the board. */
export const OperationNotice = ({ notice }: { notice: Notice }) => (
  <Banner tone="quiet">
    {notice.kind === "denied"
      ? "今はその操作をする番ではない"
      : `送った内容を処理できなかった: ${notice.message}`}
  </Banner>
);

/**
 * Several seats were free, so the server could not tell which one is ours
 * (design 6.4). Picking by name is what keeps somebody from inheriting another
 * player's score.
 */
export const SeatPicker = ({
  players,
  vacantPlayerIds,
  onClaim,
}: {
  players: Player[];
  vacantPlayerIds: string[];
  onClaim: (playerId: string) => void;
}) => {
  const seats = players.filter((player) => vacantPlayerIds.includes(player.id));

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm leading-6 text-amber-100">
        空いている席が複数ある。得点はその席に残っているので、自分の席を選ぶ
      </p>

      {seats.length === 0 ? (
        <p className="text-xs text-amber-200/80">空席がなくなった。再接続して入り直す</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {seats.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => onClaim(player.id)}
                className="w-full rounded-xl border border-amber-400/50 px-4 py-3 text-left text-slate-100"
              >
                {player.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const Banner = ({ tone, children }: { tone: "quiet" | "warn"; children: React.ReactNode }) => (
  <p
    className={`rounded-xl border p-3 text-center text-xs leading-5 ${
      tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-slate-800 bg-slate-900/60 text-slate-400"
    }`}
  >
    {children}
  </p>
);
