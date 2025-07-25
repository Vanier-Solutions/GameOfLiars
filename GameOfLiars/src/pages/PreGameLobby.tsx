import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from '../hooks/useWebSocket';

interface LobbyData {
  code: string;
  host: string;
  settings: {
    rounds: number;
    roundLimit: number;
    maxPlayers: number;
  };
  players: {
    spectators: string[];
    blueTeam: string[];
    redTeam: string[];
  };
  captains: {
    blue: string | null;
    red: string | null;
  };
}

export default function PreGameLobby() {
  const [lobbyData, setLobbyData] = useState<LobbyData | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [settings, setSettings] = useState({ rounds: 7, roundLimit: 60 });
  const [isHost, setIsHost] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');

  // Get lobby code from URL
  const lobbyCode = window.location.pathname.split('/')[2];

  // Use WebSocket for real-time updates
  const { isConnected, lastMessage } = useWebSocket(lobbyCode, playerName);

  useEffect(() => {
    // Get player name from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const nameFromUrl = urlParams.get('player');
    const nameFromStorage = localStorage.getItem('playerName');
    const playerNameValue = nameFromUrl || nameFromStorage || '';
    setPlayerName(playerNameValue);
    
    // Show name modal if no name is found
    if (!playerNameValue) {
      setShowNameModal(true);
    }
  }, []);

  useEffect(() => {
    if (lobbyCode && playerName) {
      fetchLobbyData();
    }
  }, [lobbyCode, playerName]);

  // Listen for WebSocket updates
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'teamUpdate') {
      // Update lobby data with the new team information
      const data = lastMessage.data as any;
      if (data) {
        setLobbyData(prev => ({
          ...prev!,
          players: {
            blueTeam: data.blueTeam?.map((p: any) => p.name) || [],
            redTeam: data.redTeam?.map((p: any) => p.name) || [],
            spectators: data.spectators?.map((p: any) => p.name) || []
          },
          captains: {
            blue: data.captains?.blue || null,
            red: data.captains?.red || null
          }
        }));
      }
    }
  }, [lastMessage]);

  const handleNameSubmit = async () => {
    if (!tempName.trim()) return;
    
    try {
      const response = await fetch('http://localhost:5051/api/lobby/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          playerName: tempName.trim(),
          code: lobbyCode
        }),
      });
      
      if (response.ok) {
        localStorage.setItem('playerName', tempName.trim());
        setPlayerName(tempName.trim());
        setShowNameModal(false);
        setTempName('');
      }
    } catch (error) {
      console.error('Failed to join lobby:', error);
    }
  };

  const fetchLobbyData = async () => {
    try {
      const response = await fetch(`http://localhost:5051/api/lobby/${lobbyCode}`);
      const data = await response.json();
      if (data.success) {
        setLobbyData(data.lobby);
        setIsHost(data.lobby.host === playerName);
      }
    } catch (error) {
      console.error('Failed to fetch lobby data:', error);
    }
  };

  const joinTeam = async (team: string, role: string) => {
    try {
      const response = await fetch('http://localhost:5051/api/player/team', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: lobbyCode,
          playerName,
          team,
          role
        }),
      });
      
      if (response.ok) {
        fetchLobbyData();
      }
    } catch (error) {
      console.error('Failed to join team:', error);
    }
  };

  const kickPlayer = async (playerToKick: string) => {
    if (!isHost) return;
    
    try {
      const response = await fetch('http://localhost:5051/api/player/kick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: lobbyCode,
          hostName: playerName,
          playerToKick
        }),
      });
      
      if (response.ok) {
        fetchLobbyData();
      }
    } catch (error) {
      console.error('Failed to kick player:', error);
    }
  };

  const updateSettings = async () => {
    try {
      const response = await fetch(`http://localhost:5051/api/lobby/${lobbyCode}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName,
          ...settings
        }),
      });
      
      if (response.ok) {
        fetchLobbyData();
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const startGame = async () => {
    setIsStarting(true);
    try {
      const response = await fetch(`http://localhost:5051/api/game/${lobbyCode}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerName }),
      });
      
      if (response.ok) {
        // Navigate to game
        window.location.href = `/game/${lobbyCode}`;
      }
    } catch (error) {
      console.error('Failed to start game:', error);
    } finally {
      setIsStarting(false);
    }
  };

  // Name entry modal
  if (showNameModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Join Lobby</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tempName">Enter your name to join lobby {lobbyCode}</Label>
              <Input
                id="tempName"
                placeholder="Your name..."
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                maxLength={20}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
              />
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/'}
                className="flex-1"
              >
                Return Home
              </Button>
              <Button 
                onClick={handleNameSubmit}
                disabled={!tempName.trim()}
                className="flex-1"
              >
                Join Lobby
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!lobbyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700">Loading lobby...</h2>
        </div>
      </div>
    );
  }

  const canStartGame = lobbyData.captains.blue && lobbyData.captains.red;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Game of Lies
          </h1>
          <div className="flex items-center justify-center space-x-4">
            <p className="text-gray-600">Code: {lobbyData.code}</p>
            <Badge variant="secondary">{lobbyData.players.spectators.length + lobbyData.players.blueTeam.length + lobbyData.players.redTeam.length} players</Badge>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>

        {/* Team Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Blue Team */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="bg-blue-500 text-white rounded-t-lg">
              <CardTitle className="flex justify-between items-center">
                Blue Team
                <span className="text-2xl font-bold">{lobbyData.players.blueTeam.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Team Captain:</p>
                <p className="font-medium">
                  {lobbyData.captains.blue || 'Waiting for captain...'}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Players:</p>
                <div className="space-y-1">
                  {lobbyData.players.blueTeam.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{player}</span>
                        {lobbyData.captains.blue === player && (
                          <Badge variant="default" className="text-xs">CAPTAIN</Badge>
                        )}
                      </div>
                      {isHost && player !== playerName && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => kickPlayer(player)}
                          className="text-red-500 border-red-200 hover:bg-red-50"
                        >
                          Kick
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={() => joinTeam('blue', 'member')}
                  className="w-full bg-blue-500 hover:bg-blue-600"
                  disabled={lobbyData.players.blueTeam.includes(playerName)}
                >
                  Join Blue Team
                </Button>
                <Button 
                  onClick={() => joinTeam('blue', 'captain')}
                  variant="outline"
                  className="w-full border-blue-500 text-blue-500 hover:bg-blue-50"
                  disabled={lobbyData.captains.blue !== null}
                >
                  Join as Captain
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Red Team */}
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="bg-red-500 text-white rounded-t-lg">
              <CardTitle className="flex justify-between items-center">
                Red Team
                <span className="text-2xl font-bold">{lobbyData.players.redTeam.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Team Captain:</p>
                <p className="font-medium">
                  {lobbyData.captains.red || 'Waiting for captain...'}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Players:</p>
                <div className="space-y-1">
                  {lobbyData.players.redTeam.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{player}</span>
                        {lobbyData.captains.red === player && (
                          <Badge variant="default" className="text-xs">CAPTAIN</Badge>
                        )}
                      </div>
                      {isHost && player !== playerName && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => kickPlayer(player)}
                          className="text-red-500 border-red-200 hover:bg-red-50"
                        >
                          Kick
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={() => joinTeam('red', 'member')}
                  className="w-full bg-red-500 hover:bg-red-600"
                  disabled={lobbyData.players.redTeam.includes(playerName)}
                >
                  Join Red Team
                </Button>
                <Button 
                  onClick={() => joinTeam('red', 'captain')}
                  variant="outline"
                  className="w-full border-red-500 text-red-500 hover:bg-red-50"
                  disabled={lobbyData.captains.red !== null}
                >
                  Join as Captain
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Game Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>⚙️</span>
              <span>Game Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rounds">Max Score to Win:</Label>
                <Input
                  id="rounds"
                  type="number"
                  value={isHost ? settings.rounds : lobbyData.settings.rounds}
                  onChange={(e) => isHost && setSettings({ ...settings, rounds: parseInt(e.target.value) })}
                  min={1}
                  max={20}
                  disabled={!isHost}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeLimit">Time per Question (seconds):</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  value={isHost ? settings.roundLimit : lobbyData.settings.roundLimit}
                  onChange={(e) => isHost && setSettings({ ...settings, roundLimit: parseInt(e.target.value) })}
                  min={30}
                  max={300}
                  disabled={!isHost}
                />
              </div>
            </div>
            {isHost && (
              <Button onClick={updateSettings} className="w-full bg-green-500 hover:bg-green-600">
                Update Settings
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Waiting Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>⏰</span>
              <span>Waiting Area</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lobbyData.players.spectators.map((player, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{player}</span>
                    {lobbyData.host === player && (
                      <Badge variant="secondary" className="text-xs">HOST</Badge>
                    )}
                  </div>
                  {isHost && player !== playerName && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => kickPlayer(player)}
                      className="text-red-500 border-red-200 hover:bg-red-50"
                    >
                      Kick
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <Button 
            variant="outline" 
            className="flex-1 bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
          >
            End Lobby
          </Button>
          <Button 
            onClick={startGame}
            disabled={!canStartGame || !isHost || isStarting}
            className="flex-1 bg-green-500 hover:bg-green-600"
          >
            {isStarting ? 'Starting...' : 'Start Game'}
          </Button>
        </div>

        {!canStartGame && isHost && (
          <div className="text-center text-orange-600 bg-orange-50 p-4 rounded-lg">
            Both teams need captains to start the game
          </div>
        )}
      </div>
    </div>
  );
} 