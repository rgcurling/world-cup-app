export default function Settings() {
  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <div className="settings-section">
        <div className="settings-row">
          <div>
            <div className="settings-label">AI Commentary</div>
            <div className="settings-desc">Powered by Claude. Updates every 60 seconds during live matches.</div>
          </div>
          <span style={{ fontSize: '1rem', color: 'var(--accent)' }}>✦</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Live Scores</div>
            <div className="settings-desc">Scores and events refresh automatically when a match is in progress.</div>
          </div>
          <span style={{ fontSize: '1.2rem' }}>⚽</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Broadcast (US)</div>
            <div className="settings-desc">Fox, FS1, Telemundo, Universo, Peacock, Fubo, Sling TV, YouTube TV</div>
          </div>
          <span style={{ fontSize: '1rem' }}>📺</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">World Cup 2026</div>
            <div className="settings-desc">June 11 -- July 19, 2026. 48 teams. 104 matches.</div>
          </div>
          <span style={{ fontSize: '1.2rem' }}>🏆</span>
        </div>
      </div>

      <p style={{ padding: '16px', fontSize: '0.7rem', color: 'var(--text-3)', textAlign: 'center' }}>
        KickoffAI -- World Cup 2026
      </p>
    </div>
  );
}
