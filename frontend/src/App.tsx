import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import HomePage from "./pages/HomePage"
import LobbyPage from "./pages/LobbyPage"
import GamePage from "./pages/GamePage"


function App() {

  return (
    <Router>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/lobby/:code" element={<LobbyPage />} />
      <Route path="/game/:code" element={<GamePage />} />
      </Routes>

    </Router>
  )
}

export default App
