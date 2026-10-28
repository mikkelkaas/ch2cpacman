# Group start and shared dots — design (2026-10-28)

Today every team plays alone: it taps TRYK START when it is ready, gets its own
minutes, and sees every dot no matter who played before it. This adds two ways
to run a game with many teams out at once, about ten:

- **Samlet start.** Every team in the game sets off on one signal from a
  leader and shares one clock. Dots work as today: each team can eat every
  dot.
- **Fælles prikker.** The same, and a dot one team eats is gone for everyone
  else. It is a race: teams should want to get to a dot before the others do.

The ROADMAP's "Two teams at once, shared dots" is this, for ten teams.

## Intent

A mass start on a signal, with the excitement of seeing other teams in the
field, and with shared dots, a reason to race for each one. Solo games stay
exactly as they are; the mode is chosen per game.

## Goals

- A leader starts every team of a game at once, from the admin page or from
  Postmandskab.
- Every phone counts down the same clock. Everyone ends at the same moment
  and has to be back home, with the late-home rule as now.
- In *Fælles prikker*, a dot eaten by one team disappears from every other
  phone within a few seconds. When two teams reach a dot, the first one gets
  it.
- The phone, the spectators, the admin scoreboard and Postmandskab agree on
  who owns each dot and on every score.

## Non-goals

- Shared ghosts. Each team keeps its own ghosts, simulated on its own phone,
  as now (decided).
- Power and Dobbelt crossing teams. A Power dot only frightens the ghosts of
  the team that ate it; a Dobbelt only doubles that team's dots (decided).
  The only effect on other teams is that the dot is gone.
- A server that arbitrates. cruttelut only stores data; "first" is decided
  from timestamps on the phones (see below).
- Showing other teams' runners on a runner's map.
- A "ready" count of phones on the waiting screen before the signal
  (decided: the leader looks and asks).
- Shared dots with staggered starts (teams playing one after another, dots
  eaten earlier already gone). *Fælles prikker* always comes with *Samlet
  start*.

## Anti-goals

- Changing how a solo game plays, scores or looks.
- A phone that stops working without signal. Captures are still queued
  offline and the phone's own score counts them at once.
- Standings that disagree between screens once all uploads are in.

## Decisions

| Question | Decision |
| --- | --- |
| How the mode is chosen | A per-game setting, *Spilform*, with three choices: *Hver for sig* (today, the default), *Samlet start*, *Samlet start, fælles prikker*. Older settings documents without it are *Hver for sig*. (My call to make this one setting with three values rather than two checkboxes.) |
| Who gives the signal | A leader, with a *Start alle* button on the admin page and on Postmandskab, after a confirm. (My call on placement.) |
| Phones before the signal | Code, rules, photo and planning on the map as now. Instead of TRYK START, the bottom panel says to wait for the start signal. No team can start on its own. |
| A phone that joins or reloads after the signal | It goes straight into the running game with the time that is left, not a fresh countdown (decided). Rules and photo are skipped, as they are today for a team that has already started. |
| A phone still on the rules or the photo screen when the signal comes | Nothing happens to it (decided). The team finishes reading or takes its photo at its own pace while the shared clock runs, and is in the running game when it reaches the map. The photo write can then land during the run, so it must be built on the team record as the store has it now, not a stale copy. |
| Knowing which teams are ready before the signal | Not shown (decided). The leader looks around and asks at the start line. |
| Whose clock the signal uses | The device that presses *Start alle* stamps `groupStartedAt` from its own clock, and that is the reference (my call). A phone whose clock is behind sees a signal in the future: it stays on the waiting panel and counts down to it (3, 2, 1) instead of starting early, so its captures are never before the start. |
| Changing *Spilform* in a game already played solo | Blocked while any team in the game has a start or captures; the leader uses *Nulstil alle* first (my call). Otherwise switching would silently drop the results already earned to 0. |
| Ghosts | Per team, as now. The head start counts from the signal. |
| Two teams at one dot | First come, first served: the earliest `capturedAt` wins (decided). |
| A phone that loses its dot | It takes the dot back off its own score, shows it as taken, and tells the team another team was first. |

## Where the signal lives

The signal is a timestamp on the game's settings document, `groupStartedAt`
(ISO, `null` or missing before the start). It is not written into each team's
`startedAt`.

Why: team records are replaced in full on every PUT, and the phones write them
(photo, home stamp). Writing a start into ten team records from the admin
page would race those writes, and a lost race would silently drop a team's
start or its photo. One write to one document cannot half-happen.

So in the two group modes, a team's effective start is the game's
`groupStartedAt`, and a team's own `startedAt` is ignored. Everything that
reads `team.startedAt` today (phase state, scoring, `ofCurrentRun`, the late
penalty, the leader status, the ghosts' head start, heartbeat restore, the
spectator) must go through one helper that returns the effective start for a
team in its game. The builder chooses the shape: for example, a function that
returns a copy of the team with `startedAt` filled from the settings, applied
where teams are loaded, so the downstream code does not change.

The phone waiting for the signal polls its game's settings every 2 s. At ten
phones that is five small filtered reads a second, which is the same load as
the heartbeats. The clock runs from `groupStartedAt`, not from when the phone
noticed, so a phone that sees the signal two seconds late has two seconds less
on its clock, like every other team. When it notices, it plays the start
jingle and the READY flash as TRYK START does now.

## Who owns a dot (Fælles prikker)

