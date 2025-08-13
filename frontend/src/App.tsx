import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import HomePage from "./pages/HomePage"
import LobbyPage from "./pages/LobbyPage"
import { Toaster } from "@/components/ui/toaster"

function App() {

  return (
    <Router>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/lobby/:code" element={<LobbyPage />} />
      </Routes>
      <Toaster />
    </Router>
  )
}

export default App
