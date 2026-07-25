import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSpontan } from '../state/SpontanProvider';
import { ACTIVITY_META, ACTIVITY_TYPES, SURFACE_LABELS, VIBE_LABELS } from '../data/types';
import type { ActivityType, Vibe } from '../data/types';
import { venuesIn } from '../domain/selectors';
import { fromLocalInput, nextHalfHour, toLocalInput } from '../lib/datetime';

const DURATIONS = [30, 45, 60, 90, 120];
const VIBES: Vibe[] = ['alla', 'lugnt', 'tavling'];

/**
 * Starta pass. Ska gå att fylla i medan man går mot planen: allt har rimliga
 * standardvärden per aktivitet, och kommer man hit från ett förslag i flödet är
 * typ och tid redan ifyllda.
 */
export function CreateScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { db, areaId, createSession } = useSpontan();
  const venues = venuesIn(db, areaId);

  const paramType = params.get('type');
  const initialType: ActivityType = ACTIVITY_TYPES.includes(paramType as ActivityType)
    ? (paramType as ActivityType)
    : 'match';
  const initialMeta = ACTIVITY_META[initialType];

  const [type, setType] = useState<ActivityType>(initialType);
  const [start, setStart] = useState(() => params.get('start') ?? toLocalInput(nextHalfHour()));
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '');
  const [durationMin, setDurationMin] = useState(initialMeta.defaultDurationMin);
  const [minPlayers, setMinPlayers] = useState(String(initialMeta.defaultMin));
  const [maxPlayers, setMaxPlayers] = useState(
    initialMeta.defaultMax === null ? '' : String(initialMeta.defaultMax),
  );
  const [vibe, setVibe] = useState<Vibe>('alla');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const meta = ACTIVITY_META[type];

  function changeType(next: ActivityType) {
    const nextMeta = ACTIVITY_META[next];
    setType(next);
    setDurationMin(nextMeta.defaultDurationMin);
    setMinPlayers(String(nextMeta.defaultMin));
    setMaxPlayers(nextMeta.defaultMax === null ? '' : String(nextMeta.defaultMax));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const startsAt = fromLocalInput(start);
    const min = Number(minPlayers);
    const max = maxPlayers.trim() === '' ? null : Number(maxPlayers);

    if (!venueId) return setError('Välj en plats.');
    if (!startsAt) return setError('Välj en tid.');
    if (!Number.isFinite(min) || min < 1) return setError('Minsta antal måste vara minst 1.');
    if (max !== null && (!Number.isFinite(max) || max < min)) {
      return setError('Max kan inte vara mindre än minsta antal.');
    }

    const id = await createSession({
      type,
      venueId,
      startsAt,
      durationMin,
      minPlayers: min,
      maxPlayers: max,
      vibe,
      note: note || null,
    });
    if (id) navigate(`/pass/${id}`, { replace: true });
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div>
        <h1 className="section-title">Starta ett pass</h1>
        <p className="section-sub">Du räknas automatiskt som anmäld.</p>
      </div>

      <section className="card stack">
        <div className="field">
          <span className="field__label">Vad ska ni göra?</span>
          <div className="chip-row">
            {ACTIVITY_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                className="chip chip--toggle"
                aria-pressed={type === option}
                onClick={() => changeType(option)}
              >
                {ACTIVITY_META[option].emoji} {ACTIVITY_META[option].short}
              </button>
            ))}
          </div>
          <p className="section-sub">{meta.hint}</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="venue">
            Var?
          </label>
          <select
            id="venue"
            className="input"
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
          >
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name} ({SURFACE_LABELS[venue.surface].toLowerCase()})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="start">
            När?
          </label>
          <input
            id="start"
            className="input"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field__label">Hur länge?</span>
          <div className="chip-row">
            {DURATIONS.map((option) => (
              <button
                key={option}
                type="button"
                className="chip chip--toggle"
                aria-pressed={durationMin === option}
                onClick={() => setDurationMin(option)}
              >
                {option} min
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card stack">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field grow">
            <label className="field__label" htmlFor="min">
              Minst antal
            </label>
            <input
              id="min"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              value={minPlayers}
              onChange={(e) => setMinPlayers(e.target.value)}
            />
          </div>
          <div className="field grow">
            <label className="field__label" htmlFor="max">
              Max (valfritt)
            </label>
            <input
              id="max"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Inget tak"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
            />
          </div>
        </div>
        <p className="section-sub">
          Passet visas som &quot;behöver X till&quot; tills minsta antal är uppnått. Anmälningar
          utöver max hamnar på reservplats.
        </p>

        <div className="field">
          <span className="field__label">Nivå</span>
          <div className="chip-row">
            {VIBES.map((option) => (
              <button
                key={option}
                type="button"
                className="chip chip--toggle"
                aria-pressed={vibe === option}
                onClick={() => setVibe(option)}
              >
                {VIBE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="note">
            Något mer att veta?
          </label>
          <textarea
            id="note"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ta med mörk och ljus tröja. Jag har bollar."
          />
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}

      <button className="btn btn--primary btn--block" type="submit">
        Starta passet
      </button>
    </form>
  );
}
