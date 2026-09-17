# PAC-SPEJD (ch2cpacman)

An arcade Pac-Man style GPS race for one scout event. Patrols arrive at a station
one at a time across the day. Each gets a phone with a dark map full of glowing
pellets, taps **TRYK START**, and has a fixed number of minutes to run around and
eat as many pellets as it can. Pellets far from the start are worth more. When the
time runs out the screen says GAME OVER and shows the score.

Nothing to install: it is a static web page, hosted on GitHub Pages at
<https://mikkelkaas.github.io/ch2cpacman/>. The only server is
[cruttelut](https://cruttelut.kaasfrich.dk), an unauthenticated JSON store.

- Runner: `https://mikkelkaas.github.io/ch2cpacman/`
- Admin: `https://mikkelkaas.github.io/ch2cpacman/#/admin`

Design: `docs/superpowers/specs/2026-09-17-ch2cpacman-design.md`.

## Running the event

1. Open the admin page on a laptop.
2. **Indstillinger**: set minutes per team (default 10). Click *Sæt startpunkt*,
   then click the map where the teams start.
3. **Prikker**: click the map to add a dot. Drag a dot to move it; drag the map to
   pan. The list is sorted by distance from the start, so give the far ones more
   points. Radius is how close the phone has to be, in metres; the default is
   5 m, use more under dense trees.
4. **Hold**: paste the team names, one per line, and *Tilføj*. The 4-character
   code next to each team is what the patrol types on the phone. Codes never
   contain 0, O, 1 or I.
5. Hand a patrol a phone with the runner page open. They type the code, read the
   rules, tap *Videre*, plan on the map, tap *TRYK START*. The countdown starts
   the moment they tap. The phone eats pellets automatically when inside a
   pellet's radius; nobody taps anything.
6. **Stilling** on the admin page refreshes every 10 seconds. Click a row to
   see which pellets a team ate.
7. If a team needs to run again, *Nulstil* clears its start time and deletes its
   captures. *Slet* removes the team entirely.

Phones need location permission and should keep the screen on. The page requests
a wake lock where the browser supports it. Captures made without signal are
queued on the phone and uploaded when it reconnects; the phone's own score counts
them immediately.

## Rules of scoring

- A team's window is `startedAt` to `startedAt + minutes`, plus 30 seconds grace
  for an upload that lands late. Captures outside it do not count.
- Each team can eat each pellet once. Pellets are not removed for other teams.
- Every team sees the same full map, whether it plays at 9:00 or 16:00.

## Storage

Four cruttelut collections. `GET https://cruttelut.kaasfrich.dk/rest/<name>`
returns the whole collection.

| Collection | Contents |
| --- | --- |
| `ch2cpacman_settings` | one document: `phaseMinutes`, `start` |
| `ch2cpacman_teams` | `name`, `code`, `color`, `createdAt`, `startedAt` |
| `ch2cpacman_pellets` | `name`, `lat`, `lng`, `radiusM`, `points` |
| `ch2cpacman_captures` | append-only: `teamId`, `pelletId`, `capturedAt`, `lat`, `lng`, `clientId` |

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

The runner's map tiles are plain OpenStreetMap inverted to a night look in CSS
(`.dark-tiles`); the hosted dark basemaps now require API keys. The admin page is
deliberately unthemed: the arcade look is for players only.

## Manual checklist before the event (real phone, HTTPS)

- [ ] Code screen rejects a wrong code, accepts the right one, remembers the team
- [ ] Rules screen shows the configured minutes
- [ ] Map fits all pellets and the start
- [ ] TRYK START writes `startedAt` (visible in admin within 10 s)
- [ ] Walking into a pellet eats it: pop, chomp, score
- [ ] Airplane mode, eat a pellet, back online: capture arrives, admin score updates
- [ ] Reload mid-phase: eaten pellets stay eaten, countdown resumes
- [ ] Countdown reaches zero: GAME OVER, no more captures
- [ ] Admin Nulstil returns the phone to the rules screen on reload
