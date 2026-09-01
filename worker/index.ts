/**
 * The Worker entry: it only resolves a room code to its Durable Object.
 *
 * `wrangler.jsonc` routes `/ws` here with `run_worker_first`. Without that,
 * `not_found_handling: "single-page-application"` would answer the upgrade
 * request with `index.html` and the Worker would never run.
 */

import { Room } from "./room";

export { Room };

/** Bounded so a stray request cannot mint an unbounded number of objects. */
const ROOM_CODE = /^[A-Za-z0-9-]{1,32}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const code = url.searchParams.get("room");
      if (code === null || !ROOM_CODE.test(code)) {
        return new Response("invalid room code", { status: 400 });
      }

      // Everyone who knows the code reaches the same object (tech selection 5.4).
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
    }

    // Unreachable while `run_worker_first` scopes this Worker to `/ws`. Kept so
    // that a change to that setting cannot take the whole site down.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
