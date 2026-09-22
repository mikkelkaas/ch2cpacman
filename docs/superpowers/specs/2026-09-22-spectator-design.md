# Spectators — design (2026-09-22)

A team is more than the person holding the phone. A spectator joins the same
team on their own phone and sees what the runner sees: the map, the runner's
dot, the ghosts, the countdown and the score. The spectator's phone does no
tracking and writes nothing. Everything it shows comes from the store, fed by
the runner's phone.

## Decisions

| Question | Decision |
| --- | --- |
| How a spectator joins | The runner's phone shows a QR for `#/watch/CODE`. The admin's QR dialog can flip to the same address. The print sheet is unchanged. |
| What the spectator sees | Runner dot, ghosts, pellets, HUD, banners, sounds and game over, from server data. |
| Runner phone goes quiet | Keep the last picture, dimmed, with a "last seen N s ago" line that counts up. Live again on the next beat. |
| Two runner phones on one team | No guard. Same as today. Noted under out of scope. |
| Heartbeat cadence | Every 2 s while running or late, only when something changed. Failures are dropped, never queued. |
| Spectator poll cadence | Every 2 s: heartbeat, team, captures and events, all filtered by team id. |
| Stale threshold | A beat older than 8 s is stale. |

## Data model

One new collection, `ch2cpacman_heartbeats`, one document per team, replaced
in full with a PUT on each beat.

| Field | Contents |
| --- | --- |
| `teamId`, `gameId` | The team this beat belongs to. |
| `fix` | The runner's `lat`, `lng`, `accuracyM`, `at`, or `null` when the phone has no usable fix. |
| `ghosts` | The runner's `GhostState` as it holds it: the ghost array with positions, colours, `spawnedAtMs` and `rush`, plus `frightenedUntilMs` and `immuneUntilMs`. |
| `at` | When the beat was written, ISO string from the runner phone's clock. |

The runner's phone creates the document with a POST on its first beat and
remembers the id for later PUTs. On reload it looks the document up by team id
filter before creating one, so a team never has two.

Heartbeats are not part of the score. The admin's team reset deletes the team's
heartbeat along with its captures and events. The games page counts and adopts
the collection like the other game-scoped ones.

## Data flow

```
runner phone                          store                       spectator phone
────────────                          ─────                       ───────────────
GPS fix ─┐
ghost sim ┴─ useHeartbeat ── PUT ──▶ heartbeats ── GET ?teamId ─┐
captures ─────────────────── POST ─▶ captures   ── GET ?teamId ─┤
ghost events ─────────────── POST ─▶ events     ── GET ?teamId ─┼─ useSpectate ─▶ SpectatorGame
start / return ───────────── PUT ──▶ teams      ── GET ?_id ────┘
```

The spectator never writes. At ten active teams the heartbeats are about five
small writes per second in total, and each spectator adds four small filtered
reads every two seconds. Nothing grows with the day, since each heartbeat
document is overwritten.

## Joining

The runner address stays `#/join/CODE`. A spectator joins at `#/watch/CODE`.
The route module gains a role: `joinCodeFromHash` returns code and role,
`joinHash` takes both. The role is stored next to the team id in localStorage
and follows the same address-sync rule as the team: the address always says
who this phone is, so a reload or a link from history restores both.

Handing it out:

- The runner's idle screen, the one with the start button, gets an "add
  spectator" link that opens a full-screen QR for the watch address, reusing
  the admin's QR component. The same link sits in the rules dialog so it is
  reachable mid game.
- The admin's QR dialog gets a runner and spectator flip.
- An unknown code at `#/watch/CODE` lands on the code screen with the
  spectator role preselected, mirroring the runner's behaviour.

Leaving the team clears role and id together.

## Spectator screen

`SpectatorGame` is a sibling of the runner's `Game`, fed by `useSpectate`
instead of sensors. It reuses the map, HUD, banners and game over screen
unchanged.

- **Map**: the heartbeat's fix is the runner dot. The heartbeat's ghosts are
  drawn with the ghost mode derived from its frightened timer, the way the
  runner derives it now.
- **HUD**: countdown, late penalty, score and double window come from the team
  record, captures and events through the shared scoring functions. Pending
  count is always zero. The weak signal flag comes from the heartbeat's
  accuracy.
- **Banners and sounds**: the spectator diffs events between polls and shows
  the banner and plays the sound for each new one. The nearby ghost siren and
  the late siren work from the same data the runner uses.
- **Before the start**: a waiting screen with the team name and photo.
- **After the end**: the same game over screen.

Staleness: if the newest heartbeat is older than 8 s, the runner dot and
ghosts are dimmed and a small line in the HUD counts up since the last beat.
It clears on the next fresh beat. If the runner's phone has never beaten, the
map shows pellets and the start only, with a "waiting for the runner's phone"
line.

The spectator does no GPS, no capture engine, no ghost simulation and no
writes. It keeps the screen on while the phase runs, like the runner.

## Code structure

New:

- `src/lib/heartbeat.ts`: the record type, `isStale(beat, nowMs)`, and
  `heartbeatFromGame(team, fix, ghostState, nowMs)`. Pure.
- `src/runner/useHeartbeat.ts`: the writer. Takes active, fix and ghost state,
  keeps the document id, beats every 2 s when something changed.
- `src/runner/useSpectate.ts`: the reader. Polls the four filtered reads every
  2 s and returns team, captures, events, heartbeat and the last error.
- `src/runner/SpectatorGame.tsx`: composes the map, HUD and game over screen
  from the reader.
- `src/runner/SpectatorQr.tsx`: the full-screen QR the runner's phone shows.

Changed:

- `src/lib/api.ts`: the heartbeat collection.
- `src/lib/route.ts`, `src/lib/storage.ts`: the role.
- `src/runner/RunnerApp.tsx`: picks `Game` or `SpectatorGame` by role and
  passes the address role through the join effect.
- `src/lib/score.ts`: the double window and total points move out of `Game`
  into shared functions so both screens compute them identically. A small
  extraction, not a refactor.
- Admin: QR dialog flip, team reset deletes the heartbeat, games page counts
  and adopts the collection.
- README: storage table and a spectator line in how to play.

## Error handling

- **Writer**: a failed beat is skipped and the next tick tries again. A failed
  create is retried on the next tick too. Nothing is queued.
- **Reader**: a failed poll keeps the last good data and shows the existing
  error bar with retry. Staleness covers the case where reads work but the
  runner's phone has gone quiet.
- **Storage blocked**: the role and team come from the address, as for the
  runner.

## Testing

- Unit tests, vitest, existing style: role parsing in the route module,
  `isStale`, `heartbeatFromGame`, the extracted scoring functions, and the
  heartbeat collection's filtered read in the API client test.
- Browser pass with Playwright: two tabs, one runner with a faked geolocation
  and one spectator. The spectator's map picks up the runner dot and ghosts,
  and the stale marker appears when the runner tab stops beating.

## Out of scope

- Live team positions on the admin map. The heartbeat makes it cheap; not now.
- A guard against two phones both acting as runner. The heartbeat's document
  gives a natural place for it; not now.
- Spectators acting on the game in any way.
