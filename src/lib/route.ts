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
