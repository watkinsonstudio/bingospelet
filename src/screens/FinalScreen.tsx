import { CLUB_ID, useBingo } from '../state/BingoProvider';
import { finalUnlockedFor, getClubWeeks, getTeam, getTeamSummary } from '../domain/selectors';
import { IconLock, IconTrophy, IconUnlock } from '../components/icons';

export function FinalScreen() {
  const { db, selectedTeamId, isCoach, setFinalUnlocked, selectWeek } = useBingo();

  const team = getTeam(db, selectedTeamId);
  if (!team) return null;

  const weeks = getClubWeeks(db, CLUB_ID);
  const unlocked = finalUnlockedFor(db, team.id);

  return (
    <div className="stack">
      <div className="hero-final">
        <div className="hero-final__trophy">🏆</div>
        <h2>Sommarfinal</h2>
        <p>
          Säsongens avslut för {team.name}. Här ser ni allt ni klarat tillsammans – och kan låsa upp resten för ett
          gemensamt ryck på en träning.
        </p>
      </div>

      {unlocked ? (
        <div className="banner banner--final">
          <IconUnlock className="banner__icon" width={18} height={18} />
          <span>Finalen är upplåst! Alla rutor som ännu inte tänts går nu att klara – även i arkiverade veckor.</span>
        </div>
      ) : (
        <div className="banner banner--archived">
          <IconLock className="banner__icon" width={18} height={18} />
          <span>Finalen är låst. En coach låser upp alla brickor när det är dags för det gemensamma rycket.</span>
        </div>
      )}

      {isCoach && (
        <div className="card stack">
          <div className="section-title">
            <IconUnlock width={20} height={20} /> Coach
          </div>
          <p className="section-sub">
            Lås upp alla brickor för {team.name}. Då blir varje ännu icke-tänd ruta – över alla veckor – möjlig att
            klara gemensamt.
          </p>
          <button
            className={`btn btn--block ${unlocked ? 'btn--danger' : 'btn--accent'}`}
            onClick={() => void setFinalUnlocked(team.id, !unlocked)}
          >
            {unlocked ? 'Lås finalen igen' : 'Lås upp alla brickor'}
          </button>
        </div>
      )}

      <div className="card stack">
        <div className="section-title">Säsongens veckor</div>
        {weeks.map((w) => {
          const s = getTeamSummary(db, w.id, team.id);
          return (
            <button
              key={w.id}
              className="week-result"
              onClick={() => selectWeek(w.id)}
              style={{ textAlign: 'left', width: '100%' }}
            >
              <div className="week-result__num">v.{w.weekNumber}</div>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{w.theme}</div>
                <div className="leader__meta">
                  {s.litCount} tända rutor
                  {s.teamBingos > 0 ? ` · ${s.teamBingos} lagbingo` : ''}
                  {w.status === 'active' ? ' · pågår' : ''}
                </div>
              </div>
              <IconTrophy width={20} height={20} className={s.teamBingos > 0 ? 'crown' : 'text-muted'} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
