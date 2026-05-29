import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/',          icon: '⚽', label: 'Matches'  },
  { to: '/standings', icon: '📊', label: 'Standings' },
  { to: '/settings',  icon: '⚙️',  label: 'Settings'  },
];

export default function NavBar() {
  return (
    <nav className="nav-bar">
      {ITEMS.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon">{icon}</span>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
