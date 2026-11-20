import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/authContext';
import { useIsAdmin } from '../features/auth/useIsAdmin';
import { useGoogleAutoSync } from '../features/import/useGoogleAutoSync';
import { useTheme } from '../lib/theme';
import { InvitePrompt } from '../features/card/InvitePrompt';
import { VisitBanner } from '../features/visits/VisitBanner';
import { useCityLocation } from '../features/visits/useCityLocation';
import { useVisitNotices } from '../features/visits/useVisits';
import { FeedbackButton } from '../features/feedback/Feedback';
import { MoreApps } from '../features/apps/MoreApps';
import { TrailMark, Wordmark } from './TrailMark';

export function AppLayout() {
  const { signOut, session } = useAuth();
  const { isAdmin } = useIsAdmin();
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  // Mounted here, not on a page, so the sync keeps its cadence wherever the user
  // happens to be in the app.
  const autoSync = useGoogleAutoSync();
  useCityLocation();
  const unread = (useVisitNotices().data ?? []).filter((n) => !n.read_at).length;
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand"><TrailMark /><Wordmark /></div>
        <NavLink to="/" end viewTransition>Map</NavLink>
        <NavLink to="/contacts" viewTransition>Contacts</NavLink>
        <NavLink to="/visits" viewTransition>
          Visits{unread > 0 && <span className="filter-count nav-count">{unread}</span>}
        </NavLink>
        <NavLink to="/card" viewTransition>My card</NavLink>
        <NavLink to="/history" viewTransition>History</NavLink>
        <NavLink to="/mobility" viewTransition>Mobility</NavLink>
        {isAdmin && (
          <>
            <NavLink to="/social" viewTransition>Social</NavLink>
            <NavLink to="/feed" viewTransition>Feed</NavLink>
          </>
        )}
        <NavLink to="/import" viewTransition>Import</NavLink>
        <NavLink to="/settings" viewTransition>Settings</NavLink>
        <div className="spacer" />
        <MoreApps />
        {autoSync.busy && <div className="sync-note">Syncing Google...</div>}
        {autoSync.problem && (
          <NavLink to="/settings" className="sync-note warn" title={autoSync.problem}>
            Google sync needs attention
          </NavLink>
        )}
        <FeedbackButton />
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
        <VisitBanner />
        <Outlet />
        <InvitePrompt />
      </main>
    </div>
  );
}
