import { useState } from 'react';
import { da } from '../i18n/da';
import type { TeamScore } from '../lib/score';
import { Panel } from './ui';

export default function Scoreboard({ scores }: { scores: readonly TeamScore[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const played = scores.filter(s => s.team.startedAt);

  return (
    <Panel title={da.standings}>
      {played.length === 0 && <p className="text-gray-500 text-sm">{da.noScores}</p>}
      {played.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="py-1 pr-2 w-10">{da.rank}</th>
              <th className="py-1 pr-2">{da.team}</th>
              <th className="py-1 pr-2 text-right">{da.pointsColumn}</th>
              <th className="py-1 pr-2 text-right">{da.eaten}</th>
              <th className="py-1 pr-2 text-right" title={da.caughtColumn}>👻</th>
              <th className="py-1 text-right" title={da.eatenGhostsColumn}>😋</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {played.map((score, i) => {
              const open = openId === score.team._id;
              return (
                <Row key={score.team._id} score={score} rank={i} open={open} onToggle={() => setOpenId(open ? null : score.team._id)} />
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function Row({ score, rank, open, onToggle }: { score: TeamScore; rank: number; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-gray-50">
        <td className="py-2 pr-2 text-gray-500">{rank + 1}.</td>
        <td className="py-2 pr-2">
          <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle border border-gray-300" style={{ background: score.team.color }} />
          <span className="text-gray-900 font-medium">{score.team.name}</span>
        </td>
        <td className="py-2 pr-2 text-right font-semibold text-gray-900 tabular-nums">{score.points}</td>
        <td className="py-2 pr-2 text-right text-gray-700 tabular-nums">{score.pellets.length}</td>
        <td className="py-2 pr-2 text-right text-gray-700 tabular-nums">{score.caught}</td>
        <td className="py-2 text-right text-gray-700 tabular-nums">{score.ghostsEaten}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="pb-3 pl-10 text-xs text-gray-500">
            {score.scored.length === 0 ? '–' : score.scored.map(s => `${s.pellet.name} (${s.pellet.points}${s.multiplier > 1 ? ` ×${s.multiplier}` : ''})`).join(' · ')}
            {score.caught > 0 && ` · ${da.ghostsCaught(score.caught)}`}
            {score.ghostsEaten > 0 && ` · ${da.ghostsEaten(score.ghostsEaten)}`}
          </td>
        </tr>
      )}
    </>
  );
}
