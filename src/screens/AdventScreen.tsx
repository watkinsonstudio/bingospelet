import { useEffect, useMemo, useRef, useState } from 'react';
import { CLUB_ID, useBingo } from '../state/BingoProvider';
import type { AdventEntry } from '../data/types';
import {
  ADVENT_DAYS,
  adventEndKey,
  adventScore,
  buildAdventLeaderboard,
  dateKey,
  daysUntilDoor,
  doorCompletionCount,
  isAdventOver,
  isDoorEditable,
  isDoorOpen,
  isOnTime,
  litDoors,
  todaysDoor,
} from '../domain/advent';
import { teamThreshold } from '../domain/scoring';
import {
  adventAllOpenFor,
  getAdventCalendar,
  getAdventDoors,
  getPlayer,
  getPlayerAdventEntries,
  getTeam,
  getTeamAdventEntries,
  getTeamMembers,
} from '../domain/selectors';
import { getNow, isSimulatedDate } from '../lib/today';
import { Avatar } from '../components/Avatar';
import { ChristmasTree } from '../components/ChristmasTree';
import { DoorSheet } from '../components/DoorSheet';
import { IconCrown, IconLock } from '../components/icons';

// Luckornas placering i ett 5 × 5-rutnät (som bingobrickan). Lucka 24 är dubbelt
// så bred, så 23 + 2 = 25 rutor. Ordningen är blandad, som i en riktig kalender.
const DOOR_ORDER = [9, 3, 17, 12, 21, 5, 14, 1, 19, 8, 16, 24, 6, 11, 22, 10, 2, 13, 18, 7, 20, 15, 4, 23];

type Tab = 'mine' | 'team';

