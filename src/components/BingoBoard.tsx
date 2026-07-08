import type { ReactNode } from 'react';

/** Behållare för 5×5-brickan. Rutorna byggs av respektive vy. */
export function BingoBoard({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="board" role="group" aria-label={label ?? 'Bingobricka'}>
      {children}
    </div>
  );
}
