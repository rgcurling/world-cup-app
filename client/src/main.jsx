import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

// Register service worker for push notifications + offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err.message);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
