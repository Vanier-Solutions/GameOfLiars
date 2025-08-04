"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Crown, Trash2, Plus, X } from "lucide-react"

interface Player {
  id: string
  name: string
  isCaptain: boolean
}

interface GameSettings {
  rounds: number
  roundLimit: number
  tags: string[]
}

export default function LobbyPage() {
  const [blueTeam, setBlueTeam] = useState<Player[]>([
    { id: "1", name: "Alice", isCaptain: true },
    { id: "2", name: "Bob", isCaptain: false },
  ])

  const [redTeam, setRedTeam] = useState<Player[]>([{ id: "3", name: "Charlie", isCaptain: true }])

  const [spectators, setSpectators] = useState<Player[]>([
    { id: "4", name: "David", isCaptain: false },
    { id: "5", name: "Eve", isCaptain: false },
    { id: "6", name: "Frank", isCaptain: false },
    { id: "7", name: "Grace", isCaptain: false },
    { id: "8", name: "Henry", isCaptain: false },
    { id: "9", name: "Ivy", isCaptain: false },
  ])

  const [gameSettings, setGameSettings] = useState<GameSettings>({
    rounds: 5,
    roundLimit: 60,
    tags: ["General", "Movies"],
  })

  const [newTag, setNewTag] = useState("")
  const gameCode = "ABCD"
  const hostName = "Alice"

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
      <Button
        variant="ghost"
        size="sm"
        onClick={onKick}
        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-1"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900 to-red-900/10"></div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white tracking-wide mb-2">Game Of Liars</h1>
          <div className="text-2xl font-mono text-slate-300 bg-slate-800/50 inline-block px-4 py-2 rounded-lg border border-slate-600">
            CODE: {gameCode}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Blue Team */}
          <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-blue-400 text-center text-xl">Blue Team ({blueTeam.length}/6)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {blueTeam.map((player) => (
                <PlayerCard key={player.id} player={player} onKick={() => {}} />
              ))}

              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Join as Captain</Button>
                <Button
                  variant="outline"
                  className="flex-1 border-blue-500 text-blue-400 hover:bg-blue-500/10 bg-transparent"
                >
                  Join as Member
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Center Panel */}
          <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
            <CardContent className="p-6 space-y-6">
              {/* Game Settings */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Game Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-300 block mb-2">Rounds (1-20)</label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={gameSettings.rounds}
                      onChange={(e) =>
                        setGameSettings((prev) => ({ ...prev, rounds: Number.parseInt(e.target.value) || 1 }))
                      }
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
                      onChange={(e) =>
                        setGameSettings((prev) => ({ ...prev, roundLimit: Number.parseInt(e.target.value) || 15 }))
                      }
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
                        onKeyPress={(e) => e.key === "Enter" && addTag()}
                        className="bg-slate-700/50 border-slate-600 text-white flex-1"
                      />
                      <Button onClick={addTag} size="sm" className="bg-purple-600 hover:bg-purple-700">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                            className="ml-1 p-0 h-auto text-purple-300 hover:text-purple-100"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Spectators */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Spectators ({spectators.length})</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {spectators.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-2 bg-slate-700/30 rounded border border-slate-600/50 text-sm"
                    >
                      <span className="text-white truncate">{player.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-1 ml-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700/50 bg-transparent text-sm py-2"
                >
                  Join as Spectator
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Red Team */}
          <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-red-400 text-center text-xl">Red Team ({redTeam.length}/6)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {redTeam.map((player) => (
                <PlayerCard key={player.id} player={player} onKick={() => {}} />
              ))}

              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white">Join as Captain</Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-500 text-red-400 hover:bg-red-500/10 bg-transparent"
                >
                  Join as Member
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-slate-300">
            Host: <span className="font-semibold text-white">{hostName}</span>
          </p>

          <div className="flex justify-center gap-4">
            <Button variant="destructive" className="bg-red-600 hover:bg-red-700 px-8">
              End Lobby
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 px-8">Start Game</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
