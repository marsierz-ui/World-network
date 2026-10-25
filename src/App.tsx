import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/authContext';
import { useIsAdmin } from './features/auth/useIsAdmin';
import { LoginPage } from './features/auth/LoginPage';
import { PendingDeletionPage } from './features/account/PendingDeletionPage';
import { usePendingDeletion } from './features/account/useAccountDeletion';
import { AppLayout } from './components/AppLayout';
import { MapPage } from './pages/MapPage';
import { MobilityPage } from './pages/MobilityPage';
import { SocialPage } from './pages/SocialPage';
import { FeedPage } from './pages/FeedPage';
import { ContactsPage } from './pages/ContactsPage';
import { HistoryPage } from './pages/HistoryPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();
  if (loading) return <div className="center-screen">Loading...</div>;
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  const { session, loading } = useAuth();
  const pending = usePendingDeletion();

  if (loading) return <div className="center-screen">Loading...</div>;
  if (!session) return <LoginPage />;
  if (pending.isLoading) return <div className="center-screen">Loading...</div>;
  // The app (and with it the Google auto-sync in AppLayout) never mounts for an
  // account waiting out its deletion.
  if (pending.data) return <PendingDeletionPage pending={pending.data} />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<MapPage />} />
        <Route path="mobility" element={<AdminOnly><MobilityPage /></AdminOnly>} />
        <Route path="social" element={<AdminOnly><SocialPage /></AdminOnly>} />
        <Route path="feed" element={<AdminOnly><FeedPage /></AdminOnly>} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
