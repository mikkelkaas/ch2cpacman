# Group start and shared dots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-game *Spilform* with two new modes: *Samlet start* (every team starts on one leader signal and shares a clock) and *Samlet start, fælles prikker* (also, a dot eaten by one team is gone for the rest; the first capture wins).

**Architecture:** The signal is one timestamp, `groupStartedAt`, on the game's settings document. A pure helper, `withGroupStart`, gives each team its effective start from it. It is applied wherever teams are read, so phase, scoring, ghosts and heartbeats keep reading `team.startedAt` unchanged. Writes always go to the raw team record as the store has it. Dot ownership is a pure function over the whole game's teams and captures. `scoreTeam` takes the result and counts only the dots a team owns. Phones and spectators poll the game's teams and captures to learn the owners.

**Tech Stack:** React 18 + TypeScript, Vite, Leaflet, vitest; cruttelut REST store (`src/lib/api.ts`).

**Spec:** `docs/superpowers/specs/2026-10-28-group-start-design.md`

## Global Constraints

- *Hver for sig* (`playMode: 'solo'`, also when the field is missing) plays, scores and looks exactly as today. None of the new polling runs in a solo game.
- Each team keeps its own ghosts. Power and Dobbelt only affect the team that ate the dot.
- The first capture wins: the earliest `capturedAt`. On equal times, the lower `clientId` wins.
- A capture that doesn't count for its own team (outside its window: before the signal, or after its end or home stamp plus `GRACE_MS`) blocks nobody.
- The phone's own capture counts at once, before any poll, as now. Captures still queue offline.
- Team records are replaced in full on PUT. Every team write is built on the record re-read from the store, never on an effective (`withGroupStart`) copy.
- Player strings go in all three of `src/i18n/player/da.ts`, `en.ts`, `nb.ts` (the build fails otherwise). Admin strings go in `src/i18n/da.ts`.
- Poll intervals: a phone waiting for the signal polls settings every 2 s. Shared-dot polls (runner and spectator) run every 3 s.
- `pnpm lint` and `pnpm test` pass after every task.

## Review Focus

1. **Clock skew.** The leader's device is ahead, so a phone sees `groupStartedAt` in the future. It must stay idle and count down to the signal, not start early or lose its first captures. (Task 1 test: `phaseState` is idle before a future start.)
2. **A phone joining after the signal**, or reloading mid-run. It must land in the running game with the time left, its eaten dots, and its ghosts restored. (Task 1 test: `withGroupStart` gives a team created after the signal the group start.)
3. **Writing a team record in a group game** (photo, home stamp, *Hjemme*). This must never copy the effective `startedAt` into the record, and the home stamp's same-run check must compare effective starts. (Task 5 step: PhotoScreen re-reads the record; the useReturnHome comparison is changed. Verified by the two-phone manual run in Task 8.)
4. **A team that went home early, or captures left over from before a *Nulstil alle***. These must not block another team's later capture. (Task 2 tests: `dotOwners` ignores out-of-window captures.)
5. **Shared mode with no signal yet**, or a game with no captures. There must be no owners, no crash, and scores of 0. (Task 2 test: `dotOwners` is empty without `groupStartedAt`.)

---

### Task 1: Play mode settings and the effective start

**Files:**
- Modify: `src/lib/types.ts` (Settings)
- Modify: `src/lib/settings.ts` (SETTINGS_DEFAULTS)
- Modify: `src/lib/phase.ts` (`phaseState`)
- Create: `src/lib/group.ts`
- Test: `src/lib/group.test.ts`, `src/lib/phase.test.ts`

