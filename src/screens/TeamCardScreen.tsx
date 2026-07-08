import { useMemo, useState } from 'react';
import { useBingo } from '../state/BingoProvider';
import { isFreeCell, cellsInCompleteLines } from '../domain/board';
import {
  getTask,
  getTasks,
  getTeam,
  getTeamCellInfo,
  getTeamSummary,
  getWeek,
} from '../domain/selectors';
import { BingoBoard } from '../components/BingoBoard';
import { TeamCellSheet } from '../components/TeamCellSheet';
import { IconArchive, IconInfo } from '../components/icons';

const MAX_BADGES = 5;

export function TeamCardScreen() {
  const { db, selectedTeamId, selectedWeekId } = useBingo();
  const [openCell, setOpenCell] = useState<number | null>(null);

  const team = getTeam(db, selectedTeamId);
  const week = getWeek(db, selectedWeekId);

  const summary = useMemo(
    () => (team && week ? getTeamSummary(db, week.id, team.id) : null),
    [db, team, week],
  );

  if (!team || !week || !summary) return null;

  const tasks = getTasks(db, week.id);
  const teamBingoCells = cellsInCompleteLines(summary.litCells);
  const openInfo = openCell !== null ? getTeamCellInfo(db, week.id, team.id, openCell) : null;
  const openTask = openCell !== null ? getTask(db, week.id, openCell) : null;

  return (
    <div className="stack">
      {week.status === 'archived' && (
        <div className="banner banner--archived">
          <IconArchive className="banner__icon" width={18} height={18} />
          <span>Arkiverad vecka – skrivskyddad, men allt är synligt.</span>
        </div>
      )}

      <div className="card stack">
        <div>
          <div className="section-title">Lagets bricka</div>
          <div className="section-sub">{team.name}</div>
        </div>
        <div className="banner" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-strong)' }}>
          <IconInfo className="banner__icon" width={18} height={18} />
          <span>
            En ruta tänds när minst <strong>{summary.threshold}</strong> av lagets {summary.playerCount} spelare klarat
            den – oavsett nivå.
          </span>
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="stat__value">{summary.litCount}/25</div>
            <div className="stat__label">Tända</div>
          </div>
          <div className="stat">
            <div className="stat__value">{summary.teamBingos}</div>
            <div className="stat__label">Lagbingo</div>
          </div>
          <div className="stat">
            <div className="stat__value">{summary.playerCount}</div>
            <div className="stat__label">Spelare</div>
          </div>
        </div>
      </div>

      <BingoBoard label="Lagets bingobricka">
        {tasks.map((task) => {
          const i = task.cellIndex;
          const free = isFreeCell(i);
          const info = getTeamCellInfo(db, week.id, team.id, i);
          const classes = [
            'cell',
            'cell--team',
            free ? 'cell--free' : '',
            info.lit && !free ? 'cell--lit' : '',
            teamBingoCells.has(i) ? 'cell--in-bingo' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const shown = info.contributors.slice(0, MAX_BADGES);
          const extra = info.contributors.length - shown.length;

          return (
            <button
              key={i}
              className={classes}
              onClick={() => setOpenCell(i)}
              aria-label={`${task.title}: ${free ? 'fri ruta' : `${info.count} av ${info.threshold} klara`}`}
            >
              {!free && (
                <span className="cell__counter">
                  {info.count}/{info.threshold}
                </span>
              )}
              <span className="cell__title">{task.title}</span>
              {!free && (
                <div className="badges">
                  {shown.map(({ player, entry }) => (
                    <span
                      key={entry.id}
                      className={`badge ${info.latestPlayerId === player.id ? 'badge--latest' : ''}`}
                      style={{ background: player.color }}
                      title={player.firstName}
                    >
                      {player.firstName.charAt(0)}
                    </span>
                  ))}
                  {extra > 0 && <span className="badge badge--more">+{extra}</span>}
                </div>
              )}
            </button>
          );
        })}
      </BingoBoard>

      {openInfo && openTask && (
        <TeamCellSheet task={openTask} info={openInfo} weekTheme={week.theme} onClose={() => setOpenCell(null)} />
      )}
    </div>
  );
}
