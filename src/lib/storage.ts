const TEAM_KEY = 'ch2cpacman.teamId';
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
  isMuted: () => get(MUTED_KEY) === '1',
  setMuted: (muted: boolean) => set(MUTED_KEY, muted ? '1' : '0'),
};
