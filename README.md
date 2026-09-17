# PAC-LIVE (ch2cpacman)

An arcade Pac-Man style GPS race for one scout event. Patrols arrive at a station
one at a time across the day. Each gets a phone with a dark map full of glowing
pellets, taps **TRYK START**, and has a fixed number of minutes to run around and
eat as many pellets as it can. Pellets far from the start are worth more. When the
time runs out the screen says GAME OVER and shows the score.

Nothing to install: it is a static web page, hosted on GitHub Pages at
<https://mikkelkaas.github.io/ch2cpacman/>. The only server is
[cruttelut](https://cruttelut.kaasfrich.dk), an unauthenticated JSON store.

- Runner: `https://mikkelkaas.github.io/ch2cpacman/`
- Admin, list of games: `https://mikkelkaas.github.io/ch2cpacman/#/admin`
- Admin, one game: `https://mikkelkaas.github.io/ch2cpacman/#/admin/<gameId>`

Design: `docs/superpowers/specs/2026-09-17-ch2cpacman-design.md`. Ideas not yet
built: `ROADMAP.md`.

## Running the event

1. Open the admin page on a laptop. It lists the games; create one and open it.
   Each game has its own settings, dots, teams and standings. Team codes are
   unique across all games, so a runner only ever types the code.
2. **Indstillinger**: set minutes per team (default 10). Click *Sæt startpunkt*,
   then click the map where the teams start. Pick a *Korttema* for the runner's
   map: Nat (dark inverted), Neon, Lys (plain), Amber or Grøn.
3. **Prikker**: set *Point for nye prikker*, then click the map once per dot of
   that value; change the number and continue with the next value. Drag a dot to
   move it; drag the map to pan. The list is sorted by distance from the start, so give the far ones more
   points. Radius is how close the phone has to be, in metres; the default is
   5 m, use more under dense trees.
4. **Hold**: paste the team names, one per line, and *Tilføj*. The 4-character
   code next to each team is what the patrol types on the phone. Codes never
   contain 0, O, 1 or I. *Vis QR* opens a full-screen QR code for that team,
   with next and previous, so a leader can hold up a phone to a queue of
   patrols; scanning it joins the team without typing. *Print* in the header
   opens a sheet with one card per team and a station overview of all codes.
5. Hand a patrol a phone with the runner page open. They type the code, read the
   rules, tap *Videre*, take a team photo (or skip it), plan on the map, tap
   *TRYK START*. The countdown starts
   the moment they tap. The phone eats pellets automatically when inside a
   pellet's radius; nobody taps anything.
6. **Stilling** on the admin page refreshes every 10 seconds. Click a row to
   see which pellets a team ate.
7. If a team needs to run again, *Nulstil* clears its start time and deletes its
   captures. *Slet* removes the team entirely.

Fixes worse than 30 m are shown but not trusted: no pellet is eaten and no
ghost catches on them, and the HUD says "SVAGT GPS-SIGNAL".

Phones need location permission and should keep the screen on. The page requests
a wake lock where the browser supports it. Captures made without signal are
queued on the phone and uploaded when it reconnects; the phone's own score counts
them immediately.

## Ghosts, power pellets and Dobbelt

- **Spøgelser.** Ghosts live on the phone only. They wait out a head start, then
  walk straight toward the runner's last GPS fix, ignoring terrain. Within 10 m
  the team is caught, loses points and is immune for 20 seconds while the ghost
  jumps at least 100 m away. A ghost within 40 m sets off a siren and a red
  pulse. Every catch is posted as an event the scoreboard subtracts.
- **Power.** A dot of type *Power* turns every ghost blue for a while; blue
  ghosts flee, and catching one earns bonus points. They flash white for the
  last 5 seconds.
- **Dobbelt.** A dot of type *Dobbelt* doubles every pellet eaten in the next
  minute, not itself and not ghost bonuses. The window is computed from capture
  timestamps on both the phone and the admin page.

All numbers are in *Indstillinger*: number of ghosts (0 turns them off), speed,
head start, points lost per catch, points per eaten ghost, power and Dobbelt
durations. Defaults: 2 ghosts, 1.5 m/s, 60 s head start, 2 points lost, 3 points
per ghost, 20 s power, 60 s Dobbelt. Set the type for new dots next to the point
value before clicking the map.

## Rules of scoring

- A team's window is `startedAt` to `startedAt + minutes`, plus 30 seconds grace
  for an upload that lands late. Captures outside it do not count.
- Each team can eat each pellet once. Pellets are not removed for other teams.
- Points = pellets × Dobbelt multiplier + ghost bonuses − catches, never below 0.
- Every team sees the same full map, whether it plays at 9:00 or 16:00.

## Storage

Four cruttelut collections. `GET https://cruttelut.kaasfrich.dk/rest/<name>`
returns the whole collection.

Every record except games carries a `gameId`. Records from before games existed
have none; the games page adopts them into the oldest game (creating "Spil 1"
if needed) the first time it loads.

| Collection | Contents |
| --- | --- |
| `ch2cpacman_games` | `name`, `createdAt` |
| `ch2cpacman_settings` | one per game: `phaseMinutes`, `start`, `mapTheme`, ghost settings |
| `ch2cpacman_teams` | `name`, `code`, `color`, `createdAt`, `startedAt` |
| `ch2cpacman_pellets` | `name`, `lat`, `lng`, `radiusM`, `points`, `kind` (`normal`, `power`, `double`) |
| `ch2cpacman_captures` | append-only: `teamId`, `pelletId`, `capturedAt`, `lat`, `lng`, `clientId` |
| `ch2cpacman_events` | append-only: `teamId`, `type` (`ghost_caught`, `ghost_eaten`), `at`, `points`, `clientId` |

Team photos are files, not JSON: `PUT https://cruttelut.kaasfrich.dk/files/ch2cpacman_photos/<gameId>/<teamId>/start-<ts>.jpg`,
shrunk to 1024 px JPEG in the browser first. The team record keeps the key in
`photoKey`; the public GET address is the image URL. Deleting a team or a game
deletes its photos. A test build uses the `ch2cpacman_test_photos` bucket.

Scores are never stored; both pages compute them from captures. Duplicate
captures of the same pellet by the same team are ignored, so retries are safe.

To wipe everything before the event:
`DELETE https://cruttelut.kaasfrich.dk/rest/ch2cpacman_captures` (and likewise
`_teams`, `_pellets`). Irreversible.

Note: cruttelut's `POST` answers `{"id": "..."}` only, not the stored record;
`src/lib/api.ts` rebuilds the record around that id.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:5173/ch2cpacman/
pnpm test         # vitest, pure logic in src/lib
pnpm lint         # tsc --noEmit
pnpm build        # dist/
```

Pushing to `main` runs `.github/workflows/pages.yml`: lint, test, build, deploy.

To test against throwaway collections instead of the live ones, build with
`VITE_COLLECTION_PREFIX=ch2cpacman_test_` and drop the `ch2cpacman_test_*`
collections afterwards.

The runner's map tiles are plain OpenStreetMap recoloured with CSS filters, one
preset per theme (`.theme-*` in `src/styles.css`); the hosted dark basemaps now
require API keys. The admin page is deliberately unthemed: the arcade look is
for players only.

## Manual checklist before the event (real phone, HTTPS)

- [ ] Code screen rejects a wrong code, accepts the right one, remembers the team
- [ ] Rules screen shows the configured minutes
- [ ] Photo screen opens the camera; the photo shows in admin within 10 s; skip works
- [ ] Map fits all pellets and the start
- [ ] TRYK START writes `startedAt` (visible in admin within 10 s)
- [ ] Walking into a pellet eats it: pop, chomp, score
- [ ] Airplane mode, eat a pellet, back online: capture arrives, admin score updates
- [ ] Reload mid-phase: eaten pellets stay eaten, countdown resumes
- [ ] A ghost approaches: siren, red pulse; a catch shows FANGET and lowers the score
- [ ] Power dot turns ghosts blue; catching one adds the bonus
- [ ] Dobbelt banner counts down and the next dot counts double
- [ ] Countdown reaches zero: GAME OVER, no more captures
- [ ] Admin Nulstil returns the phone to the rules screen on reload
