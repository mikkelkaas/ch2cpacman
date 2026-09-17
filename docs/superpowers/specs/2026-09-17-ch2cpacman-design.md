# ch2cpacman — design

A browser game for one scout event. Patrols arrive at a station one after another
across a day, each gets a phone with a map full of pellets, taps Start, and has a
fixed number of minutes to run around and eat as many as it can. The pellets far
from the start are worth more. An admin page creates pellets and teams and shows
the scoreboard.

Nothing is installed: runners use a web page, and the only server is
[cruttelut](https://cruttelut.kaasfrich.dk), an unauthenticated JSON store.

## Decisions

| Question | Decision |
| --- | --- |
| Capture mechanic | GPS proximity, automatic: inside the pellet radius means eaten. |
| Scarcity | Every team can eat every pellet once. Nothing is removed for others. |
| Game window | Per team. The admin sets a phase length (about 10 min). A team's phase starts when it taps Start. Teams arrive over 7–8 hours. |
| Team join | 4-character team code shown in admin, typed once on the phone. |
| Admin access | None. `/admin` is open; the storage is public anyway. |
| Language | Danish only, both screens. |
| Hosting | GitHub Pages via an Actions workflow. Static bundle, no backend. |
| Storage | cruttelut collections prefixed `ch2cpacman_`. |
| Look | Arcade Pac-Man for the runner only: black screens, neon yellow and blue, pixel font, chiptune sounds. The admin page is plain and unthemed. |
| Briefing | Every team reads a how-to-play screen before it can tap Start. |

## Arcade theme

The whole app looks like a 1980 cabinet, not like a map app with a logo.

- Black background everywhere. Pac-Man yellow `#ffe600` for the player, score and
  primary button; maze blue `#2121ff` for frames and borders; ghost colours (red,
  pink, cyan, orange) for team swatches; pellet dots in pale peach `#ffb8ae`.
- Font: "Press Start 2P" from Google Fonts for headings, numbers and buttons; a
  plain sans for body text longer than a sentence, because the pixel font is
  hard to read in paragraphs.
- Map tiles: CARTO Dark Matter (no key, attribution required) so the map is
  dark and the pellets glow. Pellets are round peach dots with a soft glow, size
  by points, the point value beside them in the pixel font. Bigger values get a
  "power pellet" pulse. The start is a small maze-blue square. The runner is a
  Pac-Man sprite that faces the direction of travel, taken from the last two
  fixes.
- Arcade text moments: "READY!" flashes when Start is tapped, "GAME OVER" when
  the countdown ends, and the score counts up digit by digit with a blip.
- Sounds, small and generated with the Web Audio API so nothing is downloaded:
  a chomp per pellet, a start jingle, a game-over descend. A speaker toggle in
  the corner mutes them; muted state persists in localStorage.
- The admin page has none of this: light background, system font, an ordinary
  OpenStreetMap map, plain blue markers. Changed 2026-09-17 at the user's request.

## Stack

- Vite + React + TypeScript, Tailwind CSS, Leaflet with OpenStreetMap tiles.
- Vitest for pure logic. No end-to-end suite; the GPS flow has a manual checklist.
- Routing by hash (`#/` runner, `#/admin` admin) so GitHub Pages needs no rewrites.
- Built to `dist/`, published by `.github/workflows/pages.yml` on push to `main`.
  `vite.config.ts` sets `base` to the repository path.

## Data model

All records live in cruttelut. Reads return whole collections; there is no filter,
no uniqueness, no conflict detection. The model is shaped around that.

### `ch2cpacman_settings` — exactly one document

```json
{ "_id": "…", "phaseMinutes": 10, "start": { "lat": 55.68, "lng": 12.57 } }
```

Created by the admin page on first visit if the collection is empty. `start` is
null until the admin places it. Updated by full PUT.

### `ch2cpacman_teams`

```json
{ "_id": "…", "name": "Ugler", "code": "K7PQ", "color": "#f59e0b",
  "createdAt": "2026-09-20T09:00:00Z", "startedAt": null }
```

`code` is 4 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I),
generated in admin and checked against existing teams before saving.
`startedAt` is written once by the runner when the team taps Start. The admin's
reset sets it back to null.

### `ch2cpacman_pellets`

```json
{ "_id": "…", "name": "Egetræet", "lat": 55.681, "lng": 12.573,
  "radiusM": 25, "points": 3 }
```

