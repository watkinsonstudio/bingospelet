import { useState } from 'react';
import { LEVEL_LABELS, LEVEL_POINTS, type Level, type Task } from '../data/types';
import { isFreeCell } from '../domain/board';
import { Sheet } from './Sheet';
import { getExerciseArt } from './exerciseArt';
import { IconCheck, IconClose, IconLock, IconPlay, IconUndo } from './icons';

interface TaskSheetProps {
  task: Task;
  weekTheme: string;
  currentLevel: Level | null;
  editable: boolean;
  onComplete: (level: Level) => void;
  onClear: () => void;
  onClose: () => void;
}

interface LevelDef {
  level: Level;
  text: string;
}

export function TaskSheet({
  task,
  weekTheme,
  currentLevel,
  editable,
  onComplete,
  onClear,
  onClose,
}: TaskSheetProps) {
  const levelDefs = ([
    ['L', task.levelEasyText],
    ['M', task.levelMediumText],
    ['S', task.levelHardText],
  ] as const)
    .filter(([, text]) => text && text.trim().length > 0)
    .map(([level, text]) => ({ level, text: text as string })) as LevelDef[];

  const multiLevel = levelDefs.length > 1;
  const done = currentLevel !== null;
  const [selected, setSelected] = useState<Level | null>(currentLevel ?? (multiLevel ? null : 'L'));

  const free = isFreeCell(task.cellIndex);
  const art = getExerciseArt(task.title);

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

      {free ? (
        <div className="stack">
          <div className="banner banner--final">
            <IconCheck className="banner__icon" width={18} height={18} />
            <span>Det här är FRI-rutan – den räknas alltid som klar. Den ger inga poäng men hjälper dina rader.</span>
          </div>
          <button className="btn btn--primary btn--block" onClick={onClose}>
            Okej!
          </button>
        </div>
      ) : (
        <>
          {/* Yta för demo-animation/video (spec avsnitt 7).
              Prioritet: riktig film → line-art-illustration → platshållare. */}
          <div className={`media-slot${art && !task.animationUrl ? ' media-slot--art' : ''}`}>
            {task.animationUrl ? (
              <video src={task.animationUrl} controls playsInline style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />
            ) : art ? (
              art
            ) : (
              <>
                <IconPlay width={26} height={26} />
                <span>Demo-film läggs till senare</span>
              </>
            )}
          </div>

          {multiLevel && (
            <>
              <div className="sheet__eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
                Välj nivå
              </div>
              <div className="levels">
                {levelDefs.map(({ level, text }) => {
                  const active = selected === level;
                  return (
                    <button
                      key={level}
                      className={`level-option lvl-${level}`}
                      aria-pressed={active}
                      disabled={!editable}
                      onClick={() => editable && setSelected(level)}
                    >
                      <span className="level-option__tag">{LEVEL_LABELS[level]}</span>
                      <span className="grow">
                        <span className="level-option__text">{text}</span>
                        <div className="level-option__pts">
                          {LEVEL_POINTS[level]} {LEVEL_POINTS[level] === 1 ? 'poäng' : 'poäng'}
                        </div>
                      </span>
                      {active && <IconCheck className="level-option__check" width={20} height={20} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {!editable ? (
            <div className="banner banner--archived">
              <IconLock className="banner__icon" width={18} height={18} />
              <span>
                {done
                  ? `Arkiverad vecka – du klarade den här på nivå ${LEVEL_LABELS[currentLevel!]}.`
                  : 'Arkiverad vecka – skrivskyddad.'}
              </span>
            </div>
          ) : (
            <div className="sheet__actions">
              {done && (
                <button className="btn btn--ghost" onClick={onClear} aria-label="Ångra">
                  <IconUndo width={18} height={18} />
                  Ångra
                </button>
              )}
              <button
                className="btn btn--primary btn--block"
                disabled={selected === null || (done && selected === currentLevel)}
                onClick={() => selected && onComplete(selected)}
              >
                <IconCheck width={18} height={18} />
                {done ? (selected === currentLevel ? 'Klarad' : 'Byt nivå') : 'Klarat!'}
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
