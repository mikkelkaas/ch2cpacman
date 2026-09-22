import type { Role } from './route';

const TEAM_KEY = 'ch2cpacman.teamId';
const ROLE_KEY = 'ch2cpacman.role';
const MUTED_KEY = 'ch2cpacman.muted';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the session still works until reload.
  }
}

export const storage = {
  getTeamId: () => get(TEAM_KEY),
  setTeamId: (id: string | null) => set(TEAM_KEY, id),
  /** Runner unless the phone chose to watch. */
  getRole: (): Role => (get(ROLE_KEY) === 'spectator' ? 'spectator' : 'runner'),
  setRole: (role: Role | null) => set(ROLE_KEY, role),
  isMuted: () => get(MUTED_KEY) === '1',
  setMuted: (muted: boolean) => set(MUTED_KEY, muted ? '1' : '0'),
};
