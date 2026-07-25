import { Navigate, Route, Routes } from 'react-router-dom';
import { useSpontan } from './state/SpontanProvider';
import { AppBar } from './components/AppBar';
import { BottomNav } from './components/BottomNav';
import { LoginScreen } from './screens/LoginScreen';
import { FeedScreen } from './screens/FeedScreen';
import { IntentScreen } from './screens/IntentScreen';
import { CreateScreen } from './screens/CreateScreen';
import { SessionScreen } from './screens/SessionScreen';
import { ProfileScreen } from './screens/ProfileScreen';

export default function App() {
  const { currentPersonId } = useSpontan();

  if (!currentPersonId) {
    return <LoginScreen />;
  }

  return (
    <div className="app-shell">
      <AppBar />
      <main className="app-main">
        <Routes>
          <Route index element={<FeedScreen />} />
          <Route path="/sugen" element={<IntentScreen />} />
          <Route path="/starta" element={<CreateScreen />} />
          <Route path="/pass/:sessionId" element={<SessionScreen />} />
          <Route path="/jag" element={<ProfileScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