**Interfaces:**
- Produces:
  - `export const PLAY_MODES = ['solo', 'together', 'shared'] as const; export type PlayMode = (typeof PLAY_MODES)[number];` in `types.ts`.
  - `Settings.playMode?: PlayMode` and `Settings.groupStartedAt?: string | null`. The defaults are `'solo'` and `null`.
  - In `group.ts`:
    - `isGroupMode(s: Pick<Settings, 'playMode'>): boolean`: true for `together` and `shared`.
    - `isSharedDots(s: Pick<Settings, 'playMode'>): boolean`.
    - `withGroupStart<T extends Pick<Team, 'startedAt'>>(team: T, s: Pick<Settings, 'playMode' | 'groupStartedAt'>): T`. In a group mode it returns a copy with `startedAt: s.groupStartedAt ?? null`. In solo it returns the same object.
    - `signalPendingMs(s: Pick<Settings, 'playMode' | 'groupStartedAt'>, nowMs: number): number`: ms until a future signal, otherwise 0.
    - `groupEndMs(s: GameSettings): number | null`: `phaseEndMs(groupStartedAt) + lateWindowMs(rule) + GRACE_MS`, or null with no signal. After this, no score in the game can change.
    - `canChangePlayMode(s: Pick<Settings, 'groupStartedAt'>, rawTeams: readonly Team[], captureCount: number): boolean`: false once `groupStartedAt` is set, any raw team has `startedAt`, or `captureCount > 0`.

- [ ] **Step 1: Write the failing tests.** In `group.test.ts`:
  - `withGroupStart` returns the team unchanged (same reference) in solo and with `playMode` missing.
  - In `together` and `shared`, it returns `startedAt === groupStartedAt` and ignores the team's own `startedAt`.
  - A group game before the signal gives `startedAt: null`.
  - A team created after the signal still gets `groupStartedAt`.
  - `signalPendingMs` is 3000 at 3 s before the signal, 0 after it, and 0 in solo.
  - `groupEndMs` with `phaseMinutes: 10`, `lateStepS: 10`, `latePenaltyPerStep: 1`, `latePenaltyMax: 3` is start + 10 min + 30 s + 30 s. It is null without a signal.
  - `canChangePlayMode` is true for a fresh game. It is false with `groupStartedAt` set, with one raw team `startedAt`, and with `captureCount: 1`.

  In `phase.test.ts`: `phaseState({ startedAt }, 10, start - 1000)` is `'idle'`.

- [ ] **Step 2: Run** `pnpm test -- group phase`. Expected: FAIL (module missing, and the phase case returns `running`).
- [ ] **Step 3: Implement.** Add the types, defaults and `group.ts`. In `phaseState`, return `'idle'` when `nowMs < Date.parse(startedAt)`. In `SettingsPanel.tsx`, add `'playMode' | 'groupStartedAt'` to the keys that `numberField` excludes, so lint passes.
- [ ] **Step 4: Run** `pnpm test && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Group start: play mode setting and each team's effective start`.

### Task 2: Dot ownership in scoring

**Files:**
- Modify: `src/lib/score.ts`
- Test: `src/lib/score.test.ts`

**Interfaces:**
- Consumes: the `withGroupStart` copies of teams (callers pass effective teams).
- Produces:
  - `dotOwners(teams: readonly Team[], captures: readonly Capture[], pellets: readonly Pellet[], settings: ScoringSettings): Map<string, string>`, mapping pellet id to owning team id. It considers only captures of the given teams, of listed pellets, inside that team's own window (the same window rule as `scoreTeam`; extract a shared `windowOf(team, settings): { startMs, endMs } | null`). Earliest `capturedAt` wins, and ties go to the lower `clientId`.
  - `scoreTeam(team, captures, pellets, settings, events = [], nowMs = Date.now(), owners?: ReadonlyMap<string, string>)`. When `owners` is given, a capture counts only if `owners.get(pelletId) === team._id`. The Dobbelt window is computed from the owned captures only.
  - `rankTeams` gets `'playMode'` in `ScoringSettings`. When `playMode === 'shared'`, it computes `dotOwners(teams, …)` once and passes it to each `scoreTeam`.

