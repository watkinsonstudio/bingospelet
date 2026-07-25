import type { SignupStatus } from '../data/types';
import { IconCheck, IconQuestion, IconX } from './icons';

const options: Array<{ status: SignupStatus; label: string; icon: typeof IconCheck }> = [
  { status: 'ja', label: 'Jag kommer', icon: IconCheck },
  { status: 'kanske', label: 'Kanske', icon: IconQuestion },
  { status: 'nej', label: 'Kan inte', icon: IconX },
];

interface Props {
  current: SignupStatus | null;
  onRespond: (status: SignupStatus) => void;
  disabled?: boolean;
  /** Kompakt läge används i listan, fullt läge på passets egen sida. */
  compact?: boolean;
}

/** Ja / kanske / nej. Ett tryck till på samma val gör inget – valet står kvar. */
export function ResponseButtons({ current, onRespond, disabled, compact }: Props) {
  return (
    <div className={`responses${compact ? ' responses--compact' : ''}`} role="group" aria-label="Ditt svar">
      {options.map(({ status, label, icon: Icon }) => (
        <button
          key={status}
          type="button"
          className={`response response--${status}`}
          aria-pressed={current === status}
          disabled={disabled}
          onClick={() => onRespond(status)}
        >
          <Icon width={18} height={18} />
          {compact ? (status === 'ja' ? 'Kommer' : status === 'kanske' ? 'Kanske' : 'Nej') : label}
        </button>
      ))}
    </div>
  );
}
