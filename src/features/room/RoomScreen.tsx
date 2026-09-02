import { SessionBoard } from "../session/SessionBoard";
import { ConnectionBanner, OperationNotice, SeatPicker } from "./ConnectionNotice";
import { RoomInvite } from "./RoomEntry";
import { useRoomConnection } from "./useRoomConnection";

/**
 * A room, once a name and a code exist.
 *
 * The last payload stays on screen through a disconnect, so a phone waking up
 * shows the game with a banner rather than an empty page.
 */
export const RoomScreen = ({ roomCode, name }: { roomCode: string; name: string }) => {
  const { status, payload, notice, send, releaseSeat, claimSeat, retry } = useRoomConnection({
    roomCode,
    name,
  });

  const viewerId = status.kind === "joined" ? status.playerId : null;

  return (
    <div className="flex flex-col gap-4">
      <RoomInvite roomCode={roomCode} />

      <ConnectionBanner status={status} onRetry={retry} />

      {status.kind === "choosingSeat" && payload !== null && (
        <SeatPicker
          players={payload.players}
          vacantPlayerIds={payload.vacantPlayerIds}
          onClaim={claimSeat}
        />
      )}

      {notice !== null && <OperationNotice notice={notice} />}

      {payload !== null && viewerId !== null && (
        <SessionBoard
          payload={payload}
          viewerId={viewerId}
          dispatch={send}
          onReleaseSeat={releaseSeat}
        />
      )}
    </div>
  );
};
