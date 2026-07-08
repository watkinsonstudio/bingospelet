import { LEVEL_LABELS, type Task } from '../data/types';
import { isFreeCell } from '../domain/board';
import type { TeamCellInfo } from '../domain/selectors';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';
import { IconCheck, IconClose } from './icons';

export function TeamCellSheet({
  task,
  info,
  weekTheme,
  onClose,
}: {
  task: Task;
  info: TeamCellInfo;
  weekTheme: string;
  onClose: () => void;
}) {
  const free = isFreeCell(task.cellIndex);

  return (
    <Sheet onClose={onClose} label={task.title}>
      <div className="sheet__head">
        <div className="grow">
          <div className="sheet__eyebrow">
            Ruta {task.cellIndex + 1} · {weekTheme}
          </div>
          <div className="sheet__title">{task.title}</div>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Stäng">
          <IconClose width={18} height={18} />
        </button>
      </div>

      <div className={`banner ${info.lit ? 'banner--final' : 'banner--archived'}`} style={{ marginBottom: 'var(--space-4)' }}>
        {info.lit ? <IconCheck className="banner__icon" width={18} height={18} /> : null}
        <span>
          {free
            ? 'FRI-rutan är alltid tänd för hela laget.'
            : info.lit
              ? `Tänd! ${info.count} av ${info.threshold} spelare har klarat rutan.`
              : `${info.count} av ${info.threshold} spelare klara – ${Math.max(0, info.threshold - info.count)} kvar tills rutan tänds.`}
        </span>
      </div>

      {!free && (
        <>
          <div className="sheet__eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
            Bidrag ({info.contributors.length})
          </div>
          {info.contributors.length === 0 ? (
            <p className="text-muted">Ingen har klarat den här rutan ännu.</p>
          ) : (
            <div className="stack">
              {info.contributors.map(({ player, entry }) => (
                <div key={player.id} className="row">
                  <Avatar player={player} size="sm" />
                  <span className="grow" style={{ fontWeight: 600 }}>
                    {player.firstName}
                  </span>
                  {info.latestPlayerId === player.id && <span className="tag tag--code">Senast</span>}
                  <span className="tag">{LEVEL_LABELS[entry.level]}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
