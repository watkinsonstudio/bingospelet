import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpontan } from '../state/SpontanProvider';
import { ACTIVITY_META, ACTIVITY_TYPES } from '../data/types';
import type { ActivityType } from '../data/types';
import { getPerson, getVenue, sessionsIn } from '../domain/selectors';
import { endsAtMs, sessionsForPerson } from '../domain/sessions';
import { intentOf } from '../domain/intents';
import { formatWhen } from '../lib/datetime';
import { describeDayparts, describeTypes, describeWeekdays } from '../lib/text';
import { Avatar } from '../components/Avatar';
import { SessionCard } from '../components/SessionCard';

/** Min sida: profil, mina pass, min sugen-status och demoverktygen. */
export function ProfileScreen() {
  const {
    db,
    now,
    areaId,
    currentPersonId,
    updateProfile,
    clearIntent,
    logout,
    resetDemo,
  } = useSpontan();
  const me = getPerson(db, currentPersonId);
  const [name, setName] = useState(me?.name ?? '');

  if (!me || !currentPersonId) return null;

  const mySessions = sessionsForPerson(sessionsIn(db, areaId), db.signups, currentPersonId);
  const upcoming = mySessions.filter((s) => endsAtMs(s) > now.getTime());
  const past = mySessions.filter((s) => endsAtMs(s) <= now.getTime()).reverse();
  const myIntent = intentOf(db.intents, currentPersonId, now);

  function toggleFavorite(type: ActivityType) {
    if (!me) return;
    const next = me.favoriteTypes.includes(type)
      ? me.favoriteTypes.filter((t) => t !== type)
      : [...me.favoriteTypes, type];
    void updateProfile({ favoriteTypes: next });
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row">
          <Avatar person={me} size="lg" />
          <div className="grow">
            <h1 className="section-title">{me.name}</h1>
            <p className="section-sub">Bara namn och färg sparas – inget mer.</p>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="profile-name">
            Namn
          </label>
          <div className="row">
            <input
              id="profile-name"
              className="input grow"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={name.trim().length < 2 || name.trim() === me.name}
              onClick={() => void updateProfile({ name: name.trim() })}
            >
              Spara
            </button>
          </div>
        </div>

        <div className="field">
          <span className="field__label">Mina favoriter</span>
          <div className="chip-row">
            {ACTIVITY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className="chip chip--toggle"
                aria-pressed={me.favoriteTypes.includes(type)}
                onClick={() => toggleFavorite(type)}
              >
                {ACTIVITY_META[type].emoji} {ACTIVITY_META[type].short}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card stack">
        <div className="row row--between">
          <h2 className="section-title">Min sugen-status</h2>
          <Link to="/sugen" className="btn btn--ghost btn--sm">
            {myIntent ? 'Ändra' : 'Sätt'}
          </Link>
        </div>
        {myIntent ? (
          <>
            <p>{describeTypes(myIntent.types)}</p>
            <p className="section-sub">
              {describeWeekdays(myIntent.weekdays)} · {describeDayparts(myIntent.dayparts)} · gäller
              till {formatWhen(myIntent.expiresAt, now)}
            </p>
            <button type="button" className="linkbtn" onClick={() => void clearIntent()}>
              Ta bort
            </button>
          </>
        ) : (
          <p className="section-sub">
            Du har inte sagt att du är sugen. Gör det – det är så andra hittar dig.
          </p>
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">Mina pass</h2>
        {upcoming.length === 0 ? (
          <div className="empty">
            <span className="empty__icon" aria-hidden="true">
              📅
            </span>
            <p>Du är inte anmäld till något ännu.</p>
            <Link to="/" className="btn btn--primary btn--sm">
              Se vad som är på gång
            </Link>
          </div>
        ) : (
          upcoming.map((session) => <SessionCard key={session.id} session={session} />)
        )}
      </section>

      {past.length > 0 && (
        <section className="card stack">
          <h2 className="section-title">Tidigare</h2>
          {past.slice(0, 5).map((session) => {
            const venue = getVenue(db, session.venueId);
            return (
              <div key={session.id} className="past-row">
                <span aria-hidden="true">{ACTIVITY_META[session.type].emoji}</span>
                <div className="grow">
                  <div>{ACTIVITY_META[session.type].label}</div>
                  <div className="section-sub">
                    {formatWhen(session.startsAt, now)} · {venue?.name}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="card stack">
        <h2 className="section-title">Utkastet</h2>
        <p className="section-sub">
          All data ligger i den här webbläsaren. Nollställ för att få tillbaka demoläget.
        </p>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => void resetDemo()}>
          Nollställ demodata
        </button>
        <button type="button" className="btn btn--danger btn--block" onClick={logout}>
          Byt profil
        </button>
      </section>
    </div>
  );
}
