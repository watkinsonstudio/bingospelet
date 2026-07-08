import { useMemo, useState } from 'react';
import { CLUB_ID, useBingo } from '../state/BingoProvider';
import { getClub, getTeamByCode, getTeamMembers } from '../domain/selectors';
import { Avatar } from '../components/Avatar';
import { IconBall } from '../components/icons';

export function LoginScreen() {
  const { db, login } = useBingo();
  const club = getClub(db, CLUB_ID);

  const [code, setCode] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const team = useMemo(
    () => (submittedCode ? getTeamByCode(db, submittedCode) : null),
    [db, submittedCode],
  );
  const members = team ? getTeamMembers(db, team.id) : [];

  const demoCodes = db.teams.filter((t) => t.clubId === CLUB_ID).map((t) => t.joinCode);

  function handleSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    const found = getTeamByCode(db, code);
    if (!found) {
      setError('Ingen lag-kod matchar. Kontrollera med din tränare.');
      setSubmittedCode(null);
      return;
    }
    setError(null);
    setSubmittedCode(code);
  }

  return (
    <div className="login">
      <div className="login__brand">
        <div className="login__crest">
          <IconBall width={40} height={40} />
        </div>
        <div className="login__title">Sommarbingo</div>
        <div className="login__tag">{club?.name ?? 'Föreningen'} · håll igång i sommar</div>
      </div>

      <div className="login__card">
        {!team ? (
          <form className="stack" onSubmit={handleSubmitCode}>
            <div className="field">
              <label className="field__label" htmlFor="code">
                Lag-kod
              </label>
              <input
                id="code"
                className="input input--code"
                placeholder="T.EX. F11-SOL"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {error && <div className="login__error" style={{ color: 'var(--color-danger)' }}>{error}</div>}
            <button className="btn btn--primary btn--block" type="submit" disabled={!code.trim()}>
              Fortsätt
            </button>
          </form>
        ) : (
          <div className="stack">
            <div className="row row--between">
              <div>
                <div className="field__label">Välj ditt namn</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{team.name}</div>
              </div>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setSubmittedCode(null);
                  setCode('');
                }}
              >
                Byt kod
              </button>
            </div>
            <div className="name-grid">
              {members.map((p) => (
                <button key={p.id} className="name-chip" onClick={() => login(p.id)}>
                  <Avatar player={p} size="sm" />
                  <span className="grow">{p.firstName}</span>
                  {p.role === 'coach' && <span className="name-chip__role">Coach</span>}
                </button>
              ))}
            </div>
            <p className="text-muted" style={{ fontSize: '0.78rem', textAlign: 'center' }}>
              Inga lösenord – bara ditt förnamn sparas.
            </p>
          </div>
        )}
      </div>

      {!team && (
        <div className="login__hint">
          <p style={{ marginBottom: 'var(--space-2)' }}>Demokoder att testa:</p>
          <div className="login__codes">
            {demoCodes.map((c) => (
              <button key={c} className="code-chip" onClick={() => setCode(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
