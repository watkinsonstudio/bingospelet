import { useSpontan } from '../state/SpontanProvider';
import { getArea, getPerson } from '../domain/selectors';
import { Avatar } from './Avatar';

export function AppBar() {
  const { db, currentPersonId, areaId } = useSpontan();
  const person = getPerson(db, currentPersonId);
  const area = getArea(db, areaId);

  return (
    <header className="appbar">
      <div className="appbar__row">
        <div className="appbar__brand">
          <span className="appbar__mark" aria-hidden="true">
            ⚽️
          </span>
          <div className="appbar__titles">
            <div className="appbar__name">Spontan</div>
            <div className="appbar__subtitle">{area?.name ?? 'Spontanfotboll'}</div>
          </div>
        </div>
        <div className="appbar__user">
          <span>{person?.name}</span>
          <Avatar person={person} size="sm" />
        </div>
      </div>
    </header>
  );
}
