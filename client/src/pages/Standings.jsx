import { useState, useEffect } from 'react';
import { fetchStandings, fetchTopScorers } from '../utils/api.js';

function TeamLogo({ src, name, size = 20 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', background: 'var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.5, fontWeight: 700, color: 'var(--text-2)',
      }}>{name?.[0] ?? '?'}</div>
    );
  }
  return <img src={src} alt={name} style={{ width: size, height: size, objectFit: 'contain' }} onError={() => setErr(true)} />;
}

function normalizeStandings(raw) {
  if (!raw?.length) return [];
  const league = raw[0]?.league;
  if (!league?.standings) return [];
  return league.standings.map((group) => ({
    groupName: group[0]?.group || 'Group',
    teams: group.map((e) => ({
      rank:   e.rank,
      name:   e.team.name,
      logo:   e.team.logo,
      played: e.all.played,
      won:    e.all.win,
      drawn:  e.all.draw,
      lost:   e.all.lose,
      gd:     e.goalsDiff,
      points: e.points,
      form:   e.form,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Groups tab
// ---------------------------------------------------------------------------
function GroupsTab({ groups }) {
  const [activeGroup, setActiveGroup] = useState(0);
  const group = groups[activeGroup];

  if (!groups.length) return (
    <div className="empty-state">Standings will be available once the group stage begins.</div>
  );

  return (
    <>
      <div className="standings-group-selector">
        {groups.map((g, i) => (
          <button key={g.groupName} className={`group-pill${i === activeGroup ? ' active' : ''}`} onClick={() => setActiveGroup(i)}>
            {g.groupName}
          </button>
        ))}
      </div>

      {group && (
        <div className="standings-table fade-in">
          <div className="standings-row header">
            <span>#</span>
            <span>Team</span>
            <span style={{ textAlign: 'center' }}>P</span>
            <span style={{ textAlign: 'center' }}>GD</span>
            <span style={{ textAlign: 'center' }}>Pts</span>
            <span style={{ textAlign: 'center' }}>Form</span>
          </div>
          {group.teams.map((t, i) => (
            <div key={t.name} className={`standings-row${i < 2 ? ' advances' : ''}`}>
              <span className="standings-pos">{t.rank}</span>
              <span className="standings-team">
                <TeamLogo src={t.logo} name={t.name} />
                {t.name}
              </span>
              <span className="standings-num">{t.played}</span>
              <span className="standings-num">{t.gd > 0 ? `+${t.gd}` : t.gd}</span>
              <span className="standings-pts">{t.points}</span>
              <span className="standings-num" style={{ fontSize: '0.65rem', letterSpacing: 1 }}>{t.form?.slice(-5) ?? ''}</span>
            </div>
          ))}
        </div>
      )}
      <p style={{ padding: '10px 16px', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        Green rows advance to the Round of 32.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Scorer table (shared by top scorers + top assists)
// ---------------------------------------------------------------------------
function ScorerTable({ players, statKey, statLabel }) {
  if (!players?.length) return (
    <div className="empty-state">Data will be available once matches are played.</div>
  );

  return (
    <div style={{ margin: '12px' }}>
      <div className="standings-table">
        <div className="scorer-row header">
          <span>#</span>
          <span style={{ gridColumn: '2/4' }}>Player</span>
          <span style={{ textAlign: 'center' }}>Apps</span>
          <span style={{ textAlign: 'center' }}>Mins</span>
          <span style={{ textAlign: 'center', color: 'var(--accent)' }}>{statLabel}</span>
        </div>
        {players.slice(0, 20).map((p, i) => {
          const stats = p.statistics?.[0];
          const val   = stats?.goals?.[statKey] ?? 0;
          const apps  = stats?.games?.appearences ?? 0;
          const mins  = stats?.games?.minutes ?? 0;
          const team  = stats?.team;
          return (
            <div key={p.player.id} className="scorer-row">
              <span className="scorer-rank">{i + 1}</span>
              <img
                className="scorer-photo"
                src={p.player.photo}
                alt={p.player.name}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="scorer-info">
                <div className="scorer-name">{p.player.name}</div>
                <div className="scorer-team" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {team?.logo && <img src={team.logo} alt={team.name} style={{ width: 12, height: 12, objectFit: 'contain' }} />}
                  {team?.name}
                </div>
              </div>
              <span className="scorer-num">{apps}</span>
              <span className="scorer-num">{mins}'</span>
              <span className="scorer-num goals">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Standings() {
  const [groups,    setGroups]    = useState([]);
  const [scorers,   setScorers]   = useState(null);
  const [assists,   setAssists]   = useState(null);
  const [tab,       setTab]       = useState('groups');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    Promise.all([fetchStandings(), fetchTopScorers()])
      .then(([standingsData, scorersData]) => {
        setGroups(normalizeStandings(standingsData));
        setScorers(scorersData?.scorers ?? []);
        setAssists(scorersData?.assists ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const TABS = [
    { key: 'groups',  label: 'Groups' },
    { key: 'scorers', label: 'Top Scorers' },
    { key: 'assists', label: 'Top Assists' },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <h1>Standings</h1>
      </header>

      {loading && <div className="loading-state"><div className="spinner" /></div>}
      {error   && <div className="empty-state">Could not load standings.</div>}

      {!loading && !error && (
        <>
          <div className="tab-bar" style={{ position: 'sticky', top: 49 }}>
            {TABS.map(({ key, label }) => (
              <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'groups'  && <GroupsTab groups={groups} />}
          {tab === 'scorers' && <ScorerTable players={scorers} statKey="total"   statLabel="Goals" />}
          {tab === 'assists' && <ScorerTable players={assists} statKey="assists"  statLabel="Assists" />}
        </>
      )}
    </div>
  );
}
