import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/authContext';
import { useTheme } from '../lib/theme';

export function AppLayout() {
  const { signOut, session } = useAuth();
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">World Network</div>
        <NavLink to="/" end>Map</NavLink>
        <NavLink to="/mobility">Mobility</NavLink>
        <NavLink to="/social">Social</NavLink>
        <NavLink to="/feed">Feed</NavLink>
        <NavLink to="/contacts">Contacts</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/import">Import</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <div className="spacer" />
        <button
          className="theme-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <div className="user">{session?.user.email}</div>
        <button className="link" onClick={signOut}>Sign out</button>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