- [ ] **Step 1: Write the failing tests**, in a `describe('shared dots')` using the existing fixtures (`team`, `other`, `cap`):
  - Two teams capture `p2` at +60 s and +30 s. The owner is `t2`. `scoreTeam` of `t1` with the owners gives 0, and `t2` gets 5.
  - With equal `capturedAt`, the capture with the lower `clientId` wins.
  - `other` is home at +20 s and captures at +40 s, and `team` captures at +50 s. The owner is `t1`.
  - A capture at −1000 (before the start) blocks nobody.
  - A capture by a team not in `teams` is ignored.
  - A team with `startedAt: null` owns nothing, and an empty capture list gives an empty map.
  - Lost Dobbelt: `t2` owns the `double` dot, and `t1` captured it later and then `p1` 10 s after. `t1` scores `p1` ×1.
  - `rankTeams` with `playMode: 'shared'` ranks by owned points. Without it, scores are unchanged (an existing test still passes).
- [ ] **Step 2: Run** `pnpm test -- score`. Expected: FAIL (`dotOwners` not exported).
- [ ] **Step 3: Implement** `windowOf`, `dotOwners`, the `owners` parameter, and `rankTeams`.
- [ ] **Step 4: Run** `pnpm test && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Shared dots: the first capture owns the dot, scores count owned dots`.

### Task 3: Admin page: Spilform, Start alle, Nulstil alle

**Files:**
- Create: `src/admin/groupActions.ts`, `src/admin/StartAllButton.tsx`
- Modify: `src/admin/AdminApp.tsx`, `src/admin/SettingsPanel.tsx`, `src/admin/TeamsPanel.tsx`, `src/i18n/da.ts`

**Interfaces:**
- Consumes: `isGroupMode`, `withGroupStart`, `canChangePlayMode` (Task 1), and `rankTeams` with shared mode (Task 2).
- Produces:
  - `startGroup(gameId: string): Promise<Settings>`. It re-reads `api.settings.list({ gameId })[0]`. If `groupStartedAt` is already set, it returns that record unchanged. Otherwise it PUTs `groupStartedAt: new Date().toISOString()`.
  - `resetGame(gameId: string): Promise<{ settings: Settings; teams: Team[] }>`. It deletes every capture, event and heartbeat of the game, read fresh by `gameId`. It PUTs every team, re-read, with `startedAt: null, returnedAt: null`, and PUTs the settings with `groupStartedAt: null`.
  - `<StartAllButton settings={GameSettings} pelletCount={number} teamCount={number} onStart={() => Promise<void>} />`. It renders only in a group mode. It is enabled when `start` is set, `pelletCount > 0` and there is no `groupStartedAt`. It confirms with `da.confirmStartAll(teamCount)`. After the start, it shows `da.groupRunning(clock)`, the shared countdown, or `da.groupOver`.

- [ ] **Step 1: Settings panel.** Add a *Spilform* select with `PLAY_MODES` and labels `da.playModes` (`solo: 'Hver for sig'`, `together: 'Samlet start'`, `shared: 'Samlet start, fælles prikker'`). It is disabled with the hint `da.playModeLocked` when a new prop `playModeLocked: boolean` is true. AdminApp passes `!canChangePlayMode(settings, teams, captures.length)`.
- [ ] **Step 2: AdminApp.** Derive `effectiveTeams = teams.map(t => withGroupStart(t, settings))` and use it for `rankTeams`, `TeamsPanel` and `Scoreboard`. Keep the raw `teams` for `freshTeam` writes. Render `StartAllButton` above the Scoreboard. Add a *Nulstil alle* button in the TeamsPanel header, shown when `!canChangePlayMode(...)`, with the confirm `da.confirmResetAll`. Calling `resetGame` replaces local teams, settings, captures and events. Add `'#0f766e', '#7c2d12'` to `TEAM_COLORS`, so ten teams get ten colours.
- [ ] **Step 3: TeamsPanel.** Add a prop `perTeamReset: boolean`. Per-team *Nulstil* is rendered only when it is true, and AdminApp passes `!isGroupMode(settings)`. *Hjemme* and *Slet* are unchanged.
- [ ] **Step 4: Verify.** Run `pnpm lint && pnpm test`. Then `VITE_COLLECTION_PREFIX=ch2cpacman_test_ pnpm dev` and, in a browser, check each of these:
  - Create a game, choose *Samlet start*, and add 2 teams. *Start alle* is disabled until the start point and a dot exist.
  - After *Start alle*, both teams show *I gang* with the same clock, the Spilform select is locked, and per-team *Nulstil* is hidden.
  - *Nulstil alle* returns everything to *Ikke startet* and unlocks the select.
  Drop the `ch2cpacman_test_*` records you made afterwards.