For each dot, its owner is the team with the earliest capture of it, among
captures that count for their own team (inside that team's window, from the
signal to its end or home stamp, plus grace, as `scoreTeam` already decides).
A capture that does not count for its own team does not block anyone. If two
captures have exactly the same timestamp, the tie goes to the lower `clientId`,
so every screen picks the same winner.

This is a pure function in `src/lib`, used by `scoreTeam` in shared mode: a
team's counted captures are the ones it owns. Everything else in scoring stays
the same: the Dobbelt window, ghost events, the late penalty, the floor at 0.
Ranking, ties and the GAME OVER total follow.

Because "first" is decided from phone timestamps, a phone that was offline can
upload a capture later that is earlier than another team's, and take the dot
from them after the fact. That is accepted: the standings settle once every
phone has uploaded. GAME OVER today only waits for this phone's own uploads,
so in shared mode a phone showing GAME OVER keeps polling the game's
captures, and its score may still change, until the late window plus grace
has passed for the game. The screen adds a line that the final standings are
on the scoreboard (my call). After *Forlad spillet* the phone shows nothing,
so nothing there needs correcting. Phone clocks are trusted, as they already
are for the countdown.

## The runner phone in Fælles prikker

While running or late, the phone polls the game's captures every 3 s
(filtered by `gameId`, and by `capturedAt` from the signal if cruttelut's
filter allows it, so it stays small). With that it knows the owner of every
dot.

- A dot another team owns is drawn as gone. When a dot goes, it flashes briefly
  in the owning team's colour (`team.color`) before disappearing, so the
  runners notice. No banner for other teams' dots: with ten teams that would
  be constant noise.
- The phone's own capture counts at once, as now, before any poll. If a poll
  shows another team owns a dot this phone ate, the phone drops it from its
  own score and shows a short banner naming the team that was first, e.g.
  "HOLD B VAR FØRST". The flash and the banner are the visible part of the
  rule; how they look is the builder's call within the arcade style.
- The capture engine does not eat a dot that is already owned by someone else.
- Power already eaten stays in effect when the dot is later lost: the ghosts
  already ran blue, and any ghost the team ate in that time stays as an event.
  A Dobbelt that is lost stops doubling, because the doubling is computed from
  the dots the team owns, the same way on the admin page. (My call: undoing
  Power after the fact cannot be shown sensibly; Dobbelt falls out of the
  scoring rule for free.)
- The HUD score is the owned-dots score, so it matches the scoreboard.

Spectators read the game's captures the same way, so they see the same dots
and the same banner. In *Samlet start* without shared dots, nothing changes
here: a phone reads only its own team's captures, as now.

## Admin page

- **Indstillinger**: the *Spilform* choice. It cannot be changed while a group
  game is running or over (`groupStartedAt` set), nor while any team has a
  solo start or captures; *Nulstil alle* unlocks it. *Nulstil alle* is
  therefore also offered in a solo game that has been played, and there it
  also clears every team's `startedAt`.
- **Start alle**: in the group modes, a button near the top, enabled once the
  start point and the dots are set and no signal has been given. Confirm,
  then write `groupStartedAt` on the settings, built on the settings as the
  store has them now, like `freshTeam` does for teams. After the start, it
  shows the shared clock instead.
- **Nulstil alle** replaces the per-team *Nulstil* in the group modes: it
  clears `groupStartedAt`, every team's `returnedAt`, and the game's captures,
  events and heartbeats, after a confirm. The per-team *Nulstil* is hidden in
  group modes, because one team cannot rerun a shared clock. *Hjemme* and
  *Slet* stay per team.
- **Stilling**: unchanged in shape. In shared mode a team's pellet list shows
  only the dots it owns.
- A team added after the signal joins the running game with the time left.

## Postmandskab

- *Start alle*, with the same confirm and the same rule for when it is
  enabled, so the leader standing at the start line can give the signal from a
  phone.
- After the start every team is *I gang* until it is home or the late window
  has passed, phone or no phone. A team whose phone never joined shows 0
  points and ends like any team that never came home.
- In shared mode, *Vis prikker* on the map shows only the dots still free.

## Solo games

*Hver for sig* is exactly today's game: TRYK START per team, per-team Nulstil,
each team can eat every dot. None of the new polling runs.

## Text

New player strings go in all three of `src/i18n/player/` (the build enforces
it): the waiting-for-signal line in place of TRYK START, the "another team was
first" banner, and a line in the rules for each group mode (start on the
signal; in shared mode, a dot another team takes is gone). Admin strings in
`src/i18n/da.ts`. The in-app guide (`HelpDialog.tsx`), the README (including
"Pellets are not removed for other teams" under Rules of scoring, and the
settings and storage tables) and the ROADMAP entry get updated.

## Testing

Pure logic in `src/lib` gets unit tests, as the rest does: the effective start
of a team per mode, phase state with a group start (before the signal, a late
joiner, the end), dot ownership (earliest wins, ties by `clientId`, a capture
outside its own team's window does not block, a home stamp ends a team's
claim on later dots), and `scoreTeam` in shared mode including a lost
Dobbelt. The manual checklist in the README gets a group start and a
shared-dots run with two phones, including one in airplane mode.

## Left to the builder

- How the effective start is threaded through the code.
- Exact poll intervals within the numbers above, and how the shared-captures
  poll is filtered.
- The look of the waiting panel, the flash and the banner, in the existing
  arcade style.
- Where exactly *Start alle* and *Nulstil alle* sit on each page.
