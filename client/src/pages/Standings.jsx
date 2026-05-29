import { useState, useEffect } from 'react';
import { fetchStandings }       from '../utils/api.js';

function TeamLogo({ src, name }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'var(--border)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-2)',
      }}>
        {name?.[0] ?? '?'}
      </div>
    );
  }
  return (
    <img className="standings-team-logo" src={src} alt={name} onError={() => setErr(true)} />
  );
}

// api-football returns standings as an array of groups, each group being an array of teams.
function normalizeStandings(raw) {
  if (!raw?.length) return [];
  const league = raw[0]?.league;
  if (!league?.standings) return [];

  return league.standings.map((group) => {
    const groupName = group[0]?.group || 'Group';
    const teams = group.map((entry) => ({
      rank:     entry.rank,
      name:     entry.team.name,
      logo:     entry.team.logo,
      played:   entry.all.played,
      won:      entry.all.win,
      drawn:    entry.all.draw,
      lost:     entry.all.lose,
      gf:       entry.all.goals.for,
      ga:       entry.all.goals.against,
      gd:       entry.goalsDiff,
      points:   entry.points,
      form:     entry.form,
    }));
    return { groupName, teams };
  });
}

export default function Standings() {
  const [groups,      setGroups]      = useState([]);
  const [activeGroup, setActiveGroup] = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    fetchStandings()
      .then((data) => {
        setGroups(normalizeStandings(data));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const group = groups[activeGroup];

  return (
    <div className="page">
      <header className="page-header">
        <h1>Standings</h1>
      </header>

      {loading && <div className="loading-state"><div className="spinner" /></div>}
      {error   && <div className="empty-state">Could not load standings.</div>}

      {!loading && !error && !groups.length && (
        <div className="empty-state">
          Standings will be available once the group stage begins on June 11.
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <>
          <div className="standings-group-selector">
            {groups.map((g, i) => (
              <button
                key={g.groupName}
                className={`group-pill${i === activeGroup ? ' active' : ''}`}
                onClick={() => setActiveGroup(i)}
              >
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
                  <span className="standings-num" style={{ fontSize: '0.65rem', letterSpacing: 1 }}>
                    {t.form?.slice(-5) ?? ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p style={{ padding: '10px 16px', fontSize: '0.7rem', color: 'var(--text-3)' }}>
            Green rows advance to the Round of 32.
          </p>
        </>
      )}
    </div>
  );
}
