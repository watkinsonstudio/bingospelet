import type { Player } from '../data/types';

interface AvatarProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
}

/** Rund avatar med spelarens initial och färg. */
export function Avatar({ player, size = 'md' }: AvatarProps) {
  return (
    <span
      className={`avatar avatar--${size}`}
      style={{ background: player.color }}
      title={player.firstName}
      aria-label={player.firstName}
    >
      {player.firstName.charAt(0).toUpperCase()}
    </span>
  );
}
