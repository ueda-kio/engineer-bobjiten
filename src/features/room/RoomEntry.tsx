import { useState } from "react";
import { PrimaryButton, SecondaryButton } from "../../components/buttons";

type EntryProps = {
  /** From the URL when somebody followed a shared link. */
  roomCode: string | null;
  initialName: string;
  onEnter: (entry: { roomCode: string; name: string }) => void;
  onCreateRoom: () => void;
};

/** Naming yourself and picking a room. Joining itself happens over the socket. */
export const RoomEntry = ({ roomCode, initialName, onEnter, onCreateRoom }: EntryProps) => {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <label htmlFor="player-name" className="text-xs font-bold tracking-[0.2em] text-slate-500">
          名前
        </label>
        <input
          id="player-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="表示される名前"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600"
        />
      </div>

      {roomCode === null ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            ルームを作ると、共有できるリンクができる。他の参加者にはそれを渡す
          </p>
          <PrimaryButton disabled={trimmed === ""} onClick={onCreateRoom}>
            ルームを作る
          </PrimaryButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            ルーム <span className="font-black tracking-[0.2em] text-slate-100">{roomCode}</span>{" "}
            に入室する
          </p>
          <PrimaryButton
            disabled={trimmed === ""}
            onClick={() => onEnter({ roomCode, name: trimmed })}
          >
            入室する
          </PrimaryButton>
        </div>
      )}
    </section>
  );
};

/** Shown once a room exists, so the code can be handed round the table. */
export const RoomInvite = ({ roomCode }: { roomCode: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      ?.writeText(location.href)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2">
      <span className="text-xs text-slate-500">
        ルーム <span className="font-black tracking-[0.2em] text-slate-200">{roomCode}</span>
      </span>
      <SecondaryButton onClick={copy}>{copied ? "コピーした" : "リンクをコピー"}</SecondaryButton>
    </div>
  );
};
