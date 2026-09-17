import { useState } from 'react';
import { da } from '../i18n/da';
import type { TeamScore } from '../lib/score';

const ORDINALS = ['1ST', '2ND', '3RD'];
const ordinal = (i: number) => ORDINALS[i] ?? `${i + 1}TH`;

export default function Scoreboard({ scores }: { scores: readonly TeamScore[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const played = scores.filter(s => s.team.startedAt);

  return (
    <section className="border-4 border-maze p-4 flex flex-col gap-3">
      <h2 className="font-arcade text-pac glow-pac text-sm text-center blink-slow">{da.highScores}</h2>
      {played.length === 0 && <p className="text-gray-500 text-sm text-center">{da.noScores}</p>}
      {played.length > 0 && (
        <table className="w-full font-arcade text-[10px] sm:text-xs">
          <thead className="text-pellet">
            <tr>
              <th className="text-left py-1">{da.rank}</th>
              <th className="text-left py-1">{da.team}</th>
              <th className="text-right py-1">{da.score}</th>
              <th className="text-right py-1">{da.eaten}</th>
            </tr>
          </thead>
          <tbody>
            {played.map((score, i) => (
              <Row key={score.team._id} score={score} rank={i} open={openId === score.team._id} onToggle={() => setOpenId(openId === score.team._id ? null : score.team._id)} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Row({ score, rank, open, onToggle }: { score: TeamScore; rank: number; open: boolean; onToggle: () => void }) {
  const color = rank === 0 ? 'text-pac' : rank === 1 ? 'text-ghost-cyan' : rank === 2 ? 'text-ghost-pink' : 'text-gray-200';
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer ${color}`}>
        <td className="py-2">{ordinal(rank)}</td>
        <td className="py-2 truncate max-w-[10rem]">
          <span className="inline-block w-2 h-2 mr-2 align-middle" style={{ background: score.team.color }} />
          {score.team.name}
        </td>
        <td className="py-2 text-right tabular-nums">{String(score.points).padStart(6, '0')}</td>
        <td className="py-2 text-right tabular-nums">{score.pellets.length}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4} className="pb-3 font-body text-xs text-gray-400">
            {score.pellets.length === 0 ? '–' : score.pellets.map(p => `${p.name} (${p.points})`).join(' · ')}
          </td>
        </tr>
      )}
    </>
  );
}
