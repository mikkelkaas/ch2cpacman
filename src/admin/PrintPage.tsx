import { useEffect, useState } from 'react';
import { joinUrl } from '../lib/route';
import { da } from '../i18n/da';
import { api } from '../lib/api';
import { inGame } from '../lib/games';
import type { Game, Team } from '../lib/types';
import QrCode from './QrCode';
import { Button } from './ui';

/**
 * Printable sheet: one card per team with name, code and QR, then a station
 * overview with every code. Uses the browser's print dialog.
 */
export default function PrintPage({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.games.list(), api.teams.list()])
      .then(([games, allTeams]) => {
        if (cancelled) return;
        setGame(games.find(g => g._id === gameId) ?? null);
        setTeams(inGame(allTeams, gameId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const base = `${window.location.origin}${window.location.pathname}`;

  if (error) return <div className="p-8 text-red-700 bg-white min-h-full">{da.fetchFailed}</div>;
  if (game === undefined) return <div className="p-8 text-gray-600 bg-white min-h-full">{da.loading}</div>;
  if (game === null) return <div className="p-8 text-gray-600 bg-white min-h-full">{da.gameNotFound}</div>;

  return (
    <div className="bg-white text-gray-900 min-h-full font-body">
      <div className="print:hidden flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600">
          <a href={`#/admin/${gameId}`} className="text-blue-700 hover:underline">
            ← {da.backToGame}
          </a>
          <span className="mx-2 text-gray-300">·</span>
          {da.printHint}
        </div>
        <Button variant="primary" onClick={() => window.print()}>
          {da.printNow}
        </Button>
      </div>

      <section className="p-6 grid grid-cols-2 gap-6 print:gap-4">
        {teams.map(team => (
          <article key={team._id} className="border-2 border-dashed border-gray-400 rounded-lg p-4 flex gap-4 items-center break-inside-avoid">
            <QrCode text={joinUrl(team.code)} className="w-32 h-32 shrink-0 [&>svg]:w-full [&>svg]:h-full" />
            <div className="min-w-0">
              <div className="text-xs uppercase text-gray-500">{game.name}</div>
              <div className="text-xl font-semibold truncate">{team.name}</div>
              <div className="font-mono text-3xl tracking-[0.25em] my-1">{team.code}</div>
              <div className="text-xs text-gray-600">{da.printCardHint}</div>
              <div className="text-[10px] text-gray-400 break-all">{base}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="p-6 break-before-page">
        <h1 className="text-2xl font-semibold mb-1">{da.stationSheet}</h1>
        <div className="text-gray-500 mb-4">
          {game.name} · {base}
        </div>
        <table className="w-full text-lg">
          <thead className="text-left text-sm text-gray-500 uppercase border-b border-gray-300">
            <tr>
              <th className="py-2">{da.team}</th>
              <th className="py-2">{da.code}</th>
              <th className="py-2 w-1/3">Noter</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {teams.map(team => (
              <tr key={team._id}>
                <td className="py-2 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full border border-gray-400 print:border-gray-600" style={{ background: team.color }} />
                  {team.name}
                </td>
                <td className="py-2 font-mono tracking-widest">{team.code}</td>
                <td className="py-2" />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
