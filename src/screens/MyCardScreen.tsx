import { useMemo, useState } from 'react';
import { useBingo } from '../state/BingoProvider';
import { FREE_CELL_INDEX, LEVEL_LABELS, type Level } from '../data/types';
import { cellsInCompleteLines, isFreeCell } from '../domain/board';
import { completedCells } from '../domain/scoring';
import {
  finalUnlockedFor,
  getPersonalSummary,
  getPlayer,
  getTask,
  getTasks,
  getWeek,
  isCellEditableForPlayer,
} from '../domain/selectors';
import { BingoBoard } from '../components/BingoBoard';
import { TaskSheet } from '../components/TaskSheet';
import { IconArchive, IconCheck } from '../components/icons';

export function MyCardScreen() {
  const { db, currentPlayerId, selectedWeekId, completeCell, clearCell } = useBingo();
  const [openCell, setOpenCell] = useState<number | null>(null);

  const player = getPlayer(db, currentPlayerId);
  const week = getWeek(db, selectedWeekId);

  const summary = useMemo(
    () => (week && player ? getPersonalSummary(db, week.id, player.id) : null),
    [db, week, player],
  );

  if (!player || !week || !summary) return null;

  const tasks = getTasks(db, week.id);
  const levelByCell = new Map<number, Level>(summary.entries.map((e) => [e.cellIndex, e.level]));
  const completed = completedCells(summary.entries);
  const bingoCells = cellsInCompleteLines(completed);

  const archived = week.status === 'archived';
  const finalUnlocked = finalUnlockedFor(db, player.teamId);
  const openTask = openCell !== null ? getTask(db, week.id, openCell) : null;

  return (
    <div className="stack">
      {archived && (
        <div className="banner banner--archived">
          <IconArchive className="banner__icon" width={18} height={18} />
          <span>
            Arkiverad vecka (v.{week.weekNumber} · {week.dateRange}) – skrivskyddad.
            {finalUnlocked && ' Finalen är upplåst: rutor som ännu inte tänts går att klara.'}
          </span>
        </div>
      )}

      <div className="card stack">
        <div>
          <div className="section-title">Min bricka</div>
          <div className="section-sub">
            {week.theme} · v.{week.weekNumber}
          </div>
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="stat__value">{summary.completedCells}/25</div>
            <div className="stat__label">Klarade</div>
          </div>
          <div className="stat">
            <div className="stat__value">{summary.points}</div>
            <div className="stat__label">Poäng</div>
          </div>
          <div className="stat">
            <div className="stat__value">{summary.bingos}</div>
            <div className="stat__label">Bingo</div>
          </div>
        </div>
      </div>

      <BingoBoard label="Min bingobricka">
        {tasks.map((task) => {
          const i = task.cellIndex;
          const free = isFreeCell(i);
          const level = levelByCell.get(i);
          const done = free || level !== undefined;
          const classes = [
            'cell',
            free ? 'cell--free' : '',
            done && !free ? `cell--done cell--${level}` : '',
            bingoCells.has(i) ? 'cell--in-bingo' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={i}
              className={classes}
              onClick={() => setOpenCell(i)}
              aria-label={`${task.title}${done ? ', klarad' : ''}`}
            >
              {!free && <span className="cell__index">{i + 1}</span>}
              <span className="cell__title">{task.title}</span>
              {done && (
                <span className="cell__mark">
                  <IconCheck width={13} height={13} />
                </span>
              )}
            </button>
          );
        })}
      </BingoBoard>

      <div className="card">
        <div className="legend">
          <span className="legend__item">
            <span className="legend__swatch" style={{ background: 'var(--level-easy)' }} /> {LEVEL_LABELS.L} · 1p
          </span>
          <span className="legend__item">
            <span className="legend__swatch" style={{ background: 'var(--level-medium)' }} /> {LEVEL_LABELS.M} · 2p
          </span>
          <span className="legend__item">
            <span className="legend__swatch" style={{ background: 'var(--level-hard)' }} /> {LEVEL_LABELS.S} · 3p
          </span>
          <span className="legend__item">
            <span className="legend__swatch" style={{ background: 'var(--color-green)' }} /> FRI
          </span>
        </div>
      </div>

      {openTask && (
        <TaskSheet
          task={openTask}
          weekTheme={week.theme}
          currentLevel={levelByCell.get(openTask.cellIndex) ?? null}
          editable={
            openTask.cellIndex !== FREE_CELL_INDEX &&
            isCellEditableForPlayer(db, week, player.teamId, openTask.cellIndex)
          }
          onComplete={(lvl) => {
            void completeCell(openTask.cellIndex, lvl);
            setOpenCell(null);
          }}
          onClear={() => {
            void clearCell(openTask.cellIndex);
            setOpenCell(null);
          }}
          onClose={() => setOpenCell(null)}
        />
      )}
    </div>
  );
}
