import { useState, useEffect }    from 'react';
import { useNavigate }            from 'react-router-dom';
import MatchCard                  from '../components/MatchCard.jsx';
import { fetchMatches }           from '../utils/api.js';
import { groupByDate, formatDateHeading } from '../utils/time.js';
import { usePolling }             from '../hooks/usePolling.js';

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await fetchMatches();
      setMatches(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  usePolling(load, 60_000, !loading);

  const live   = matches.filter((m) => m.status === 'live');
  const groups = groupByDate(matches.filter((m) => m.status !== 'live'));

  return (
    <div className="page">
      <header className="page-header">
        <span className="logo">KickoffAI</span>
        <button className="icon-btn" onClick={() => navigate('/settings')} aria-label="Settings">⚙️</button>
      </header>

      {loading && <div className="loading-state"><div className="spinner" />Loading matches...</div>}

      {error && !loading && (
        <div className="empty-state">
          Could not load matches.<br /><br />
          <button className="btn-primary" style={{ width: 'auto', display: 'inline-block' }} onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {live.length > 0 && (
            <section>
              <p className="section-label live"><span className="live-dot" />Live Now</p>
              {live.map((m) => <MatchCard key={m.id} match={m} />)}
            </section>
          )}

          {groups.map(([dateStr, dayMatches]) => (
            <section key={dateStr}>
              <p className="section-label">{formatDateHeading(dayMatches[0].kickoff)}</p>
              {dayMatches.map((m) => <MatchCard key={m.id} match={m} />)}
            </section>
          ))}

          {matches.length === 0 && (
            <div className="empty-state">
              No matches found.<br />The World Cup starts June 11, 2026.
            </div>
          )}
        </>
      )}
    </div>
  );
}