- [ ] **Step 5: Commit** `Admin: Spilform, Start alle and Nulstil alle`.

### Task 4: Postmandskab

**Files:**
- Modify: `src/admin/LeaderPage.tsx`

**Interfaces:**
- Consumes: `StartAllButton`, `startGroup` (Task 3), `withGroupStart`, `isSharedDots` (Task 1), `dotOwners` (Task 2).

- [ ] **Step 1:** Map the polled teams through `withGroupStart` before the rows, `running`, `clocks` and the cards. In shared mode, compute `owners = dotOwners(effectiveTeams, captures, pellets, full)` once. Pass it to each `scoreTeam`, and pass `pellets.filter(p => !owners.has(p._id))` to `LeaderMap`.
- [ ] **Step 2:** Render `StartAllButton` in the header in group modes. `onStart` calls `startGroup`, then `livePoll.reload()`.
- [ ] **Step 3: Verify.** Run `pnpm lint`. Then, on the test build, open Postmandskab for the Task 3 game on a phone-width viewport. *Start alle* is there before the signal, and after it every team is *I gang* with the same clock.
- [ ] **Step 4: Commit** `Postmandskab: Start alle, shared clock and free dots`.

### Task 5: Runner phone: group start

**Files:**
- Modify: `src/runner/RunnerApp.tsx`, `src/runner/PhotoScreen.tsx`, `src/runner/useReturnHome.ts`, `src/runner/Briefing.tsx`
- Create: `src/runner/useGroupSignal.ts`
- Modify: `src/i18n/player/da.ts`, `en.ts`, `nb.ts`

**Interfaces:**
- Consumes: `withGroupStart`, `isGroupMode`, `isSharedDots`, `signalPendingMs` (Task 1).
- Produces:
  - `useGroupSignal({ enabled: boolean, gameId: string | undefined, onSettings: (s: Settings) => void })`. It polls `api.settings.list({ gameId })` every 2000 ms while enabled and calls `onSettings` with the record when `groupStartedAt` changes.
  - `RulesInput` gains `groupStart: boolean` and `sharedDots: boolean`.
  - New player strings: `waitingForSignal`, `signalIn: (s: number) => string`, plus the rule lines below.

- [ ] **Step 1: RunnerApp.** Keep `data.settings` in state with a setter. Derive the team passed to `Game` (and to `SpectatorGame`, see Task 7) as `withGroupStart(rawTeam, settings)`. `Game` gets `onSettingsChange`. In `Game`, call `useGroupSignal` with `enabled: isGroupMode(settings) && (!settings.groupStartedAt || signalPendingMs(settings, now) > 0)`.
- [ ] **Step 2: Waiting panel.** In group modes, the idle bottom panel shows `t.waitingForSignal` in place of the text and the TRYK START button. While `signalPendingMs > 0`, it shows `t.signalIn(Math.ceil(ms / 1000))` instead. The spectator, rules and change-team links stay. On the transition from idle to running in a group mode, run the same `sound.unlock(); sound.startJingle(); readyFlash` as `start()`. The tap on *Videre* in the rules has already unlocked audio.
- [ ] **Step 3: Rules and photo don't follow the clock.** Replace `state === 'idle' && !briefed` with `!briefed`. Add `useState(state !== 'idle')` as the initial value of `photoSkipped`, and drop `state === 'idle'` from the photo condition. A phone that mounts mid-run still skips both, and a signal that arrives mid-screen leaves the team there (spec: "Nothing happens to it").
- [ ] **Step 4: Raw writes.**
  - In `PhotoScreen.upload`, build the PUT on `(await api.teams.list({ _id: team._id }))[0] ?? team`, never on the prop.
  - In `useReturnHome`, change the `sameRun` check to compare `withGroupStart(current, settings).startedAt === teamRef.current.startedAt`. Both the PUT and the leader-stamp pickup already pass the raw `current`. That is correct, since RunnerApp stores raw teams.
