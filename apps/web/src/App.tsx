import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Nav, ToastHost } from './ui.js';
import { useAuth } from './store.js';
import { Home } from './pages/Home.js';
import { Auth } from './pages/Auth.js';
import { CreateWorker } from './pages/CreateWorker.js';
import { Office } from './pages/Office.js';
import { AgentLab } from './pages/AgentLab.js';
import { Arena } from './pages/Arena.js';
import { MatchView } from './pages/MatchView.js';
import { Replays } from './pages/Replays.js';
import { Leaderboard } from './pages/Leaderboard.js';
import { Tournaments } from './pages/Tournaments.js';
import { TournamentDetail } from './pages/TournamentDetail.js';
import { ChainVault } from './pages/ChainVault.js';
import { Store } from './pages/Store.js';
import { Economy } from './pages/Economy.js';
import { Profile } from './pages/Profile.js';
import { Docs } from './pages/Docs.js';

export function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="app">
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/create" element={<CreateWorker />} />
        <Route path="/office" element={<Office />} />
        <Route path="/lab" element={<AgentLab />} />
        <Route path="/lab/:workerId" element={<AgentLab />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/match/:id" element={<MatchView />} />
        <Route path="/replays" element={<Replays />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/chain" element={<ChainVault />} />
        <Route path="/store" element={<Store />} />
        <Route path="/economy" element={<Economy />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
      <ToastHost />
    </div>
  );
}