export function AdventScreen() {
  const { db, currentPlayerId, selectedTeamId, completeDoor, clearDoor } = useBingo();
  const [tab, setTab] = useState<Tab>('mine');
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [openingDay, setOpeningDay] = useState<number | null>(null);
  const openTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(openTimer.current), []);

  const now = getNow();
  const todayKey = dateKey(now);
  const simulated = isSimulatedDate();

  const calendar = getAdventCalendar(db, CLUB_ID);
  const player = getPlayer(db, currentPlayerId);
  const team = getTeam(db, selectedTeamId);

  const myEntries = useMemo(
    () => (calendar && player ? getPlayerAdventEntries(db, calendar.id, player.id) : []),
    [db, calendar, player],
  );
  const teamEntries = useMemo(
    () => (calendar && team ? getTeamAdventEntries(db, calendar.id, team.id) : []),
    [db, calendar, team],
  );

  if (!calendar || !player || !team) return null;

  const year = calendar.year;
  const doors = getAdventDoors(db, calendar.id);
  const doorByDay = new Map(doors.map((d) => [d.day, d]));
  const myByDay = new Map<number, AdventEntry>(myEntries.map((e) => [e.day, e]));
  const score = adventScore(myEntries, year);

  const allOpen = adventAllOpenFor(db, player.teamId);
  const today = todaysDoor(year, todayKey);
  const daysToStart = daysUntilDoor(year, 1, now);
  const over = isAdventOver(year, todayKey);
  const afterXmas = todayKey > `${year}-12-24` && !over;

  const members = getTeamMembers(db, team.id);
  const teamSize = members.filter((p) => p.role === 'player').length;
  const playerTeamMembers = getTeamMembers(db, player.teamId);
  const playerTeamEntries = calendar ? getTeamAdventEntries(db, calendar.id, player.teamId) : [];

  const openDoor = openDay !== null ? doorByDay.get(openDay) ?? null : null;

  const handleDoor = (day: number) => {
    const opened = isDoorOpen(year, day, todayKey, allOpen);
    if (!opened || myByDay.has(day)) {
      setOpenDay(day);
      return;
    }
    // Liten "lucköppning" innan utmaningen visas.
    setOpeningDay(day);
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => {
      setOpeningDay(null);
      setOpenDay(day);
    }, 420);
  };

  return (
    <div className="stack">
      <div className="advent-hero">
        <div className="advent-hero__eyebrow">{team.name}</div>
        <div className="advent-hero__title">
          {calendar.title} {year}
        </div>
        <p className="advent-hero__sub">
          {over
            ? 'Kalendern är stängd. Tack för en fin december!'
            : afterXmas
              ? `God jul! Missade luckor går att klara fram till trettondedag jul (${adventEndKey(year).slice(8)}/1).`
              : today
                ? `Lucka ${today} är öppen. En ny utmaning varje dag fram till julafton.`
                : allOpen
                  ? 'Alla luckor är öppnade av er coach. Kör så det ryker!'
                  : daysToStart === 1
                    ? 'Första luckan öppnas i morgon!'
                    : `Första luckan öppnas 1 december, om ${daysToStart} dagar.`}
        </p>
        {simulated && <span className="advent-hero__sim">Låtsasdatum: {todayKey}</span>}
      </div>

      <div className="segmented" role="tablist" aria-label="Visa">
        <button role="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>
          Min kalender
        </button>
        <button role="tab" aria-selected={tab === 'team'} onClick={() => setTab('team')}>
          Lagets julgran
        </button>
      </div>

      {tab === 'mine' ? (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="stat__value">
                {score.doors}/{ADVENT_DAYS}
              </div>
              <div className="stat__label">Luckor</div>
            </div>
            <div className="stat">
              <div className="stat__value">{score.points}</div>
              <div className="stat__label">Poäng</div>
            </div>
            <div className="stat">
              <div className="stat__value">⭐ {score.onTime}</div>
              <div className="stat__label">I tid</div>
            </div>
          </div>

          <div className="advent-grid" role="group" aria-label="Adventskalender">
            {DOOR_ORDER.map((day) => {
              const door = doorByDay.get(day);
              if (!door) return null;
              const entry = myByDay.get(day);
              const opened = isDoorOpen(year, day, todayKey, allOpen);
              const classes = [
                'door',
                `door--v${day % 3}`,
                day === ADVENT_DAYS ? 'door--wide' : '',
                !opened ? 'door--locked' : '',
                entry ? `door--done door--${entry.level}` : '',
                day === today ? 'door--today' : '',
                openingDay === day ? 'door--opening' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={day}
                  className={classes}
                  onClick={() => handleDoor(day)}
                  aria-label={`Lucka ${day}${!opened ? ', inte öppnad än' : entry ? `, ${door.title}, klarad` : ', öppna'}`}
                >
                  {entry ? (
                    <>
                      <span className="door__day">{day}</span>
                      <span className="door__emoji" aria-hidden>
                        {door.emoji}
                      </span>
                      {day === ADVENT_DAYS && <span className="door__title">{door.title}</span>}
                      {isOnTime(entry, year) && (
                        <span className="door__star" aria-hidden>
                          ⭐
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="door__num">{day}</span>
                      {!opened && <IconLock className="door__lock" width={12} height={12} />}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="card">
            <div className="legend">
              <span className="legend__item">
                <span className="legend__swatch" style={{ background: 'var(--level-easy)' }} /> Lätt · 1p
              </span>
              <span className="legend__item">
                <span className="legend__swatch" style={{ background: 'var(--level-medium)' }} /> Medel · 2p
              </span>
              <span className="legend__item">
                <span className="legend__swatch" style={{ background: 'var(--level-hard)' }} /> Svår · 3p
              </span>
              <span className="legend__item">⭐ Samma dag · +1p</span>
            </div>
          </div>
        </>
      ) : (
        <TeamTree
          entries={teamEntries}
          members={members}
          teamSize={teamSize}
          year={year}
          today={today}
        />
      )}

      {openDoor && (
        <DoorSheet
          key={openDoor.day}
          door={openDoor}
          year={year}
          locked={!isDoorOpen(year, openDoor.day, todayKey, allOpen)}
          daysLeft={daysUntilDoor(year, openDoor.day, now)}
          editable={isDoorEditable(year, openDoor.day, todayKey, allOpen)}
          isToday={openDoor.day === today}
          currentLevel={myByDay.get(openDoor.day)?.level ?? null}
          onTime={(() => {
            const e = myByDay.get(openDoor.day);
            return e ? isOnTime(e, year) : false;
          })()}
          teamDone={doorCompletionCount(playerTeamEntries, playerTeamMembers, openDoor.day)}
          teamSize={playerTeamMembers.filter((p) => p.role === 'player').length}
          onComplete={(level) => {
            void completeDoor(openDoor.day, level);
            setOpenDay(null);
          }}
          onClear={() => {
            void clearDoor(openDoor.day);
            setOpenDay(null);
          }}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
}

function TeamTree({
  entries,
  members,
  teamSize,
  year,
  today,
}: {
  entries: AdventEntry[];
  members: ReturnType<typeof getTeamMembers>;
  teamSize: number;
  year: number;
  today: number | null;
}) {
  const lit = litDoors(entries, members);
  const threshold = teamThreshold(members);
  const rows = buildAdventLeaderboard(members, entries, year);
  const maxPoints = Math.max(1, ...rows.map((r) => r.points));
  const todaysDone = today
    ? members.filter((p) => p.role === 'player' && entries.some((e) => e.day === today && e.playerId === p.id))
    : [];

  return (
    <>
      <div className="card stack">
        <ChristmasTree lit={lit} />
        <div className="text-center">
          <div className="section-title" style={{ justifyContent: 'center' }}>
            {lit.size} av {ADVENT_DAYS} ljus tända
          </div>
          <p className="section-sub">
            Ett ljus tänds när minst {threshold} av lagets {teamSize} spelare klarat luckan. När alla 24 lyser tänds
            stjärnan i toppen.
          </p>
        </div>
      </div>

      {today && (
        <div className="card stack">
          <div className="section-title" style={{ fontSize: '1rem' }}>
            Dagens lucka ({today}): {todaysDone.length} av {teamSize} klara
          </div>
          {todaysDone.length > 0 ? (
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {todaysDone.map((p) => (
                <Avatar key={p.id} player={p} size="md" />
              ))}
            </div>
          ) : (
            <p className="section-sub">Ingen har klarat dagens lucka än. Bli först!</p>
          )}
        </div>
      )}

      <div className="card stack">
        <div className="section-title" style={{ fontSize: '1rem' }}>
          Julkalenderns topplista
        </div>
        {rows.every((r) => r.points === 0) ? (
          <p className="section-sub">Inga poäng än. Den första luckan avgör!</p>
        ) : (
          <div className="stack">
            {rows.map((row) => {
              const first = row.rank === 1 && row.points > 0;
              return (
                <div key={row.player.id} className={`leader ${first ? 'leader--first' : ''}`}>
                  <div className="leader__rank">
                    {first ? <IconCrown className="crown" width={22} height={22} /> : row.rank}
                  </div>
                  <Avatar player={row.player} size="md" />
                  <div className="leader__body">
                    <div className="leader__name">{row.player.firstName}</div>
                    <div className="leader__meta">
                      {row.doors} luckor{row.onTime > 0 ? ` · ⭐ ${row.onTime}` : ''}
                    </div>
                    <div className="leader__bar">
                      <div className="leader__bar-fill" style={{ width: `${(row.points / maxPoints) * 100}%` }} />
                    </div>
                  </div>
                  <div className="leader__score">
                    <div className="leader__points">{row.points}</div>
                    <div className="leader__points-label">poäng</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
