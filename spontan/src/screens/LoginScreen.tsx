import { useState } from 'react';
import { useSpontan } from '../state/SpontanProvider';
import { ACTIVITY_META, ACTIVITY_TYPES } from '../data/types';
import type { ActivityType } from '../data/types';
import { areaByCode, peopleIn } from '../domain/selectors';
import { Avatar } from '../components/Avatar';

/**
 * Inloggning utan konto: en områdeskod + ett namn. Ingen e-post, inga lösenord,
 * inga kontaktuppgifter – samma snåla hållning som i Sommarbingo.
 */
export function LoginScreen() {
  const { db, login, joinAsNew } = useSpontan();
  const [code, setCode] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [types, setTypes] = useState<ActivityType[]>(['match', 'spontan']);
  const [error, setError] = useState<string | null>(null);

  const people = peopleIn(db, areaId);

  function submitCode(event: React.FormEvent) {
    event.preventDefault();
    const area = areaByCode(db, code);
    if (!area) {
      setError('Ingen sådan områdeskod. Testa SKULTUNA.');
      return;
    }
    setError(null);
    setAreaId(area.id);
  }

  function toggleType(type: ActivityType) {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function createProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!areaId || name.trim().length < 2) {
      setError('Skriv ditt namn (minst två tecken).');
      return;
    }
    await joinAsNew(areaId, name, types);
  }

  return (
    <div className="login">
      <div className="login__brand">
        <div className="login__crest" aria-hidden="true">
          ⚽️
        </div>
        <h1 className="login__title">Spontan</h1>
        <p className="login__tag">
          Säg att du är sugen. Se vilka fler som är det. Kom ut och spela.
        </p>
      </div>

      {!areaId ? (
        <form className="login__card" onSubmit={submitCode}>
          <div className="field">
            <label className="field__label" htmlFor="code">
              Områdeskod
            </label>
            <input
              id="code"
              className="input input--code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SKULTUNA"
              autoComplete="off"
            />
          </div>
          {error && <p className="login__error">{error}</p>}
          <button className="btn btn--primary btn--block" type="submit">
            Fortsätt
          </button>
          <p className="text-muted text-center" style={{ fontSize: '0.8rem' }}>
            Koden får du av den som drog igång Spontan i ditt område.
          </p>
        </form>
      ) : (
        <form className="login__card" onSubmit={createProfile}>
          <div>
            <div className="section-title">Vem är du?</div>
            <div className="section-sub">Välj din profil eller skapa en ny.</div>
          </div>

          {people.length > 0 && (
            <div className="name-grid">
              {people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="name-chip"
                  onClick={() => login(person.id)}
                >
                  <Avatar person={person} size="sm" />
                  {person.name}
                </button>
              ))}
            </div>
          )}

          <div className="divider" />

          <div className="field">
            <label className="field__label" htmlFor="name">
              Ny här – ditt namn
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Förnamn"
              autoComplete="given-name"
            />
          </div>

          <div className="field">
            <span className="field__label">Vad är du oftast sugen på?</span>
            <div className="chip-row">
              {ACTIVITY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="chip chip--toggle"
                  aria-pressed={types.includes(type)}
                  onClick={() => toggleType(type)}
                >
                  {ACTIVITY_META[type].emoji} {ACTIVITY_META[type].short}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="login__error">{error}</p>}

          <button className="btn btn--primary btn--block" type="submit">
            Skapa profil
          </button>
          <button className="btn btn--ghost btn--block" type="button" onClick={() => setAreaId(null)}>
            Byt områdeskod
          </button>
        </form>
      )}
    </div>
  );
}
