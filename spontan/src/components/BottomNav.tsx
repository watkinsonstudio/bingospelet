import { NavLink } from 'react-router-dom';
import { IconBall, IconHand, IconPlus, IconUser } from './icons';

const items = [
  { to: '/', label: 'Passen', icon: IconBall, end: true },
  { to: '/sugen', label: 'Sugen', icon: IconHand, end: false },
  { to: '/starta', label: 'Starta', icon: IconPlus, end: false },
  { to: '/jag', label: 'Jag', icon: IconUser, end: false },
];

export function BottomNav() {
  return (
    <nav className="bottomnav" aria-label="Huvudnavigering">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="bottomnav__item">
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
