import { initials } from '../domain/selectors';
import type { Person } from '../data/types';

interface AvatarProps {
  person: Person | null;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
}

export function Avatar({ person, size = 'md', title }: AvatarProps) {
  return (
    <span
      className={`avatar avatar--${size}`}
      style={{ background: person?.color ?? 'var(--color-text-faint)' }}
      title={title ?? person?.name ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      {initials(person?.name ?? '?')}
    </span>
  );
}

/** Överlappande avatarer för en lista av personer, med "+N" när de blir många. */
export function AvatarStack({
  people,
  max = 6,
  size = 'sm',
}: {
  people: Person[];
  max?: number;
  size?: 'sm' | 'md';
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="avatar-stack">
      {shown.map((person) => (
        <span
          key={person.id}
          className={`avatar avatar--${size}`}
          style={{ background: person.color }}
          title={person.name}
        >
          {initials(person.name)}
        </span>
      ))}
      {rest > 0 && <span className={`avatar avatar--${size} avatar--more`}>+{rest}</span>}
    </div>
  );
}
