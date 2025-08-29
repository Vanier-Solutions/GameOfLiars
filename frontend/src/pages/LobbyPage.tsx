"use client"

import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Crown, Trash2, Plus, X } from "lucide-react"
import { socketService, addSocketListener, removeSocketListener } from "@/lib/socket"
import { getBaseUrl } from "@/lib/api"

function GameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#1f2937" stroke="#374151" strokeWidth="2"/>
      <rect x="8" y="10" width="8" height="12" rx="1" fill="#3b82f6" stroke="#1e40af" strokeWidth="1"/>
      <rect x="16" y="10" width="8" height="12" rx="1" fill="#ef4444" stroke="#dc2626" strokeWidth="1"/>
      <text x="16" y="20" textAnchor="middle" fill="white" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="bold">?</text>
    </svg>
  )
}

interface Player {
  id: string
  name: string
  isCaptain?: boolean
  isHost?: boolean
  team?: "blue" | "red" 
}

interface GameSettings {
  rounds: number
  roundLimit: number
  tags: string[]
}

export default function LobbyPage() {
  const { code } = useParams()
  const [blueTeam, setBlueTeam] = useState<Player[]>([])
  const [redTeam, setRedTeam] = useState<Player[]>([])
  const [gameSettings, setGameSettings] = useState<GameSettings>({ rounds: 7, roundLimit: 60, tags: ["General"] })
  const [hostName, setHostName] = useState<string>("")
  const [newTag, setNewTag] = useState("")
  const gameCode = code || "" 
  const [currentLobbyFromToken, setCurrentLobbyFromToken] = useState<string | null>(null)
  const [isHost, setIsHost] = useState<boolean>(false)
  const [hasCaptains, setHasCaptains] = useState<boolean>(false)
  const navigate = useNavigate()
  
  const MAX_TEAM_SIZE = 8;

  useEffect(() => {
    // Decode token to determine host status for UI
    const token = localStorage.getItem("gameToken")
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setIsHost(Boolean(payload?.isHost))
      } catch {}
    } else {
      setIsHost(false)
    }
    const fetchLobby = async () => {
      try {
        const token = localStorage.getItem("gameToken")
        // If no token yet, redirect to home with join query parameter
        if (!token) {
          navigate(`/?join=${gameCode}`)
          return
        }
        const res = await fetch(`${getBaseUrl()}/api/lobby/${gameCode}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          // If 401/403 or lobby not found, redirect to home
          localStorage.removeItem("gameToken")
          navigate("/")
          return
        }
        const lobby = data.data
        setBlueTeam(lobby.blueTeam)
        setRedTeam(lobby.redTeam)
        setGameSettings(lobby.settings)
        setHostName(lobby.host.name)
        setCurrentLobbyFromToken(lobby.code)
        setHasCaptains(Boolean(lobby.captains?.blue && lobby.captains?.red))

        // Connect to socket and join lobby
        socketService.connect()
        socketService.joinLobby(token)
      } catch (err: any) {
        // Network or other errors - redirect home
        localStorage.removeItem("gameToken")
        navigate("/")
      }
    }
    if (gameCode) fetchLobby()
  }, [gameCode, navigate])

  // If user navigates to a different lobby while having a token for another lobby, leave previous
  useEffect(() => {
    const token = localStorage.getItem('gameToken')
    if (!token) return
    if (currentLobbyFromToken && currentLobbyFromToken !== gameCode) {
      fetch(`${getBaseUrl()}/api/lobby/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).finally(() => {
        localStorage.removeItem('gameToken')
        navigate("/") 
      })
    }
  }, [gameCode, currentLobbyFromToken])

  // Set up socket event listeners
  useEffect(() => {
    const setupSocketListeners = () => {
      // Handle player joined
      addSocketListener('player-joined', (data) => {
        const { player, lobby } = data
        setBlueTeam(lobby.blueTeam)
        setRedTeam(lobby.redTeam)
        setHasCaptains(Boolean(lobby.captains?.blue && lobby.captains?.red))
        // Player joined
      })

      // Handle player left
      addSocketListener('player-left', (data) => {
        const { player, lobby } = data
        setBlueTeam(lobby.blueTeam)
        setRedTeam(lobby.redTeam)
        setHasCaptains(Boolean(lobby.captains?.blue && lobby.captains?.red))
        // Player left
      })

      // Handle player disconnected
      addSocketListener('player-disconnected', () => {
        // Player disconnected
      })

      // Handle lobby updates
      addSocketListener('lobby-updated', (data) => {
        const { lobby, updateType } = data
        setBlueTeam(lobby.blueTeam)
        setRedTeam(lobby.redTeam)
        setGameSettings(lobby.settings)
        setHasCaptains(Boolean(lobby.captains?.blue && lobby.captains?.red))
        
        if (updateType === 'team-change') {
          // Teams updated
        } else if (updateType === 'settings') {
          // Settings updated
        }
      })

      // Handle lobby ended
      addSocketListener('lobby-ended', (data) => {
        localStorage.removeItem('gameToken')
        navigate('/')
      })

      // Handle when current player gets kicked
      addSocketListener('you-were-kicked', (data) => {
        // You were kicked
        localStorage.removeItem('gameToken')
        navigate('/')
      })

      // Handle player kicked (for other players)
      addSocketListener('player-kicked', (data) => {
        setBlueTeam(data.lobby.blueTeam)
        setRedTeam(data.lobby.redTeam)
        setHasCaptains(Boolean(data.lobby.captains?.blue && data.lobby.captains?.red))
        // Player kicked
      })

      // Handle player team changed
      addSocketListener('player-team-changed', (data) => {
        const { player, lobby } = data
        setBlueTeam(lobby.blueTeam)
        setRedTeam(lobby.redTeam)
        setHasCaptains(Boolean(lobby.captains?.blue && lobby.captains?.red))
        // Team updated
      })

      // Handle settings updated
      addSocketListener('settings-updated', (data) => {
        const { lobby } = data;
        setGameSettings(lobby.settings);
      })

      // Handle game started -> navigate to game page
      addSocketListener('game-started', (data) => {
        if (data?.lobbyCode === gameCode) {
          navigate(`/game/${gameCode}`)
        }
      })

    }

    setupSocketListeners()

    // Cleanup function to remove all listeners
    return () => {
      removeSocketListener('player-joined')
      removeSocketListener('player-left')
      removeSocketListener('player-disconnected')
      removeSocketListener('lobby-updated')
      removeSocketListener('lobby-ended')
      removeSocketListener('you-were-kicked')
      removeSocketListener('player-kicked')
      removeSocketListener('player-team-changed')
      removeSocketListener('settings-updated')
      removeSocketListener('game-started')
    }
  }, [navigate])

  // Cleanup socket connection on unmount
  useEffect(() => {
    return () => {
      const token = localStorage.getItem('gameToken')
      if (token) {
        socketService.leaveLobby(token)
      }
      socketService.disconnect()
    }
  }, [])


  const addTag = () => {
    if (newTag.trim() && !gameSettings.tags.includes(newTag.trim())) {
      setGameSettings((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }))
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setGameSettings((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }))
  }

  const PlayerCard = ({ player, onKick }: { player: Player; onKick: () => void }) => (
    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
      <div className="flex items-center gap-2">
        {player.isCaptain && <Crown className="w-4 h-4 text-yellow-400" />}
        <span className="text-white font-medium">{player.name}</span>
      </div>
      {isHost && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onKick}
          className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  )

  const CaptainSlot = ({ captain, teamColor, onJoinAsCaptain, onKick }: { 
    captain?: Player; 
    teamColor: "blue" | "red"; 
    onJoinAsCaptain: () => void;
    onKick: () => void;
  }) => {
    if (captain) {
      return (
        <div className="p-4 bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded-lg border-2 border-yellow-400/30 relative">
          <div className="absolute -top-2 left-3 bg-slate-800 px-2 py-1 rounded text-xs font-semibold text-yellow-400 border border-yellow-400/30">
            CAPTAIN
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-bold text-lg">{captain.name}</span>
            </div>
            {isHost && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onKick}
                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="p-4 bg-gradient-to-r from-slate-700/30 to-slate-600/30 rounded-lg border-2 border-dashed border-slate-500/50 relative">
        <div className="absolute -top-2 left-3 bg-slate-800 px-2 py-1 rounded text-xs font-semibold text-slate-400 border border-slate-500/30">
          CAPTAIN
        </div>
        <div className="flex items-center justify-center pt-2">
          <Button 
            onClick={onJoinAsCaptain}
            className={`${teamColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'} text-white flex items-center gap-2`}
          >
            <Crown className="w-4 h-4" />
            Become Captain
          </Button>
        </div>
      </div>
    )
  }

  const handleStartGame = async () => {
    try {
      const token = localStorage.getItem('gameToken')
      if (!token) return
      const res = await fetch(`${getBaseUrl()}/api/lobby/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to start game')
      // Game started
      // Optionally navigate to game screen later
    } catch (e: any) {
      // Start failed
    }
  }

  const handleEndLobby = async () => {
    try {
      const token = localStorage.getItem('gameToken')
      if (!token) return
      const res = await fetch(`${getBaseUrl()}/api/lobby/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to end lobby')
      localStorage.removeItem('gameToken')
      navigate('/')
    } catch (e: any) {
      // End lobby failed
    }
  }

  const handleLeaveLobby = async () => {
    try {
      const token = localStorage.getItem('gameToken')
      if (!token) return
      const res = await fetch(`${getBaseUrl()}/api/lobby/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to leave lobby')
      localStorage.removeItem('gameToken')
      navigate('/')
    } catch (e: any) {
      // Leave failed
    }
  }

  const handleJoinTeam = async (team: 'blue' | 'red', isCaptain: boolean = false) => {
    try {
      const token = localStorage.getItem('gameToken')
      if (!token) return
      
      const res = await fetch(`${getBaseUrl()}/api/lobby/teamSelect`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ team, isCaptain })
      })
      
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to join team')
      
      // Team joined
      
      // Update local state with new lobby data
      if (data.lobby) {
        setBlueTeam(data.lobby.blueTeam)
        setRedTeam(data.lobby.redTeam)
        setHasCaptains(Boolean(data.lobby.captains?.blue && data.lobby.captains?.red))
        
      }
    } catch (e: any) {
      // Team join failed
    }
  }

  const handleUpdateSettings = async () => {
    try {
      const token = localStorage.getItem('gameToken');
      if (!token) return;

      const res = await fetch(`${getBaseUrl()}/api/lobby/updateSettings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: gameSettings })
      })

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update settings');
      }
      // Settings updated;
    } catch (e: any) {
      // Update settings failed;
    }
  }

  const handleKickPlayer = async (playerId: string) => {
    try {
      const token = localStorage.getItem('gameToken');
      if (!token) return;

      const res = await fetch(`${getBaseUrl()}/api/lobby/kickPlayer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId: playerId })
      })

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to kick player');
      // Player kicked;
    } catch (e: any) {
      // Kick player failed;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900 to-red-900/10"></div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <GameIcon className="h-14 w-14" />
            <h1 className="text-5xl font-semibold text-white tracking-wide">Game of Liars</h1>
          </div>
          <div className="text-2xl font-mono text-slate-300 bg-slate-800/50 inline-block px-6 py-3 rounded-lg border border-slate-600">
            CODE: {gameCode}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Blue Team */}
          <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-blue-400 text-center text-xl">Blue Team ({blueTeam.length}/{MAX_TEAM_SIZE})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Captain Slot */}
              <CaptainSlot 
                captain={blueTeam.find(player => player.isCaptain)}
                teamColor="blue"
                onJoinAsCaptain={() => handleJoinTeam('blue', true)}
                onKick={() => {
                  const captain = blueTeam.find(player => player.isCaptain);
                  if (captain) handleKickPlayer(captain.id);
                }}
              />

              {/* Regular Team Members */}
              {blueTeam.filter(player => !player.isCaptain).map((player) => (
                <PlayerCard key={player.id} player={player} onKick={() => handleKickPlayer(player.id)} />
              ))}

              {/* Join as Member Button */}
              {blueTeam.length < MAX_TEAM_SIZE && (
                <Button
                  variant="outline"
                  className="w-full border-blue-500 text-blue-400 hover:bg-blue-500/10 bg-transparent"
                  onClick={() => handleJoinTeam('blue', false)}
                >
                  Join as Member
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Center Panel */}
          <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
            <CardContent className="p-6 space-y-6">
              {/* Game Settings */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Game Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Rounds (1-20)</label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={gameSettings.rounds}
                      onChange={(e) => {
                        const value = Number.parseInt(e.target.value) || 1;
                        const clampedValue = Math.max(1, Math.min(20, value));
                        setGameSettings((prev) => ({ ...prev, rounds: clampedValue }));
                      }}
                      disabled={!isHost}
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Round Limit (15-120s)</label>
                    <Input
                      type="number"
                      min="15"
                      max="120"
                      value={gameSettings.roundLimit}
                      onChange={(e) => {
                        const value = Number.parseInt(e.target.value) || 15;
                        const clampedValue = Math.max(15, Math.min(120, value));
                        setGameSettings((prev) => ({ ...prev, roundLimit: clampedValue }));
                      }}
                      disabled={!isHost}
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Tags</label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Add category"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && isHost && addTag()}
                        className="bg-slate-700/50 border-slate-600 text-white flex-1"
                        disabled={!isHost}
                      />
                      <Button onClick={addTag} size="sm" className="bg-purple-600 hover:bg-purple-700" disabled={!isHost || !newTag.trim()}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {gameSettings.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="bg-purple-600/20 text-purple-300 border-purple-500/30"
                        >
                          {tag}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTag(tag)}
                            disabled={!isHost}
                            className="ml-1 p-0 h-auto text-purple-300 hover:text-purple-100"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    { isHost && (
                      <Button 
                      onClick={handleUpdateSettings}
                      disabled={!isHost}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Update Settings
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Red Team */}
          <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-red-400 text-center text-xl">Red Team ({redTeam.length}/{MAX_TEAM_SIZE})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Captain Slot */}
              <CaptainSlot 
                captain={redTeam.find(player => player.isCaptain)}
                teamColor="red"
                onJoinAsCaptain={() => handleJoinTeam('red', true)}
                onKick={() => {
                  const captain = redTeam.find(player => player.isCaptain);
                  if (captain) handleKickPlayer(captain.id);
                }}
              />

              {/* Regular Team Members */}
              {redTeam.filter(player => !player.isCaptain).map((player) => (
                <PlayerCard key={player.id} player={player} onKick={() => handleKickPlayer(player.id)} />
              ))}

              {/* Join as Member Button */}
              {redTeam.length < MAX_TEAM_SIZE && (
                <Button
                  variant="outline"
                  className="w-full border-red-500 text-red-400 hover:bg-red-500/10 bg-transparent"
                  onClick={() => handleJoinTeam('red', false)}
                >
                  Join as Member
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-slate-300">
            Host: <span className="font-semibold text-white">{hostName}</span>
          </p>

          {isHost ? (
            <div className="flex justify-center gap-4">
              <Button variant="destructive" className="bg-red-600 hover:bg-red-700 px-8" onClick={handleEndLobby}>
                End Lobby
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 px-8" onClick={handleStartGame} disabled={!hasCaptains}>
                Start Game
              </Button>
            </div>
          ) : (
            <div className="flex justify-center gap-4">
              <Button variant="outline" className="px-8" onClick={handleLeaveLobby}>
                Leave Lobby
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
