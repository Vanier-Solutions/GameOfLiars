import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Analytics } from "@vercel/analytics/react"
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
      <Analytics />
    </Router>
  )
}

export default App
