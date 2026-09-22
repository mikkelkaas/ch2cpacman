# Spectator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second phone joins a team as a spectator and sees the runner, ghosts, pellets, countdown and score live, without tracking or writing anything.

**Architecture:** The runner's phone writes one heartbeat document per team every 2 s (fix plus ghost state) to a new cruttelut collection. A spectator polls that document plus the team's record, captures and events with server-side filters, and renders the existing map, HUD and game-over screens from that data. Roles are carried in the address (`#/join/CODE` runner, `#/watch/CODE` spectator) and in localStorage.

**Tech Stack:** React 19, TypeScript, Vite, vitest, Leaflet, cruttelut REST (`?filter=` reads), pnpm.

**Spec:** `docs/superpowers/specs/2026-09-22-spectator-design.md`

## Global Constraints

- All user-facing text is Danish and lives in `src/i18n/da.ts`. Arcade-style strings on runner screens are upper case.
- Collections are prefixed with `PREFIX` from `src/lib/api.ts` (`ch2cpacman_` by default). The new collection is `${PREFIX}heartbeats`.
- Heartbeat cadence 2000 ms, only when the payload changed. Stale threshold 8000 ms. Spectator poll 2000 ms.
- A failed heartbeat write is dropped, never queued.
- The spectator never writes to the store.
- Run `pnpm lint` (tsc) and `pnpm test` before every commit. Both must pass.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Do not push. Pushing to `main` deploys the site.

## File map

Create:

- `src/lib/heartbeat.ts` — `Heartbeat` type, constants, `isStale`, `heartbeatFromGame`, `sameBeat`. Pure.
- `src/lib/heartbeat.test.ts`
- `src/runner/useHeartbeat.ts` — writer hook used by the runner's `Game`.
- `src/runner/useSpectate.ts` — reader hook: polls team, captures, events, heartbeat.
- `src/runner/SpectatorGame.tsx` — spectator screen composing `RunnerMap`, `Hud`, `GameOver`.
- `src/runner/SpectatorQr.tsx` — full-screen QR the runner's phone shows.

Modify:

- `src/lib/route.ts`, `src/lib/route.test.ts` — role in the hash.
- `src/lib/storage.ts` — role in localStorage.
- `src/lib/api.ts`, `src/lib/api.test.ts` — heartbeat collection.
- `src/lib/score.ts`, `src/lib/score.test.ts` — `captureTimesOf`, `doubleRemainingMs`.
- `src/App.tsx` — route carries role.
- `src/runner/RunnerApp.tsx` — role state, `Game` vs `SpectatorGame`, heartbeat writer, spectator QR link, shared double window.
- `src/runner/CodeScreen.tsx` — role toggle.
- `src/runner/Hud.tsx` — stale line.
- `src/runner/RunnerMap.tsx` — `faded` prop.
- `src/runner/Briefing.tsx` — `footer` slot.
- `src/admin/QrDialog.tsx` — runner/spectator flip.
- `src/admin/AdminApp.tsx` — delete heartbeat on reset and delete.
- `src/admin/GamesPage.tsx` — adopt and delete heartbeats.
- `src/i18n/da.ts` — new strings.
- `README.md` — storage table, how to play, manual checklist.

---

### Task 1: Role in the address and in storage

**Files:**
- Modify: `src/lib/route.ts`
- Modify: `src/lib/route.test.ts`
- Modify: `src/lib/storage.ts`
- Modify: `src/App.tsx`
- Modify: `src/runner/RunnerApp.tsx:40-90`

**Interfaces:**
- Produces: `type Role = 'runner' | 'spectator'`; `joinCodeFromHash(hash): { code: string; role: Role } | null`; `joinHash(code: string | null, role?: Role): string`; `joinUrl(code: string, role?: Role): string`; `setJoinHash(code: string | null, role?: Role): void`; `storage.getRole(): Role`; `storage.setRole(role: Role | null)`.
- `RunnerApp` props become `{ joinCode?: string | null; joinRole?: Role }`.

- [ ] **Step 1: Write the failing tests**

Replace the contents of `src/lib/route.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { joinCodeFromHash, joinHash } from './route';

describe('joinCodeFromHash', () => {
  it('reads the team code from a join address, upper-cased, as a runner', () => {
    expect(joinCodeFromHash('#/join/ab12')).toEqual({ code: 'AB12', role: 'runner' });
  });
  it('reads a watch address as a spectator', () => {
    expect(joinCodeFromHash('#/watch/ab12')).toEqual({ code: 'AB12', role: 'spectator' });
  });
  it('is null for the plain and admin routes', () => {
    expect(joinCodeFromHash('')).toBeNull();
    expect(joinCodeFromHash('#/')).toBeNull();
    expect(joinCodeFromHash('#/admin/g1')).toBeNull();
  });
});

describe('joinHash', () => {
  it('points at the team so a reload rejoins', () => {
    expect(joinHash('AB12')).toBe('#/join/AB12');
    expect(joinHash('AB12', 'runner')).toBe('#/join/AB12');
  });
  it('uses the watch route for a spectator', () => {
    expect(joinHash('AB12', 'spectator')).toBe('#/watch/AB12');
  });
  it('is the plain route when no team is joined, whatever the role', () => {
    expect(joinHash(null)).toBe('#/');
    expect(joinHash(null, 'spectator')).toBe('#/');
  });
  it('round-trips through joinCodeFromHash', () => {
    expect(joinCodeFromHash(joinHash('XY99', 'spectator'))).toEqual({ code: 'XY99', role: 'spectator' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/route.test.ts`
Expected: FAIL. `joinCodeFromHash('#/join/ab12')` returns a string, not an object.

- [ ] **Step 3: Implement the role in `src/lib/route.ts`**

Replace the file with:

```ts
/** Who this phone is on the team: the one being tracked, or one watching. */
export type Role = 'runner' | 'spectator';

/**
 * The join addresses: `#/join/<code>` for the runner, `#/watch/<code>` for a
 * spectator. A phone joins from one after a QR scan, and the running game
 * keeps it there so a reload, or the tab reopened from history, rejoins with
 * the same role even when localStorage is blocked or cleared.
 */