Points are whole numbers ≥ 1. Radius default 5 m. Deleting a pellet does not
delete captures of it; scoring ignores captures whose pellet no longer exists.

### `ch2cpacman_captures` — append only

```json
{ "_id": "…", "teamId": "…", "pelletId": "…", "capturedAt": "2026-09-20T09:04:12Z",
  "lat": 55.6811, "lng": 12.5729, "clientId": "k3j…" }
```

Never updated. `clientId` is a random id generated on the phone when the capture
happens, so a retried POST that succeeded twice is one capture. Readers dedupe on
`(teamId, pelletId)` and keep the earliest.

## Scoring

Pure function `score(team, captures, pellets, settings)`:

1. Keep captures for this team whose pellet exists.
2. Dedupe on pelletId, earliest `capturedAt` wins.
3. Keep those with `startedAt ≤ capturedAt ≤ startedAt + phaseMinutes + 30 s grace`.
   A team with no `startedAt` scores 0.
4. Sum pellet points. Also return the count and the list, for the runner's list
   and the admin's detail.

The grace covers a capture made at 9:59 whose POST lands after the phone's
countdown reached zero. The phone itself stops capturing when its countdown ends.

## Runner screen (`#/`)

Danish throughout. Phone portrait first.

1. **Kode.** One input for the team code. On match the team id is saved in
   localStorage and the screen is skipped on later visits. A wrong code shows
   "Ukendt kode". A link "Skift hold" in the footer clears it.
2. **Kort.** Full-screen Leaflet map. Pellets are circle markers with the point
   value as label; a bigger dot for more points. Start location marked. The
   runner's position is a pulsing dot with an accuracy ring. Map opens fitted to
   all pellets plus the start.
3. **Sådan spiller I.** Shown full-screen after the code and before anything
   else, every time the phone opens the game for a team that has not started.
   Arcade title card with the team name, then the rules in short lines with a
   pictogram each:
   - "I har N minutter." (from settings)
   - "Kortet viser prikker. Løb hen til dem."
   - "Telefonen spiser prikken, når I er tæt nok på. I skal ikke trykke."
   - "Jo længere væk, jo flere point."
   - "Når tiden er gået, er spillet slut. Point tæller kun inden for tiden."
   - "Hold skærmen tændt og telefonen i hånden."
   A button "Videre" reveals the map with the pellets behind a translucent
   overlay, so the team can plan its route while the rules are still fresh, and
   the Start button below. The rules can be reopened from a "?" button later.
4. **Start.** A large yellow "TRYK START" button, with "Klar? Tiden starter,
   når I trykker". Tapping it PUTs the team with `startedAt = now`, flashes
   "READY!", plays the start jingle and begins the countdown. If the team
   already has `startedAt` (phone reload, second phone), the briefing is
   skipped and the countdown resumes from that value. If the phase has already
   ended the screen goes straight to the result.
5. **Løb.** Countdown at the top, score at the bottom. `watchPosition` with high
   accuracy. On each fix, every uneaten pellet within `radiusM` of the fix is
   eaten: it disappears from this phone's map with a short pop animation and a
   chomp sound, the score ticks up, and a capture is POSTed. No accuracy
   threshold, on purpose: woodland GPS is poor and the admin sets radii.
   The page requests a screen wake lock where supported.
6. **Slut.** When the countdown hits zero, capturing stops, the map dims,
   "GAME OVER" drops in, and a card shows points and pellets eaten. Nothing else is possible; the admin
   resets the team if it must run again.

Eaten pellets are known from the team's captures loaded at start plus the local
queue, so a reload mid-phase does not resurrect pellets.

### Offline queue

Captures are written to a localStorage queue first, then POSTed. A background loop
retries the queue every few seconds while anything is pending, and removes an
entry on 201. The score shown on the phone counts queued captures, so a dead
spot never costs points; they arrive when the phone has signal again. A small
"venter på netværk" hint shows when the queue is non-empty for more than 10 s.

## Admin screen (`#/admin`)

One page, map on the left and panels on the right, stacking on narrow screens.
Danish.

- **Indstillinger.** Phase length in minutes. "Sæt startpunkt" arms the map; the
  next click places the start marker. Saved on change.
- **Pellets.** A click on the map adds one with a default name, radius 5 m and
  1 point, and selects it. Dragging a pellet moves it and saves the new position
  on drop; dragging the map pans. The list shows name, points, radius and
  distance from the start in metres, sorted by distance, so the admin can grade
  points from near to far. Inline edit, delete with confirm.
