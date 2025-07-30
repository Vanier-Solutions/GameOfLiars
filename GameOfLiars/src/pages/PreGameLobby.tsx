import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useWebSocket } from "../hooks/useWebSocket";
import { API_URL } from '../config/api';
import socketManager from '../utils/socketManager';

interface Player {
  name: string;
  isHost?: boolean;
}

interface LobbyData {
  code: string;
  host: string;
  settings: {
    rounds: number;
    roundLimit: number;
    maxScore: number;
  };
  teams: {
    red: {
      captain?: Player;
      players: Player[];
    };
    blue: {
      captain?: Player;
      players: Player[];
    };
  };
  spectators: Player[];
  gamePhase: string;
}

export default function PreGameLobby() {
  const { code } = useParams<{ code: string }>();
  const [playerName, setPlayerName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Kick confirmation modal state
  const [showKickModal, setShowKickModal] = useState(false);
  const [playerToKick, setPlayerToKick] = useState('');
  
  const [lobbyData, setLobbyData] = useState<LobbyData>({
    code: '',
    host: '',
    settings: {
      rounds: 7,
      roundLimit: 60,
      maxScore: 10
    },
    teams: {
      red: {
        players: []
      },
      blue: {
        players: []
      }
    },
    spectators: [],
    gamePhase: 'pregame'
  });

  const [isHost, setIsHost] = useState(false);
  const [settings, setSettings] = useState(lobbyData.settings);

  // Initialize Socket.io connection
  const { isConnected, lastMessage, sendMessage } = useWebSocket(lobbyCode, playerName);

  useEffect(() => {
    // Set lobby code from URL params
    if (code) {
      setLobbyCode(code);
    }

    // Get playerId from localStorage
    const playerId = localStorage.getItem('playerId');

    // Fetch player information using UUID
    const fetchPlayerInfo = async () => {
      if (!code || !playerId) {
        // If no playerId in localStorage, try to get player name from localStorage
        const nameFromStorage = localStorage.getItem('playerName');
        if (nameFromStorage && code) {
          setPlayerName(nameFromStorage);
          fetchLobbyData(code);
        } else {
          setError('Player session not found. Please join the lobby again.');
        }
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/api/lobby/${code}/player/${playerId}`);
        const data = await response.json();
        
        if (data.success && data.player) {
          setPlayerName(data.player.name);
          localStorage.setItem('playerName', data.player.name);
        } else {
          // Fallback to localStorage if API fails
          const nameFromStorage = localStorage.getItem('playerName');
          if (nameFromStorage) {
            setPlayerName(nameFromStorage);
          } else {
            setError('Player not found in lobby. Please join the lobby again.');
            return;
          }
        }
        
        // Fetch initial lobby data
        fetchLobbyData(code);
      } catch (err) {
        console.error('Failed to fetch player info:', err);
        // Fallback to localStorage
        const nameFromStorage = localStorage.getItem('playerName');
        if (nameFromStorage && code) {
          setPlayerName(nameFromStorage);
          fetchLobbyData(code);
        } else {
          setError('Failed to load player information. Please join the lobby again.');
        }
      }
    };

    fetchPlayerInfo();
  }, [code]);

  // Listen for Socket.io updates
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'teamUpdate':
          // Refresh lobby data when teams change
          fetchLobbyData(lobbyCode);
          break;
        case 'settingsUpdate':
          // Update settings in real-time when host changes them
          const settingsData = lastMessage.data as any;
          const newSettings = settingsData?.settings || settingsData;
          if (newSettings) {
            setSettings(newSettings);
            setLobbyData(prev => ({ ...prev, settings: newSettings }));
          }
          break;
        case 'playerJoined':
        case 'playerLeft':
          // Refresh lobby data when players join/leave
          fetchLobbyData(lobbyCode);
          break;
        case 'playerKicked':
          // Refresh lobby data when player is kicked
          fetchLobbyData(lobbyCode);
          break;
        case 'error':
          const errorData = lastMessage.data as any;
          setError(errorData?.message || 'Socket error occurred');
          break;
      }
    }
  }, [lastMessage, lobbyCode]);

  // Update host status whenever lobbyData or playerName changes
  useEffect(() => {
    if (lobbyData.host && playerName) {
      const shouldBeHost = playerName === lobbyData.host;
      
      if (shouldBeHost !== isHost) {
        setIsHost(shouldBeHost);
      }
    }
  }, [lobbyData.host, playerName, isHost]);

  const fetchLobbyData = async (code: string) => {
    if (!code) return;
    
    try {
      const response = await fetch(`${API_URL}/api/lobby/${code}`);
      const data = await response.json();
      
      if (data.success) {
        const lobby = data.lobby;
        
        setLobbyData({
          code: lobby.code,
          host: lobby.host,
          settings: { ...lobby.settings, maxScore: lobby.settings.maxScore || 10 },
          gamePhase: lobby.gamePhase,
          teams: {
            red: {
              captain: lobby.captains.red ? { name: lobby.captains.red } : undefined,
              players: lobby.players.redTeam
                .filter((name: string) => name !== lobby.captains.red)
                .map((name: string) => ({ name }))
            },
            blue: {
              captain: lobby.captains.blue ? { name: lobby.captains.blue } : undefined,
              players: lobby.players.blueTeam
                .filter((name: string) => name !== lobby.captains.blue)
                .map((name: string) => ({ name }))
            }
          },
          spectators: lobby.players.spectators.map((name: string) => ({ 
            name, 
            isHost: name === lobby.host 
          }))
        });
        
        setSettings({ ...lobby.settings, maxScore: lobby.settings.maxScore || 10 });
        setLoading(false);
        setError('');
        
        // Set host status after lobby data is set
        if (playerName) {
          const hostStatus = playerName === lobby.host;
          setIsHost(hostStatus);
        }
      } else {
        setError(data.error || 'Failed to load lobby');
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch lobby data:', err);
      setError('Failed to connect to server');
      setLoading(false);
    }
  };

  const handleJoinTeam = async (team: 'red' | 'blue', role: 'player' | 'captain') => {
    try {
      setError(''); // Clear previous errors
      
      const playerId = localStorage.getItem('playerId');
      
      const response = await fetch(`${API_URL}/api/player/team`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: lobbyCode,
          playerId: playerId,
          team: team,
          role: role
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to join team');
      }
      // No need for success handling - Socket.io will update automatically
    } catch (err) {
      console.error('Failed to join team:', err);
      setError('Failed to join team');
    }
  };

  const handleLeaveTeam = async () => {
    try {
      setError('');
      
      const playerId = localStorage.getItem('playerId');
      
      const response = await fetch(`${API_URL}/api/player/team`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code: lobbyCode,
          playerId: playerId,
          team: 'spectator'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh lobby data
        fetchLobbyData(lobbyCode);
      } else {
        setError(data.error || 'Failed to leave team');
      }
    } catch (err) {
      setError('Failed to leave team');
    }
  };

  const handleUpdateSettings = async () => {
    if (!isHost) return;
    
    try {
      setError('');
      
      const playerId = localStorage.getItem('playerId');
      
      const response = await fetch(`${API_URL}/api/lobby/${lobbyCode}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: playerId,
          rounds: settings.rounds,
          roundLimit: settings.roundLimit,
          maxScore: settings.maxScore
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to update settings');
      }
      // Settings will be broadcast via Socket.io automatically from the backend
    } catch (err) {
      console.error('Failed to update settings:', err);
      setError('Failed to update settings');
    }
  };

  const handleStartGame = async () => {
    if (!isHost) return;
    
    try {
      setError('');
      
      const playerId = localStorage.getItem('playerId');
      
      const response = await fetch(`${API_URL}/api/game/${lobbyCode}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId }),
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to start game');
      }
    } catch (err) {
      console.error('Failed to start game:', err);
      setError('Failed to start game');
    }
  };

  const handleKickPlayer = async (playerNameToKick: string) => {
    if (!isHost) return;
    
    setPlayerToKick(playerNameToKick);
    setShowKickModal(true);
  };

  const confirmKick = async () => {
    if (!isHost) return;
    
    try {
      setError('');
      
      const hostPlayerId = localStorage.getItem('playerId');
      
      console.log('Kicking player:', playerToKick);
      console.log('Host player ID:', hostPlayerId);
      console.log('Lobby code:', lobbyCode);
      
      const response = await fetch(`${API_URL}/api/player/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: lobbyCode,
          hostPlayerId: hostPlayerId,
          playerToKick: playerToKick
        }),
      });

      const data = await response.json();
      
      console.log('Kick response:', data);
      
      if (!data.success) {
        setError(data.error || 'Failed to kick player');
      } else {
        setShowKickModal(false);
        setPlayerToKick('');
        // Refresh lobby data after successful kick
        fetchLobbyData(lobbyCode);
      }
    } catch (err) {
      console.error('Failed to kick player:', err);
      setError('Failed to kick player');
    }
  };

  const cancelKick = () => {
    setShowKickModal(false);
    setPlayerToKick('');
  };

  // Check if current player is on a team
  const getCurrentPlayerTeam = () => {
    if (lobbyData.teams.red.captain?.name === playerName) return { team: 'red', role: 'captain' };
    if (lobbyData.teams.blue.captain?.name === playerName) return { team: 'blue', role: 'captain' };
    if (lobbyData.teams.red.players.some(p => p.name === playerName)) return { team: 'red', role: 'player' };
    if (lobbyData.teams.blue.players.some(p => p.name === playerName)) return { team: 'blue', role: 'player' };
    return null;
  };

  const playerTeam = getCurrentPlayerTeam();
  const canStartGame = lobbyData.teams.red.captain && lobbyData.teams.blue.captain;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700">Loading lobby...</h2>
          <p className="text-gray-500 mt-2">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (error && !lobbyData.code) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Error</h2>
          <p className="text-gray-700 mt-2">{error}</p>
          <Button 
            onClick={() => window.location.href = '/'}
            className="mt-4"
          >
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">
            Game of Liars
          </h1>
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
            <span>Lobby Code: <span className="font-mono font-semibold text-lg">{lobbyData.code}</span></span>
            <Separator orientation="vertical" className="h-4" />
            <span>Host: {lobbyData.host}</span>
            <Separator orientation="vertical" className="h-4" />
            
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-md mx-auto p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Red Team */}
          <div className="bg-white/80 border border-red-400 shadow-xl backdrop-blur-sm rounded-lg overflow-hidden">
            <div className="bg-gradient-to-br from-red-600 via-red-500 to-red-700 px-6 py-6">
              <h2 className="text-2xl text-white text-center font-bold tracking-wide drop-shadow-sm">Red Team</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Captain */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600 font-medium">Captain</Label>
                {lobbyData.teams.red.captain ? (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <span className="font-medium text-red-800">
                      {lobbyData.teams.red.captain.name}
                      {lobbyData.teams.red.captain.name === playerName && ' (you)'}
                    </span>
                    <div className="flex items-center space-x-2">
                      {isHost && lobbyData.teams.red.captain.name !== playerName && (
                        <button
                          onClick={() => handleKickPlayer(lobbyData.teams.red.captain!.name)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-100 transition-colors"
                          title="Kick player"
                        >
                          ✕
                        </button>
                      )}
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleJoinTeam('red', 'captain')}
                    variant="outline"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Join as Captain
                  </Button>
                )}
              </div>

              {/* Players */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600 font-medium">Players</Label>
                <div className="space-y-2">
                  {lobbyData.teams.red.players.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-800">
                        {player.name}
                        {player.name === playerName && ' (you)'}
                      </span>
                      <div className="flex items-center space-x-2">
                        {isHost && player.name !== playerName && (
                          <button
                            onClick={() => handleKickPlayer(player.name)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-100 transition-colors"
                            title="Kick player"
                          >
                            ✕
                          </button>
                        )}
                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => handleJoinTeam('red', 'player')}
                    variant="outline"
                    size="sm"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Join Team
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column - Spectators & Settings */}
          <div className="space-y-6">
            
            {/* Spectators */}
            <Card className="bg-white/80 border-gray-200 shadow-xl backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-gray-800 text-center">Spectators</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {lobbyData.spectators.map((spectator, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-800">
                        {spectator.name} {spectator.name === playerName && '(you)'}
                      </span>
                      <div className="flex items-center space-x-2">
                        {spectator.isHost && (
                          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                            Host
                          </span>
                        )}
                        {isHost && spectator.name !== playerName && (
                          <button
                            onClick={() => handleKickPlayer(spectator.name)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-100 transition-colors"
                            title="Kick player"
                          >
                            ✕
                          </button>
                        )}
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Game Settings - Visible to all, editable by host only */}
            <Card className="bg-white/80 border-gray-200 shadow-xl backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-gray-800 text-center">
                  Game Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-600">Rounds</Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={settings.rounds}
                      onChange={(e) => setSettings(prev => ({ ...prev, rounds: parseInt(e.target.value) }))}
                      disabled={!isHost}
                      className={`h-9 text-center ${!isHost ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-600">Round Timer (sec)</Label>
                    <Input
                      type="number"
                      min="30"
                      max="300"
                      value={settings.roundLimit}
                      onChange={(e) => setSettings(prev => ({ ...prev, roundLimit: parseInt(e.target.value) }))}
                      disabled={!isHost}
                      className={`h-9 text-center ${!isHost ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-600">Max Score</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxScore}
                      onChange={(e) => setSettings(prev => ({ ...prev, maxScore: parseInt(e.target.value) }))}
                      disabled={!isHost}
                      className={`h-9 text-center ${!isHost ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>
                {isHost && (
                  <Button 
                    onClick={handleUpdateSettings}
                    className="w-full h-9 bg-gray-700 hover:bg-gray-600 text-white font-medium"
                  >
                    Update Settings
                  </Button>
                )}
                {!isHost && (
                  <p className="text-xs text-center text-gray-500">
                    Only the host can change settings
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Start Game - Only visible to host */}
            {isHost && (
              <Card className="bg-white/80 border-gray-200 shadow-xl backdrop-blur-sm">
                <CardContent className="pt-6">
                  <Button
                    onClick={handleStartGame}
                    disabled={!canStartGame}
                    className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-medium disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    {canStartGame ? 'Start Game' : 'Need Captains for Both Teams'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Blue Team */}
          <div className="bg-white/80 border border-blue-400 shadow-xl backdrop-blur-sm rounded-lg overflow-hidden">
            <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 px-6 py-6">
              <h2 className="text-2xl text-white text-center font-bold tracking-wide drop-shadow-sm">Blue Team</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Captain */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600 font-medium">Captain</Label>
                {lobbyData.teams.blue.captain ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="font-medium text-blue-800">
                      {lobbyData.teams.blue.captain.name}
                      {lobbyData.teams.blue.captain.name === playerName && ' (you)'}
                    </span>
                    <div className="flex items-center space-x-2">
                      {isHost && lobbyData.teams.blue.captain.name !== playerName && (
                        <button
                          onClick={() => handleKickPlayer(lobbyData.teams.blue.captain!.name)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                          title="Kick player"
                        >
                          ✕
                        </button>
                      )}
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleJoinTeam('blue', 'captain')}
                    variant="outline"
                    className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    Join as Captain
                  </Button>
                )}
              </div>

              {/* Players */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600 font-medium">Players</Label>
                <div className="space-y-2">
                  {lobbyData.teams.blue.players.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-800">
                        {player.name}
                        {player.name === playerName && ' (you)'}
                      </span>
                      <div className="flex items-center space-x-2">
                        {isHost && player.name !== playerName && (
                          <button
                            onClick={() => handleKickPlayer(player.name)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                            title="Kick player"
                          >
                            ✕
                          </button>
                        )}
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => handleJoinTeam('blue', 'player')}
                    variant="outline"
                    size="sm"
                    className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    Join Team
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kick Confirmation Modal */}
      {showKickModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-medium text-gray-900">Confirm Kick</h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Are you sure you want to kick {playerToKick} from the lobby?
              </p>
            </div>
            <div className="items-center px-4 py-3">
              <button
                onClick={confirmKick}
                className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Kick
              </button>
              <button
                onClick={cancelKick}
                className="mt-3 px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 