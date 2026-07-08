import { Navigate, Route, Routes } from 'react-router-dom';
import { useBingo } from './state/BingoProvider';
import { AppBar } from './components/AppBar';
import { BottomNav } from './components/BottomNav';
import { LoginScreen } from './screens/LoginScreen';
import { MyCardScreen } from './screens/MyCardScreen';
import { TeamCardScreen } from './screens/TeamCardScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { FinalScreen } from './screens/FinalScreen';
import { CoachScreen } from './screens/CoachScreen';

export default function App() {
  const { currentPlayerId, isCoach } = useBingo();

  if (!currentPlayerId) {
    return <LoginScreen />;
  }

  return (
    <div className="app-shell">
      <AppBar />
      <main className="app-main">
        <Routes>
          <Route index element={<MyCardScreen />} />
          <Route path="/lag" element={<TeamCardScreen />} />
          <Route path="/topplista" element={<LeaderboardScreen />} />
          <Route path="/final" element={<FinalScreen />} />
          <Route path="/coach" element={isCoach ? <CoachScreen /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
