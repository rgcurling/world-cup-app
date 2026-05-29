import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchMatch, fetchUpdates, fetchVenues } from '../utils/api.js';
import { usePolling } from '../hooks/usePolling.js';
import { formatRelative } from '../utils/time.js';

function TeamLogo({ src, name, size = 56 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--border)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, fontWeight: 700, color: 'var(--text-2)',
      }}>
        {name?.[0] ?? '?'}
      </div>
    );
  }
  return (
    <img
      className="scoreboard-logo"
      src={src} alt={name}
      style={{ width: size, height: size }}
      onError={() => setErr(true)}
    />
  );
}

function Scoreboard({ match }) {
  const { home_team, away_team, home_score, away_score,
          status, home_logo_url, away_logo_url } = match;
  const isLive = status === 'live';
  const isFT   = status === 'finished';

  return (
    <div className="scoreboard">
      <div className="scoreboard-team">
        <TeamLogo src={home_logo_url} name={home_team} />
        <span className="scoreboard-team-name">{home_team}</span>
      </div>

      <div className="scoreboard-center">
        {(isLive || isFT) ? (
          <div className="scoreboard-score">
            <span>{home_score ?? 0}</span>
            <span className="scoreboard-sep">-</span>
            <span>{away_score ?? 0}</span>
          </div>
        ) : (
          <div className="scoreboard-score" style={{ fontSize: '1.8rem', color: 'var(--text-3)' }}>
            vs
          </div>
        )}
        <div className={`scoreboard-status${isFT ? ' finished' : !isLive ? ' scheduled' : ''}`}>
          {isLive && <span className="live-dot" />}
          {isLive ? 'LIVE' : isFT ? 'FULL TIME' : 'UPCOMING'}
        </div>
      </div>

      <div className="scoreboard-team">
        <TeamLogo src={away_logo_url} name={away_team} />
        <span className="scoreboard-team-name">{away_team}</span>
      </div>
    </div>
  );
}

function AiFeed({ updates, loading }) {
  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  if (!updates.length) {
    return (
      <div className="empty-state">
        AI commentary will appear here once the match starts.
      </div>
    );
  }
  return (
    <div style={{ paddingTop: 12 }}>
      {updates.map((u, i) => (
        <div key={u.id} className={`ai-update-card fade-in${i === 0 ? ' latest' : ''}`}>
          <div className="ai-update-meta">
            {u.minute != null && <span className="ai-minute">{u.minute}'</span>}
            <span className="ai-time">{formatRelative(u.created_at)}</span>
          </div>
          <p className="ai-summary">{u.summary}</p>
        </div>
      ))}
    </div>
  );
}

function BroadcastTab({ broadcastInfo }) {
  const info = broadcastInfo || {};
  return (
    <div className="broadcast-section">
      {info.tv?.length > 0 && (
        <>
          <h3>TV Channels</h3>
          <div className="channel-grid" style={{ marginBottom: 16 }}>
            {info.tv.map((ch) => <span key={ch} className="channel-chip">{ch}</span>)}
          </div>
        </>
      )}
      {info.streaming?.length > 0 && (
        <>
          <h3>Streaming</h3>
          <div className="channel-grid">
            {info.streaming.map((ch) => <span key={ch} className="channel-chip">{ch}</span>)}
          </div>
        </>
      )}
      {!info.tv?.length && !info.streaming?.length && (
        <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>
          Broadcast info unavailable.
        </p>
      )}
    </div>
  );
}

function VenuePhoto({ url, name }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return <div className="venue-photo-placeholder">🍺</div>;
  }
  return <img className="venue-photo" src={url} alt={name} onError={() => setErr(true)} />;
}

function VenuesTab({ fixtureId }) {
  const [venues,  setVenues]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [denied,  setDenied]  = useState(false);
  const [fetched, setFetched] = useState(false);

  const load = () => {
    if (!navigator.geolocation) { setDenied(true); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const data = await fetchVenues(fixtureId, coords.latitude, coords.longitude);
          setVenues(data);
        } catch {
          // non-fatal
        } finally {
          setLoading(false);
          setFetched(true);
        }
      },
      () => { setDenied(true); setLoading(false); },
    );
  };

  if (denied) {
    return (
      <div className="empty-state">
        Location access is required to find nearby bars.
        Please enable it in your browser settings.
      </div>
    );
  }

  if (!fetched && !loading) {
    return (
      <div style={{ padding: '16px 12px' }}>
        <button className="btn-primary" onClick={load}>
          Find Bars Near Me
        </button>
      </div>
    );
  }

  if (loading) return <div className="loading-state"><div className="spinner" /></div>;

  if (!venues.length) {
    return <div className="empty-state">No nearby sports bars found.</div>;
  }

  return (
    <div style={{ paddingTop: 12 }}>
      {venues.map((v) => (
        <div key={v.place_id} className="venue-card">
          <VenuePhoto url={v.photo_url} name={v.name} />
          <div className="venue-info">
            <div className="venue-name">{v.name}</div>
            {v.address && <div className="venue-address">{v.address}</div>}
            <div className="venue-meta">
              {v.rating && <span className="venue-rating">{'★'} {v.rating}</span>}
              {v.distance_km && <span className="venue-distance">{v.distance_km} km</span>}
              {v.open_now === true  && <span className="venue-open">Open now</span>}
              {v.open_now === false && <span style={{ color: 'var(--live)', fontSize: '0.75rem' }}>Closed</span>}
            </div>
            {v.maps_url && (
              <a href={v.maps_url} target="_blank" rel="noreferrer" className="venue-link">
                Open in Maps
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Match() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [match,   setMatch]   = useState(null);
  const [updates, setUpdates] = useState([]);
  const [tab,     setTab]     = useState('feed');
  const [loading, setLoading] = useState(true);

  const loadMatch = async () => {
    try {
      const [m, u] = await Promise.all([fetchMatch(id), fetchUpdates(id)]);
      setMatch(m);
      setUpdates(u);
    } catch {
      // keep stale data on poll failures
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMatch(); }, [id]);
  usePolling(loadMatch, 30_000, match?.status === 'live');

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state"><div className="spinner" /></div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="page">
        <div className="empty-state">Match not found.</div>
      </div>
    );
  }

  const context = [match.group_name, match.round].filter(Boolean).join(' · ');

  return (
    <div className="page" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)' }}>
      <div className="match-detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <span className="match-detail-title">{context}</span>
      </div>

      <Scoreboard match={match} />

      <div className="tab-bar">
        {[['feed', 'AI Feed'], ['broadcast', 'Broadcast'], ['bars', 'Bars']].map(([key, label]) => (
          <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'feed'      && <AiFeed updates={updates} loading={false} />}
      {tab === 'broadcast' && <BroadcastTab broadcastInfo={match.broadcast_info} />}
      {tab === 'bars'      && <VenuesTab fixtureId={match.fixture_id} />}
    </div>
  );
}
