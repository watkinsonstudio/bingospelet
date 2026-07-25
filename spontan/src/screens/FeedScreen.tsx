import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSpontan } from '../state/SpontanProvider';
import { ACTIVITY_META, DAYPART_LABELS } from '../data/types';
import { getPerson, sessionsIn } from '../domain/selectors';
import { upcomingSessions } from '../domain/sessions';
import { intentClusters, intentOf } from '../domain/intents';
import { formatDay, toLocalInput } from '../lib/datetime';
import { SessionCard } from '../components/SessionCard';
import { AvatarStack } from '../components/Avatar';
import { IconHand, IconSpark } from '../components/icons';

/**
 * Startvyn: först det som redan är på gång, sedan appens poäng – överlapp mellan
 * sugna personer som ingen ännu gjort något av. Varje förslag går att förvandla
 * till ett riktigt pass med ett tryck.
 */
export function FeedScreen() {
  const { db, now, areaId, currentPersonId } = useSpontan();

  const sessions = useMemo(
    () => upcomingSessions(sessionsIn(db, areaId), now),
    [db, areaId, now],
  );

  const areaIntents = useMemo(
    () => db.intents.filter((i) => i.areaId === areaId),
    [db.intents, areaId],
  );

  const clusters = useMemo(() => intentClusters(areaIntents, now, { limit: 3 }), [areaIntents, now]);
  const myIntent = currentPersonId ? intentOf(db.intents, currentPersonId, now) : null;

  return (
    <div className="stack">
      {!myIntent && (
        <Link to="/sugen" className="prompt-card">
          <IconHand width={22} height={22} />
          <div className="grow">
            <div className="prompt-card__title">Är du sugen den här veckan?</div>
            <div className="prompt-card__sub">
              Säg vad du vill göra och ungefär när – så matchar appen dig med andra.
            </div>
          </div>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      {clusters.length > 0 && (
        <section className="stack">
          <div>
            <h2 className="section-title">
              <IconSpark width={18} height={18} /> Nu är flera sugna samtidigt
            </h2>
            <p className="section-sub">Ingen har startat något än. Gör det du.</p>
          </div>
          {clusters.map((cluster) => {
            const meta = ACTIVITY_META[cluster.type];
            const people = cluster.personIds
              .map((id) => getPerson(db, id))
              .filter(Boolean) as NonNullable<ReturnType<typeof getPerson>>[];
            const start = new Date(cluster.startsAt);
            const query = new URLSearchParams({
              type: cluster.type,
              start: toLocalInput(start),
            });
            return (
              <article key={`${cluster.type}-${cluster.startsAt}`} className="cluster">
                <div className="cluster__head">
                  <span className="cluster__emoji" aria-hidden="true">
                    {meta.emoji}
                  </span>
                  <div className="grow">
                    <div className="cluster__title">
                      {cluster.personIds.length} sugna på {meta.label.toLowerCase()}
                    </div>
                    <div className="cluster__when">
                      {formatDay(start, now)} · {DAYPART_LABELS[cluster.daypart].toLowerCase()}
                    </div>
                  </div>
                </div>
                <div className="cluster__foot">
                  <AvatarStack people={people} max={6} />
                  <Link className="btn btn--primary btn--sm" to={`/starta?${query.toString()}`}>
                    Starta passet
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="stack">
        <div className="row row--between">
          <h2 className="section-title">På gång</h2>
          <Link to="/starta" className="btn btn--ghost btn--sm">
            Starta pass
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="empty">
            <span className="empty__icon" aria-hidden="true">
              🥅
            </span>
            <p>Inget pass är inbokat än.</p>
            <Link to="/starta" className="btn btn--primary btn--sm">
              Starta det första
            </Link>
          </div>
        ) : (
          sessions.map((session) => <SessionCard key={session.id} session={session} />)
        )}
      </section>
    </div>
  );
}
