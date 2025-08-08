import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { API_URL } from '../config/api';
import { useWebSocket } from "../hooks/useWebSocket";
import ToastNotification from '../components/ToastNotification';

interface Player {
  name: string;
  role: string;
}

interface GameData {
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
  scores: {
    blue: number;
    red: number;
  };
  currentRound: number;
  gamePhase: string;
}

interface RoundData {
  roundNumber: number;
  question: string;
  roundStatus: string;
  roundStartTime?: number;
}

interface ChatMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: Date;
  team?: string;
}

interface RoundResults {
  blueAnswer: { answer: string; isSteal: boolean } | null;
  redAnswer: { answer: string; isSteal: boolean } | null;
  correctAnswer: string;
  bluePoints: number;
  redPoints: number;
  winner: string;
  blueScore: number;
  redScore: number;
}

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const [playerName, setPlayerName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [teamChatMessages, setTeamChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [teamMessageInput, setTeamMessageInput] = useState('');
  const [chatMode, setChatMode] = useState<'game' | 'team'>('game');
  
  // Game state
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [answerInput, setAnswerInput] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [playerTeam, setPlayerTeam] = useState<string | null>(null);
  const [roundStatus, setRoundStatus] = useState<string>('NS'); // NS = Not Started, QP = Question Period, QR = Question Reveal
  
  // Answer submission state
  const [teamAnswered, setTeamAnswered] = useState<{ blue: boolean; red: boolean }>({ blue: false, red: false });
  const [roundResults, setRoundResults] = useState<RoundResults | null>(null);
  const [showRoundResults, setShowRoundResults] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [allRoundsResults, setAllRoundsResults] = useState<RoundResults[]>([]);
  
  // Toast notification state
  const [toastNotification, setToastNotification] = useState<{
    isVisible: boolean;
    message: string;
  }>({
    isVisible: false,
    message: ''
  });

  const [hostDisconnected, setHostDisconnected] = useState(false);

  const [gameData, setGameData] = useState<GameData>({
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
    scores: {
      blue: 0,
      red: 0
    },
    currentRound: 0,
    gamePhase: 'pregame'
  });

  const [isHost, setIsHost] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Initialize Socket.io connection
  const { isConnected, lastMessage, sendMessage } = useWebSocket(lobbyCode, playerName);

  useEffect(() => {
    if (code) {
      setLobbyCode(code);
      
      const nameFromStorage = localStorage.getItem('playerName');
      const playerIdFromStorage = localStorage.getItem('playerId');
      
      if (nameFromStorage && playerIdFromStorage) {
        setPlayerName(nameFromStorage);
        
        // Refresh session by making a quick request to the lobby endpoint
        const refreshSession = async () => {
          try {
            // Use a session-based approach to refresh the session
            await fetch(`${API_URL}/api/lobby/${code}`, {
              credentials: 'include',
              method: 'GET'
            });
          } catch (error) {
            // If session refresh fails, try to re-establish session
            try {
              await fetch(`${API_URL}/api/lobby/join`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  code: code,
                  playerName: nameFromStorage
                }),
              });
            } catch (rejoinError) {
              // If rejoin fails, redirect back to lobby
              window.location.href = `/lobby/${code}`;
              return;
            }
          }
        };
        
        // Refresh session first, then fetch game data
        refreshSession().then(() => {
          setTimeout(() => {
            fetchGameData(code, nameFromStorage);
          }, 100);
        });
      } else {
        // If localStorage data is missing, try to redirect back to lobby
        window.location.href = `/lobby/${code}`;
      }
    }
  }, [code]);

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
        case 'teamChat':
          const teamChatData = lastMessage.data as any;
          setTeamChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            playerName: teamChatData.playerName,
            message: teamChatData.message,
            timestamp: new Date(),
            team: teamChatData.team
          }]);
          break;
        case 'roundStarted':
          const roundData = lastMessage.data as any;
          setCurrentQuestion(roundData.question);
          setRoundStatus('QP');
          const roundTimeRemaining = roundData.roundLimit || gameData.settings.roundLimit;
          setTimeRemaining(Number.isFinite(roundTimeRemaining) ? roundTimeRemaining : gameData.settings.roundLimit);
          setGameData(prev => ({ ...prev, currentRound: roundData.roundNumber }));
          setTeamAnswered({ blue: false, red: false });
          setRoundResults(null);
          setShowRoundResults(false);
          break;
        case 'answerSubmitted':
          const answerData = lastMessage.data as any;
          setTeamAnswered(prev => ({
            ...prev,
            [answerData.team]: true
          }));
          
          // Show toast notification for other team's answer
          if (answerData.team !== playerTeam) {
            setToastNotification({
              isVisible: true,
              message: answerData.message
            });
          }
          break;
        case 'roundResults':
          const resultsData = lastMessage.data as RoundResults;
          setRoundResults(resultsData);
          setShowRoundResults(true);
          setRoundStatus('QR'); // Question Reveal
          setTimeRemaining(0);
          
          // Store this round's results
          setAllRoundsResults(prev => [...prev, resultsData]);
          
          // Update scores
          setGameData(prev => ({
            ...prev,
            scores: {
              blue: resultsData.blueScore,
              red: resultsData.redScore
            }
          }));
          break;
        case 'nextRound':
          const nextRoundData = lastMessage.data as any;
          setCurrentQuestion(nextRoundData.question);
          setRoundStatus('QP');
          const newTimeRemaining = nextRoundData.roundData ? nextRoundData.roundData.roundLimit : gameData.settings.roundLimit;
          setTimeRemaining(Number.isFinite(newTimeRemaining) ? newTimeRemaining : gameData.settings.roundLimit);
          setGameData(prev => ({ 
            ...prev, 
            currentRound: nextRoundData.roundNumber 
          }));
          setTeamAnswered({ blue: false, red: false });
          setRoundResults(null);
          setShowRoundResults(false);
          break;
        case 'gameEnded':
          const gameEndData = lastMessage.data as any;
          setGameEnded(true);
          setToastNotification({
            isVisible: true,
            message: `Game Over! ${gameEndData.winner === 'blue' ? 'Blue' : 'Red'} team wins!`
          });
          // Don't auto-redirect, let host show match summary
          break;
        case 'gameStarted':
          // Refresh game data when game starts
          setGameEnded(false);
          setAllRoundsResults([]);
          if (code && playerName) {
            fetchGameData(code, playerName);
          }
          break;
        case 'lobbyClosed':
          // The lobby was closed by the server, redirect to home
          const messageData = lastMessage.data as { message?: string };
          alert(messageData.message || 'The lobby has been closed.');
          window.location.href = '/';
          break;
        case 'error':
          const errorData = lastMessage.data as any;
          setError(errorData?.message || 'Game error occurred');
          break;
        case 'returnToLobby':
          // All players return to lobby when host clicks return
          window.location.href = `/lobby/${lobbyCode}`;
          break;
        case 'hostDisconnected':
            setHostDisconnected(true);
            break;
        case 'hostReconnected':
            setHostDisconnected(false);
            setToastNotification({ isVisible: true, message: 'The host has reconnected.' });
            break;
      }
    }
  }, [lastMessage, code, playerName, playerTeam, gameData.settings.roundLimit]);

  // Timer countdown effect
  useEffect(() => {
    if (roundStatus === 'QP' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prevTime => prevTime - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeRemaining === 0 && roundStatus === 'QP') {
      // Round timer finished - automatically end the round
      handleRoundTimeout();
    }
  }, [roundStatus, timeRemaining]);

  const handleRoundTimeout = async () => {
    try {
      setError('');
      
      const response = await fetch(`${API_URL}/api/game/${lobbyCode}/round/timeout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Use session for auth
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to end round');
      }
    } catch (err) {
      console.error('Failed to end round:', err);
      setError('Failed to end round');
    }
  };

  const fetchGameData = async (code: string, currentPlayerName?: string) => {
    if (!code) return;
    
    try {
      // Fetch game state
      const gameResponse = await fetch(`${API_URL}/api/game/${code}/state`, {
        credentials: 'include',
        headers: {
          'x-player-id': localStorage.getItem('playerId') || '',
          'x-player-name': localStorage.getItem('playerName') || '',
          'x-lobby-code': code
        }
      });
      
      if (gameResponse.status === 403) {
        setError('You need to join this lobby to view it. Please return to the lobby.');
        setLoading(false);
        // Redirect back to lobby after a short delay
        setTimeout(() => {
          window.location.href = `/lobby/${code}`;
        }, 2000);
        return;
      }
      
      const gameData = await gameResponse.json();
      
      // Fetch lobby data to get team information
      const lobbyResponse = await fetch(`${API_URL}/api/lobby/${code}`, {
        credentials: 'include',
        headers: {
          'x-player-id': localStorage.getItem('playerId') || '',
          'x-player-name': localStorage.getItem('playerName') || '',
          'x-lobby-code': code
        }
      });
      
      if (lobbyResponse.status === 403) {
        setError('You need to join this lobby to view it. Please return to the lobby.');
        setLoading(false);
        // Redirect back to lobby after a short delay
        setTimeout(() => {
          window.location.href = `/lobby/${code}`;
        }, 2000);
        return;
      }
      
      const lobbyData = await lobbyResponse.json();
      
      if (gameData.success && lobbyData.success) {
        const lobby = lobbyData.lobby;
        
        setGameData({
          code: code,
          host: lobby.host,
          settings: gameData.settings,
          teams: {
            red: {
              captain: lobby.captains.red ? { name: lobby.captains.red, role: 'captain' } : undefined,
              players: lobby.players.redTeam
                .filter((name: string) => name !== lobby.captains.red)
                .map((name: string) => ({ name, role: 'member' }))
            },
            blue: {
              captain: lobby.captains.blue ? { name: lobby.captains.blue, role: 'captain' } : undefined,
              players: lobby.players.blueTeam
                .filter((name: string) => name !== lobby.captains.blue)
                .map((name: string) => ({ name, role: 'member' }))
            }
          },
          scores: gameData.scores,
          currentRound: gameData.currentRoundNumber,
          gamePhase: gameData.gamePhase
        });
        
        // Set host status using the provided playerName or current state
        const nameToCheck = currentPlayerName || playerName;
        if (nameToCheck) {
          setIsHost(nameToCheck === lobby.host);
          
          // Set captain status and team
          const isRedCaptain = lobby.captains.red === nameToCheck;
          const isBlueCaptain = lobby.captains.blue === nameToCheck;
          setIsCaptain(isRedCaptain || isBlueCaptain);
          
          if (isRedCaptain) {
            setPlayerTeam('red');
          } else if (isBlueCaptain) {
            setPlayerTeam('blue');
          } else if (lobby.players.redTeam.includes(nameToCheck)) {
            setPlayerTeam('red');
          } else if (lobby.players.blueTeam.includes(nameToCheck)) {
            setPlayerTeam('blue');
          } else {
            setPlayerTeam(null);
          }
          
        }
        
        // Set round status and question based on game state
        if (gameData.roundData) {
          setRoundStatus(gameData.roundData.roundStatus);
          if (gameData.roundData.question && gameData.roundData.roundStatus === 'QP') {
            setCurrentQuestion(gameData.roundData.question);
          }
          
          // Set team answered status
          setTeamAnswered({
            blue: gameData.roundData.blueAnswer !== null,
            red: gameData.roundData.redAnswer !== null
          });
          
          // Set timer based on round status and start time
          if (gameData.roundData.roundStatus === 'QP') {
            if (gameData.roundData.roundStartTime) {
              // Calculate remaining time based on round start time
              const elapsedTime = Math.floor((Date.now() - gameData.roundData.roundStartTime) / 1000);
              const remainingTime = Math.max(0, gameData.settings.roundLimit - elapsedTime);
              setTimeRemaining(remainingTime);
            } else {
              // Fallback to full timer if no start time
              setTimeRemaining(gameData.settings.roundLimit);
            }
          } else {
            setTimeRemaining(0);
          }
        } else {
          // No active round, set timer to 0
          setTimeRemaining(0);
        }
        
        setLoading(false);
        setError('');
      } else {
        setError(gameData.error || lobbyData.error || 'Failed to load game');
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch game data:', err);
      setError('Failed to load game data');
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    if (chatMode === 'game') {
      sendMessage('gameChat', {
        playerName: playerName,
        message: messageInput.trim()
      });
    } else {
      sendMessage('teamChat', {
        playerName: playerName,
        message: messageInput.trim()
      });
    }
    
    setMessageInput('');
  };

  const handleSendTeamMessage = () => {
    if (!teamMessageInput.trim()) return;
    
    sendMessage('teamChat', {
      playerName: playerName,
      message: teamMessageInput.trim()
    });
    
    setTeamMessageInput('');
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
        body: JSON.stringify({ lobbyCode }) // Remove playerId - backend will get it from session
      });

      const data = await response.json();
      
      if (data.success) {
        // Game started successfully, refresh data
        fetchGameData(lobbyCode, playerName);
      } else {
        setError(data.error || 'Failed to start game');
      }
    } catch (err) {
      console.error('Failed to start game:', err);
      setError('Failed to start game');
    }
  };

  const handleStartRound = async () => {
    if (!isHost) return;
    
    try {
      setError('');
      
      const response = await fetch(`${API_URL}/api/game/${lobbyCode}/round/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session for auth
        body: JSON.stringify({ lobbyCode }) // Remove playerId - backend will get it from session
      });

      const data = await response.json();
      
      if (data.success && data.roundData) {
        setCurrentQuestion(data.roundData.question);
        setRoundStatus('QP');
      } else {
        setError(data.error || 'Failed to start round');
      }
    } catch (err) {
      console.error('Failed to start round:', err);
      setError('Failed to start round');
    }
  };

  const handleSubmitAnswer = async () => {
    if (!isCaptain || !answerInput.trim()) return;
    
    try {
      setError('');
      
      const response = await fetch(`${API_URL}/api/game/${lobbyCode}/round/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session for auth
        body: JSON.stringify({ 
          answer: answerInput.trim(),
          isSteal: false
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setAnswerInput('');
        // Answer submitted successfully
      } else {
        setError(data.error || 'Failed to submit answer');
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setError('Failed to submit answer');
    }
  };

  const handleSteal = async () => {
    if (!isCaptain) return;
    
    try {
      setError('');
      
      const response = await fetch(`${API_URL}/api/game/${lobbyCode}/round/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session for auth
        body: JSON.stringify({ 
          answer: '',
          isSteal: true
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to steal');
      }
    } catch (err) {
      console.error('Failed to steal:', err);
      setError('Failed to steal');
    }
  };

  const handleNextRound = async () => {
    if (!isHost) return;
    
    try {
      setError('');
      
      const response = await fetch(`${API_URL}/api/game/${lobbyCode}/round/next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session for auth
        body: JSON.stringify({ lobbyCode }) // Remove playerId - backend will get it from session
      });

      const data = await response.json();
      
      if (data.success) {
        if (data.gameEnded) {
          // Game ended, will be handled by socket event
        } else {
          // Next round started - update state immediately
          setCurrentQuestion(data.question);
          setRoundStatus('QP');
          const nextRoundTimeRemaining = data.roundData ? data.roundData.roundLimit : gameData.settings.roundLimit;
          setTimeRemaining(Number.isFinite(nextRoundTimeRemaining) ? nextRoundTimeRemaining : gameData.settings.roundLimit);
          setGameData(prev => ({ 
            ...prev, 
            currentRound: data.roundNumber 
          }));
          setTeamAnswered({ blue: false, red: false });
          setRoundResults(null);
          setShowRoundResults(false);
        }
      } else {
        setError(data.error || 'Failed to start next round');
      }
    } catch (err) {
      console.error('Failed to start next round:', err);
      setError('Failed to start next round');
    }
  };

  const handleReturnToLobby = async () => {
    if (!isHost) return;
    
    try {
      setError('');
      
      const response = await fetch(`${API_URL}/api/game/${lobbyCode}/return-to-lobby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use session for auth
        body: JSON.stringify({ lobbyCode }) // Remove playerId - backend will get it from session
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to return to lobby');
      }
    } catch (err) {
      console.error('Failed to return to lobby:', err);
      setError('Failed to return to lobby');
    }
  };

  const getCurrentPlayerTeam = () => {
    return playerTeam;
  };

  const formatTime = (seconds: number) => {
    // Safety check for NaN or undefined values
    if (isNaN(seconds) || seconds === undefined || seconds === null) {
      return '0:00';
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canSubmitAnswer = () => {
    if (!isCaptain) return false;
    if (roundStatus !== 'QP') return false;
    if (teamAnswered[playerTeam as keyof typeof teamAnswered]) return false;
    return true;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700">Loading game...</h2>
          <p className="text-gray-500 mt-2">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (error && !gameData.code) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Error</h2>
          <p className="text-gray-700 mt-2">{error}</p>
          <div className="mt-4 space-x-2">
            <Button 
              onClick={() => window.location.href = `/lobby/${code}`}
              className="mr-2"
            >
              Return to Lobby
            </Button>
            <Button 
              onClick={() => window.location.href = '/'}
              variant="outline"
            >
              Return Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 lg:p-4">
      {/* Host Disconnected Banner */}
      {hostDisconnected && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 text-center mb-4" role="alert">
              <p className="font-bold">Host Disconnected</p>
              <p>The host has disconnected. If they do not reconnect within 30 seconds, the lobby will be closed.</p>
          </div>
      )}

      {/* Toast Notification */}
      <ToastNotification
        message={toastNotification.message}
        isVisible={toastNotification.isVisible}
        onClose={() => setToastNotification({ isVisible: false, message: '' })}
        duration={1000}
      />
      
      <div className="max-w-8xl mx-auto">
        
        {/* Game Header */}
        <div className="text-center mb-2 lg:mb-4">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
            Game of Liars
          </h1>
          <div className="flex items-center justify-center space-x-4 lg:space-x-6 text-sm lg:text-base text-gray-600 mt-1">
            <span>Room: <span className="font-mono font-semibold">{gameData.code}</span></span>
            <span></span>
            <span>Round {gameData.currentRound}/{gameData.settings.rounds}</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-md mx-auto p-2 bg-red-50 border border-red-200 rounded-lg mb-2 lg:mb-4">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 lg:gap-4">
          
          {/* Blue Team */}
          <div className="lg:col-span-1 order-1 lg:order-1">
            <div className="bg-white/90 border-l-4 border-blue-500 shadow-xl backdrop-blur-sm rounded-lg">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base lg:text-lg text-white font-bold">Blue Team</h2>
                  <div className="text-right">
                    <div className="text-lg lg:text-xl font-bold text-white">{gameData.scores.blue}</div>
                    <div className="text-xs text-blue-100">/ {gameData.settings.maxScore}</div>
                  </div>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {gameData.teams.blue.captain && (
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-blue-800 text-sm">
                        {gameData.teams.blue.captain.name}
                        {gameData.teams.blue.captain.name === playerName && ' (you)'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded-full font-medium">
                        CAPTAIN
                      </span>
                    </div>
                    {gameData.teams.blue.captain.name === gameData.host && (
                      <span className="text-xs text-blue-600">HOST</span>
                    )}
                  </div>
                )}
                {gameData.teams.blue.players.map((player, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-800 text-sm">
                      {player.name}
                      {player.name === playerName && ' (you)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center Game Area */}
          <div className="lg:col-span-3 order-3 lg:order-2 space-y-2 lg:space-y-4">
            
            {/* Game Status */}
            <Card className="bg-white/90 shadow-xl backdrop-blur-sm">
              <CardContent className="p-4 lg:p-6 text-center">
                <div className="space-y-2 lg:space-y-3">
                  <div className="text-xl lg:text-2xl font-light text-gray-700">
                    Round {gameData.currentRound}
                  </div>
                  
                  {/* Game Flow Logic */}
                  {gameData.gamePhase === 'pregame' ? (
                    // Pre-game: Show start game button or waiting message
                    <>
                      {isHost ? (
                        <Button
                          onClick={handleStartGame}
                          className="mt-2 px-8 lg:px-10 py-4 lg:py-5 text-xl lg:text-2xl bg-green-600 hover:bg-green-700 text-white font-bold"
                        >
                          Start the game
                        </Button>
                      ) : (
                        <div className="text-2xl lg:text-3xl font-bold text-gray-900">
                          Waiting for host to start the game...
                        </div>
                      )}
                    </>
                  ) : gameData.gamePhase === 'playing' && roundStatus === 'NS' ? (
                    // Game started but round not started: Show start round button or waiting
                    <>
                      {isHost ? (
                        <Button
                          onClick={handleStartRound}
                          className="mt-2 px-8 lg:px-10 py-4 lg:py-5 text-xl lg:text-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                        >
                          Start Round
                        </Button>
                      ) : (
                        <div className="text-2xl lg:text-3xl font-bold text-gray-900">
                          Waiting for host to start the round...
                        </div>
                      )}
                    </>
                  ) : roundStatus === 'QP' && currentQuestion ? (
                    // Round in progress: Show question and captain controls
                    <div className="space-y-4">
                      <div className="text-lg lg:text-xl font-bold text-gray-900 bg-gray-50 p-4 rounded-lg">
                        {currentQuestion}
                      </div>
                      
                      {/* Captain Controls */}
                      {isCaptain && canSubmitAnswer() && (
                        <div className="space-y-3">
                          <div className="flex space-x-2">
                            <Input
                              value={answerInput}
                              onChange={(e) => setAnswerInput(e.target.value)}
                              placeholder="Type your answer..."
                              onKeyPress={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                              className="flex-1"
                            />
                          </div>
                          <div className="flex space-x-2 justify-center">
                            <Button
                              onClick={handleSubmitAnswer}
                              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                              disabled={!answerInput.trim()}
                            >
                              Submit Answer
                            </Button>
                            <Button
                              onClick={handleSteal}
                              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium"
                            >
                              Steal
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {!isCaptain && (
                        <div className="text-gray-600">
                          Waiting for captains to answer...
                        </div>
                      )}
                      
                      {isCaptain && !canSubmitAnswer() && (
                        <div className="text-gray-600">
                          Answer submitted! Waiting for other team...
                        </div>
                      )}
                    </div>
                  ) : roundStatus === 'QR' && showRoundResults && roundResults ? (
                    // Round results: Show answers and scores
                    <div className="space-y-2">
                      <div className="text-base lg:text-lg font-bold text-gray-900 bg-gray-50 p-2 rounded-lg">
                        {(gameEnded || 
                          gameData.scores.blue >= gameData.settings.maxScore || 
                          gameData.scores.red >= gameData.settings.maxScore ||
                          gameData.currentRound >= gameData.settings.rounds) ? 
                          'Match Results' : 'Round Results'}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 p-2 rounded-lg">
                          <h3 className="font-bold text-blue-800 mb-1 text-xs">Blue Team</h3>
                          {(gameEnded || 
                            gameData.scores.blue >= gameData.settings.maxScore || 
                            gameData.scores.red >= gameData.settings.maxScore ||
                            gameData.currentRound >= gameData.settings.rounds) ? (
                            // Show all rounds for Blue team
                            <div className="space-y-0.5 max-h-28 overflow-y-auto">
                              {allRoundsResults.map((result, index) => (
                                <div key={index} className="text-xs border-b border-blue-200 pb-0.5">
                                  <span className="font-medium">R{index + 1}:</span>
                                  <span className="ml-1">
                                    {result.blueAnswer?.isSteal ? 
                                      `STOLE${result.blueAnswer?.answer ? `: ${result.blueAnswer.answer}` : ''}` :
                                      `${result.blueAnswer?.answer || 'No answer'}`
                                    }
                                  </span>
                                  <span className="ml-1 font-bold">
                                    ({result.bluePoints > 0 ? '+' : ''}{result.bluePoints})
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Show current round for Blue team
                            <>
                              <p className="text-xs">
                                {roundResults.blueAnswer?.isSteal ? 
                                  `STOLE${roundResults.blueAnswer?.answer ? `: ${roundResults.blueAnswer.answer}` : ''}` :
                                  `${roundResults.blueAnswer?.answer || 'No answer'}`
                                }
                              </p>
                              <p className="text-xs font-bold">
                                Points: {roundResults.bluePoints > 0 ? '+' : ''}{roundResults.bluePoints}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="bg-red-50 p-2 rounded-lg">
                          <h3 className="font-bold text-red-800 mb-1 text-xs">Red Team</h3>
                          {(gameEnded || 
                            gameData.scores.blue >= gameData.settings.maxScore || 
                            gameData.scores.red >= gameData.settings.maxScore ||
                            gameData.currentRound >= gameData.settings.rounds) ? (
                            // Show all rounds for Red team
                            <div className="space-y-0.5 max-h-28 overflow-y-auto">
                              {allRoundsResults.map((result, index) => (
                                <div key={index} className="text-xs border-b border-red-200 pb-0.5">
                                  <span className="font-medium">R{index + 1}:</span>
                                  <span className="ml-1">
                                    {result.redAnswer?.isSteal ? 
                                      `STOLE${result.redAnswer?.answer ? `: ${result.redAnswer.answer}` : ''}` :
                                      `${result.redAnswer?.answer || 'No answer'}`
                                    }
                                  </span>
                                  <span className="ml-1 font-bold">
                                    ({result.redPoints > 0 ? '+' : ''}{result.redPoints})
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Show current round for Red team
                            <>
                              <p className="text-xs">
                                {roundResults.redAnswer?.isSteal ? 
                                  `STOLE${roundResults.redAnswer?.answer ? `: ${roundResults.redAnswer.answer}` : ''}` :
                                  `${roundResults.redAnswer?.answer || 'No answer'}`
                                }
                              </p>
                              <p className="text-xs font-bold">
                                Points: {roundResults.redPoints > 0 ? '+' : ''}{roundResults.redPoints}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-green-50 p-2 rounded-lg">
                        <h3 className="font-bold text-green-800 mb-1 text-xs">Correct Answer</h3>
                        <p className="text-xs">{roundResults.correctAnswer}</p>
                      </div>
                      
                      <div className="text-center">
                        {(gameEnded || 
                          gameData.scores.blue >= gameData.settings.maxScore || 
                          gameData.scores.red >= gameData.settings.maxScore ||
                          gameData.currentRound >= gameData.settings.rounds) ? (
                          // Game ended - show winner
                          <div className="text-sm font-bold">
                            {gameData.scores.blue > gameData.scores.red ? (
                              <span className="text-blue-600">Blue Team Won!</span>
                            ) : gameData.scores.red > gameData.scores.blue ? (
                              <span className="text-red-600">Red Team Won!</span>
                            ) : (
                              <span className="text-amber-600">It's a Tie!</span>
                            )}
                          </div>
                        ) : (
                          // Round ended - show round winner
                          <p className="text-sm font-bold">
                            Winner: {roundResults.winner === 'blue' ? 'Blue Team' : 
                                     roundResults.winner === 'red' ? 'Red Team' : 'Tie'}
                          </p>
                        )}
                      </div>
                      
                      {isHost && (
                        <Button
                          onClick={(gameEnded || 
                                   gameData.scores.blue >= gameData.settings.maxScore || 
                                   gameData.scores.red >= gameData.settings.maxScore ||
                                   gameData.currentRound >= gameData.settings.rounds) ? 
                                   handleReturnToLobby : handleNextRound}
                          className="mt-1 px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white font-bold"
                          disabled={false}
                        >
                          {(gameEnded || 
                            gameData.scores.blue >= gameData.settings.maxScore || 
                            gameData.scores.red >= gameData.settings.maxScore ||
                            gameData.currentRound >= gameData.settings.rounds) ? 
                            'Return to Lobby' : 'Next Round'}
                        </Button>
                      )}
                    </div>
                  ) : (gameEnded || 
                       gameData.scores.blue >= gameData.settings.maxScore || 
                       gameData.scores.red >= gameData.settings.maxScore ||
                       gameData.currentRound >= gameData.settings.rounds) ? (
                    // Game ended: Show congratulations screen
                    <div className="space-y-6 text-center">
                      {/* Game Results */}
                      <div className="text-2xl lg:text-3xl font-bold text-gray-900">
                        Game Results
                      </div>
                      
                      {/* Winner announcement */}
                      <div className="text-xl lg:text-2xl font-bold">
                        {gameData.scores.blue > gameData.scores.red ? (
                          <span className="text-blue-600">Blue Team Won the Game!</span>
                        ) : gameData.scores.red > gameData.scores.blue ? (
                          <span className="text-red-600">Red Team Won the Game!</span>
                        ) : (
                          <span className="text-amber-600">It's a Tie!</span>
                        )}
                      </div>
                      
                      {/* Final scores */}
                      <div className="text-lg lg:text-xl text-gray-600 mt-4">
                        <p>Final Score:</p>
                        <div className="flex justify-center space-x-8 mt-2">
                          <span className="text-blue-600 font-bold">{gameData.scores.blue} - Blue</span>
                          <span className="text-red-600 font-bold">{gameData.scores.red} - Red</span>
                        </div>
                      </div>
                      
                      {/* Host buttons */}
                      {isHost && (
                        <div className="mt-8 space-y-4">
                          <Button
                            onClick={handleReturnToLobby}
                            className="px-8 py-4 text-xl bg-green-600 hover:bg-green-700 text-white font-bold"
                          >
                            Return to Lobby
                          </Button>
                        </div>
                      )}
                      
                      {/* Non-host message */}
                      {!isHost && (
                        <div className="mt-8 text-gray-500">
                          <p>Waiting for host to return to lobby...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Default state
                    <div className="text-2xl lg:text-3xl font-bold text-gray-900">
                      Game loading...
                    </div>
                  )}
                  
                  {/* Timer Display */}
                  {roundStatus === 'QP' && (
                    <div className="text-3xl lg:text-4xl font-mono font-bold text-gray-400">
                      {formatTime(timeRemaining)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chat */}
            <Card className="bg-white/90 shadow-xl backdrop-blur-sm">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between mb-2 lg:mb-3">
                  <h3 className="text-sm lg:text-base font-medium text-gray-900">Chat</h3>
                </div>
                
                {/* Chat Layout - Side by Side */}
                <div className="flex flex-col lg:flex-row gap-3">
                  {/* Game Chat */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Game Chat</h4>
                    </div>
                    
                    {/* Game Chat Messages */}
                    <div className="bg-gray-50 rounded-lg p-2 overflow-y-auto mb-2 min-h-[120px] lg:min-h-[200px]">
                      <div className="space-y-1">
                        {chatMessages.map((msg) => {
                          // Determine team color for player name
                          const isRedTeam = gameData.teams.red.captain?.name === msg.playerName || 
                                           gameData.teams.red.players.some(p => p.name === msg.playerName);
                          const isBlueTeam = gameData.teams.blue.captain?.name === msg.playerName || 
                                            gameData.teams.blue.players.some(p => p.name === msg.playerName);
                          
                          let nameColor = 'text-gray-700'; // Default for spectators
                          if (isRedTeam) nameColor = 'text-red-600';
                          else if (isBlueTeam) nameColor = 'text-blue-600';
                          
                          return (
                            <div key={msg.id} className="text-xs">
                              <span className={`font-medium ${nameColor}`}>{msg.playerName}:</span>
                              <span className="text-gray-600 ml-2">{msg.message}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Game Chat Input */}
                    <div className="flex space-x-2">
                      <Input
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Type a game message..."
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 text-xs h-8"
                      />
                      <Button 
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim()}
                        size="sm"
                        className="px-2 h-8 text-xs"
                      >
                        Send
                      </Button>
                    </div>
                  </div>

                  {/* Team Chat */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Team Chat</h4>
                    </div>
                    
                    {/* Team Chat Messages */}
                    <div className="bg-gray-50 rounded-lg p-2 overflow-y-auto mb-2 min-h-[120px] lg:min-h-[200px]">
                      <div className="space-y-1">
                        {teamChatMessages
                          .filter(msg => {
                            const currentTeam = getCurrentPlayerTeam();
                            // Show messages for the current player's team OR spectator messages if player is a spectator
                            return msg.team === currentTeam || (currentTeam === null && msg.team === 'spectator');
                          })
                          .map((msg) => {
                            // Determine team color for player name
                            const isRedTeam = gameData.teams.red.captain?.name === msg.playerName || 
                                             gameData.teams.red.players.some(p => p.name === msg.playerName);
                            const isBlueTeam = gameData.teams.blue.captain?.name === msg.playerName || 
                                              gameData.teams.blue.players.some(p => p.name === msg.playerName);
                            
                            let nameColor = 'text-gray-700'; // Default for spectators
                            if (isRedTeam) nameColor = 'text-red-600';
                            else if (isBlueTeam) nameColor = 'text-blue-600';
                            
                            return (
                              <div key={msg.id} className="text-xs">
                                <span className={`font-medium ${nameColor}`}>{msg.playerName}:</span>
                                <span className="text-gray-600 ml-2">{msg.message}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                    
                    {/* Team Chat Input */}
                    <div className="flex space-x-2">
                      <Input
                        value={teamMessageInput}
                        onChange={(e) => setTeamMessageInput(e.target.value)}
                        placeholder="Type a team message..."
                        onKeyPress={(e) => e.key === 'Enter' && handleSendTeamMessage()}
                        className="flex-1 text-xs h-8"
                      />
                      <Button 
                        onClick={handleSendTeamMessage}
                        disabled={!teamMessageInput.trim()}
                        size="sm"
                        className="px-2 h-8 text-xs"
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Red Team */}
          <div className="lg:col-span-1 order-2 lg:order-3">
            <div className="bg-white/90 border-r-4 border-red-500 shadow-xl backdrop-blur-sm rounded-lg">
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-3 py-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base lg:text-lg text-white font-bold">Red Team</h2>
                  <div className="text-right">
                    <div className="text-lg lg:text-xl font-bold text-white">{gameData.scores.red}</div>
                    <div className="text-xs text-red-100">/ {gameData.settings.maxScore}</div>
                  </div>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {gameData.teams.red.captain && (
                  <div className="p-2 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-red-800 text-sm">
                        {gameData.teams.red.captain.name}
                        {gameData.teams.red.captain.name === playerName && ' (you)'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-red-600 text-white rounded-full font-medium">
                        CAPTAIN
                      </span>
                    </div>
                    {gameData.teams.red.captain.name === gameData.host && (
                      <span className="text-xs text-red-600">HOST</span>
                    )}
                  </div>
                )}
                {gameData.teams.red.players.map((player, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-800 text-sm">
                      {player.name}
                      {player.name === playerName && ' (you)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
