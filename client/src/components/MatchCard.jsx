import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatKickoff } from '../utils/time.js';

function TeamLogo({ src, name }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="team-logo-fallback">{name?.[0] ?? '?'}</div>
    );
  }
  return <img className="team-logo" src={src} alt={name} onError={() => setErr(true)} />;
}

function ScoreDigit({ value }) {
  const prev    = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prev.current !== value && value != null) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  return <span className={`score-digit${flash ? ' updated' : ''}`}>{value ?? 0}</span>;
}

export default function MatchCard({ match }) {
  const navigate = useNavigate();
  const { fixture_id, home_team, away_team, home_score, away_score,
          status, kickoff_utc, round, group_name,
          home_logo_url, away_logo_url } = match;

  const context = [group_name, round].filter(Boolean).join(' · ');
  const isLive  = status === 'live';
  const isFT    = status === 'finished';

  return (
    <div className="match-card fade-in" onClick={() => navigate(`/match/${fixture_id}`)}>
      <div className="match-card-meta">
        <span className="match-card-context">{context}</span>
        {isLive && (
          <span className="status-badge live">
            <span className="live-dot" />
            LIVE
          </span>
        )}
        {isFT && <span className="status-badge finished">FT</span>}
        {!isLive && !isFT && (
          <span className="status-badge scheduled">{formatKickoff(kickoff_utc)}</span>
        )}
      </div>

      <div className="match-card-teams">
        <div className="team">
          <TeamLogo src={home_logo_url} name={home_team} />
          <span className="team-name">{home_team}</span>
        </div>

        <div className="match-score">
          {(isLive || isFT) ? (
            <div className="score-line">
              <ScoreDigit value={home_score} />
              <span className="score-sep">-</span>
              <ScoreDigit value={away_score} />
            </div>
          ) : (
            <span className="vs-label">vs</span>
          )}
        </div>

        <div className="team">
          <TeamLogo src={away_logo_url} name={away_team} />
          <span className="team-name">{away_team}</span>
        </div>
      </div>
    </div>
  );
}
