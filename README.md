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
- Postmandskab (the leaders at the post), one game: `https://mikkelkaas.github.io/ch2cpacman/#/admin/<gameId>/postmandskab`

Design: `docs/superpowers/specs/2026-09-17-ch2cpacman-design.md`. Ideas not yet
built: `ROADMAP.md`.

## Running the event

1. Open the admin page on a laptop. It lists the games; create one and open it.
   Each game has its own settings, dots, teams and standings. Team codes are
   unique across all games, so a runner only ever types the code.
2. **Indstillinger**: set minutes per team (default 10). Click *Sæt startpunkt*,
   then click the map where the teams start. Pick a *Korttema* for the runner's
   map: Nat (dark inverted), Neon, Lys (plain), Amber or Grøn. Untick
   *Holdfoto før start* to skip the team photo step.
   The layers button top right of the admin map switches to *Luftfoto (DK)*,
   this year's Danish orthophoto from Dataforsyningen, or *Satellit (verden)*
   from Esri outside Denmark (remembered in that browser); the runner's map is
   unaffected.
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
   rules, tap *Videre*, take a team photo (or skip it, if enabled), plan on the map, tap
   *TRYK START*. The countdown starts
   the moment they tap. The phone eats pellets automatically when inside a
   pellet's radius; nobody taps anything.

The player screens come in Danish, English and Norwegian (Bokmål). The
**DA · EN · NO** switch sits on the code screen, the rules and the spectator's
waiting screen. A phone starts in its own language (anything other than Danish
or Norwegian gets English) and remembers a choice made on the switch. The admin
page is Danish only. The text lives in `src/i18n/player/`; the Danish file sets
the shape, so the build fails if a translation misses a string.

More people than the one holding the phone can follow along. The runner's
phone has "Tilføj tilskuer" on its start screen and in the rules: it shows a
QR for `#/watch/CODE`. A phone that scans it sees the same map, runner dot,
ghosts, countdown and score, a couple of seconds behind, and does no tracking
of its own. The admin's QR dialog can show the same code. Any number of
spectators can watch one team.

6. When the countdown ends the team must be back at the start point. If it is,
   the phone shows GAME OVER. If not, it switches to **LØB HJEM!** with a red
   line to the start and loses points for every step of seconds late until it
   is inside the home radius or the penalty cap is reached. The phone stamps the
   return itself from GPS; if you see the patrol arrive first, click *Hjemme*
   on the team. There is no bonus for being early. *Forlad spillet* under the
   score makes the phone forget the team (after a confirm, and only once all
   points have uploaded), so the same phone can be handed to the next team or
   used in another game. Before the start, *Skift hold* does the same.
7. **Stilling** on the admin page refreshes every 10 seconds. Click a row to
   see which pellets a team ate.
8. If a team needs to run again, *Nulstil* clears its start time, its return
   and deletes its captures. *Slet* removes the team entirely.
9. **Postmandskab** in the admin header opens the page for the leaders who
   welcome the teams, made for a phone; several leaders can have it open at
   once. It has a card per team, filtered by *Ikke spillet*, *I gang*,
   *Færdig* or *Alle*, with *Vis QR* (the same full-screen QR as the admin
   page) and the score. The page refreshes every 5 seconds. *Kort* switches to a map of every team in
   *I gang*: where its runner phone last reported (no ghosts or spectators),
   with the time left or *PÅ VEJ HJEM*, faded when the phone has gone quiet,
   and a *Vis prikker* toggle for the dots.

A pellet counts when a fix lands inside its radius, or when the straight line
between two consecutive good fixes passes within it, so a team running through
a pellet between fixes still eats it. The line is only drawn for fixes at most
10 s apart and no faster than 7 m/s between them, so a GPS jump eats nothing.

Fixes worse than 30 m are shown but not trusted: no pellet is eaten and no
ghost catches on them, and the HUD says "SVAGT GPS-SIGNAL".

Phones need location permission and should keep the screen on. The page requests
a wake lock where the browser supports it. Captures made without signal are
queued on the phone and uploaded when it reconnects; the phone's own score counts
them immediately.

## Spilform: samlet start og fælles prikker

Each game has a *Spilform* in *Indstillinger*:

- **Hver for sig** (the default, and how older games behave): everything above.
  Each team taps *TRYK START* when it is ready and has its own clock.
- **Samlet start**: no team can start on its own. A leader gives one signal and
  every team in the game shares one clock and one end. Dots work as before,
  each team can eat every dot.
- **Samlet start, fælles prikker**: the same, and a dot eaten by one team is gone
  for the others. It is a race for each dot.

The signal is *Start alle*, on the admin page (a panel above the teams) and on
Postmandskab. It asks for a confirm, and is enabled once the start point and at
least one dot are set. The pressing device stamps `groupStartedAt` on the game's
settings from its own clock; after that the panel shows the shared clock. Teams
are not written to, so a phone's photo or home stamp cannot race the start.
A team's start is then always the game's `groupStartedAt`; its own `startedAt` is
ignored.

