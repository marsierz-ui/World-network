import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/authContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppLayout } from './components/AppLayout';
import { MapPage } from './pages/MapPage';
import { MobilityPage } from './pages/MobilityPage';
import { SocialPage } from './pages/SocialPage';
import { FeedPage } from './pages/FeedPage';
import { ContactsPage } from './pages/ContactsPage';
import { HistoryPage } from './pages/HistoryPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const { session, loading } = useAuth();

  if (loading) return <div className="center-screen">Loading...</div>;
  if (!session) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<MapPage />} />
        <Route path="mobility" element={<MobilityPage />} />
        <Route path="social" element={<SocialPage />} />
        <Route path="feed" element={<FeedPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
