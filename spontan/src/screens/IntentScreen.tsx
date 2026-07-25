import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpontan } from '../state/SpontanProvider';
import {
  ACTIVITY_META,
  ACTIVITY_TYPES,
  DAYPARTS,
  DAYPART_LABELS,
  WEEKDAY_LABELS,
} from '../data/types';
import type { ActivityType, Daypart } from '../data/types';
import { getPerson } from '../domain/selectors';
import { activeIntents, intentOf } from '../domain/intents';
import { describeDayparts, describeTypes, describeWeekdays } from '../lib/text';
import { Avatar } from '../components/Avatar';
import { IconHand } from '../components/icons';

const DURATION_CHOICES = [3, 7, 14];
/** Veckodagar i svensk ordning (måndag först), värden enligt Date#getDay. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * "Jag är sugen" – behovet appen finns för. Ingen tid bokas: man säger vad man
 * vill göra och ungefär när, och appen letar upp överlappen åt en.
 */
export function IntentScreen() {
  const { db, now, areaId, currentPersonId, saveIntent, clearIntent } = useSpontan();
  const existing = currentPersonId ? intentOf(db.intents, currentPersonId, now) : null;
  const me = getPerson(db, currentPersonId);

  const [types, setTypes] = useState<ActivityType[]>(
    existing?.types ?? me?.favoriteTypes ?? ['match'],
  );
  const [weekdays, setWeekdays] = useState<number[]>(existing?.weekdays ?? []);
  const [dayparts, setDayparts] = useState<Daypart[]>(existing?.dayparts ?? ['kvall']);
  const [note, setNote] = useState(existing?.note ?? '');
  const [days, setDays] = useState(7);
  const [saved, setSaved] = useState(false);

  const others = activeIntents(db.intents, now)
    .filter((i) => i.areaId === areaId && i.personId !== currentPersonId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function toggle<T>(list: T[], value: T, set: (next: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await saveIntent({ types, weekdays, dayparts, note: note || null, days });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="stack">
      <div>
        <h1 className="section-title">
          <IconHand width={20} height={20} /> Jag är sugen
        </h1>
        <p className="section-sub">
          Ingen tid bokas. Du säger vad du vill göra – appen säger till när fler vill samma sak.
        </p>
      </div>

      <form className="card stack" onSubmit={submit}>
        <div className="field">
          <span className="field__label">Vad är du sugen på?</span>
          <div className="chip-row">
            {ACTIVITY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className="chip chip--toggle"
                aria-pressed={types.includes(type)}
                onClick={() => toggle(types, type, setTypes)}
              >
                {ACTIVITY_META[type].emoji} {ACTIVITY_META[type].short}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">Vilka dagar?</span>
          <div className="chip-row">
            {WEEKDAY_ORDER.map((day) => (
              <button
                key={day}
                type="button"
                className="chip chip--toggle"
                aria-pressed={weekdays.includes(day)}
                onClick={() => toggle(weekdays, day, setWeekdays)}
              >
                {WEEKDAY_LABELS[day]}
              </button>
            ))}
          </div>
          <p className="section-sub">Välj inget = alla dagar funkar.</p>
        </div>

        <div className="field">
          <span className="field__label">När på dagen?</span>
          <div className="chip-row">
            {DAYPARTS.map((part) => (
              <button
                key={part}
                type="button"
                className="chip chip--toggle"
                aria-pressed={dayparts.includes(part)}
                onClick={() => toggle(dayparts, part, setDayparts)}
              >
                {DAYPART_LABELS[part]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="intent-note">
            Något att tillägga?
          </label>
          <textarea
            id="intent-note"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Har bollar och västar. Kan hämta någon på vägen."
          />
        </div>

        <div className="field">
          <span className="field__label">Hur länge gäller det?</span>
          <div className="chip-row">
            {DURATION_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className="chip chip--toggle"
                aria-pressed={days === choice}
                onClick={() => setDays(choice)}
              >
                {choice} dagar
              </button>
            ))}
          </div>
          <p className="section-sub">
            Sugen-statusen försvinner av sig själv – ingen behöver städa i gamla önskemål.
          </p>
        </div>

        <button className="btn btn--primary btn--block" type="submit" disabled={types.length === 0}>
          {saved ? 'Sparat!' : existing ? 'Uppdatera' : 'Jag är sugen'}
        </button>
        {existing && (
          <button type="button" className="linkbtn" onClick={() => void clearIntent()}>
            Ta bort min sugen-status
          </button>
        )}
      </form>

      <section className="stack">
        <div className="row row--between">
          <h2 className="section-title">Andra som är sugna</h2>
          <Link to="/starta" className="btn btn--ghost btn--sm">
            Starta pass
          </Link>
        </div>

        {others.length === 0 ? (
          <div className="empty">
            <span className="empty__icon" aria-hidden="true">
              🫥
            </span>
            <p>Ingen annan har sagt något än. Var först – då ser andra dig.</p>
          </div>
        ) : (
          others.map((intent) => {
            const person = getPerson(db, intent.personId);
            return (
              <article key={intent.id} className="intent-row">
                <Avatar person={person} size="md" />
                <div className="grow">
                  <div className="intent-row__name">{person?.name}</div>
                  <div className="intent-row__meta">{describeTypes(intent.types)}</div>
                  <div className="intent-row__meta">
                    {describeWeekdays(intent.weekdays)} · {describeDayparts(intent.dayparts)}
                  </div>
                  {intent.note && <p className="intent-row__note">”{intent.note}”</p>}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
