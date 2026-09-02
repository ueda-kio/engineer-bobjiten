/**
 * Room codes are read aloud across a noisy table, so the alphabet leaves out
 * the characters people mishear or mistype: I, L, O, 0 and 1.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const CODE_LENGTH = 6;

/** Matches the Worker's own check on `/ws?room=`. */
const VALID_CODE = /^[A-Za-z0-9-]{1,32}$/;

export const createRoomCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));

  // The modulo skews the last few letters very slightly. At seven friends
  // guessing nothing, that is not worth rejection sampling.
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
};

export const isRoomCode = (value: string): boolean => VALID_CODE.test(value);
