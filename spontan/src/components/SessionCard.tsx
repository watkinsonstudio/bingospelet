import { Link } from 'react-router-dom';
import { useSpontan } from '../state/SpontanProvider';
import { ACTIVITY_META } from '../data/types';
import type { Session } from '../data/types';
import { getPerson, getVenue } from '../domain/selectors';
import { sessionState, signupOf, statusLabel } from '../domain/sessions';
import { formatCountdown, formatSpan, formatWhen, isToday } from '../lib/datetime';
import { AvatarStack } from './Avatar';
import { ResponseButtons } from './ResponseButtons';
import { IconPin } from './icons';

/** Ett pass i flödet: när, var, blir det av – och svara direkt utan att öppna. */
export function SessionCard({ session }: { session: Session }) {
  const { db, now, currentPersonId, respond } = useSpontan();
  const meta = ACTIVITY_META[session.type];
  const venue = getVenue(db, session.venueId);
  const state = sessionState(session, db.signups, now);
  const mine = currentPersonId ? signupOf(db.signups, session.id, currentPersonId) : null;
  const going = state.going.map((id) => getPerson(db, id)).filter(Boolean) as NonNullable<
    ReturnType<typeof getPerson>
  >[];

  const tone =
    state.phase !== 'kommande' && state.phase !== 'pagar'
      ? 'muted'
      : state.needed > 0
        ? 'warn'
        : 'ok';

  return (
    <article className={`session-card session-card--${tone}`}>
      <Link to={`/pass/${session.id}`} className="session-card__main">
        <span className="session-card__emoji" aria-hidden="true">
          {meta.emoji}
        </span>
        <div className="grow">
          <div className="session-card__title">{meta.label}</div>
          <div className="session-card__meta">
            {formatWhen(session.startsAt, now)} · {formatSpan(session.startsAt, session.durationMin)}
            {state.phase === 'kommande' &&
              isToday(session.startsAt, now) &&
              ` · ${formatCountdown(session.startsAt, now)}`}
          </div>
          <div className="session-card__meta">
            <IconPin width={14} height={14} /> {venue?.name ?? 'Plats saknas'}
          </div>
        </div>
        <span className={`pill pill--${tone}`}>{statusLabel(state)}</span>
      </Link>

      <div className="session-card__foot">
        <AvatarStack people={going} max={5} />
        <span className="session-card__count">
          {state.goingCount}
          {session.maxPlayers ? `/${session.maxPlayers}` : ''} anmälda
          {state.maybeCount > 0 && ` · ${state.maybeCount} kanske`}
        </span>
      </div>

      {(state.phase === 'kommande' || state.phase === 'pagar') && (
        <ResponseButtons
          compact
          current={mine?.status ?? null}
          onRespond={(status) => void respond(session.id, status)}
        />
      )}
    </article>
  );
}