export function joinCodeFromHash(hash: string): { code: string; role: Role } | null {
  const match = hash.match(/^#\/(join|watch)\/([A-Za-z0-9]+)/);
  if (!match) return null;
  return { code: match[2].toUpperCase(), role: match[1] === 'watch' ? 'spectator' : 'runner' };
}

/** Hash for the joined team and role, or the plain runner route when there is none. */
export function joinHash(code: string | null, role: Role = 'runner'): string {
  if (!code) return '#/';
  return `#/${role === 'spectator' ? 'watch' : 'join'}/${code}`;
}

/** Address a phone opens to join a team straight away. */
export function joinUrl(code: string, role: Role = 'runner'): string {
  return `${window.location.origin}${window.location.pathname}${joinHash(code, role)}`;
}

/**
 * Make the address follow the joined team. `replaceState` fires no
 * `hashchange`, so the router does not remount the runner, and it leaves no
 * history entry to step back through.
 */
export function setJoinHash(code: string | null, role: Role = 'runner'): void {
  window.history.replaceState(null, '', `${window.location.pathname}${joinHash(code, role)}`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/route.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Store the role**

In `src/lib/storage.ts`, add the key and two accessors:

```ts
import type { Role } from './route';

const TEAM_KEY = 'ch2cpacman.teamId';
const ROLE_KEY = 'ch2cpacman.role';
const MUTED_KEY = 'ch2cpacman.muted';
```

and in the exported object:

```ts
export const storage = {
  getTeamId: () => get(TEAM_KEY),
  setTeamId: (id: string | null) => set(TEAM_KEY, id),
  /** Runner unless the phone chose to watch. */
  getRole: (): Role => (get(ROLE_KEY) === 'spectator' ? 'spectator' : 'runner'),
  setRole: (role: Role | null) => set(ROLE_KEY, role),
  isMuted: () => get(MUTED_KEY) === '1',
  setMuted: (muted: boolean) => set(MUTED_KEY, muted ? '1' : '0'),
};
```

- [ ] **Step 6: Carry the role through the router**

In `src/App.tsx`:

```ts
import { joinCodeFromHash } from './lib/route';
import type { Role } from './lib/route';

type Route =
  | { kind: 'runner'; joinCode: string | null; joinRole: Role }
  | { kind: 'games' }
  | { kind: 'admin'; gameId: string }
  | { kind: 'print'; gameId: string };

function routeFromHash(): Route {
  const hash = window.location.hash;
  const join = joinCodeFromHash(hash);
  if (join) return { kind: 'runner', joinCode: join.code, joinRole: join.role };
  const admin = hash.match(/^#\/admin(?:\/([^/]+))?(\/print)?/);
  if (!admin) return { kind: 'runner', joinCode: null, joinRole: 'runner' };
  if (!admin[1]) return { kind: 'games' };
  const gameId = decodeURIComponent(admin[1]);
  return admin[2] ? { kind: 'print', gameId } : { kind: 'admin', gameId };
}
```

and at the bottom:

```tsx
  return <RunnerApp joinCode={route.joinCode} joinRole={route.joinRole} />;
```

- [ ] **Step 7: Hold the role in RunnerApp**

In `src/runner/RunnerApp.tsx`, change the signature and the team state block. The imports gain `Role`:

```ts
import { setJoinHash } from '../lib/route';
import type { Role } from '../lib/route';
```

Replace the component head down to the address-sync effect with:

```tsx
export default function RunnerApp({ joinCode = null, joinRole = 'runner' }: { joinCode?: string | null; joinRole?: Role }) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(() => storage.getTeamId());
  const [role, setRole] = useState<Role>(() => storage.getRole());
  const [data, setData] = useState<GameData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  // Teams first: the code on the phone identifies both the team and its game.
  const loadTeams = useCallback(async () => {
    setLoadError(null);
    try {
      setTeams(await api.teams.list());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const chooseTeam = useCallback((t: Team | null, r: Role = 'runner') => {
    storage.setTeamId(t?._id ?? null);
    storage.setRole(t ? r : null);
    setTeamId(t?._id ?? null);
    setRole(t ? r : 'runner');
  }, []);

  // A scanned QR or a reload carries the code and role in the address: join
  // without typing. Consumed once per code, so a team change made later on
  // the code screen is not undone when the team list refreshes.
  const consumedJoinCode = useRef<string | null>(null);
  useEffect(() => {
    if (!joinCode || !teams || consumedJoinCode.current === joinCode) return;
    consumedJoinCode.current = joinCode;
    // No such team (a stale link, a typo in the address): the stored team
    // stands, and the address is corrected below.
    const match = teams.find(t => t.code === joinCode);
    if (match) chooseTeam(match, joinRole);
  }, [joinCode, joinRole, teams, chooseTeam]);

  const team = teams?.find(t => t._id === teamId) ?? null;

  // The address follows the joined team and role, whether they came from the
  // QR, the code screen or localStorage: a reload, or the tab reopened from
  // history, rejoins from the address even when storage is blocked or
  // cleared. Not before the team list is in, so a failed load keeps the
  // scanned address. Also after a code was typed into the address and
  // matched no team.
  useEffect(() => {
    if (!teams) return;
    setJoinHash(team?.code ?? null, role);
  }, [teams, team?.code, role, joinCode]);
```

The three existing `chooseTeam(...)` call sites (`onJoin`, the not-set-up button, `onLeaveTeam`) keep working: `onJoin={chooseTeam}` passes only the team, so the role defaults to runner for now. Task 7 changes the code screen to pass a role.

- [ ] **Step 8: Typecheck and run all tests**

Run: `pnpm lint && pnpm test`
Expected: tsc silent, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/route.ts src/lib/route.test.ts src/lib/storage.ts src/App.tsx src/runner/RunnerApp.tsx
git commit -m "Carry a runner or spectator role in the address and storage

#/watch/CODE joins as a spectator. Nothing renders differently yet.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Heartbeat record, helpers and collection

**Files:**
- Create: `src/lib/heartbeat.ts`
- Create: `src/lib/heartbeat.test.ts`
- Modify: `src/lib/api.ts:62-69`
- Modify: `src/lib/api.test.ts`

**Interfaces:**
- Produces:

```ts
export const HEARTBEAT_MS = 2000;
export const STALE_MS = 8000;
export interface HeartbeatFix { lat: number; lng: number; accuracyM: number; at: number }
export interface Heartbeat extends GameScoped {
  _id: string;
  teamId: string;
  fix: HeartbeatFix | null;
  ghosts: GhostState | null;
  at: string;
}
export function heartbeatFromGame(team: Pick<Team, '_id' | 'gameId'>, fix: Fix | null, ghosts: GhostState | null, nowMs: number): NewRecord<Heartbeat>;
export function sameBeat(a: Pick<Heartbeat, 'fix' | 'ghosts'> | null, b: Pick<Heartbeat, 'fix' | 'ghosts'>): boolean;
export function isStale(beat: Pick<Heartbeat, 'at'> | null, nowMs: number): boolean;
export function staleForMs(beat: Pick<Heartbeat, 'at'> | null, nowMs: number): number | null;
```

- `api.heartbeats` with the same `list/create/update/remove` as the other collections.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/heartbeat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { heartbeatFromGame, isStale, sameBeat, staleForMs, STALE_MS } from './heartbeat';
import type { GhostState } from './ghosts';

const team = { _id: 't1', gameId: 'g1' };
const fix = { lat: 56.1, lng: 10.2, accuracyM: 12, at: 1_000 };
const ghosts: GhostState = { ghosts: [{ id: 0, color: '#ff0000', lat: 56.11, lng: 10.21, spawnedAtMs: 500, rush: 0.2 }], frightenedUntilMs: 0, immuneUntilMs: 0 };

describe('heartbeatFromGame', () => {
  it('copies the fix and ghost state and stamps the time', () => {
    const beat = heartbeatFromGame(team, fix, ghosts, 5_000);
    expect(beat).toEqual({ teamId: 't1', gameId: 'g1', fix, ghosts, at: new Date(5_000).toISOString() });
  });
  it('carries nulls when the phone has no fix or no ghosts yet', () => {
    const beat = heartbeatFromGame(team, null, null, 5_000);
    expect(beat.fix).toBeNull();
    expect(beat.ghosts).toBeNull();
  });
  it('drops a fix that is too inaccurate to trust', () => {
    const beat = heartbeatFromGame(team, { ...fix, accuracyM: 80 }, ghosts, 5_000);
    expect(beat.fix).toBeNull();
  });
});

describe('sameBeat', () => {
  it('is false against nothing sent yet', () => {
    expect(sameBeat(null, { fix, ghosts })).toBe(false);
  });
  it('is true when fix and ghosts are unchanged, ignoring the stamp', () => {
    expect(sameBeat({ fix, ghosts }, { fix: { ...fix }, ghosts: structuredClone(ghosts) })).toBe(true);
  });
  it('is false when a ghost moved', () => {
    const moved = { ...ghosts, ghosts: [{ ...ghosts.ghosts[0], lat: 56.12 }] };
    expect(sameBeat({ fix, ghosts }, { fix, ghosts: moved })).toBe(false);
  });
});

describe('isStale', () => {
  const at = new Date(10_000).toISOString();
  it('is stale with no beat at all', () => {
    expect(isStale(null, 10_000)).toBe(true);
  });
  it('is fresh inside the threshold and stale after it', () => {
    expect(isStale({ at }, 10_000 + STALE_MS - 1)).toBe(false);
    expect(isStale({ at }, 10_000 + STALE_MS)).toBe(true);
  });
  it('reports how long since the last beat, or null without one', () => {
    expect(staleForMs({ at }, 13_500)).toBe(3_500);
    expect(staleForMs(null, 13_500)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/heartbeat.test.ts`
Expected: FAIL, module `./heartbeat` not found.

- [ ] **Step 3: Implement `src/lib/heartbeat.ts`**

```ts
import type { Fix } from '../hooks/useGeolocation';
import { isUsableFix } from './fix';
import type { GhostState } from './ghosts';
import type { GameScoped, NewRecord, Team } from './types';

/** How often the runner's phone writes, and how old a beat may be before the spectator marks it stale. */
export const HEARTBEAT_MS = 2000;
export const STALE_MS = 8000;

export interface HeartbeatFix {
  lat: number;
  lng: number;
  accuracyM: number;
  /** Phone clock, ms since epoch, when the fix was taken. */
  at: number;
}

/**
 * What the runner's phone knows and nobody else does: where it is and where
 * its ghosts are. One document per team, replaced on every beat. Not part of
 * the score.
 */
export interface Heartbeat extends GameScoped {
  _id: string;
  teamId: string;
  /** Null when the phone has no usable fix. */
  fix: HeartbeatFix | null;
  /** Null before the ghosts have spawned or when ghosts are off. */
  ghosts: GhostState | null;
  /** When the beat was written, ISO string from the runner phone's clock. */
  at: string;
}

export function heartbeatFromGame(team: Pick<Team, '_id' | 'gameId'>, fix: Fix | null, ghosts: GhostState | null, nowMs: number): NewRecord<Heartbeat> {
  const usable = fix && isUsableFix(fix) ? { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, at: fix.at } : null;
  return { teamId: team._id, gameId: team.gameId, fix: usable, ghosts, at: new Date(nowMs).toISOString() };
}

/** Same picture as the last beat: nothing worth sending. */
export function sameBeat(a: Pick<Heartbeat, 'fix' | 'ghosts'> | null, b: Pick<Heartbeat, 'fix' | 'ghosts'>): boolean {
  if (!a) return false;
  return JSON.stringify({ fix: a.fix, ghosts: a.ghosts }) === JSON.stringify({ fix: b.fix, ghosts: b.ghosts });
}

export function staleForMs(beat: Pick<Heartbeat, 'at'> | null, nowMs: number): number | null {
  if (!beat) return null;
  return Math.max(0, nowMs - Date.parse(beat.at));
}

export function isStale(beat: Pick<Heartbeat, 'at'> | null, nowMs: number): boolean {
  const age = staleForMs(beat, nowMs);
  return age === null || age >= STALE_MS;
}
```

`isUsableFix` lives in `src/lib/fix.ts` and returns false above 30 m accuracy, so the 80 m test passes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/heartbeat.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Add the collection to the API client, test first**

Append to the `describe('cruttelut client')` block in `src/lib/api.test.ts`:

```ts
  it('has a heartbeat collection under the prefix', async () => {
    const fetchMock = stubFetch(200, []);
    await api.heartbeats.list({ teamId: 't1' });
    expect(fetchMock.mock.calls[0][0]).toBe(`https://cruttelut.kaasfrich.dk/rest/ch2cpacman_heartbeats?filter=${encodeURIComponent('{"teamId":"t1"}')}`);
  });
```

Run: `pnpm vitest run src/lib/api.test.ts`
Expected: FAIL, `api.heartbeats` is undefined.

In `src/lib/api.ts`, import the type and add the collection:

```ts
import type { Heartbeat } from './heartbeat';
import type { Capture, Game, GameEvent, NewRecord, Pellet, Settings, Team } from './types';
```

```ts
export const api = {
  games: collection<Game>(`${PREFIX}games`),
  settings: collection<Settings>(`${PREFIX}settings`),
  teams: collection<Team>(`${PREFIX}teams`),
  pellets: collection<Pellet>(`${PREFIX}pellets`),
  captures: collection<Capture>(`${PREFIX}captures`),
  events: collection<GameEvent>(`${PREFIX}events`),
  heartbeats: collection<Heartbeat>(`${PREFIX}heartbeats`),
};
```

Run: `pnpm vitest run src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and run all tests, then commit**

Run: `pnpm lint && pnpm test`
Expected: clean.

```bash
git add src/lib/heartbeat.ts src/lib/heartbeat.test.ts src/lib/api.ts src/lib/api.test.ts
git commit -m "Heartbeat record: the runner phone's fix and ghosts, one per team

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Shared double-window helpers

The runner's `Game` computes the Dobbelt countdown inline from the capture engine's map of capture times. The spectator computes it from captures. Both must agree, so the computation moves into `score.ts`.

**Files:**
- Modify: `src/lib/score.ts`
- Modify: `src/lib/score.test.ts`
- Modify: `src/runner/RunnerApp.tsx` (the `doubleMs` block in `Game`)

**Interfaces:**
- Produces:

```ts
export function captureTimesOf(captures: readonly Capture[], teamId: string): Map<string, string>; // pelletId -> capturedAt
export function doubleRemainingMs(captureTimes: ReadonlyMap<string, string>, pellets: readonly Pellet[], doubleSeconds: number, nowMs: number): number;
```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/score.test.ts` (keep the existing imports and add `captureTimesOf, doubleRemainingMs` to the import from `./score`):

```ts
describe('captureTimesOf', () => {
  it('maps each pellet to the earliest capture of one team', () => {
    const captures = [
      { _id: 'a', teamId: 't1', pelletId: 'p1', capturedAt: '2026-09-22T10:00:05.000Z', lat: 0, lng: 0, clientId: 'a' },
      { _id: 'b', teamId: 't1', pelletId: 'p1', capturedAt: '2026-09-22T10:00:01.000Z', lat: 0, lng: 0, clientId: 'b' },
      { _id: 'c', teamId: 't2', pelletId: 'p2', capturedAt: '2026-09-22T10:00:02.000Z', lat: 0, lng: 0, clientId: 'c' },
    ];
    expect(captureTimesOf(captures, 't1')).toEqual(new Map([['p1', '2026-09-22T10:00:01.000Z']]));
  });
});

describe('doubleRemainingMs', () => {
  const pellets = [
    { _id: 'd1', name: 'x2', lat: 0, lng: 0, radiusM: 20, points: 1, kind: 'double' as const },
    { _id: 'n1', name: 'n', lat: 0, lng: 0, radiusM: 20, points: 1 },
  ];
  const t0 = Date.parse('2026-09-22T10:00:00.000Z');
  it('counts down from the most recent double pellet eaten', () => {
    const times = new Map([['d1', new Date(t0).toISOString()], ['n1', new Date(t0 + 1000).toISOString()]]);
    expect(doubleRemainingMs(times, pellets, 60, t0 + 15_000)).toBe(45_000);
  });
  it('is 0 once the window has passed or nothing double was eaten', () => {
    const times = new Map([['d1', new Date(t0).toISOString()]]);
    expect(doubleRemainingMs(times, pellets, 60, t0 + 61_000)).toBe(0);
    expect(doubleRemainingMs(new Map(), pellets, 60, t0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/score.test.ts`
Expected: FAIL, the two functions are not exported.

- [ ] **Step 3: Implement in `src/lib/score.ts`**

Add after `dedupeCaptures`:

```ts
/** Pellet id to the earliest capture time for one team. What the phone's HUD needs. */
export function captureTimesOf(captures: readonly Capture[], teamId: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of dedupeCaptures(captures)) if (c.teamId === teamId) m.set(c.pelletId, c.capturedAt);
  return m;
}

/** Milliseconds of Dobbelt left, from the most recent double pellet eaten. 0 when none is active. */
export function doubleRemainingMs(captureTimes: ReadonlyMap<string, string>, pellets: readonly Pellet[], doubleSeconds: number, nowMs: number): number {
  return Math.max(
    0,
    ...pellets
      .filter(p => p.kind === 'double' && captureTimes.has(p._id))
      .map(p => Date.parse(captureTimes.get(p._id)!) + doubleSeconds * 1000 - nowMs),
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/score.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in the runner's `Game`**

In `src/runner/RunnerApp.tsx`, import `doubleRemainingMs` next to `dedupeCaptures`:

```ts
import { dedupeCaptures, doubleRemainingMs } from '../lib/score';
```

Replace the `doubleMs` block:

```ts
  // Dobbelt left: from the most recent double pellet eaten within the window.
  const doubleMs = Math.max(
    0,
    ...pellets
      .filter(p => p.kind === 'double' && engine.captureTimes.has(p._id))
      .map(p => Date.parse(engine.captureTimes.get(p._id)!) + settings.doubleSeconds * 1000 - now),
  );
```

with:

```ts
  const doubleMs = doubleRemainingMs(engine.captureTimes, pellets, settings.doubleSeconds, now);
```

- [ ] **Step 6: Typecheck, test, commit**

Run: `pnpm lint && pnpm test`
Expected: clean.

```bash
git add src/lib/score.ts src/lib/score.test.ts src/runner/RunnerApp.tsx
git commit -m "Share the Dobbelt countdown so the spectator computes it like the runner

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The heartbeat writer on the runner's phone

**Files:**
- Create: `src/runner/useHeartbeat.ts`
- Modify: `src/runner/RunnerApp.tsx` (`Game` body, after `useGhosts`)

**Interfaces:**
- Consumes: `heartbeatFromGame`, `sameBeat`, `HEARTBEAT_MS` from Task 2; `api.heartbeats`.
- Produces: `useHeartbeat({ active, team, fix, ghosts }: { active: boolean; team: Team; fix: Fix | null; ghosts: GhostState | null }): void`.

- [ ] **Step 1: Write the hook**

Create `src/runner/useHeartbeat.ts`:

```ts
import { useEffect, useRef } from 'react';
import type { Fix } from '../hooks/useGeolocation';
import { api } from '../lib/api';
import { HEARTBEAT_MS, heartbeatFromGame, sameBeat } from '../lib/heartbeat';
import type { Heartbeat } from '../lib/heartbeat';
import type { GhostState } from '../lib/ghosts';
import type { Team } from '../lib/types';

interface Options {
  /** Beat while the phase is running or the team is on its way home. */
  active: boolean;
  team: Team;
  fix: Fix | null;
  ghosts: GhostState | null;
}

/**
 * Publishes what only this phone knows, its fix and its ghosts, so a
 * spectator can draw the same map. One document per team, replaced in full
 * every HEARTBEAT_MS when something changed. A failed write is dropped: a
 * stale beat has no value and the next one replaces it anyway.
 */
export function useHeartbeat({ active, team, fix, ghosts }: Options): void {
  const fixRef = useRef(fix);
  fixRef.current = fix;
  const ghostsRef = useRef(ghosts);
  ghostsRef.current = ghosts;
  const teamRef = useRef(team);
  teamRef.current = team;
  const docId = useRef<string | null>(null);
  const lastSent = useRef<Pick<Heartbeat, 'fix' | 'ghosts'> | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const beat = async () => {
      if (inFlight.current) return;
      const record = heartbeatFromGame(teamRef.current, fixRef.current, ghostsRef.current, Date.now());
      if (sameBeat(lastSent.current, record)) return;
      inFlight.current = true;
      try {
        if (!docId.current) {
          // A reload must not leave the team with two documents: reuse an
          // existing one before creating.
          const existing = await api.heartbeats.list({ teamId: teamRef.current._id });
          docId.current = existing[0]?._id ?? null;
        }
        if (docId.current) {
          await api.heartbeats.update({ ...record, _id: docId.current });
        } else {
          const created = await api.heartbeats.create(record);
          docId.current = created._id;
        }
        if (!cancelled) lastSent.current = { fix: record.fix, ghosts: record.ghosts };
      } catch {
        // Dropped on purpose. The next tick tries again with a fresh picture.
      } finally {
        inFlight.current = false;
      }
    };

    void beat();
    const id = window.setInterval(() => void beat(), HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active]);
}
```

- [ ] **Step 2: Wire it into `Game`**

In `src/runner/RunnerApp.tsx`, import:

```ts
import { useHeartbeat } from './useHeartbeat';
```

In `Game`, directly after the `useCaptureEngine` call:

```ts
  // Publish this phone's fix and ghosts for spectators while the team is out.
  useHeartbeat({ active: state === 'running' || state === 'late', team, fix, ghosts: ghosts.ghosts });
```

- [ ] **Step 3: Typecheck**

Run: `pnpm lint`
Expected: silent.

- [ ] **Step 4: Check it live against the store**

Start the dev server: `pnpm dev --port 5199 --strictPort` in the background. In a browser (Playwright MCP or a real one), open `http://localhost:5199/ch2cpacman/#/join/<CODE>` for a team that is not started, grant a fake geolocation (Playwright: `browser_evaluate` cannot fake it; use the Chromium sensors panel in a real browser, or temporarily set `navigator.geolocation` before load with `browser_run_code_unsafe` to `context.setGeolocation({latitude, longitude, accuracy: 10})` and `context.grantPermissions(['geolocation'])`). Tap Start. Then:

```bash
curl -s "https://cruttelut.kaasfrich.dk/rest/ch2cpacman_heartbeats?filter=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("{\"teamId\":\"<TEAM_ID>\"}"))')"
```

Expected: exactly one document, `at` within the last few seconds, `fix` set, `ghosts.ghosts` an array. Reload the phone tab, wait 5 s, run the curl again: still exactly one document.

Afterwards reset the team from the admin page so it can be reused. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/runner/useHeartbeat.ts src/runner/RunnerApp.tsx
git commit -m "Runner phone publishes a heartbeat with its fix and ghosts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The spectator reader hook

**Files:**
- Create: `src/runner/useSpectate.ts`

**Interfaces:**
- Consumes: `usePolling` from `src/hooks/usePolling.ts`; `api.teams`, `api.captures`, `api.events`, `api.heartbeats`; `Heartbeat`.
- Produces:

```ts
export function useSpectate(initial: { team: Team; captures: Capture[]; events: GameEvent[] }): {
  team: Team;
  captures: Capture[];
  events: GameEvent[];
  heartbeat: Heartbeat | null;
  error: string | null;
  retry: () => Promise<void>;
};
```

- [ ] **Step 1: Write the hook**

Create `src/runner/useSpectate.ts`:

```ts
import { useCallback, useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { HEARTBEAT_MS } from '../lib/heartbeat';
import type { Heartbeat } from '../lib/heartbeat';
import type { Capture, GameEvent, Team } from '../lib/types';

interface Initial {
  team: Team;
  captures: Capture[];
  events: GameEvent[];
}

/**
 * Everything a spectator shows, read from the store every HEARTBEAT_MS with
 * filters on this team: the team record for start and return, captures and
 * events for the score, and the runner phone's heartbeat for the map. A
 * failed poll keeps the last good data and surfaces the error for a retry bar.
 */
export function useSpectate(initial: Initial) {
  const [team, setTeam] = useState(initial.team);
  const [captures, setCaptures] = useState(initial.captures);
  const [events, setEvents] = useState(initial.events);
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const teamId = initial.team._id;

  const load = useCallback(async () => {
    const [teamList, captureList, eventList, beats] = await Promise.all([
      api.teams.list({ _id: teamId }),
      api.captures.list({ teamId }),
      api.events.list({ teamId }),
      api.heartbeats.list({ teamId }),
    ]);
    if (teamList[0]) setTeam(teamList[0]);
    setCaptures(captureList);
    setEvents(eventList);
    setHeartbeat(beats[0] ?? null);
  }, [teamId]);

  const { error, reload } = usePolling(load, HEARTBEAT_MS);
  return { team, captures, events, heartbeat, error, retry: reload };
}
```

cruttelut converts a 24-hex `_id` in a filter to an ObjectId, so `{ _id: teamId }` returns the one team.

- [ ] **Step 2: Typecheck**

Run: `pnpm lint`
Expected: silent. (The hook is unused until Task 6; tsc does not mind.)

- [ ] **Step 3: Commit**

```bash
git add src/runner/useSpectate.ts
git commit -m "Spectator reader: poll team, captures, events and heartbeat by team

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The spectator screen

**Files:**
- Create: `src/runner/SpectatorGame.tsx`
- Modify: `src/runner/Hud.tsx` (new optional prop `staleForMs`)
- Modify: `src/runner/RunnerMap.tsx` (new optional prop `faded`)
- Modify: `src/i18n/da.ts`
- Modify: `src/runner/RunnerApp.tsx` (render `SpectatorGame` when the role is spectator)

**Interfaces:**
- Consumes: `useSpectate` (Task 5), `isStale`, `staleForMs` (Task 2), `captureTimesOf`, `doubleRemainingMs`, `scoreTeam`, `dedupeCaptures` (Task 3 and existing), `isFrightened` from `src/lib/ghosts.ts`, `phaseState`, `remainingMs`, `lateMs` from `src/lib/phase.ts`, `haversineM` from `src/lib/geo.ts`, `GHOST_WARN_M` from `src/lib/settings.ts`, `useNow`, `useWakeLock`, `sound.hurt`, `sound.ghostEaten`, `sound.siren`, `photoUrl`.
- Produces: `SpectatorGame({ team, settings, pellets, captures, events, onLeaveTeam })`.

- [ ] **Step 1: Add the Danish strings**

In `src/i18n/da.ts`, in the `// Runner` section after `unmute`:

```ts
  // Spectator
  spectator: 'TILSKUER',
  spectatorHint: 'I kigger med på løberens telefon. Denne telefon sporer ikke.',
  waitingForStart: 'Venter på at holdet starter…',
  waitingForRunner: 'VENTER PÅ LØBERENS TELEFON…',
  lastSeen: (s: number) => `SIDST SET FOR ${s} S SIDEN`,
```

- [ ] **Step 2: Let the HUD show the stale line**

In `src/runner/Hud.tsx`, add to `Props`:

```ts
  /** Spectator only: milliseconds since the runner phone's last beat when it has gone quiet, else null. */
  staleForMs?: number | null;
```

Add `staleForMs = null` to the destructured parameters, and in the bottom block, directly above the `weakSignal` line:

```tsx
        {staleForMs !== null && <div className="font-arcade text-[9px] text-ghost-orange bg-black/80 px-2 py-1">{da.lastSeen(Math.round(staleForMs / 1000))}</div>}
```

- [ ] **Step 3: Let the map fade the runner and ghosts**

In `src/runner/RunnerMap.tsx`, add to `Props`:

```ts
  /** Spectator only: the picture is old. Runner and ghosts go translucent, pellets stay. */
  faded?: boolean;
```

Add `faded = false` to the destructured parameters. Add an effect after the ghost effect (the one that maintains `ghostMarkers`):

```ts
  // Fade the moving parts when the picture is stale.
  useEffect(() => {
    const opacity = faded ? 0.35 : 1;
    runnerMarker.current?.setOpacity(opacity);
    for (const marker of ghostMarkers.current.values()) marker.setOpacity(opacity);
  }, [faded, fix, ghosts]);
```

`fix` and `ghosts` are dependencies so a marker created on the same render as a fade change still gets the opacity.

- [ ] **Step 4: Write the spectator screen**

Create `src/runner/SpectatorGame.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import ErrorBar from '../components/ErrorBar';
import { useNow } from '../hooks/useNow';
import { useWakeLock } from '../hooks/useWakeLock';
import { da } from '../i18n/da';
import { photoUrl } from '../lib/files';
import { haversineM } from '../lib/geo';
import { isFrightened } from '../lib/ghosts';
import { isStale, staleForMs } from '../lib/heartbeat';
import { lateMs, phaseState, remainingMs } from '../lib/phase';
import { captureTimesOf, doubleRemainingMs, scoreTeam } from '../lib/score';
import { GHOST_WARN_M } from '../lib/settings';
import { sound } from '../lib/sound';
import type { Capture, GameEvent, GameSettings, Pellet, Team } from '../lib/types';
import Briefing from './Briefing';
import GameOver from './GameOver';
import Hud from './Hud';
import RunnerMap from './RunnerMap';
import type { GhostBanner } from './useGhosts';
import { useSpectate } from './useSpectate';

interface Props {
  team: Team;
  settings: GameSettings;
  pellets: Pellet[];
  captures: Capture[];
  events: GameEvent[];
  onLeaveTeam: () => void;
}

/**
 * The runner's screen, drawn from the store instead of sensors: the team
 * record for the clock, captures and events for the score, and the runner
 * phone's heartbeat for the runner dot and the ghosts. Reads only.
 */
export default function SpectatorGame({ team: initialTeam, settings, pellets, captures: initialCaptures, events: initialEvents, onLeaveTeam }: Props) {
  const now = useNow(250);
  const { team, captures, events, heartbeat, error, retry } = useSpectate({ team: initialTeam, captures: initialCaptures, events: initialEvents });
  const rule = { lateStepS: settings.lateStepS, latePenaltyPerStep: settings.latePenaltyPerStep, latePenaltyMax: settings.latePenaltyMax };
  const state = phaseState(team, settings.phaseMinutes, now, rule);
  const [rulesOpen, setRulesOpen] = useState(false);
  useWakeLock(state === 'running' || state === 'late');

  // Score exactly as the admin and the runner do, from timestamps.
  const score = scoreTeam(team, captures, pellets, settings, events, now);
  const captureTimes = captureTimesOf(captures, team._id);
  const eatenIds = new Set(captureTimes.keys());
  const doubleMs = doubleRemainingMs(captureTimes, pellets, settings.doubleSeconds, now);

  // The runner phone's picture, and how old it is.
  const stale = isStale(heartbeat, now);
  const fix = heartbeat?.fix ? { ...heartbeat.fix } : null;
  const ghostState = heartbeat?.ghosts ?? null;
  const frightened = ghostState ? isFrightened(ghostState, now) : false;
  const ghostMode = !frightened ? 'normal' : ghostState!.frightenedUntilMs - now < 5000 ? 'flashing' : 'frightened';
  const shielded = (ghostState?.immuneUntilMs ?? 0) > now;
  const nearest = fix && ghostState ? Math.min(...ghostState.ghosts.map(g => haversineM(fix, g)), Infinity) : Infinity;
  const homeDistanceM = fix && settings.start ? Math.round(haversineM(fix, settings.start)) : null;

  // Banner and sound for each ghost event the runner phone reports, once.
  const seenEvents = useRef<Set<string>>(new Set(initialEvents.map(e => e.clientId)));
  const [banner, setBanner] = useState<GhostBanner | null>(null);
  useEffect(() => {
    for (const e of events) {
      if (seenEvents.current.has(e.clientId)) continue;
      seenEvents.current.add(e.clientId);
      setBanner({ type: e.type, points: e.points, at: Date.now() });
      if (e.type === 'ghost_caught') sound.hurt();
      else sound.ghostEaten();
    }
  }, [events]);
  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), 2000);
    return () => window.clearTimeout(id);
  }, [banner]);

  // The same cues the runner hears: a siren when the countdown ends away from
  // home, and while a ghost is close on a fresh picture.
  useEffect(() => {
    if (state === 'late') sound.siren();
  }, [state]);
  const sirenAt = useRef(0);
  useEffect(() => {
    if (state !== 'running' || stale || frightened || nearest >= GHOST_WARN_M) return;
    if (now - sirenAt.current > 450) {
      sirenAt.current = now;
      sound.siren();
    }
  }, [now, state, stale, frightened, nearest]);

  const eatenCount = pellets.filter(p => eatenIds.has(p._id)).length;
  const running = state === 'running' || state === 'late';

  return (
    <div className="relative h-full w-full overflow-hidden">
      <RunnerMap
        theme={settings.mapTheme}
        pellets={pellets}
        eatenIds={eatenIds}
        start={settings.start}
        fix={fix}
        ghosts={state === 'running' ? ghostState?.ghosts : []}
        ghostMode={ghostMode}
        shielded={state === 'running' && shielded}
        dimmed={state === 'over'}
        faded={running && stale}
        homeRadiusM={state === 'late' ? settings.homeRadiusM : null}
      />

      {error && (
        <div className="absolute top-0 inset-x-0 z-[470]">
          <ErrorBar message={da.fetchFailed} onRetry={() => void retry()} />
        </div>
      )}

      {state === 'idle' && (
        <div className="absolute inset-x-0 bottom-0 z-[450] p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            {team.photoKey && <img src={photoUrl(team.photoKey)} alt="" className="w-12 h-12 object-cover border-2 border-maze" />}
            <div className="font-arcade text-[10px] text-pellet">{team.name}</div>
          </div>
          <div className="font-arcade text-xs text-ghost-cyan">{da.spectator}</div>
          <p className="text-gray-200 text-center">{da.waitingForStart}</p>
          <p className="text-gray-500 text-center text-sm">{da.spectatorHint}</p>
          <div className="flex gap-4 text-xs text-gray-500">
            <button onClick={() => setRulesOpen(true)} className="underline">
              {da.showRules}
            </button>
            <button onClick={onLeaveTeam} className="underline">
              {da.changeTeam}
            </button>
          </div>
        </div>
      )}

      {running && (
        <>
          <Hud
            remainingMs={remainingMs(team.startedAt!, settings.phaseMinutes, now)}
            lateMs={state === 'late' ? lateMs(team.startedAt!, settings.phaseMinutes, now) : 0}
            latePoints={score.late}
            homeDistanceM={homeDistanceM}
            points={score.points}
            pendingCount={0}
            onShowRules={() => setRulesOpen(true)}
            doubleMs={doubleMs}
            danger={state === 'late' || (!stale && nearest < GHOST_WARN_M)}
            power={frightened}
            ghostBanner={banner}
            weakSignal={!!heartbeat && !stale && heartbeat.fix === null}
            staleForMs={heartbeat && stale ? staleForMs(heartbeat, now) : null}
          />
          {!heartbeat && (
            <div className="absolute inset-x-0 top-1/2 z-[460] flex justify-center pointer-events-none">
              <div className="font-arcade text-[10px] text-ghost-orange bg-black/80 px-3 py-2 blink">{da.waitingForRunner}</div>
            </div>
          )}
        </>
      )}

      {state === 'over' && (
        <GameOver
          points={score.points}
          pelletCount={eatenCount}
          teamName={team.name}
          photoUrl={team.photoKey ? photoUrl(team.photoKey) : null}
          late={score.late}
          homeInTime={rule.latePenaltyPerStep > 0 && !!team.returnedAt && score.late === 0}
        />
      )}

      {rulesOpen && <Briefing overlay teamName={team.name} settings={settings} pellets={pellets} onDone={() => setRulesOpen(false)} />}
    </div>
  );
}
```

Notes for the implementer:
- `RunnerMap` takes `fix: Fix | null` where `Fix` is `{ lat, lng, accuracyM, at }`. `HeartbeatFix` has the same four fields, so the spread is enough.
- `weakSignal` is true when the runner phone beats but reports no usable fix. That is what a weak GPS looks like from the outside.
- The spectator never calls `api.*.create/update/remove`. Check with `grep -n "api\." src/runner/SpectatorGame.tsx`: there must be no matches.

- [ ] **Step 5: Render it for spectators**

In `src/runner/RunnerApp.tsx`, import:

```ts
import SpectatorGame from './SpectatorGame';
```

Replace the final `return (<Game .../>)` with:

```tsx
  if (role === 'spectator') {
    return (
      <SpectatorGame
        key={`watch-${team._id}`}
        team={team}
        settings={withDefaults(settings)}
        pellets={pellets}
        captures={captures}
        events={events}
        onLeaveTeam={() => chooseTeam(null)}
      />
    );
  }

  return (
    <Game
      key={team._id}
      team={team}
      settings={withDefaults(settings)}
      pellets={pellets}
      captures={captures}
      events={events}
      onTeamChange={updated => setTeams(list => (list ? list.map(t => (t._id === updated._id ? updated : t)) : list))}
      onLeaveTeam={() => chooseTeam(null)}
    />
  );
```

- [ ] **Step 6: Typecheck and test**

Run: `pnpm lint && pnpm test`
Expected: clean.

- [ ] **Step 7: Check it live with two tabs**

Start `pnpm dev --port 5199 --strictPort`. Open two tabs:

1. Runner: `#/join/<CODE>` with a faked geolocation (see Task 4 step 4), tap Start.
2. Spectator: `#/watch/<CODE>`.

Expected in the spectator tab within a few seconds: the countdown runs, the yellow runner dot appears where the runner tab's fake position is, ghosts appear and move, the score is `0000`. Eat a pellet in the runner tab by moving the fake position onto one: within about 4 s the spectator's pellet disappears and the score rises to match.

Then pause the runner tab (close it). After 8 s the spectator's runner dot and ghosts fade and the HUD shows `SIDST SET FOR 9 S SIDEN` counting up. Reopen the runner tab at the same address: the picture snaps back and the line disappears.

Reset the team in the admin afterwards. Stop the dev server. Remove `.playwright-mcp/` if it was created.

- [ ] **Step 8: Commit**

```bash
git add src/runner/SpectatorGame.tsx src/runner/Hud.tsx src/runner/RunnerMap.tsx src/i18n/da.ts src/runner/RunnerApp.tsx
git commit -m "Spectator screen: the runner's map and HUD drawn from the heartbeat

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Handing out the spectator address

**Files:**
- Create: `src/runner/SpectatorQr.tsx`
- Modify: `src/runner/Briefing.tsx` (a `footer` slot)
- Modify: `src/runner/CodeScreen.tsx` (role toggle)
- Modify: `src/runner/RunnerApp.tsx` (idle-screen link, rules-dialog link, code-screen role)
- Modify: `src/i18n/da.ts`

**Interfaces:**
- Consumes: `joinUrl(code, 'spectator')` from Task 1; `QrCode` from `src/admin/QrCode.tsx`.
- Produces: `SpectatorQr({ team, onClose })`; `Briefing` gains `footer?: ReactNode`; `CodeScreen` props become `{ teams, initialRole?: Role, onJoin: (team: Team, role: Role) => void }`.

- [ ] **Step 1: Strings**

In `src/i18n/da.ts`, in the `// Spectator` block from Task 6:

```ts
  addSpectator: 'Tilføj tilskuer',
  spectatorQrTitle: 'SCAN FOR AT KIGGE MED',
  spectatorQrHint: 'Tilskueren ser kortet, spøgelserne og scoren, men sporer ikke.',
  roleRunner: 'LØBER',
  roleSpectator: 'TILSKUER',
  roleQuestion: 'HVEM ER DENNE TELEFON?',
```

- [ ] **Step 2: The QR overlay**

Create `src/runner/SpectatorQr.tsx`:

```tsx
import QrCode from '../admin/QrCode';
import ArcadeButton from '../components/ArcadeButton';
import { da } from '../i18n/da';
import { joinUrl } from '../lib/route';
import type { Team } from '../lib/types';

/** Full-screen QR for the watch address, shown on the runner's phone so others can join as spectators. */
export default function SpectatorQr({ team, onClose }: { team: Team; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="absolute inset-0 z-[550] bg-black/95 flex flex-col items-center justify-center gap-5 p-6 text-center scanlines">
      <div className="font-arcade text-pellet text-xs">{da.spectatorQrTitle}</div>
      <div className="bg-white p-3 border-4 border-maze w-full max-w-xs">
        <QrCode text={joinUrl(team.code, 'spectator')} className="w-full [&>svg]:w-full [&>svg]:h-auto" />
      </div>
      <div className="font-arcade text-2xl text-pac tracking-[0.3em]">{team.code}</div>
      <p className="text-gray-400 text-sm max-w-xs">{da.spectatorQrHint}</p>
      <ArcadeButton onClick={onClose} className="w-full max-w-xs">
        {da.close}
      </ArcadeButton>
    </div>
  );
}
```

- [ ] **Step 3: A footer slot in the rules overlay**

In `src/runner/Briefing.tsx`, add to `Props`:

```ts
  /** Rendered under the close button. The runner puts the spectator link here. */
  footer?: ReactNode;
```

Import `ReactNode` from `react` (`import type { ReactNode } from 'react';`), destructure `footer` in the component signature, and render `{footer}` as the last child of the outer `div`, directly after the closing `</ArcadeButton>` of the button that calls `onDone`:

```tsx
        {overlay ? da.close : da.next}
      </ArcadeButton>
      {footer}
    </div>
```

- [ ] **Step 4: Role toggle on the code screen**

Replace `src/runner/CodeScreen.tsx` with:

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import ArcadeTitle from '../components/ArcadeTitle';
import { da } from '../i18n/da';
import type { Role } from '../lib/route';
import { sound } from '../lib/sound';
import { CODE_LENGTH, normalizeCode } from '../lib/teamCode';
import type { Team } from '../lib/types';

interface Props {
  teams: readonly Team[];
  /** Preselected from the address: a #/watch link that matched no team lands here as a spectator. */
  initialRole?: Role;
  onJoin: (team: Team, role: Role) => void;
}

export default function CodeScreen({ teams, initialRole = 'runner', onJoin }: Props) {
  const [code, setCode] = useState('');
  const [role, setRole] = useState<Role>(initialRole);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    sound.unlock();
    const team = teams.find(t => t.code === code);
    if (!team) {
      setError(da.unknownCode);
      return;
    }
    sound.blip();
    onJoin(team, role);
  };

  const roleButton = (value: Role, label: string) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      aria-pressed={role === value}
      className={`font-arcade text-xs flex-1 py-3 border-2 ${role === value ? 'border-pac text-pac glow-pac' : 'border-maze text-blue-400'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-8 p-6 scanlines relative">
      <ArcadeTitle size="xl">{da.title}</ArcadeTitle>
      <form onSubmit={submit} className="flex flex-col items-center gap-5 w-full max-w-xs">
        <label className="font-arcade text-pellet text-xs" htmlFor="code">
          {da.enterCode}
        </label>
        <input
          id="code"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={e => {
            setCode(normalizeCode(e.target.value).slice(0, CODE_LENGTH));
            setError(null);
          }}
          placeholder={da.codePlaceholder}
          className="font-arcade text-3xl tracking-[0.5em] text-center w-full bg-black text-pac border-4 border-maze py-4 outline-none focus:glow-maze placeholder:text-blue-900"
        />
        <div className="w-full flex flex-col gap-2">
          <div className="font-arcade text-pellet text-[9px] text-center">{da.roleQuestion}</div>
          <div className="flex gap-2 w-full">
            {roleButton('runner', da.roleRunner)}
            {roleButton('spectator', da.roleSpectator)}
          </div>
        </div>
        {error && <p className="font-arcade text-ghost-red text-xs blink">{error}</p>}
        <ArcadeButton type="submit" disabled={code.length !== CODE_LENGTH} className="w-full">
          {da.join}
        </ArcadeButton>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Wire the runner's phone**

In `src/runner/RunnerApp.tsx`:

Import:

```ts
import SpectatorQr from './SpectatorQr';
```

The code screen call becomes:

```tsx
    return <CodeScreen teams={teams} initialRole={joinRole} onJoin={chooseTeam} />;
```

(`chooseTeam(t, r)` already takes a role from Task 1.)

In `Game`, add state next to `rulesOpen`:

```ts
  const [qrOpen, setQrOpen] = useState(false);
```

In the idle bottom bar, the `<div className="flex gap-4 text-xs text-gray-500">` gains a third button, before the rules one:

```tsx
            <button onClick={() => setQrOpen(true)} className="underline">
              {da.addSpectator}
            </button>
```

The rules overlay call becomes:

```tsx
      {rulesOpen && (
        <Briefing
          overlay
          teamName={team.name}
          settings={settings}
          pellets={pellets}
          onDone={() => setRulesOpen(false)}
          footer={
            <button
              onClick={() => {
                setRulesOpen(false);
                setQrOpen(true);
              }}
              className="underline text-xs text-gray-500"
            >
              {da.addSpectator}
            </button>
          }
        />
      )}
      {qrOpen && <SpectatorQr team={team} onClose={() => setQrOpen(false)} />}
```

- [ ] **Step 6: Typecheck, test**

Run: `pnpm lint && pnpm test`
Expected: clean.

- [ ] **Step 7: Check live**

Dev server up. Open `#/join/<CODE>` for an unstarted team: the idle bar shows "Tilføj tilskuer". Tap it: a QR on a white box over the black screen, the code under it. Scan it with a phone, or read the QR's `aria-label` in the DOM: it must be `.../ch2cpacman/#/watch/<CODE>`. Open `#/watch/ZZZZ` (no such team): the code screen appears with TILSKUER preselected. Type a real code and continue: the address becomes `#/watch/<CODE>` and the spectator waiting screen shows.

- [ ] **Step 8: Commit**

```bash
git add src/runner/SpectatorQr.tsx src/runner/Briefing.tsx src/runner/CodeScreen.tsx src/runner/RunnerApp.tsx src/i18n/da.ts
git commit -m "Runner phone hands out a spectator QR; code screen picks a role

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Admin: QR flip, and heartbeats follow the team

**Files:**
- Modify: `src/admin/QrDialog.tsx`
- Modify: `src/admin/AdminApp.tsx:134-160`
- Modify: `src/admin/GamesPage.tsx:25-60, 85-105`
- Modify: `src/i18n/da.ts`

**Interfaces:**
- Consumes: `joinUrl(code, role)`, `api.heartbeats`, `orphans`/`inGame` from `src/lib/games.ts`.

- [ ] **Step 1: Strings**

In `src/i18n/da.ts`, in the `// Admin` section near `qrTitle`:

```ts
  qrForRunner: 'Løber',
  qrForSpectator: 'Tilskuer',
  qrSpectatorTitle: 'Scan for at kigge med',
```

- [ ] **Step 2: The flip in `QrDialog`**

In `src/admin/QrDialog.tsx`, import the role type and add state:

```ts
import { joinUrl } from '../lib/route';
import type { Role } from '../lib/route';
```

```ts
  const [role, setRole] = useState<Role>('runner');
  const team = teams[index];
  const url = joinUrl(team.code, role);
```

Between the team name and the `QrCode`, add:

```tsx
        <div className="flex gap-2">
          <Button variant={role === 'runner' ? 'primary' : 'secondary'} onClick={() => setRole('runner')}>
            {da.qrForRunner}
          </Button>
          <Button variant={role === 'spectator' ? 'primary' : 'secondary'} onClick={() => setRole('spectator')}>
            {da.qrForSpectator}
          </Button>
        </div>
```

`Button` in `src/admin/ui.tsx` takes `variant?: 'primary' | 'secondary' | 'danger'`, default `secondary`.

The caption becomes:

```tsx
        <p className="text-sm text-gray-500">{role === 'spectator' ? da.qrSpectatorTitle : da.qrTitle}</p>
```

- [ ] **Step 3: Delete a team's heartbeat with its captures**

In `src/admin/AdminApp.tsx`, `deleteTeamCaptures` becomes:

```ts
  const deleteTeamCaptures = async (team: Team) => {
    const mine = captures.filter(c => c.teamId === team._id);
    const myEvents = events.filter(e => e.teamId === team._id);
    const beats = await api.heartbeats.list({ teamId: team._id }).catch(() => []);
    await Promise.all([
      ...mine.map(c => api.captures.remove(c._id)),
      ...myEvents.map(e => api.events.remove(e._id)),
      ...beats.map(b => api.heartbeats.remove(b._id)),
    ]);
    setCaptures(list => list.filter(c => c.teamId !== team._id));
    setEvents(list => list.filter(e => e.teamId !== team._id));
  };
```

Both `resetTeam` and `deleteTeam` already call it.

- [ ] **Step 4: Adopt and delete heartbeats with the game**

In `src/admin/GamesPage.tsx`, in `load`, add `heartbeatList` to the parallel reads and the orphan handling:

```ts
      let [gameList, settingsList, teamList, pelletList, captureList, eventList, heartbeatList] = await Promise.all([
        api.games.list(),
        api.settings.list(),
        api.teams.list(),
        api.pellets.list(),
        api.captures.list(),
        api.events.list(),
        api.heartbeats.list().catch(() => []),
      ]);
      const stray = [...orphans(settingsList), ...orphans(teamList), ...orphans(pelletList), ...orphans(captureList), ...orphans(eventList), ...orphans(heartbeatList)];
```

and in the `Promise.all` of updates:

```ts
          ...orphans(heartbeatList).map(r => api.heartbeats.update({ ...r, gameId })),
```

In `remove`, add `heartbeatList` to the reads (`api.heartbeats.list().catch(() => [])`) and to the deletes:

```ts
        ...mine(heartbeatList).map(r => api.heartbeats.remove(r._id)),
```

Note: `let [... ] = await Promise.all([...])` destructures a tuple; with a `.catch(() => [])` the element type is `Heartbeat[] | never[]`, which is fine for `orphans`. If tsc complains, write `.catch((): Heartbeat[] => [])` and import the type.

- [ ] **Step 5: Typecheck, test**

Run: `pnpm lint && pnpm test`
Expected: clean.

- [ ] **Step 6: Check live**

Dev server up. Admin page for the game: open a team's QR, click "Tilskuer": the QR changes and the caption says "Scan for at kigge med"; the `aria-label` on the QR contains `#/watch/`. Reset a team that has a heartbeat (from Task 6's live check) and run the curl from Task 4 step 4: an empty array.

- [ ] **Step 7: Commit**

```bash
git add src/admin/QrDialog.tsx src/admin/AdminApp.tsx src/admin/GamesPage.tsx src/i18n/da.ts
git commit -m "Admin: spectator QR flip; heartbeats reset and delete with the team

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: README

**Files:**
- Modify: `README.md` (sections "Running the event", "Storage", "Manual checklist before the event")

- [ ] **Step 1: Running the event**

Under `## Running the event`, after the paragraph that describes how a team joins with the QR or code, add:

```markdown
More people than the one holding the phone can follow along. The runner's
phone has "Tilføj tilskuer" on its start screen and in the rules: it shows a
QR for `#/watch/CODE`. A phone that scans it sees the same map, runner dot,
ghosts, countdown and score, a couple of seconds behind, and does no tracking
of its own. The admin's QR dialog can show the same code. Any number of
spectators can watch one team.
```

- [ ] **Step 2: Storage**

Change "Six cruttelut collections." to "Seven cruttelut collections." and add a row to the table:

```markdown
| `ch2cpacman_heartbeats` | one per team, overwritten every 2 s while it runs: `teamId`, `fix` (`lat`, `lng`, `accuracyM`, `at` or null), `ghosts` (the runner phone's ghost state or null), `at` |
```

After the table, add:

```markdown
Heartbeats are not part of the score. The runner's phone writes them so a
spectator can draw the runner and the ghosts; a spectator only reads. A beat
older than 8 s is shown as stale on the spectator's screen. Resetting or
deleting a team removes its heartbeat.
```

- [ ] **Step 3: Manual checklist**

Under `## Manual checklist before the event`, add items:

```markdown
- Spectator: on the runner phone, tap "Tilføj tilskuer" and scan the QR with a
  second phone. After Start, the second phone shows the runner dot and the
  ghosts within a few seconds, and its score follows the runner's.
- Spectator, phone gone quiet: lock the runner phone for 15 s. The spectator's
  runner and ghosts fade and "SIDST SET FOR … S SIDEN" counts up. Unlock: it
  snaps back.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "README: spectators and the heartbeat collection

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end pass and hand-off

**Files:** none changed unless the pass finds a bug.

- [ ] **Step 1: Full suite**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: all clean; the build prints the bundle size and no warnings about the new files.

- [ ] **Step 2: Two-tab browser pass**

Repeat Task 6 step 7 end to end on the final code, and additionally:

- Reload the spectator tab mid game: it comes back as a spectator at `#/watch/<CODE>` with the score intact (score comes from the store, not memory).
- Clear the spectator tab's localStorage and reload with the hash: still a spectator.
- On the spectator, "Skift hold" returns to the code screen and the address becomes `#/`.
- Confirm with the browser's network panel or `performance.getEntriesByType('resource')` that the spectator tab makes only GET requests to cruttelut.

- [ ] **Step 3: Clean up**

Reset any test team in the admin. Stop the dev server. Delete `.playwright-mcp/` if present. `git status` must show a clean tree.

- [ ] **Step 4: Report**

Do not push. Report to the user: the commits made, what the browser pass showed, and that `git push` will deploy.