Before the signal a phone goes through code, rules, photo and map as usual, but
where *TRYK START* would be it says to wait for the leader, and polls the settings
every 2 s. If its clock is behind the leader's it counts down to the signal
instead of starting early. A phone that joins or reloads after the signal goes
straight into the running game with the time that is left; a team still on the
rules or photo when the signal comes is simply in the game when it reaches the
map. Ghosts are still per phone, with the head start counted from the signal.

*Nulstil alle* replaces the per-team *Nulstil* in the two group modes (that
button is hidden): after a confirm it clears the signal, every team's return, and
the game's captures, events and heartbeats. *Hjemme* and *Slet* stay per team.
The *Spilform* select is locked while a signal has been given or any team has a
start or captures; *Nulstil alle* unlocks it, and is also offered in a solo game
that has been played, where it also clears every team's `startedAt`.

In shared mode the first team to a dot gets it, decided by the earliest
`capturedAt` among captures that count for their own team (a tie goes to the
lower `clientId`). While running, a phone reads the game's captures every 3 s;
a dot another team owns flashes in that team's colour and disappears. The
phone's own capture counts at once, so if another team turns out to have been
first, the dot comes off the score and a banner names the team. A phone that
was offline can therefore take a dot after the fact when its capture is
earlier, and a phone showing GAME OVER keeps polling until the late window has
passed, so its score can still change; the screen points to the scoreboard for
the final standings. Power and Dobbelt stay with the team that ate the dot,
but a Dobbelt that is lost stops doubling.

## Ghosts, power pellets and Dobbelt

- **Spøgelser.** Ghosts live on the phone only. They wait out a head start, then
  walk straight toward the runner's last GPS fix, ignoring terrain. They are
  hungry: a ghost speeds up from its base speed to its top speed over a ramp
  time counted from release or from its last respawn, so the longer it chases
  without a catch the faster it gets, and a ghost at top speed glows red and
  its siren doubles in pace. A catch sends it far away and back to base speed.
  Within 10 m
  the team is caught, loses points and is immune for 20 seconds while the ghost
  jumps at least 100 m away. A ghost within 40 m sets off a siren and a red
  pulse. Every catch is posted as an event the scoreboard subtracts.
- **Power.** A dot of type *Power* turns every ghost blue for a while; blue
  ghosts flee, and catching one earns bonus points. They flash white for the
  last 5 seconds.
- **Dobbelt.** A dot of type *Dobbelt* doubles every pellet eaten in the next
  minute, not itself and not ghost bonuses. The window is computed from capture
  timestamps on both the phone and the admin page.

All numbers are in *Indstillinger*: number of ghosts (0 turns them off), speed
and top speed in km/h (stored as m/s), seconds to top speed, head start, points
lost per catch, points per eaten ghost, power and Dobbelt durations. Defaults:
2 ghosts, 3 km/h rising to 8 km/h over 60 s, 60 s head start, 2 points
lost, 3 points per ghost, 20 s power, 60 s Dobbelt. The speeds are from the
first event (30 teams, 7 minutes, 3 ghosts): a ghost at top speed is just
slower than a jogging scout, so a team that keeps moving can stay ahead, and
teams were caught about 2–3 times each. Set the top speed equal to the speed for constant
ghosts. Set the type for new dots next to the point
value before clicking the map.

## Coming home

- The team has to be at the start point when the countdown ends. Being there
  early earns nothing; the run only ends at zero.
- Not home at zero: the phone shows **LØB HJEM!**, a count-up clock, the
  distance to the start and a red dashed line to it. Every whole step of
  *Straf hver* seconds late (default 10) costs *Point tabt pr. straf*
  (default 1), never more than *Højst tabt for sent* (default 10). When the cap is reached the phone stops
  waiting and shows GAME OVER, so a dead phone or a lost signal costs at most
  the cap.
- Home is a usable GPS fix within *Hjemmeradius* (default 15 m) of the start.
  The phone writes `returnedAt` on the team; the leader can write it with
  *Hjemme* under Hold when the phone is slow or dead. When both stamp, the
  earlier one stands; the phone also picks up the leader's stamp while it is
  out. The penalty is computed from that timestamp on both the phone and the
  admin page.
- Setting the points per step to 0 turns the rule off: GAME OVER at zero as
  before.

## Rules of scoring

- A team's window is `startedAt` to `startedAt + minutes`, plus 30 seconds grace
  for an upload that lands late. Captures outside it do not count.
- Late home: `floor((returnedAt − end) / step) × penalty`, capped. A team not
  yet home is charged as of now, and as the cap once the late window has
  passed. Subtracted after ghost events, and the total never goes below 0.
