import { useState } from 'react';
import { LEVEL_LABELS, LEVEL_POINTS, type AdventDoor, type AdventPlace, type Level } from '../data/types';
import { ON_TIME_BONUS } from '../domain/advent';
import { Sheet } from './Sheet';
import { IconCheck, IconClose, IconLock, IconUndo } from './icons';

const PLACE_LABEL: Record<AdventPlace, string> = {
  inne: '🏠 Inne',
  ute: '🌲 Ute',
  hemma: '❤️ Hemma',
  överallt: '⚽ Inne eller ute',
};

export const formatDoorDate = (year: number, day: number): string =>
  new Date(year, 11, day).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

interface DoorSheetProps {
  door: AdventDoor;
  year: number;
  /** Luckan är inte öppnad än – visa bara nedräkning, inte utmaningen. */
  locked: boolean;
  daysLeft: number;
  editable: boolean;
  isToday: boolean;
  currentLevel: Level | null;
  onTime: boolean;
  /** "3 av 9 i laget har klarat den" */
  teamDone: number;
  teamSize: number;
  onComplete: (level: Level) => void;
  onClear: () => void;
  onClose: () => void;
}

export function DoorSheet({
  door,
  year,
  locked,
  daysLeft,
  editable,
  isToday,
  currentLevel,
  onTime,
  teamDone,
  teamSize,
  onComplete,
  onClear,
  onClose,
}: DoorSheetProps) {
  const [selected, setSelected] = useState<Level | null>(currentLevel);
  const done = currentLevel !== null;
  const date = formatDoorDate(year, door.day);

  const levels: Array<[Level, string]> = [
    ['L', door.levelEasyText],
    ['M', door.levelMediumText],
    ['S', door.levelHardText],
  ];

  return (
    <Sheet onClose={onClose} label={locked ? `Lucka ${door.day}` : door.title}>
      <div className="sheet__head">
        <div className="grow">
          <div className="sheet__eyebrow">
            Lucka {door.day} · {date}
          </div>
          <div className="sheet__title">{locked ? `Lucka ${door.day}` : `${door.emoji} ${door.title}`}</div>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Stäng">
          <IconClose width={18} height={18} />
        </button>
      </div>

      {locked ? (
        <div className="stack">
          <div className="door-locked">
            <span className="door-locked__icon" aria-hidden>
              🎁
            </span>
            <div className="door-locked__count">
              {daysLeft === 1 ? 'Öppnas i morgon!' : `Öppnas om ${daysLeft} dagar`}
            </div>
            <p className="section-sub">Ingen tjuvkikning! Utmaningen syns när luckan öppnas {date}.</p>
          </div>
          <button className="btn btn--primary btn--block" onClick={onClose}>
            Okej, jag väntar
          </button>
        </div>
      ) : (
        <>
          <p className="door-intro">{door.intro}</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <span className="chip">{PLACE_LABEL[door.place]}</span>
            {teamSize > 0 && (
              <span className="chip">
                {teamDone} av {teamSize} i laget klara
              </span>
            )}
          </div>

          {isToday && !done && editable && (
            <div className="banner banner--star" style={{ marginBottom: 'var(--space-3)' }}>
              <span className="banner__icon" aria-hidden>
                ⭐
              </span>
              <span>Dagens lucka! Klarar du den idag får du en julstjärna (+{ON_TIME_BONUS} poäng).</span>
            </div>
          )}
          {done && onTime && (
            <div className="banner banner--star" style={{ marginBottom: 'var(--space-3)' }}>
              <span className="banner__icon" aria-hidden>
                ⭐
              </span>
              <span>Klarad samma dag som luckan öppnades. Julstjärnan är din!</span>
            </div>
          )}

          <div className="sheet__eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
            Välj nivå
          </div>
          <div className="levels">
            {levels.map(([level, text]) => {
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
                    <div className="level-option__pts">{LEVEL_POINTS[level]} poäng</div>
                  </span>
                  {active && <IconCheck className="level-option__check" width={20} height={20} />}
                </button>
              );
            })}
          </div>

          {!editable ? (
            <div className="banner banner--archived">
              <IconLock className="banner__icon" width={18} height={18} />
              <span>
                Julkalendern är stängd.
                {done ? ` Du klarade luckan på nivå ${LEVEL_LABELS[currentLevel!]}.` : ''}
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
