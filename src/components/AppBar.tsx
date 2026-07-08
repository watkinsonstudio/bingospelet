import { CLUB_ID, useBingo } from '../state/BingoProvider';
import { getClub, getClubWeeks, getPlayer, getTeam } from '../domain/selectors';
import { IconLogout } from './icons';

export function AppBar() {
  const { db, currentPlayerId, selectedTeamId, selectedWeekId, isCoach, selectTeam, selectWeek, logout } = useBingo();

  const club = getClub(db, CLUB_ID);
  const player = getPlayer(db, currentPlayerId);
  const selectedTeam = getTeam(db, selectedTeamId);
  const weeks = getClubWeeks(db, CLUB_ID);
  const clubTeams = db.teams.filter((t) => t.clubId === CLUB_ID);
  const showTeamSelect = isCoach && clubTeams.length > 1;

  return (
    <header className="appbar">
      <div className="appbar__row">
        <div className="appbar__club">
          <div className="appbar__crest" aria-hidden>
            {club?.name.charAt(0) ?? 'S'}
          </div>
          <div className="appbar__titles">
            <div className="appbar__club-name">{club?.name ?? 'Föreningen'}</div>
            <div className="appbar__subtitle">
              {selectedTeam?.name}
              {isCoach ? ' · Coach' : ''}
            </div>
          </div>
        </div>

        {player && (
          <div className="appbar__user">
            <span>{player.firstName}</span>
            <button
              className="btn btn--ghost btn--sm"
              style={{ minHeight: 32, padding: '0 10px', background: 'rgba(255,255,255,.16)', color: '#fff', border: 'none' }}
              onClick={logout}
              aria-label="Logga ut"
            >
              <IconLogout width={16} height={16} />
            </button>
          </div>
        )}
      </div>

      {showTeamSelect && (
        <div className="appbar__selectors">
          <select
            className="team-select"
            value={selectedTeamId ?? ''}
            onChange={(e) => selectTeam(e.target.value)}
            aria-label="Välj lag"
          >
            {clubTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="weekbar" aria-label="Veckor">
        {weeks.map((w) => (
          <button
            key={w.id}
            className={`weekpill weekpill--${w.status}`}
            aria-pressed={w.id === selectedWeekId}
            onClick={() => selectWeek(w.id)}
          >
            <span className="weekpill__dot" />
            v.{w.weekNumber} · {w.theme}
          </button>
        ))}
      </nav>
    </header>
  );
}
