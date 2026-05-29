import { useState, useEffect } from 'react';
import { fetchVapidKey, saveSubscription, removeSubscription } from '../utils/api.js';

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export default function Settings() {
  const [supported,   setSupported]   = useState(false);
  const [permission,  setPermission]  = useState('default');
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [statusMsg,   setStatusMsg]   = useState('');

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (ok) {
      setPermission(Notification.permission);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub));
      });
    }
  }, []);

  const enable = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setStatusMsg('Permission denied. Enable notifications in browser settings.');
        return;
      }

      const { publicKey } = await fetchVapidKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:     true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await saveSubscription(sub);
      setSubscribed(true);
      setStatusMsg('Notifications enabled.');
    } catch (e) {
      setStatusMsg('Could not enable notifications: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setStatusMsg('Notifications disabled.');
    } catch (e) {
      setStatusMsg('Could not disable notifications: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <div className="settings-section" style={{ margin: '16px 12px 0' }}>
        <div className="settings-row">
          <div>
            <div className="settings-label">Push Notifications</div>
            <div className="settings-desc">
              {!supported
                ? 'Not supported in this browser'
                : permission === 'denied'
                  ? 'Blocked -- enable in browser settings'
                  : subscribed
                    ? 'You will receive AI updates during live matches'
                    : 'Get live AI commentary every 15 minutes'}
            </div>
          </div>
          {supported && permission !== 'denied' && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={subscribed}
                disabled={loading}
                onChange={subscribed ? disable : enable}
              />
              <span className="toggle-slider" />
            </label>
          )}
        </div>
      </div>

      {statusMsg && (
        <p style={{ padding: '10px 16px', fontSize: '0.8rem', color: 'var(--text-2)' }}>
          {statusMsg}
        </p>
      )}

      <div className="settings-section" style={{ margin: '16px 12px 0' }}>
        <div className="settings-row">
          <div>
            <div className="settings-label">World Cup 2026</div>
            <div className="settings-desc">June 11 -- July 19, 2026 · 48 teams · 104 matches</div>
          </div>
          <span style={{ fontSize: '1.3rem' }}>⚽</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">AI Commentary</div>
            <div className="settings-desc">Powered by Claude -- updated every 15 minutes during live matches</div>
          </div>
          <span style={{ fontSize: '1rem', color: 'var(--accent)' }}>✦</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Broadcast</div>
            <div className="settings-desc">Fox, FS1, Telemundo, Universo, Peacock, Fubo, Sling TV, YouTube TV</div>
          </div>
          <span style={{ fontSize: '1rem' }}>📺</span>
        </div>
      </div>

      <p style={{ padding: '16px', fontSize: '0.7rem', color: 'var(--text-3)', textAlign: 'center' }}>
        KickoffAI -- World Cup 2026
      </p>
    </div>
  );
}
