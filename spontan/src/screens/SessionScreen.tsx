import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSpontan } from '../state/SpontanProvider';
import { ACTIVITY_META, SURFACE_LABELS, VIBE_LABELS } from '../data/types';
import type { Person } from '../data/types';
import { getPerson, getSession, getVenue } from '../domain/selectors';
import { sessionState, signupOf, statusLabel } from '../domain/sessions';
import { pingCandidates } from '../domain/intents';
import { splitTeams } from '../domain/teams';
import { formatCountdown, formatSpan, formatWhen, isToday } from '../lib/datetime';
import { copyText, inviteText } from '../lib/text';
import { Avatar } from '../components/Avatar';
import { ResponseButtons } from '../components/ResponseButtons';
import { IconBack, IconPin, IconShare, IconShuffle, IconUsers } from '../components/icons';

/** Passets egen sida: allt om ett pass, och verktygen för att få ihop det. */
export function SessionScreen() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { db, now, currentPersonId, respond, clearResponse, setSessionCancelled } = useSpontan();
  const [shuffleCount, setShuffleCount] = useState(0);
  const [showTeams, setShowTeams] = useState(false);
  const [copied, setCopied] = useState(false);

  const session = getSession(db, sessionId ?? null);
  const state = useMemo(
    () => (session ? sessionState(session, db.signups, now) : null),
    [session, db.signups, now],
  );

  if (!session || !state) {
    return (
      <div className="empty">
        <span className="empty__icon" aria-hidden="true">
          🤷
        </span>
        <p>Passet finns inte längre.</p>
        <Link className="btn btn--ghost btn--sm" to="/">
          Till flödet
        </Link>
      </div>
    );
  }

  const meta = ACTIVITY_META[session.type];
  const venue = getVenue(db, session.venueId);
  const host = getPerson(db, session.hostId);
  const isHost = currentPersonId === session.hostId;
  const mine = currentPersonId ? signupOf(db.signups, session.id, currentPersonId) : null;
  const closed = state.phase === 'avslutat' || state.phase === 'instalt';

  const people = (ids: string[]): Person[] =>
    ids.map((id) => getPerson(db, id)).filter((p): p is Person => p !== null);

  const going = people(state.going);
  const candidates = people(pingCandidates(db.intents, session, db.signups, now));
  const teams = splitTeams(
    going.map((p) => p.id),
    `${session.id}:${shuffleCount}`,
  );
  const progress = Math.min(100, Math.round((state.goingCount / session.minPlayers) * 100));

  async function share() {
    if (!session) return;
    const url = typeof window === 'undefined' ? '' : window.location.href;
    const ok = await copyText(inviteText(session, venue, url));
    setCopied(ok);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="stack">
      <button type="button" className="backlink" onClick={() => navigate(-1)}>
        <IconBack width={18} height={18} /> Tillbaka
      </button>

      <section className="card stack">
        <div className="row">
          <span className="session-hero__emoji" aria-hidden="true">
            {meta.emoji}
          </span>
          <div className="grow">
            <h1 className="session-hero__title">{meta.label}</h1>
            <div className="section-sub">
              {formatWhen(session.startsAt, now)} · {formatSpan(session.startsAt, session.durationMin)}
              {state.phase === 'kommande' &&
                isToday(session.startsAt, now) &&
                ` · ${formatCountdown(session.startsAt, now)}`}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <div className="detail-row">
            <IconPin width={16} height={16} />
            <span>
              {venue?.name ?? 'Plats saknas'}
              {venue && ` · ${SURFACE_LABELS[venue.surface]}`}
            </span>
          </div>
          {venue?.note && <p className="section-sub">{venue.note}</p>}
          <div className="detail-row">
            <IconUsers width={16} height={16} />
            <span>
              Minst {session.minPlayers}
              {session.maxPlayers ? `, max ${session.maxPlayers}` : ''} · {VIBE_LABELS[session.vibe]}
            </span>
          </div>
          <div className="detail-row">
            <Avatar person={host} size="sm" />
            <span>{host?.name} startade passet</span>
          </div>
        </div>

        {session.note && <p className="session-note">{session.note}</p>}

        <div>
          <div className="row row--between">
            <span className={`pill pill--${closed ? 'muted' : state.needed > 0 ? 'warn' : 'ok'}`}>
              {statusLabel(state)}
            </span>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              {state.goingCount}/{session.minPlayers} för spel
            </span>
          </div>
          <div className="meter">
            <div
              className={`meter__fill${state.needed === 0 ? ' meter__fill--ok' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {!closed && (
          <ResponseButtons
            current={mine?.status ?? null}
            onRespond={(status) => void respond(session.id, status)}
          />
        )}
        {!closed && mine && (
          <button
            type="button"
            className="linkbtn"
            onClick={() => void clearResponse(session.id)}
          >
            Ta bort mitt svar
          </button>
        )}
      </section>

      <section className="card stack">
        <h2 className="section-title">Vilka kommer</h2>
        <PeopleList label="Kommer" ids={state.going} db={db} empty="Ingen har svarat ja än." />
        {state.waitlist.length > 0 && (
          <PeopleList label="Reserver" ids={state.waitlist} db={db} empty="" />
        )}
        {state.maybe.length > 0 && <PeopleList label="Kanske" ids={state.maybe} db={db} empty="" />}
        {state.declined.length > 0 && (
          <PeopleList label="Kan inte" ids={state.declined} db={db} empty="" />
        )}
      </section>

      {!closed && candidates.length > 0 && (
        <section className="card stack">
          <div>
            <h2 className="section-title">Sugna som inte svarat</h2>
            <p className="section-sub">
              De här har sagt att de är sugna på just det här – men har inte sett passet.
            </p>
          </div>
          <div className="people-list">
            {candidates.map((person) => (
              <span key={person.id} className="person-chip">
                <Avatar person={person} size="sm" />
                {person.name}
              </span>
            ))}
          </div>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => void share()}>
            <IconShare width={18} height={18} />
            {copied ? 'Inbjudan kopierad!' : 'Kopiera inbjudan till chatten'}
          </button>
        </section>
      )}

      {going.length >= 4 && !closed && (
        <section className="card stack">
          <div className="row row--between">
            <h2 className="section-title">Lagindelning</h2>
            {showTeams && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setShuffleCount((n) => n + 1)}
              >
                <IconShuffle width={16} height={16} /> Lotta om
              </button>
            )}
          </div>
          {showTeams ? (
            <div className="teams">
              {teams.map((team) => (
                <div key={team.name} className="team">
                  <div className="team__head" style={{ background: team.color }}>
                    {team.name}
                  </div>
                  <ul className="team__list">
                    {team.memberIds.map((id) => (
                      <li key={id}>{getPerson(db, id)?.name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => setShowTeams(true)}
            >
              <IconShuffle width={18} height={18} /> Dela in i två lag
            </button>
          )}
          <p className="section-sub">
            Alla som är anmälda får samma lag på sin telefon. Lotta om så många gånger ni vill.
          </p>
        </section>
      )}

      {isHost && state.phase !== 'avslutat' && (
        <section className="card stack">
          <h2 className="section-title">Du är värd</h2>
          {session.status === 'open' ? (
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => void setSessionCancelled(session.id, true)}
            >
              Ställ in passet
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => void setSessionCancelled(session.id, false)}
            >
              Återuppta passet
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--block" onClick={() => void share()}>
            <IconShare width={18} height={18} />
            {copied ? 'Inbjudan kopierad!' : 'Kopiera inbjudan'}
          </button>
        </section>
      )}
    </div>
  );
}

function PeopleList({
  label,
  ids,
  db,
  empty,
}: {
  label: string;
  ids: string[];
  db: ReturnType<typeof useSpontan>['db'];
  empty: string;
}) {
  const people = ids.map((id) => getPerson(db, id)).filter((p): p is Person => p !== null);
  return (
    <div>
      <div className="list-label">
        {label} <span className="text-muted">({people.length})</span>
      </div>
      {people.length === 0 ? (
        empty && <p className="section-sub">{empty}</p>
      ) : (
        <div className="people-list">
          {people.map((person) => (
            <span key={person.id} className="person-chip">
              <Avatar person={person} size="sm" />
              {person.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
