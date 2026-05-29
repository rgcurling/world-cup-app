import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchMatch, fetchVenues } from '../utils/api.js';

const US_BROADCAST = {
  english:   ['Fox Sports', 'FS1'],
  spanish:   ['Telemundo', 'Universo'],
  streaming: ['Peacock', 'Fubo', 'Sling TV', 'YouTube TV'],
};

// ---------------------------------------------------------------------------
// Score header
// ---------------------------------------------------------------------------
function ScoreHeader({ match }) {
  if (!match) return null;
  const { home_team, away_team, home_logo, away_logo,
          home_score, away_score, status, minute } = match;
  const isLive = status === 'live';
  const isFT   = status === 'finished';

  return (
    <div className="scoreboard">
      <div className="scoreboard-team">
        <TeamLogo src={home_logo} name={home_team} size={56} />
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
          <div className="scoreboard-score" style={{ fontSize: '1.6rem', color: 'var(--text-3)' }}>vs</div>
        )}
        <div className={`scoreboard-status${isFT ? ' finished' : !isLive ? ' scheduled' : ''}`}>
          {isLive && <span className="live-dot" />}
          {isLive ? `${minute ?? 0}'` : isFT ? 'FULL TIME' : 'UPCOMING'}
        </div>
      </div>
      <div className="scoreboard-team">
        <TeamLogo src={away_logo} name={away_team} size={56} />
        <span className="scoreboard-team-name">{away_team}</span>
      </div>
    </div>
  );
}

function TeamLogo({ src, name, size = 40 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--border)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700, color: 'var(--text-2)',
      }}>
        {name?.[0] ?? '?'}
      </div>
    );
  }
  return <img src={src} alt={name} style={{ width: size, height: size, objectFit: 'contain' }} onError={() => setErr(true)} />;
}

