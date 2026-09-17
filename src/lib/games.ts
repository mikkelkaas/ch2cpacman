import type { Game, GameScoped } from './types';

/** Records that belong to no game: from before games existed. */
export function orphans<T extends GameScoped>(records: readonly T[]): T[] {
  return records.filter(r => !r.gameId);
}

export function inGame<T extends GameScoped>(records: readonly T[], gameId: string): T[] {
  return records.filter(r => r.gameId === gameId);
}

/**
 * Which game orphaned records should join: the oldest existing game, or none
 * when there is no game yet and one has to be created first.
 */
export function homeForOrphans(games: readonly Game[]): Game | null {
  return [...games].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null;
}

export const FIRST_GAME_NAME = 'Spil 1';
