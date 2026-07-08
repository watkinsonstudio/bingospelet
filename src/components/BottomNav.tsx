import { NavLink } from 'react-router-dom';
import { useBingo } from '../state/BingoProvider';
import { IconCard, IconFinal, IconTeam, IconTrophy, IconWhistle } from './icons';

const items = [
  { to: '/', label: 'Min bricka', icon: IconCard, end: true },
  { to: '/lag', label: 'Laget', icon: IconTeam, end: false },
  { to: '/topplista', label: 'Topplista', icon: IconTrophy, end: false },
  { to: '/final', label: 'Final', icon: IconFinal, end: false },
];

export function BottomNav() {
  const { isCoach } = useBingo();
  const navItems = isCoach ? [...items, { to: '/coach', label: 'Coach', icon: IconWhistle, end: false }] : items;

  return (
    <nav className="bottomnav" aria-label="Huvudnavigering">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="bottomnav__item">
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
