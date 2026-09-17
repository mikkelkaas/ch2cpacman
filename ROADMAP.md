# Roadmap

Ideas for PAC-SPEJD beyond what is built. Nothing here is committed to; the
list is a menu. Effort is a rough size for one person who knows the code:
**S** under half a day, **M** a day or two, **L** more.

Built so far, for reference: per-team timed runs, GPS pellets with points and
radius, power pellets, Dobbelt, virtual ghosts, several games, five map
themes, an admin with standings, an in-app guide, a GPS accuracy guard, QR
join codes on a phone, a printable team sheet and a team photo before the start
(stored in cruttelut's file bucket). See `README.md`.

## Recommended next

Small, each improves the day, none changes the rules already explained to
leaders.

| Idea | Effort | Why first |
| --- | --- | --- |
| Ghost personalities | S | Blinky chases directly, Pinky aims ahead of the runner's heading, Inky wanders between dots, Clyde retreats when close. Cheap on top of the existing simulation, and the ghosts stop feeling like one homing missile. |
| Big scoreboard view | S–M | `#/board/<gameId>` in the arcade style for a laptop or TV at the station: HIGH SCORES, the running team's live countdown and score, "READY PLAYER ONE" when a team is about to start. |
| Practice mode | S | A "prøvetur" code that lets a team walk to one dot with nothing counted, so phone and permissions are proven before the real run. |

## Before the event, on the day

- **Rename game** (S). Games can be created and deleted but not renamed.
- **Duplicate game** (S). Copy dots and settings into a new game for a second
  round or another site.

## More Pac-Man

- **Fruit** (M). A bonus dot that appears for 60 s at a random moment during
  each team's run, worth extra. Schedule derived from the team's start time so
  the scoreboard can verify the capture window.
- **Warp tunnel** (S). Two paired dots; eating one sends the ghosts far from
  the other, opening a safe corridor.
- **Lives instead of points** (S). Three lives, a catch costs one, three
  catches end the run early with points kept. A different kind of tension.
- **Speech in Danish** (S). Browser speech synthesis says a short line on
  start, catch and game over. No audio files needed.

## Fairness and running it smoothly

- **Time bonus for returning** (S). Reaching the start point before time runs
  out converts the remaining seconds to points. Brings teams back on their own.
- **Pause a team** (M). Admin pauses and resumes one team's clock when a phone
  dies or a child falls. The phase window becomes a set of intervals in
  `scoreTeam`.
- **Admin live view** (M). The running team's position on the admin map every
  few seconds. Costs the phone extra uploads.
- **Admin protection** (S). A shared PIN or an unguessable path. The store is
  public regardless, so this only stops a curious scout.

## After the run

- **Replay** (M). The team's path with eaten dots and catches on the GAME OVER
  screen and in admin. Capture positions exist; a trail needs a few uploads per
  minute.
- **Hall of fame** (S). Best scores across games, since several games exist.
- **Game-over photo** (S). The start photo exists; a second one at GAME OVER
  with the score burned in would make a nice souvenir.

## Beyond one station

- **Two teams at once, shared dots** (M). A dot eaten by one patrol vanishes
  for the other. Polling the other team's captures every few seconds is within
  what cruttelut can take for two phones.
- **Human ghost** (M). A leader's phone posts its position; runners see it and
  are caught within 10 m. Real terrain, real chase, needs a leader and signal.

## Known limits worth remembering

- Ghosts ignore terrain and chase the last GPS fix; a jumping position under
  trees can produce an unfair catch. The head start, immunity and the penalty
  setting exist to keep that a nuisance rather than a disaster.
- cruttelut is unauthenticated and returns whole collections. Fine for one
  event and a handful of phones; not for a public deployment.
- Capture radius default is 5 m, tighter than typical phone GPS. Widen
  individual dots if captures feel late.
