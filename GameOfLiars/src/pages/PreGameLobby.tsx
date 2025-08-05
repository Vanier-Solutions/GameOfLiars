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

interface ChatMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: Date;
}

export default function PreGameLobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Name entry popup state
  const [showNamePopup, setShowNamePopup] = useState(false);
  const [tempPlayerName, setTempPlayerName] = useState('');
  const [joiningLobby, setJoiningLobby] = useState(false);
  
  // Kick confirmation modal state
  const [showKickModal, setShowKickModal] = useState(false);
  const [playerToKick, setPlayerToKick] = useState('');
  
  // Add flag to prevent multiple session checks
  const [sessionChecked, setSessionChecked] = useState(false);
  
  const [lobbyData, setLobbyData] = useState<LobbyData>({
    code: '',
    host: '',
    settings: {
      rounds: 10,
      roundLimit: 60,
      maxScore: 7
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

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');

  // Initialize Socket.io connection
  const { isConnected, lastMessage, sendMessage } = useWebSocket(lobbyCode, playerName);

  useEffect(() => {
    // Set lobby code from URL params
    if (code && !sessionChecked) {
      setLobbyCode(code);
      setSessionChecked(true); // Prevent multiple checks
      
      // Clear any old player data when accessing a new lobby
      const currentLobbyCode = localStorage.getItem('lobbyCode');
      if (currentLobbyCode && currentLobbyCode !== code) {
        localStorage.removeItem('playerId');
        localStorage.removeItem('playerName');
        localStorage.removeItem('lobbyCode');
      }
      
      // Check if we have a valid session by trying to fetch player info
      const checkSession = async () => {
        if (!code || sessionChecked) return;
        
        console.log('Checking session for lobby:', code);
        setSessionChecked(true);
        
        // Check if we have stored player data first
        const playerId = localStorage.getItem('playerId');
        const storedPlayerName = localStorage.getItem('playerName');
        
        console.log('Stored player data:', { playerId, storedPlayerName });
        
        // If we have stored player data, try to verify the session
        if (playerId && storedPlayerName) {
          try {
            const response = await fetch(`${API_URL}/api/lobby/${code}/player/${playerId}`, {
              credentials: 'include'
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                console.log('Session verified successfully');
                setPlayerName(storedPlayerName);
                fetchLobbyData(code);
                return;
              }
            }
            
            // Session check failed, but don't immediately show popup
            // Try to fetch lobby data first to see if we're already in the lobby
            console.log('Session check failed, trying to fetch lobby data');
            try {
              const lobbyResponse = await fetch(`${API_URL}/api/lobby/${code}`, {
                credentials: 'include'
              });
              
              if (lobbyResponse.ok) {
                const lobbyData = await lobbyResponse.json();
                if (lobbyData.success) {
                  // We can access the lobby, so we might already be a player
                  // Check if our stored name is in the lobby
                  const allPlayers = [
                    ...lobbyData.lobby.players.redTeam,
                    ...lobbyData.lobby.players.blueTeam,
                    ...lobbyData.lobby.players.spectators
                  ];
                  
                  if (allPlayers.includes(storedPlayerName)) {
                    console.log('Found our name in lobby, joining with stored credentials');
                    setPlayerName(storedPlayerName);
                    fetchLobbyData(code);
                    return;
                  }
                }
              }
            } catch (lobbyError) {
              console.log('Lobby fetch failed:', lobbyError);
            }
            
            console.log('No valid session found, showing name popup');
            setShowNamePopup(true);
            setLoading(false);
          } catch (error) {
            console.log('Session check error:', error);
            setShowNamePopup(true);
            setLoading(false);
          }
        } else {
          console.log('No stored player data, showing name popup');
          // No stored data, show name popup immediately
          setShowNamePopup(true);
          setLoading(false);
        }
      };
      
      checkSession();
    }
  }, [code, sessionChecked]);

  // Listen for Socket.io updates
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'gameChat':
          const gameChatData = lastMessage.data as any;
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            playerName: gameChatData.playerName,
            message: gameChatData.message,
            timestamp: new Date()
          }]);
          break;
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
      const response = await fetch(`${API_URL}/api/lobby/${code}`, {
        credentials: 'include' // Use session for auth
      });
      
      if (response.status === 404) {
        // Lobby doesn't exist, redirect to home
        navigate('/');
        return;
      }
      
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
          spectators: lobby.players.spectators.map((name: string) => ({ name }))
        });
        
        setSettings(lobby.settings);
        setError('');
        setLoading(false);
      } else {
        // If the lobby exists but we don't have a valid session, show name popup
        if (data.error && (data.error.includes('not a player') || data.error.includes('unauthorized'))) {
          // Only show popup if we haven't already checked the session
          if (!sessionChecked) {
            setShowNamePopup(true);
          }
          setLoading(false);
        } else {
          setError(data.error || 'Failed to fetch lobby data');
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error fetching lobby data:', error);
      setError('Failed to fetch lobby data');
      setLoading(false);
    }
  };

  const handleJoinTeam = async (team: 'red' | 'blue', role: 'player' | 'captain') => {
    try {
      setError('');
      
      const response = await fetch(`${API_URL}/api/player/team`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session for auth
        body: JSON.stringify({
          code: lobbyCode,
          team: team,
          role: role
          // Remove playerId - backend will get it from session
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to join team');
      }
    } catch (err) {
      console.error('Failed to join team:', err);
      setError('Failed to join team');
    }
  };

  const handleLeaveTeam = async () => {
    try {
      setError('');
      
      const response = await fetch(`${API_URL}/api/player/team`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session for auth
        body: JSON.stringify({ 
          code: lobbyCode,
          team: 'spectator'
          // Remove playerId - backend will get it from session
        }),
      });

      const data = await response.json();
      
      if (data.success) {
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
      
      const playerId = localStorage.getItem('playerId'); // Keep this for now
      
      const response = await fetch(`${API_URL}/api/lobby/${lobbyCode}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Add session support
        body: JSON.stringify({
          playerId: playerId, // Keep this until backend is updated
          rounds: settings.rounds,
          roundLimit: settings.roundLimit,
          maxScore: settings.maxScore
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to update settings');
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
      setError('Failed to update settings');
    }
  };

  const handleStartGame = async () => {
    if (!isHost) return;
    
    try {
      setError('');
      
      const response = await fetch(`${API_URL}/api/game/${lobbyCode}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session for auth
        body: JSON.stringify({})  // Remove playerId - backend will get it from session
      });

      if (response.status === 404) {
        // Lobby doesn't exist, redirect to home
        navigate('/');
        return;
      }

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
      
      const response = await fetch(`${API_URL}/api/lobby/kick`, { // Fixed URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session for auth
        body: JSON.stringify({
          code: lobbyCode,
          playerName: playerToKick // Only send who to kick, not who is kicking
          // Remove hostPlayerId - backend will get it from session
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to kick player');
      } else {
        setShowKickModal(false);
        setPlayerToKick('');
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

  const handleJoinLobby = async () => {
    if (!tempPlayerName.trim() || !code || joiningLobby) return;
    
    console.log('Attempting to join lobby:', code, 'with name:', tempPlayerName.trim());
    
    // Validate name length
    if (tempPlayerName.trim().length > 20) {
      setError('Player name too long (max 20 characters)');
      return;
    }
    
    // Validate name contains only valid characters
    if (!/^[a-zA-Z0-9\s]+$/.test(tempPlayerName.trim())) {
      setError('Player name can only contain letters, numbers, and spaces');
      return;
    }
    
    try {
      setJoiningLobby(true);
      setError('');
      
      const response = await fetch(`${API_URL}/api/lobby/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Add session support
        body: JSON.stringify({
          code: code,
          playerName: tempPlayerName.trim()
        }),
      });

      const data = await response.json();
      
      console.log('Join response:', data);
      
      if (data.success) {
        // Store player info
        localStorage.setItem('playerId', data.playerId);
        localStorage.setItem('playerName', tempPlayerName.trim());
        localStorage.setItem('lobbyCode', code); // Store current lobby code
        
        setPlayerName(tempPlayerName.trim());
        setShowNamePopup(false);
        setTempPlayerName('');
        
        fetchLobbyData(code);
      } else {
        setError(data.error || 'Failed to join lobby');
      }
    } catch (err) {
      console.error('Failed to join lobby:', err);
      setError('Failed to join lobby');
    } finally {
      setJoiningLobby(false);
    }
  };

  const handleCancelJoin = () => {
    setShowNamePopup(false);
    setTempPlayerName('');
    setError('');
    // Redirect to home page
    window.location.href = '/';
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    sendMessage('gameChat', {
      playerName: playerName,
      message: messageInput.trim()
    });
    
    setMessageInput('');
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

  // Show name popup if user hasn't joined yet
  if (showNamePopup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <h3 className="text-lg font-medium text-gray-900">Enter Your Name</h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Please enter your name to join the lobby.
            </p>
          </div>
          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div className="mt-4">
            <Input
              type="text"
              placeholder="Your Name"
              value={tempPlayerName}
              onChange={(e) => setTempPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tempPlayerName.trim()) {
                  handleJoinLobby();
                }
              }}
              className="h-9"
              autoFocus
            />
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <Button
              onClick={handleJoinLobby}
              disabled={!tempPlayerName.trim() || joiningLobby}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:bg-blue-300 disabled:text-blue-500"
            >
              {joiningLobby ? 'Joining...' : 'Join Lobby'}
            </Button>
            <Button
              onClick={handleCancelJoin}
              className="h-9 bg-gray-200 text-gray-800 font-medium"
            >
              Cancel
            </Button>
          </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Red Team */}
          <div className="bg-white/80 border border-red-400 shadow-xl backdrop-blur-sm rounded-lg">
            <div className="bg-gradient-to-br from-red-600 via-red-500 to-red-700 px-4 py-4">
              <h2 className="text-xl text-white text-center font-bold tracking-wide drop-shadow-sm">Red Team</h2>
            </div>
            <div className="p-4 space-y-3">
              {/* Captain */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600 font-medium">Captain</Label>
                {lobbyData.teams.red.captain ? (
                  <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-200">
                    <span className="font-medium text-red-800 text-sm">
                      {lobbyData.teams.red.captain.name}
                      {lobbyData.teams.red.captain.name === playerName && ' (you)'}
                    </span>
                    <div className="flex items-center space-x-2">
                      {isHost && lobbyData.teams.red.captain.name !== playerName && (
                        <button
                          onClick={() => handleKickPlayer(lobbyData.teams.red.captain!.name)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-1 py-1 rounded hover:bg-red-100 transition-colors"
                          title="Kick player"
                        >
                          ✕
                        </button>
                      )}
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleJoinTeam('red', 'captain')}
                    variant="outline"
                    size="sm"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50 text-sm"
                  >
                    Join as Captain
                  </Button>
                )}
              </div>

              {/* Players */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600 font-medium">Players</Label>
                <div className="space-y-1">
                  {lobbyData.teams.red.players.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-800 text-sm">
                        {player.name}
                        {player.name === playerName && ' (you)'}
                      </span>
                      <div className="flex items-center space-x-2">
                        {isHost && player.name !== playerName && (
                          <button
                            onClick={() => handleKickPlayer(player.name)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium px-1 py-1 rounded hover:bg-red-100 transition-colors"
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
                    className="w-full border-red-300 text-red-600 hover:bg-red-50 text-sm"
                  >
                    Join Team
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column - Spectators, Settings, and Chat */}
          <div className="lg:col-span-2 space-y-4 flex flex-col">
            
            {/* Top Row - Spectators and Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Spectators */}
              <Card className="bg-white/80 border-gray-200 shadow-xl backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-gray-800 text-center">Spectators</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-1">
                    {lobbyData.spectators.map((spectator, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-800 text-sm">
                          {spectator.name} {spectator.name === playerName && '(you)'}
                        </span>
                        <div className="flex items-center space-x-2">
                          {spectator.isHost && (
                            <span className="text-xs px-1 py-0.5 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                              Host
                            </span>
                          )}
                          {isHost && spectator.name !== playerName && (
                            <button
                              onClick={() => handleKickPlayer(spectator.name)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium px-1 py-1 rounded hover:bg-red-100 transition-colors"
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

              {/* Game Settings */}
              <Card className="bg-white/80 border-gray-200 shadow-xl backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-gray-800 text-center">
                    Game Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Rounds</Label>
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={settings.rounds}
                        onChange={(e) => setSettings(prev => ({ ...prev, rounds: parseInt(e.target.value) }))}
                        disabled={!isHost}
                        className={`h-8 text-center text-sm ${!isHost ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Timer (sec)</Label>
                      <Input
                        type="number"
                        min="30"
                        max="300"
                        value={settings.roundLimit}
                        onChange={(e) => setSettings(prev => ({ ...prev, roundLimit: parseInt(e.target.value) }))}
                        disabled={!isHost}
                        className={`h-8 text-center text-sm ${!isHost ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Max Score</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={settings.maxScore}
                        onChange={(e) => setSettings(prev => ({ ...prev, maxScore: parseInt(e.target.value) }))}
                        disabled={!isHost}
                        className={`h-8 text-center text-sm ${!isHost ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>
                  {isHost && (
                    <Button 
                      onClick={handleUpdateSettings}
                      size="sm"
                      className="w-full h-8 bg-gray-700 hover:bg-gray-600 text-white font-medium text-sm"
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
            </div>

            {/* Start Game Button */}
            {isHost && (
              <Card className="bg-white/80 border-gray-200 shadow-xl backdrop-blur-sm">
                <CardContent className="pt-4">
                  <Button
                    onClick={handleStartGame}
                    disabled={!canStartGame}
                    className="w-full h-10 bg-gray-900 hover:bg-gray-800 text-white font-medium disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    {canStartGame ? 'Start Game' : 'Need Captains for Both Teams'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Chat */}
            <Card className="bg-white/80 border-gray-200 shadow-xl backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-gray-800 text-center">Lobby Chat</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {/* Chat Messages */}
                <div className="bg-gray-50 rounded-lg p-3 overflow-y-auto mb-3 min-h-[200px]">
                  <div className="space-y-1">
                    {chatMessages.map((msg) => {
                      const playerTeam = getCurrentPlayerTeam();
                      const isRedTeam = lobbyData.teams.red.captain?.name === msg.playerName || 
                                       lobbyData.teams.red.players.some(p => p.name === msg.playerName);
                      const isBlueTeam = lobbyData.teams.blue.captain?.name === msg.playerName || 
                                        lobbyData.teams.blue.players.some(p => p.name === msg.playerName);
                      const isSpectator = lobbyData.spectators.some(p => p.name === msg.playerName);
                      
                      let nameColor = 'text-gray-700'; // Default for spectators
                      if (isRedTeam) nameColor = 'text-red-600';
                      else if (isBlueTeam) nameColor = 'text-blue-600';
                      
                      return (
                        <div key={msg.id} className="text-sm">
                          <span className={`font-medium ${nameColor}`}>{msg.playerName}:</span>
                          <span className="text-gray-600 ml-2">{msg.message}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Chat Input */}
                <div className="flex space-x-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && messageInput.trim()) {
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    size="sm"
                    className="px-3 h-8"
                  >
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Blue Team */}
          <div className="bg-white/80 border border-blue-400 shadow-xl backdrop-blur-sm rounded-lg">
            <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 px-4 py-4">
              <h2 className="text-xl text-white text-center font-bold tracking-wide drop-shadow-sm">Blue Team</h2>
            </div>
            <div className="p-4 space-y-3">
              {/* Captain */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600 font-medium">Captain</Label>
                {lobbyData.teams.blue.captain ? (
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="font-medium text-blue-800 text-sm">
                      {lobbyData.teams.blue.captain.name}
                      {lobbyData.teams.blue.captain.name === playerName && ' (you)'}
                    </span>
                    <div className="flex items-center space-x-2">
                      {isHost && lobbyData.teams.blue.captain.name !== playerName && (
                        <button
                          onClick={() => handleKickPlayer(lobbyData.teams.blue.captain!.name)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium px-1 py-1 rounded hover:bg-blue-100 transition-colors"
                          title="Kick player"
                        >
                          ✕
                        </button>
                      )}
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleJoinTeam('blue', 'captain')}
                    variant="outline"
                    size="sm"
                    className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 text-sm"
                  >
                    Join as Captain
                  </Button>
                )}
              </div>

              {/* Players */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-600 font-medium">Players</Label>
                <div className="space-y-1">
                  {lobbyData.teams.blue.players.map((player, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-800 text-sm">
                        {player.name}
                        {player.name === playerName && ' (you)'}
                      </span>
                      <div className="flex items-center space-x-2">
                        {isHost && player.name !== playerName && (
                          <button
                            onClick={() => handleKickPlayer(player.name)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium px-1 py-1 rounded hover:bg-blue-100 transition-colors"
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
                    className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 text-sm"
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