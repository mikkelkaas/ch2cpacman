/**
 * The join address: `#/join/<code>`. A phone joins from it after a QR scan,
 * and the running game keeps it there so a reload, or the tab reopened from
 * history, rejoins the team even when localStorage is blocked or cleared.
 */
export function joinCodeFromHash(hash: string): string | null {
  const match = hash.match(/^#\/join\/([A-Za-z0-9]+)/);
  return match ? match[1].toUpperCase() : null;
}

/** Hash for the joined team, or the plain runner route when there is none. */
export function joinHash(code: string | null): string {
  return code ? `#/join/${code}` : '#/';
}

/** Address a phone opens to join a team straight away. */
export function joinUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}${joinHash(code)}`;
}

/**
 * Make the address follow the joined team. `replaceState` fires no
 * `hashchange`, so the router does not remount the runner, and it leaves no
 * history entry to step back through.
 */
export function setJoinHash(code: string | null): void {
  window.history.replaceState(null, '', `${window.location.pathname}${joinHash(code)}`);
}