- [ ] **Step 5: Rules text, in all three languages.**
  - With `groupStart`, the planning line becomes "you can see the map and dots before the start; the time starts on the leader's signal, for every team at once" (Danish: *"Før start kan I se kortet og prikkerne. Læg en plan, tiden starter på lederens signal, for alle hold på én gang."*).
  - With `sharedDots`, add *"Prikkerne deles med de andre hold. Det hold, der først når en prik, får den, og så er den væk for alle andre."*
  - `waitingForSignal`: *"Kig på kortet og læg en plan. Tiden starter, når lederen giver signal."*
  - `signalIn`: `s => \`START OM ${s}\``.
  - `Briefing` passes `groupStart: isGroupMode(settings)` and `sharedDots: isSharedDots(settings)`.
- [ ] **Step 6: Verify.** Run `pnpm lint && pnpm test`. Then, on the test build, use the game from Task 3 after *Nulstil alle*:
  - Join a team in a browser with the geolocation override. It waits with no TRYK START.
  - Press *Start alle* in another tab. Within about 2 s the phone flashes READY and counts down the shared clock.
  - Join a second team after the start. It lands in the running game with the same time left.
  - Join a third team, stay on the rules, and press *Start alle* (after a fresh *Nulstil alle*). The rules stay until *Videre*.
- [ ] **Step 7: Commit** `Runner: wait for the leader's signal in group games`.

### Task 6: Runner phone: shared dots

**Files:**
- Create: `src/runner/useSharedDots.ts`
- Modify: `src/runner/useCaptureEngine.ts`, `src/runner/RunnerApp.tsx`, `src/runner/RunnerMap.tsx`, `src/runner/Hud.tsx` (banner), `src/runner/GameOver.tsx`, `src/styles.css`, player i18n ×3

**Interfaces:**
- Consumes: `dotOwners`, `scoreTeam(…, owners)` (Task 2), `withGroupStart`, `isSharedDots`, `groupEndMs` (Task 1).
- Produces:
  - `useSharedDots({ enabled: boolean, settings: GameSettings, pellets: readonly Pellet[], ownTeamId: string, ownCaptures: ReadonlyMap<string, string> }): { owners: ReadonlyMap<string, string>; teams: readonly Team[] }`.
    - It polls `api.teams.list({ gameId })` and `api.captures.list({ gameId, capturedAt: { $gte: groupStartedAt } })` every 3000 ms.
    - It maps the teams through `withGroupStart`.
    - It adds the phone's own local captures (`ownCaptures`, pellet id to ISO time, with `clientId` = pellet id, as the engine does) to the server captures before `dotOwners`. That way the phone's own unuploaded dots compete too.
    - A failed poll keeps the last result.
  - `useCaptureEngine` options gain `blockedIds?: ReadonlySet<string>` (it never eats these) and `owners?: ReadonlyMap<string, string>` (passed to its `scoreTeam` call).
  - `RunnerMap` gains `takenColors?: ReadonlyMap<string, string>` (pellet id to team colour). An eaten pellet listed there plays a flash in that colour (a `.pellet-dot.taken` class with `--taken-color`) instead of the default pop. Keep the existing 320 ms removal, or lengthen it to about 800 ms for this case.
  - New player strings: `firstBanner: (team: string) => string` (Danish `${team} VAR FØRST`), and `finalOnScoreboard` (*"Den endelige stilling står på tavlen ved posten."*).

