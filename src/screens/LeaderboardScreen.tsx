import { useMemo } from 'react';
import { useBingo } from '../state/BingoProvider';
import { getLeaderboard, getTeam, getWeek } from '../domain/selectors';
import { Avatar } from '../components/Avatar';
import { IconArchive, IconCrown } from '../components/icons';

export function LeaderboardScreen() {
  const { db, selectedTeamId, selectedWeekId } = useBingo();

  const team = getTeam(db, selectedTeamId);
  const week = getWeek(db, selectedWeekId);

  const rows = useMemo(
    () => (team && week ? getLeaderboard(db, week.id, team.id) : []),
    [db, team, week],
  );

  if (!team || !week) return null;

  const maxPoints = Math.max(1, ...rows.map((r) => r.points));
  const hasScores = rows.some((r) => r.points > 0);

  return (
    <div className="stack">
      {week.status === 'archived' && (
        <div className="banner banner--archived">
          <IconArchive className="banner__icon" width={18} height={18} />
          <span>Topplista för en arkiverad vecka.</span>
        </div>
      )}

      <div className="card stack">
        <div>
          <div className="section-title">Topplista</div>
          <div className="section-sub">
            {team.name} · {week.theme} · v.{week.weekNumber}
          </div>
        </div>
        <p className="section-sub">Rankas efter poäng – svårare nivåer ger mer. Nollställs varje ny vecka.</p>
      </div>

      {!hasScores ? (
        <div className="card empty">
          <span className="empty__icon">⚽️</span>
          <p>Ingen har samlat poäng ännu den här veckan. Var först!</p>
        </div>
      ) : (
        <div className="stack">
          {rows.map((row) => {
            const first = row.rank === 1 && row.points > 0;
            return (
              <div key={row.player.id} className={`leader ${first ? 'leader--first' : ''}`}>
                <div className="leader__rank">
                  {first ? <IconCrown className="crown" width={22} height={22} /> : row.rank}
                </div>
                <Avatar player={row.player} size="md" />
                <div className="leader__body">
                  <div className="leader__name">{row.player.firstName}</div>
                  <div className="leader__meta">
                    {row.completed} rutor{row.bingos > 0 ? ` · ${row.bingos} bingo` : ''}
                  </div>
                  <div className="leader__bar">
                    <div className="leader__bar-fill" style={{ width: `${(row.points / maxPoints) * 100}%` }} />
                  </div>
                </div>
                <div className="leader__score">
                  <div className="leader__points">{row.points}</div>
                  <div className="leader__points-label">poäng</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