- Each team can eat each pellet once. In *Hver for sig* and *Samlet start*
  pellets are not removed for other teams. In *Samlet start, fælles prikker* a
  pellet belongs to the team with the earliest counted capture and is gone for
  the others.
- Points = pellets × Dobbelt multiplier + ghost bonuses − catches, never below 0.
- Every team sees the same full map, whether it plays at 9:00 or 16:00.

## Storage

Seven cruttelut collections. `GET https://cruttelut.kaasfrich.dk/rest/<name>`
returns the whole collection; `?filter=<url-encoded Mongo query>` returns only
the matching records. Captures and events grow all day, so the phone reads
them by `teamId` and the admin poll by `gameId`. The small collections are
still read whole and filtered in memory.

Every record except games carries a `gameId`. Records from before games existed
have none; the games page adopts them into the oldest game (creating "Spil 1"
if needed) the first time it loads.

| Collection | Contents |
| --- | --- |
| `ch2cpacman_games` | `name`, `createdAt` |
| `ch2cpacman_settings` | one per game: `phaseMinutes`, `start`, `mapTheme`, `playMode` (`solo`, `together`, `shared`; missing means `solo`), `groupStartedAt` (ISO or null), ghost settings |
| `ch2cpacman_teams` | `name`, `code`, `color`, `createdAt`, `startedAt` |
| `ch2cpacman_pellets` | `name`, `lat`, `lng`, `radiusM`, `points`, `kind` (`normal`, `power`, `double`) |
| `ch2cpacman_captures` | append-only: `teamId`, `pelletId`, `capturedAt`, `lat`, `lng`, `clientId` |
| `ch2cpacman_events` | append-only: `teamId`, `type` (`ghost_caught`, `ghost_eaten`), `at`, `points`, `clientId` |
| `ch2cpacman_heartbeats` | one per team, overwritten every 2 s while it runs: `teamId`, `fix` (`lat`, `lng`, `accuracyM`, `at` or null), `ghosts` (the runner phone's ghost state or null), `at` |

Heartbeats are not part of the score. The runner's phone writes them so a
spectator can draw the runner and the ghosts; a spectator only reads. A beat
older than 8 s is shown as stale on the spectator's screen. Resetting or
deleting a team removes its heartbeat.

Team photos are files, not JSON: `PUT https://cruttelut.kaasfrich.dk/files/ch2cpacman_photos/<gameId>/<teamId>/start-<ts>.jpg`,
shrunk to 1024 px JPEG in the browser first. The team record keeps the key in
`photoKey`; the public GET address is the image URL. Deleting a team or a game
deletes its photos. A test build uses the `ch2cpacman_test_photos` bucket.

Scores are never stored; both pages compute them from captures and events.
Duplicate captures of the same pellet by the same team, and events stored twice
under one `clientId`, are ignored, so retries are safe. The phone and the
spectators only count captures and events stamped after the team's current
`startedAt`, so anything from before a *Nulstil* that lands late is ignored.

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

Under `pnpm dev` the runner's map can draw no pellets: React StrictMode mounts
the map twice and the pellet markers from the first mount stay in `RunnerMap`'s
layer cache, attached to the removed map. Production builds are fine.

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
- [ ] Spectator: on the runner phone, tap "Tilføj tilskuer" and scan the QR with a
  second phone. After Start, the second phone shows the runner dot and the
  ghosts within a few seconds, and its score follows the runner's.
- [ ] Spectator, phone gone quiet: lock the runner phone for 15 s. The spectator's
  runner and ghosts fade and "SIDST SET FOR … S SIDEN" counts up. Unlock: it
  snaps back.
- [ ] Spectator, weak signal: cover the runner phone's GPS for 15 s. The
  spectator shows SVAGT GPS-SIGNAL, not SIDST SET.
- [ ] Group start: set a game to *Samlet start*, open the runner on two phones with two
  teams. Both wait on "Kig på kortet og læg en plan. Tiden starter, når lederen giver
  signal." Press *Start alle* (try it on
  Postmandskab too): both start within a few seconds on the same clock.
- [ ] Late joiner: a third phone enters its code after the signal and goes straight to
  the running game with the time left.
- [ ] Shared dot: set *Samlet start, fælles prikker*. When one phone eats a dot it
  flashes and disappears on the other within a few seconds. Put one phone in
  airplane mode, let both eat the same dot, the airplane-mode one first. Back
  online: the dot moves to it, the other phone shows a banner and its score drops.
- [ ] *Nulstil alle* during the run returns both phones to the waiting panel within
  about 5 s, all dots back and no rules screen, and unlocks *Spilform*. A second
  *Start alle* then starts both on the new clock.
- [ ] *Spilform* changed while phones wait: from *Samlet start* to *Hver for sig* the
  waiting phones show TRYK START within a few seconds; the other way, a phone on
  TRYK START that is tapped waits for the signal instead of starting.