- [ ] **Step 1: Wire it in `Game`.** Only when `isSharedDots(settings)`:
  - Enable `useSharedDots` while `state` is running or late, and on over until `groupEndMs(settings)`.
  - `blockedIds` is the pellets whose owner exists and is not this team. `owners` goes to the engine.
  - The map's `eatenIds` is `engine.eatenIds ∪ blockedIds`.
  - `takenColors` maps each blocked pellet to its owner team's `color`.
- [ ] **Step 2: Lost-dot banner.** For each pellet in `engine.captureTimes` whose owner is now another team, show once (remember the ids in a ref) a banner `t.firstBanner(ownerName)` for 2 s, using the same banner slot and styling as the ghost banners in `Hud`, and play `sound.hurt()`. The score falls by itself, because the engine scores with `owners`.
- [ ] **Step 3: GAME OVER.** In shared mode, show `t.finalOnScoreboard` under the score. The points shown keep following `owners` while the hook polls.
- [ ] **Step 4: Verify.** Run `pnpm lint && pnpm test`. Then, on the test build, set the game to *Samlet start, fælles prikker* and use two browser contexts with the geolocation override on two teams.
  - Move team A onto a dot. Within about 3 s it flashes in A's colour and disappears on B.
  - Move B onto the same dot. B doesn't eat it.
  - Make B eat a fresh dot while offline (devtools *Offline*), then make A eat it online, then bring B online. B's capture is earlier, so within about 3 s A shows "<B> VAR FØRST" and A's score drops.
- [ ] **Step 5: Commit** `Runner: shared dots, taken by the first team`.

### Task 7: Spectator in group games

**Files:**
- Modify: `src/runner/useSpectate.ts`, `src/runner/SpectatorGame.tsx`, `src/runner/RunnerApp.tsx`

**Interfaces:**
- Consumes: `withGroupStart`, `isGroupMode`, `isSharedDots` (Task 1) and `useSharedDots` (Task 6).

- [ ] **Step 1:** `useSpectate` gains `settings: GameSettings`. In a group mode it also polls `api.settings.list({ gameId })` and returns the latest settings. The returned `team` is `withGroupStart(polledTeam, latestSettings)`. Stopping at over is unchanged.
- [ ] **Step 2:** In shared mode, `SpectatorGame` uses `useSharedDots`, with `ownCaptures` built from the polled captures and the same `enabled` rule as the runner. It scores with `owners`, draws `eatenIds ∪ blocked` with `takenColors`, shows the same lost-dot banner, and shows `finalOnScoreboard` on GAME OVER.
- [ ] **Step 3: Verify.** Run `pnpm lint`. Then, with the Task 6 setup, open `#/watch/<A's code>` in a third context. It waits for the signal, starts with A, and shows the same dots and score as A.
- [ ] **Step 4: Commit** `Spectator: group start and shared dots`.

### Task 8: Docs and the in-app guide

**Files:**
- Modify: `README.md`, `ROADMAP.md`, `src/admin/HelpDialog.tsx`

- [ ] **Step 1: README.**
  - Add a section, *Spilform: samlet start og fælles prikker*, covering:
    - the three modes;
    - *Start alle* on the admin page and Postmandskab;
    - waiting phones, and joining after the signal with the time left;
    - *Nulstil alle* and the locked select;
    - first come, first served by timestamp, including the offline case;
    - GAME OVER may still change.
  - Under Rules of scoring, change "Pellets are not removed for other teams" so it only applies to *Hver for sig* and *Samlet start*.
  - Add `playMode` and `groupStartedAt` to the settings row of the storage table.
  - Add to the manual checklist: a group start with two phones, a late joiner, and a shared dot contested by a phone in airplane mode.
- [ ] **Step 2: ROADMAP.** Move "Two teams at once, shared dots" into the built list.
- [ ] **Step 3: HelpDialog.** Add the same mode explanation in Danish, matching the dialog's existing sections.
- [ ] **Step 4: Verify.** Run `pnpm lint && pnpm test && pnpm build`. Expected: all pass.
- [ ] **Step 5: Commit** `Docs: group start and shared dots`.
