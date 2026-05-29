import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchMatch, fetchPlayerRatings, fetchVenues } from '../utils/api.js';

const US_BROADCAST = {
  english:   ['Fox Sports', 'FS1'],
  spanish:   ['Telemundo', 'Universo'],
  streaming: ['Peacock', 'Fubo', 'Sling TV', 'YouTube TV'],
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function TeamLogo({ src, name, size = 40 }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', background: 'var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700, color: 'var(--text-2)',
      }}>{name?.[0] ?? '?'}</div>
    );
  }
  return <img src={src} alt={name} style={{ width: size, height: size, objectFit: 'contain' }} onError={() => setErr(true)} />;
}

function SectionBox({ title, children }) {
  return (
    <div style={{ padding: '0 12px 14px' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>{title}</div>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score header
// ---------------------------------------------------------------------------
function ScoreHeader({ match }) {
  if (!match) return null;
  const { home_team, away_team, home_logo, away_logo, home_score, away_score, status, minute } = match;
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

// ---------------------------------------------------------------------------
// Tab 1: LIVE
// ---------------------------------------------------------------------------
function LiveTab({ data, lastUpdated, analyzing }) {
  const { match, events = [], stats = [], analysis } = data || {};
  const timeline   = [...events]
    .filter((e) => ['Goal', 'Card', 'subst'].includes(e.type))
    .sort((a, b) => a.time.elapsed - b.time.elapsed);
  const homeStats  = stats[0]?.statistics || [];
  const awayStats  = stats[1]?.statistics || [];
  const getStat    = (arr, type) => arr.find((s) => s.type === type)?.value ?? '-';
  const secAgo     = lastUpdated ? Math.floor((Date.now() - lastUpdated) / 1000) : null;

  if (!data) return <div className="loading-state"><div className="spinner" /></div>;
  if (match?.status === 'scheduled') {
    return <div className="empty-state">Match hasn't started. Check back at kickoff.</div>;
  }

  return (
    <div style={{ paddingTop: 12 }}>
      {/* AI Analysis */}
      <div style={{ padding: '0 12px 14px' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span>AI Analysis</span>
          {secAgo !== null && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)' }}>Updated {secAgo}s ago</span>}
        </div>
        <div className="ai-update-card latest fade-in">
          {analyzing
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)' }}><div className="spinner" style={{ width: 18, height: 18 }} /><span style={{ fontSize: '0.85rem' }}>Analyzing...</span></div>
            : <p className="ai-summary">{analysis ?? 'Analysis not available for this match.'}</p>}
        </div>
      </div>

      {/* Event timeline */}
      {timeline.length > 0 && (
        <SectionBox title="Events">
          {timeline.map((e, i) => {
            const min  = e.time.extra ? `${e.time.elapsed}+${e.time.extra}'` : `${e.time.elapsed}'`;
            const icon = e.type === 'Goal' ? '⚽' : e.detail === 'Red Card' ? '🟥' : e.type === 'Card' ? '🟨' : '🔄';
            const desc = e.type === 'Goal'
              ? `${e.player.name}${e.detail === 'Own Goal' ? ' (OG)' : e.detail === 'Penalty' ? ' (pen)' : ''}`
              : e.type === 'Card' ? e.player.name : `${e.player.name} on`;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                    borderBottom: i < timeline.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', minWidth: 38, fontVariantNumeric: 'tabular-nums' }}>{min}</span>
                <span>{icon}</span>
                <span style={{ fontSize: '0.85rem', flex: 1 }}>{desc}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{e.team.name}</span>
              </div>
            );
          })}
        </SectionBox>
      )}

      {/* Stats bars */}
      {(homeStats.length > 0 || awayStats.length > 0) && (
        <SectionBox title="Stats">
          {[['Possession','Ball Possession'],['Shots on target','Shots on Goal'],['Corners','Corner Kicks'],['Fouls','Fouls'],['xG','expected_goals']].map(([label, key]) => {
            const h = getStat(homeStats, key);
            const a = getStat(awayStats, key);
            if (h === '-' && a === '-') return null;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ minWidth: 32, textAlign: 'right', fontWeight: 700 }}>{h}</span>
                <span style={{ flex: 1, textAlign: 'center', color: 'var(--text-3)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
                <span style={{ minWidth: 32, fontWeight: 700 }}>{a}</span>
              </div>
            );
          })}
        </SectionBox>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: PLAYERS
// ---------------------------------------------------------------------------
function PlayerPhoto({ src, name }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <div className="player-photo-placeholder">{name?.[0] ?? '?'}</div>;
  return <img className="player-photo" src={src} alt={name} onError={() => setErr(true)} />;
}

function ratingClass(r) {
  if (!r) return 'none';
  const n = parseFloat(r);
  if (n >= 7.5) return 'high';
  if (n >= 6.5) return 'mid';
  return 'low';
}

function PlayersTab({ fixtureId }) {
  const [players, setPlayers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayerRatings(fixtureId)
      .then(setPlayers)
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  }, [fixtureId]);

  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  if (!players?.length) return <div className="empty-state">Player ratings are not available for this match. They require an upgraded API plan.</div>;

  const byTeam = players.reduce((acc, p) => {
    const team = p.statistics[0]?.team;
    if (!team) return acc;
    if (!acc[team.id]) acc[team.id] = { team, players: [] };
    acc[team.id].players.push(p);
    return acc;
  }, {});

  return (
    <div style={{ paddingTop: 12 }}>
      {Object.values(byTeam).map(({ team, players: teamPlayers }) => (
        <div key={team.id}>
          <div className="player-section-label">
            {team.logo && <img src={team.logo} alt={team.name} style={{ width: 20, height: 20, objectFit: 'contain' }} />}
            {team.name}
          </div>
          <div style={{ margin: '0 12px 12px', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {teamPlayers.map((p) => {
              const stats  = p.statistics[0];
              const rating = stats?.games?.rating;
              const pos    = stats?.games?.position ?? '';
              const goals  = stats?.goals?.total;
              const assists = stats?.goals?.assists;
              const shots  = stats?.shots?.on;
              const details = [
                goals    && `${goals}G`,
                assists  && `${assists}A`,
                shots    && `${shots} shots`,
                stats?.games?.minutes && `${stats.games.minutes}'`,
              ].filter(Boolean).join(' · ');
              return (
                <div key={p.player.id} className="player-row">
                  <PlayerPhoto src={p.player.photo} name={p.player.name} />
                  <div className="player-info">
                    <div className="player-name">{p.player.name}</div>
                    <div className="player-detail">{pos}{details ? ` · ${details}` : ''}</div>
                  </div>
                  <div className={`player-rating ${ratingClass(rating)}`}>
                    {rating ? parseFloat(rating).toFixed(1) : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: VENUES
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
        try { setVenues(await fetchVenues(coords.latitude, coords.longitude)); }
        catch { /* non-fatal */ }
        finally { setLoading(false); setFetched(true); }
      },
      () => { setDenied(true); setLoading(false); },
    );
  };

  if (denied) return <div className="empty-state">Location access required. Enable it in your browser settings.</div>;
  if (!fetched && !loading) return <div style={{ padding: '16px 12px' }}><button className="btn-primary" onClick={load}>Find Bars Near Me</button></div>;
  if (loading)  return <div className="loading-state"><div className="spinner" /></div>;
  if (!venues.length) return <div className="empty-state">No nearby sports bars found.</div>;

  return (
    <div style={{ paddingTop: 12 }}>
      {venues.map((v) => (
        <div key={v.place_id} className="venue-card">
          {v.photo_url ? <img className="venue-photo" src={v.photo_url} alt={v.name} /> : <div className="venue-photo-placeholder">🍺</div>}
          <div className="venue-info">
            <div className="venue-name">{v.name}</div>
            {v.address && <div className="venue-address">{v.address}</div>}
            <div className="venue-meta">
              {v.rating     && <span className="venue-rating">★ {v.rating}</span>}
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
// Tab 4: INFO
// ---------------------------------------------------------------------------
function PredictionWidget({ predictions }) {
  if (!predictions?.length) return null;
  const p   = predictions[0];
  const pct = p.predictions?.percent;
  const advice = p.predictions?.advice ?? '';
  // Hide widget when the API has no real data (all equal or explicit "no data" message)
  if (!pct) return null;
  if (advice.toLowerCase().includes('no prediction')) return null;
  if (pct.home === pct.draw && pct.draw === pct.away) return null;
  return (
    <div className="prediction-card">
      <div className="prediction-title">Pre-match Prediction</div>
      <div className="prediction-bars">
        {[['Home', pct.home, 'home'], ['Draw', pct.draw, 'draw'], ['Away', pct.away, 'away']].map(([label, val, cls]) => (
          <div key={cls} className="prediction-row">
            <span className="prediction-label">{label}</span>
            <div className="prediction-track"><div className={`prediction-fill ${cls}`} style={{ width: val || '0%' }} /></div>
            <span className="prediction-pct">{val || '0%'}</span>
          </div>
        ))}
      </div>
      {advice && <div className="prediction-advice">{advice}</div>}
    </div>
  );
}

function H2HSection({ h2h, homeName, awayName }) {
  if (!h2h?.length) return null;
  return (
    <SectionBox title={`${homeName} vs ${awayName} — Last ${h2h.length} meetings`}>
      {h2h.map((m) => (
        <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="h2h-row">
            <span className="h2h-team home">{m.home_team}</span>
            <span className="h2h-score">{m.home_score ?? '-'} - {m.away_score ?? '-'}</span>
            <span className="h2h-team">{m.away_team}</span>
          </div>
          <div className="h2h-date">{new Date(m.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · {m.league}</div>
        </div>
      ))}
    </SectionBox>
  );
}

function InjuriesSection({ injuries }) {
  if (!injuries?.length) return null;
  return (
    <SectionBox title="Injuries / Unavailable">
      {injuries.map((inj, i) => (
        <div key={i} className="injury-row">
          {inj.team?.logo && <img className="injury-team-logo" src={inj.team.logo} alt={inj.team.name} />}
          <span className="injury-name">{inj.player?.name}</span>
          <span className="injury-type">{inj.injury?.type ?? inj.injury?.reason ?? 'Unavailable'}</span>
        </div>
      ))}
    </SectionBox>
  );
}

function InfoTab({ data }) {
  const { match, lineups = [], predictions, h2h, injuries } = data || {};
  return (
    <div style={{ paddingTop: 12 }}>
      <PredictionWidget predictions={predictions} />
      <InjuriesSection injuries={injuries} />
      <H2HSection h2h={h2h} homeName={match?.home_team} awayName={match?.away_team} />

      {/* Broadcast */}
      <SectionBox title="Where to Watch (US)">
        {[['English', US_BROADCAST.english], ['Spanish', US_BROADCAST.spanish], ['Streaming', US_BROADCAST.streaming]].map(([label, channels]) => (
          <div key={label} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
            <div className="channel-grid">{channels.map((c) => <span key={c} className="channel-chip">{c}</span>)}</div>
          </div>
        ))}
      </SectionBox>

      {/* Venue */}
      {match?.venue && (
        <SectionBox title="Stadium">
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{match.venue}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>{match.city}</div>
            </div>
            <span style={{ fontSize: '1.3rem' }}>🏟️</span>
          </div>
        </SectionBox>
      )}

      {/* Lineups */}
      {lineups.length === 2 && (
        <SectionBox title="Starting Lineups">
          {lineups.map((team, ti) => (
            <div key={team.team.id} style={{ padding: '10px 14px', borderBottom: ti === 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
                {team.team.name} ({team.formation})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {team.startXI?.map(({ player }) => (
                  <span key={player.id} style={{ fontSize: '0.78rem', background: 'var(--border)', borderRadius: 6, padding: '3px 8px' }}>
                    {player.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </SectionBox>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Match() {
  const { id }         = useParams();
  const navigate       = useNavigate();
  const [data,         setData]         = useState(null);
  const [tab,          setTab]          = useState('live');
  const [loading,      setLoading]      = useState(true);
  const [analyzing,    setAnalyzing]    = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const intervalRef    = useRef(null);

  const load = async (bg = false) => {
    if (!bg) setLoading(true); else setAnalyzing(true);
    try {
      setData(await fetchMatch(id));
      setLastUpdated(Date.now());
    } catch { /* keep stale */ }
    finally { setLoading(false); setAnalyzing(false); }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (data?.match?.status === 'live') {
      intervalRef.current = setInterval(() => load(true), 60_000);
    }
    return () => clearInterval(intervalRef.current);
  }, [data?.match?.status]);

  const context = data?.match ? [data.match.group, data.match.round].filter(Boolean).join(' - ') : '';

  const TABS = [
    { key: 'live',    label: 'Live' },
    { key: 'players', label: 'Players' },
    { key: 'venues',  label: 'Venues' },
    { key: 'info',    label: 'Info' },
  ];

  return (
    <div className="page">
      <div className="match-detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <span className="match-detail-title">{context}</span>
      </div>

      {loading ? <div className="loading-state"><div className="spinner" /></div> : (
        <>
          <ScoreHeader match={data?.match} />
          <div className="tab-bar">
            {TABS.map(({ key, label }) => (
              <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                {key === 'live' && data?.match?.status === 'live' && <span className="live-dot" style={{ marginRight: 5 }} />}
                {label}
              </button>
            ))}
          </div>
          {tab === 'live'    && <LiveTab data={data} lastUpdated={lastUpdated} analyzing={analyzing} />}
          {tab === 'players' && <PlayersTab fixtureId={id} />}
          {tab === 'venues'  && <VenuesTab />}
          {tab === 'info'    && <InfoTab data={data} />}
        </>
      )}
    </div>
  );
}
