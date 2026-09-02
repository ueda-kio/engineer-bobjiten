import { useState } from "react";
import { RoomEntry } from "./features/room/RoomEntry";
import { RoomScreen } from "./features/room/RoomScreen";
import { createRoomCode, isRoomCode } from "./features/room/roomCode";

const NAME_KEY = "bobjiten:name";

/** The room code lives in the URL, so sharing the link is sharing the room. */
const roomCodeFromUrl = (): string | null => {
  const code = new URLSearchParams(location.search).get("room");
  return code !== null && isRoomCode(code) ? code : null;
};

const readName = (): string => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

const rememberName = (name: string): void => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Only a convenience on the next visit; not worth failing over.
  }
};

function App() {
  const [roomCode, setRoomCode] = useState(roomCodeFromUrl);
  const [entered, setEntered] = useState<{ roomCode: string; name: string } | null>(null);

  const openRoom = (code: string) => {
    history.replaceState(null, "", `?room=${code}`);
    setRoomCode(code);
  };

  const enter = (entry: { roomCode: string; name: string }) => {
    rememberName(entry.name);
    setEntered(entry);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-black tracking-tight text-slate-50">
          エンジニア縛りボブジテン
        </h1>
      </header>

      {entered === null ? (
        <RoomEntry
          roomCode={roomCode}
          initialName={readName()}
          onEnter={enter}
          onCreateRoom={() => openRoom(createRoomCode())}
        />
      ) : (
        <RoomScreen roomCode={entered.roomCode} name={entered.name} />
      )}
    </div>
  );
}

export default App;
