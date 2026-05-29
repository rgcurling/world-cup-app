import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NavBar     from './components/NavBar.jsx';
import Home       from './pages/Home.jsx';
import Match      from './pages/Match.jsx';
import Standings  from './pages/Standings.jsx';
import Settings   from './pages/Settings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/match/:id"  element={<Match />} />
          <Route path="/standings"  element={<Standings />} />
          <Route path="/settings"   element={<Settings />} />
        </Routes>
        <NavBar />
      </div>
    </BrowserRouter>
  );
}
