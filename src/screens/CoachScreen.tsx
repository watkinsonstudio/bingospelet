import { useState } from 'react';
import { CLUB_ID, useBingo } from '../state/BingoProvider';
import { FREE_CELL_INDEX, type Task } from '../data/types';
import { getActiveWeek, getClubWeeks, getTasks, getTeamMembers, getWeek } from '../domain/selectors';
import { IconArchive, IconCheck, IconUnlock, IconWhistle } from '../components/icons';

export function CoachScreen() {
  const { db, selectedWeekId, isCoach, updateTask, archiveWeek, createNextWeek, resetDemo } = useBingo();
  const [newTheme, setNewTheme] = useState('');

  if (!isCoach) return null;

  const week = getWeek(db, selectedWeekId) ?? getActiveWeek(db, CLUB_ID);
  const activeWeek = getActiveWeek(db, CLUB_ID);
  const weeks = getClubWeeks(db, CLUB_ID);
  const tasks = week ? getTasks(db, week.id) : [];
  const clubTeams = db.teams.filter((t) => t.clubId === CLUB_ID);

  return (
    <div className="stack">
      <div className="card stack">
        <div className="section-title">
          <IconWhistle width={22} height={22} /> Coach
        </div>
        <p className="section-sub">
          Lägg upp veckans uppgifter, arkivera och se alla lag. Använd veckoväljaren högst upp för att välja vilken
          vecka du redigerar.
        </p>
      </div>

      {/* Skapa ny vecka */}
      <div className="card stack">
        <div className="section-title" style={{ fontSize: '1rem' }}>
          Ny vecka
        </div>
        <p className="section-sub">Skapar en ny aktiv bricka. Nuvarande aktiva vecka arkiveras automatiskt.</p>
        <div className="field">
          <input
            className="input"
            placeholder="Tema, t.ex. Avslutsveckan"
            value={newTheme}
            onChange={(e) => setNewTheme(e.target.value)}
          />
        </div>
        <button
          className="btn btn--primary btn--block"
          disabled={!newTheme.trim()}
          onClick={() => {
            void createNextWeek(newTheme);
            setNewTheme('');
          }}
        >
          Skapa &amp; aktivera
        </button>
      </div>

      {/* Redigera veckans uppgifter */}
      {week && (
        <div className="card stack">
          <div className="row row--between">
            <div className="section-title" style={{ fontSize: '1rem' }}>
              Redigera v.{week.weekNumber}
            </div>
            <span className={`tag ${week.status === 'active' ? 'tag--code' : ''}`}>
              {week.status === 'active' ? 'Aktiv' : week.status === 'archived' ? 'Arkiverad' : 'Kommande'}
            </span>
          </div>
          {week.status === 'archived' && (
            <div className="banner banner--archived">
              <IconArchive className="banner__icon" width={18} height={18} />
              <span>Den här veckan är arkiverad. Ändringar påverkar historiken – redigera helst aktiv vecka.</span>
            </div>
          )}
          <div className="stack">
            {tasks.map((task) => (
              <TaskEditor key={task.id} task={task} onSave={updateTask} />
            ))}
          </div>
        </div>
      )}

      {/* Arkivera */}
      {activeWeek && (
        <div className="card stack">
          <div className="section-title" style={{ fontSize: '1rem' }}>
            Arkivera veckan
          </div>
          <p className="section-sub">
            Sätter v.{activeWeek.weekNumber} ({activeWeek.theme}) till arkiverad och skrivskyddad. Ingen data raderas.
          </p>
          <button className="btn btn--ghost btn--block" onClick={() => void archiveWeek(activeWeek.id)}>
            <IconArchive width={18} height={18} /> Arkivera v.{activeWeek.weekNumber}
          </button>
        </div>
      )}

      {/* Alla lag */}
      <div className="card stack">
        <div className="section-title" style={{ fontSize: '1rem' }}>
          Alla lag
        </div>
        {clubTeams.map((t) => {
          const members = getTeamMembers(db, t.id);
          const players = members.filter((m) => m.role === 'player').length;
          return (
            <div key={t.id} className="team-manage">
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <div className="leader__meta">
                  {players} spelare · {members.length - players} coach
                </div>
              </div>
              <span className="tag tag--code">{t.joinCode}</span>
            </div>
          );
        })}
        <p className="section-sub">Sommarfinalen låses upp per lag under fliken Final.</p>
      </div>

      {/* Demo */}
      <div className="card stack">
        <div className="section-title" style={{ fontSize: '1rem' }}>
          Demo
        </div>
        <p className="section-sub">
          All data lagras lokalt i den här webbläsaren. Nollställ för att återgå till exempeldatan.
        </p>
        <button className="btn btn--danger btn--block" onClick={() => void resetDemo()}>
          Nollställ demodata
        </button>
        <div className="row" style={{ gap: 'var(--space-2)', color: 'var(--color-text-faint)', fontSize: '0.75rem' }}>
          <IconUnlock width={14} height={14} />
          <span>{weeks.length} veckor i biblioteket.</span>
        </div>
      </div>
    </div>
  );
}

/** Redigerar en enskild uppgift. Lokalt state, sparar vid blur. */
function TaskEditor({
  task,
  onSave,
}: {
  task: Task;
  onSave: (id: string, patch: Partial<Omit<Task, 'id' | 'weekId' | 'cellIndex'>>) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [easy, setEasy] = useState(task.levelEasyText ?? '');
  const [medium, setMedium] = useState(task.levelMediumText ?? '');
  const [hard, setHard] = useState(task.levelHardText ?? '');

  if (task.cellIndex === FREE_CELL_INDEX) {
    return (
      <div className="coach-task">
        <div className="coach-task__head">
          <span className="coach-task__cell">{task.cellIndex + 1}</span>
          <span>FRI RUTA (räknas alltid som klar)</span>
        </div>
      </div>
    );
  }

  const commit = (patch: Partial<Omit<Task, 'id' | 'weekId' | 'cellIndex'>>) => {
    void onSave(task.id, patch);
  };

  return (
    <div className="coach-task">
      <div className="coach-task__head">
        <span className="coach-task__cell">{task.cellIndex + 1}</span>
        <input
          className="input"
          style={{ minHeight: 38 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== task.title && commit({ title: title.trim() || task.title })}
          aria-label={`Titel ruta ${task.cellIndex + 1}`}
        />
      </div>
      <LevelField label="Lätt" value={easy} onChange={setEasy} onBlur={() => commit({ levelEasyText: emptyToNull(easy) })} />
      <LevelField
        label="Medel"
        value={medium}
        onChange={setMedium}
        onBlur={() => commit({ levelMediumText: emptyToNull(medium) })}
      />
      <LevelField label="Svår" value={hard} onChange={setHard} onBlur={() => commit({ levelHardText: emptyToNull(hard) })} />
    </div>
  );
}

function LevelField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}>
      <span className="tag" style={{ marginTop: 8, width: 52, justifyContent: 'center', flexShrink: 0 }}>
        {label}
      </span>
      <input
        className="input grow"
        style={{ minHeight: 38 }}
        value={value}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {value.trim() && <IconCheck width={16} height={16} className="text-muted" style={{ marginTop: 11 }} />}
    </label>
  );
}

const emptyToNull = (s: string): string | null => (s.trim() ? s.trim() : null);