- **Hold.** A textarea with one team name per line plus "Tilføj N hold"; blank
  and duplicate lines are dropped. Each row: colour swatch, name, code in a
  large monospace font, state: "Ikke startet", "I gang, slutter kl. HH:MM" or
  "Færdig". "Nulstil" clears `startedAt` and deletes the team's captures after a
  confirm. Delete team likewise.
- **Stilling.** Teams ranked by points, then by earliest last capture. Columns:
  place, team, points, pellets. Refreshed every 10 s by refetching captures and
  teams. Expanding a row lists what the team ate. Only "Sæt startpunkt" arms the
  map; everything else is direct.

The admin page loads all four collections once, then polls captures and teams.
Writes go straight to cruttelut and update local state on success.

## Error handling

- Any failed read shows a red bar with "Kunne ikke hente data" and a retry
  button; the last good data stays on screen.
- Failed admin writes show the same bar; the edit is not applied locally.
- Runner Start failing to save shows "Kunne ikke starte, prøv igen" and does not
  start the countdown, since the timestamp must exist for scoring.
- A runner opening the site before the admin has placed the start or any
  pellet sees "Spillet er ikke sat op endnu" instead of the code screen.
- Geolocation denied or unavailable shows a full-screen explanation of how to
  allow it, in Danish, and the Start button stays disabled until a fix arrives.

## Testing

Vitest, colocated `*.test.ts`:

- `score`: window, grace, dedupe earliest, deleted pellet, no start.
- `capturesWithin(fix, pellets, eatenIds)`: radius edge, several at once.
- `haversine`: known distances.
- `teamCode`: alphabet, length, uniqueness against a list.
- `queue`: enqueue, drain on success, keep on failure, idempotent clientId.
- `phase`: remaining seconds, ended, resume from an existing `startedAt`.

Manual checklist before the event, on a real phone over HTTPS: join, map fits,
Start writes `startedAt`, walking into a pellet eats it, airplane mode then back
delivers the queued capture, reload mid-phase resumes, countdown end locks the
screen, admin sees the score.

## Ghosts, power pellets and Dobbelt (added 2026-09-17)

**Ghosts** are simulated on the phone (`lib/ghosts.ts`), `ghostCount` of them
(default 2). They spawn when the phase starts at pellets at least 100 m from the
runner, wait `ghostHeadStartS` (60), then move straight toward the last GPS fix
at `ghostSpeedMps` (1.5), ignoring terrain. Within 10 m of the runner the team
is caught: `−ghostPenalty` (2), a hurt sound, the ghost respawns far away and
the team is immune for 20 s (dashed ring). Within 40 m a siren plays and the
screen edge pulses red. Catches are posted as `ch2cpacman_events` records with
their signed points, so the admin subtracts exactly what the phone showed.

**Power pellets** (`kind: 'power'`) turn all ghosts blue for `powerSeconds`
(20). Blue ghosts flee at 1 m/s; coming within 10 m eats one for `+ghostBonus`
(3) and respawns it. Ghosts flash white for the last 5 s.

**Dobbelt** (`kind: 'double'`) doubles pellets eaten in the following
`doubleSeconds` (60), never itself or ghost bonuses. The window is derived from
capture timestamps in `scoreTeam`, which both the phone and the admin use.

Score = Σ pellet × multiplier + Σ events, floored at 0. Admin: the settings
above, a type per pellet and a type for new dots, and catches / ghosts eaten in
the standings. The briefing adds a line per feature that is in play.

## Several games (added 2026-09-17)

The one-game assumption was dropped. `ch2cpacman_games` holds `{ name,
createdAt }`; settings, teams, pellets, captures and events carry `gameId`.
`#/admin` lists games with create and delete (delete removes every record of
the game); `#/admin/<gameId>` is the per-game admin. Team codes are unique
across all games, so the runner still only types a code: the team's `gameId`
selects its settings and pellets. Records without `gameId` from before this
change are adopted into the oldest game, created as "Spil 1" when none exists,
the first time the games page loads.

Settings also gained `mapTheme`: `nat` (default, inverted and brightened),
`neon`, `lys` (plain), `amber`, `groen`. The runner map applies the matching
CSS filter preset to the tiles only.

## Out of scope

Routes, home base, voice, photos, questions, authentication,
pellet scarcity between teams, bonus fruit, human ghosts, anti-spoofing.