// ---------------------------------------------------------------------------
// Tab 1: LIVE (events + stats + AI analysis)
// ---------------------------------------------------------------------------
function LiveTab({ data, lastUpdated, analyzing }) {
  const { match, events = [], stats = [], analysis } = data || {};

  const timeline = [...events]
    .filter((e) => ['Goal', 'Card', 'subst'].includes(e.type))
    .sort((a, b) => a.time.elapsed - b.time.elapsed);

  const homeStats = stats[0]?.statistics || [];
  const awayStats = stats[1]?.statistics || [];
  const getStat   = (arr, type) => arr.find((s) => s.type === type)?.value ?? '-';

  const secAgo = lastUpdated ? Math.floor((Date.now() - lastUpdated) / 1000) : null;

  if (!data) {
    return <div className="loading-state"><div className="spinner" /></div>;
  }

  if (match?.status === 'scheduled') {
    return (
      <div className="empty-state">
        Match hasn't started yet. Come back at kick off for live updates and AI analysis.
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 12 }}>
      {/* AI Analysis */}
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
          AI Analysis
          {secAgo !== null && (
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0,
                           color: 'var(--text-3)', marginLeft: 8 }}>
              Updated {secAgo}s ago
            </span>
          )}
        </div>
        <div className={`ai-update-card latest${analyzing ? '' : ' fade-in'}`}>
          {analyzing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)' }}>
              <div className="spinner" style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: '0.85rem' }}>Analyzing...</span>
            </div>
          ) : (
            <p className="ai-summary">{analysis ?? 'Analysis not available for this match.'}</p>
          )}
        </div>
      </div>

      {/* Event timeline */}
      {timeline.length > 0 && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
            Events
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)', overflow: 'hidden' }}>
            {timeline.map((e, i) => {
              const min  = e.time.extra ? `${e.time.elapsed}+${e.time.extra}'` : `${e.time.elapsed}'`;
              const icon = e.type === 'Goal' ? '⚽' : e.detail === 'Red Card' ? '🟥' : e.type === 'Card' ? '🟨' : '🔄';
              const desc = e.type === 'Goal'
                ? `${e.player.name}${e.detail === 'Own Goal' ? ' (OG)' : e.detail === 'Penalty' ? ' (pen)' : ''}`
                : e.type === 'Card' ? e.player.name
                : `${e.player.name} on`;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                      padding: '10px 14px', borderBottom: i < timeline.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{min}</span>
                  <span>{icon}</span>
                  <span style={{ fontSize: '0.85rem', flex: 1 }}>{desc}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{e.team.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      {(homeStats.length > 0 || awayStats.length > 0) && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
            Stats
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Possession',      'Ball Possession'],
              ['Shots on target', 'Shots on Goal'],
              ['Corners',         'Corner Kicks'],
              ['Fouls',           'Fouls'],
            ].map(([label, key]) => {
              const h = getStat(homeStats, key);
              const a = getStat(awayStats, key);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                  <span style={{ minWidth: 28, textAlign: 'right', fontWeight: 700 }}>{h}</span>
                  <span style={{ flex: 1, textAlign: 'center', color: 'var(--text-3)', fontSize: '0.7rem' }}>{label}</span>
                  <span style={{ minWidth: 28, fontWeight: 700 }}>{a}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: VENUES
// ---------------------------------------------------------------------------
function VenuesTab() {
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
          const data = await fetchVenues(coords.latitude, coords.longitude);
          setVenues(data);
        } catch { /* non-fatal */ }
        finally { setLoading(false); setFetched(true); }
      },
      () => { setDenied(true); setLoading(false); },
    );
  };

  if (denied) return <div className="empty-state">Location access is required to find nearby bars. Enable it in your browser settings.</div>;
  if (!fetched && !loading) {
    return (
      <div style={{ padding: '16px 12px' }}>
        <button className="btn-primary" onClick={load}>Find Bars Near Me</button>
      </div>
    );
  }
  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  if (!venues.length) return <div className="empty-state">No nearby sports bars found.</div>;

  return (
    <div style={{ paddingTop: 12 }}>
      {venues.map((v) => (
        <div key={v.place_id} className="venue-card">
          {v.photo_url
            ? <img className="venue-photo" src={v.photo_url} alt={v.name} />
            : <div className="venue-photo-placeholder">🍺</div>}
          <div className="venue-info">
            <div className="venue-name">{v.name}</div>
            {v.address && <div className="venue-address">{v.address}</div>}
            <div className="venue-meta">
              {v.rating    && <span className="venue-rating">★ {v.rating}</span>}
              {v.distance_km && <span className="venue-distance">{v.distance_km} km</span>}
              {v.open_now === true  && <span className="venue-open">Open now</span>}
              {v.open_now === false && <span style={{ color: 'var(--live)', fontSize: '0.75rem' }}>Closed</span>}
            </div>
            {v.maps_url && <a href={v.maps_url} target="_blank" rel="noreferrer" className="venue-link">Open in Maps</a>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: INFO (broadcast + venue + lineups)
// ---------------------------------------------------------------------------
function InfoTab({ data }) {
  const { match, lineups = [] } = data || {};

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Where to watch */}
      <div className="settings-section" style={{ margin: 0 }}>
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div className="settings-label">Where to Watch (US)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>English</div>
              <div className="channel-grid">{US_BROADCAST.english.map((c) => <span key={c} className="channel-chip">{c}</span>)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Spanish</div>
              <div className="channel-grid">{US_BROADCAST.spanish.map((c) => <span key={c} className="channel-chip">{c}</span>)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Streaming</div>
              <div className="channel-grid">{US_BROADCAST.streaming.map((c) => <span key={c} className="channel-chip">{c}</span>)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Venue info */}
      {match?.venue && (
        <div className="settings-section" style={{ margin: 0 }}>
          <div className="settings-row">
            <div>
              <div className="settings-label">{match.venue}</div>
              <div className="settings-desc">{match.city}</div>
            </div>
            <span style={{ fontSize: '1.2rem' }}>🏟️</span>
          </div>
        </div>
      )}

      {/* Lineups */}
      {lineups.length === 2 && (
        <div className="settings-section" style={{ margin: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div className="settings-label" style={{ marginBottom: 0 }}>Starting Lineups</div>
          </div>
          {lineups.map((team) => (
            <div key={team.team.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
                {team.team.name} ({team.formation})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {team.startXI?.map(({ player }) => (
                  <span key={player.id} style={{ fontSize: '0.78rem', background: 'var(--border)',
                                                  borderRadius: 6, padding: '3px 8px' }}>
                    {player.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Match() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [data,       setData]       = useState(null);
  const [tab,        setTab]        = useState('live');
  const [loading,    setLoading]    = useState(true);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef  = useRef(null);

  const load = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setAnalyzing(true);
    try {
      const result = await fetchMatch(id);
      setData(result);
      setLastUpdated(Date.now());
    } catch { /* keep stale data */ }
    finally { setLoading(false); setAnalyzing(false); }
  };

  useEffect(() => {
    load();
  }, [id]);

  // Poll every 60s when live
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (data?.match?.status === 'live') {
      intervalRef.current = setInterval(() => load(true), 60_000);
    }
    return () => clearInterval(intervalRef.current);
  }, [data?.match?.status]);

  const context = data?.match
    ? [data.match.group, data.match.round].filter(Boolean).join(' - ')
    : '';

  return (
    <div className="page">
      <div className="match-detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <span className="match-detail-title">{context}</span>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <>
          <ScoreHeader match={data?.match} />

          <div className="tab-bar">
            {[['live', 'Live'], ['venues', 'Venues'], ['info', 'Info']].map(([key, label]) => (
              <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                {key === 'live' && data?.match?.status === 'live' && <span className="live-dot" style={{ marginRight: 5 }} />}
                {label}
              </button>
            ))}
          </div>

          {tab === 'live'   && <LiveTab data={data} lastUpdated={lastUpdated} analyzing={analyzing} />}
          {tab === 'venues' && <VenuesTab />}
          {tab === 'info'   && <InfoTab data={data} />}
        </>
      )}
    </div>
  );
}
