import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PreGameLobby from './pages/PreGameLobby';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lobby/:code" element={<PreGameLobby />} />
      </Routes>
    </Router>
  );
}

export default App;
