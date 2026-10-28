import type { Capture } from './types';

/**
 * The server's captures plus the phone's own (pellet id to ISO time) that the
 * server does not hold yet, so unuploaded dots compete for ownership too. Own
 * records use the pellet id as `clientId`, as the capture engine's score does.
 */
export function withOwnCaptures(server: readonly Capture[], ownTeamId: string, own: ReadonlyMap<string, string>): Capture[] {
  const uploaded = new Set(server.filter(c => c.teamId === ownTeamId).map(c => c.pelletId));
  const local = [...own].filter(([pelletId]) => !uploaded.has(pelletId)).map(([pelletId, capturedAt]) => ({ _id: pelletId, teamId: ownTeamId, pelletId, capturedAt, lat: 0, lng: 0, clientId: pelletId }));
  return [...server, ...local];
}

/** The dots another team owns: pellet id to that team's id. */
export function takenDots(owners: ReadonlyMap<string, string>, teamId: string): Map<string, string> {
  return new Map([...owners].filter(([, owner]) => owner !== teamId));
}

/** The dots this team ate (`mine`, keyed by pellet id) that another team owns: pellet id to that team's id. */
export function lostDots(mine: ReadonlyMap<string, unknown>, owners: ReadonlyMap<string, string>, teamId: string): Map<string, string> {
  return new Map([...takenDots(owners, teamId)].filter(([pelletId]) => mine.has(pelletId)));
}
