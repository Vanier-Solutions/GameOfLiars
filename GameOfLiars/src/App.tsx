import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PreGameLobby from './pages/PreGameLobby';
import InGamePage from './pages/InGamePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lobby/:code" element={<PreGameLobby />} />
        <Route path="/game/:code" element={<InGamePage />} />
      </Routes>
    </Router>
  );
}

export default App;
