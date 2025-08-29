"use client"

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Send, Users } from "lucide-react";
import { socketService, addSocketListener, removeSocketListener } from "@/lib/socket";

import { getBaseUrl } from "@/lib/api";

interface ChatMessage {
  id: string;
  message: string;
  playerId: string;
  playerName: string;
  team: "blue" | "red";
  chatType: "game" | "team";
  timestamp: string;
}

interface Player {
  id: string;
  name: string;
  team: "blue" | "red";
  isCaptain?: boolean;
  isHost?: boolean;
}

function BanditLogo(props: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className}>
      <rect x="8" y="18" width="48" height="28" rx="14" fill="currentColor" opacity="0.9"/>
      <rect x="14" y="26" width="14" height="8" rx="4" fill="#0f172a"/>
      <rect x="36" y="26" width="14" height="8" rx="4" fill="#0f172a"/>
      <path d="M12 18c4-6 12-10 20-10s16 4 20 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
      <path d="M14 46c4 6 12 10 18 10s14-4 18-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.8"/>
    </svg>
  );
}

function AnimatedDots() {
  const [dots, setDots] = useState('.');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '.';
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  return <span>{dots}</span>;
}

function TeamCard({ side, color, score, players, currentPlayerId }: { side: "Blue" | "Red"; color: "blue" | "red"; score: number; players: Player[]; currentPlayerId?: string; }) {
  const colorClasses = color === "blue" ? "from-indigo-500 to-blue-600" : "from-rose-600 to-red-600";
  const panelBg = color === "blue" ? "bg-indigo-50/5" : "bg-rose-50/5";
  return (
    <div className={`rounded-2xl shadow-xl border border-white/10 overflow-hidden`}>
      <div className={`px-4 py-3 text-white font-semibold bg-gradient-to-r ${colorClasses} flex items-center justify-between`}>
        <span>{side} Team</span>
        <div className="text-right leading-none">
          <div className="text-xl font-extrabold">{score}</div>
        </div>
      </div>
      <div className={`${panelBg} p-3 space-y-2 hidden lg:block`}>
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <Users className="h-4 w-4 opacity-80" />
            <span className="text-sm flex-1 truncate">{p.name}</span>
            {p.isCaptain && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/80 text-slate-900">CAPTAIN</span>
            )}
            {currentPlayerId === p.id && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-400/90 text-slate-900">YOU</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScorePillsMobile({ blueScore, redScore }: { blueScore: number; redScore: number; }) {
  return (
    <div className="lg:hidden grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 flex items-center justify-between shadow border border-white/10">
        <span className="font-semibold">Blue</span>
        <span className="font-extrabold">{blueScore}</span>
      </div>
      <div className="rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 flex items-center justify-between shadow border border-white/10">
        <span className="font-semibold">Red</span>
        <span className="font-extrabold">{redScore}</span>
      </div>
    </div>
  );
}

function ChatMessage({ message, currentPlayerTeam }: { message: ChatMessage; currentPlayerTeam: "blue" | "red" }) {
  const isTeamChat = message.chatType === "team";
  const isOwnTeam = message.team === currentPlayerTeam;
  
  // Only show team chat messages from own team
  if (isTeamChat && !isOwnTeam) return null;
  
  const teamColors = {
    blue: "text-blue-400",
    red: "text-red-400"
  };
  
  const teamBgColors = {
    blue: "bg-blue-600",
    red: "bg-red-600"
  };
  
  const messageBg = isTeamChat ? "bg-white/5" : "bg-slate-800/50";
  
  return (
    <div className={`${messageBg} rounded-lg p-1.5 mb-1.5`}>
      <div className="flex items-center gap-2 text-sm">
        <span className={`${isTeamChat ? teamBgColors[message.team] : 'bg-white'} ${isTeamChat ? 'text-white' : teamColors[message.team]} px-2 py-0.5 rounded font-medium text-xs`}>
          {isTeamChat ? `[TEAM] ${message.playerName}` : `[ALL] ${message.playerName}`}
        </span>
        <span className="text-white flex-1">{message.message}</span>
        <span className="text-xs text-white/50">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

export default function GamePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<"idle" | "question" | "answered" | "results" | "summary">("idle");
  const [roundResults, setRoundResults] = useState<any>(null);
  const [gameComplete, setGameComplete] = useState(false);
  const [allRounds, setAllRounds] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [chatMode, setChatMode] = useState<"game" | "team">("team");
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [blueTeam, setBlueTeam] = useState<Player[]>([]);
  const [redTeam, setRedTeam] = useState<Player[]>([]);
  const [blueScore, setBlueScore] = useState<number>(0);
  const [redScore, setRedScore] = useState<number>(0);
  const [maxScore, setMaxScore] = useState<number>(7);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    const token = localStorage.getItem('gameToken');
    if (!token || !code) {
      navigate('/');
      return;
    }

    // Verify token is valid and player is authorized to be in this game
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Check if token is for the correct lobby
      if (payload.lobby !== code) {
        console.error('Token lobby mismatch');
        navigate('/');
        return;
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.error('Token expired');
        navigate('/');
        return;
      }

      setCurrentPlayer({
        id: payload.sub,
        name: payload.name,
        team: "blue",
        isHost: payload.isHost || false
      });
    } catch (error) {
      console.error('Failed to parse token:', error);
      navigate('/');
      return;
    }

    // Connect to socket and join lobby
    socketService.connect();
    socketService.joinLobby(token);
  }, [code, navigate]);

  useEffect(() => {
    const handleChatMessage = (data: { message: string; playerId: string; playerName: string; team: string; chatType: 'game' | 'team'; timestamp: string }) => {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        message: data.message,
        playerId: data.playerId,
        playerName: data.playerName,
        team: data.team as "blue" | "red",
        chatType: data.chatType,
        timestamp: data.timestamp
      };
      setMessages(prev => [...prev, newMessage]);
    };

    const handleGameEnded = (data: { reason?: string }) => {
      navigate(`/lobby/${code}`);
    };

    const handleRoundStarted = (data: any) => {
      if (data.game && data.game.currentRound) {
        setRound(data.game.currentRoundNumber);
        setQuestion(data.game.currentRound.question);
        setPhase("question");
        setAnswer("");
        setRoundResults(null);
        
        // Update scores if provided
        if (data.game.scores) {
          setBlueScore(data.game.scores.blue);
          setRedScore(data.game.scores.red);
        }
        
        // Clear any existing timer before starting a new one
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        // Simple countdown timer using server-provided endsAt
        const updateTimer = () => {
          const now = Date.now();
          const timeLeft = Math.max(0, (data.endsAt ?? 0) - now);
          const secondsLeftCalc = Math.floor(timeLeft / 1000);
          
          setSecondsLeft(secondsLeftCalc);

          
          if (timeLeft <= 0) {
            clearInterval(timerIntervalRef.current!);
            timerIntervalRef.current = null;
          }
        };
        
        // Update immediately and then every second
        updateTimer();
        timerIntervalRef.current = window.setInterval(updateTimer, 1000);
      }
    };

    const handleRoundTimeup = () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setSecondsLeft(0);
    };
    const handleRoundResults = (data: { round: any; scores: { blue: number; red: number }; game?: any; isGameEnd?: boolean; gameComplete?: boolean }) => {
      if (data.round) {
        setRoundResults(data.round);
        
        // Update scores
        if (data.scores) {
          setBlueScore(data.scores.blue);
          setRedScore(data.scores.red);
        }
        
        // Always show round results first
        setPhase("results");
        const winner = data.round.winner === 'tie' ? 'It\'s a tie!' : `${data.round.winner} team wins this round!`;
        
        // Check if game is complete
        if (data.gameComplete && data.game) {
          setGameComplete(true);
          setAllRounds(data.game.rounds || []);
          
          // Show final round results first, then transition after 5 seconds to summary
          // Final round complete
          
          setTimeout(() => {
            setPhase("summary");
            
            const finalWinner = data.scores.blue > data.scores.red ? 'Blue' : 
                               data.scores.red > data.scores.blue ? 'Red' : 'Tie';
            // Game complete
          }, 5000);
        } else {
          // Round complete
        }
      }
    };

    const handlePlayerDisconnected = (data: { playerId: string; lobbyCode: string; timestamp: string }) => {
      // Update UI to show player as disconnected but don't remove them

      // Could add visual indicators here in the future
    };

    const handleTeamAnswerSubmitted = (data: { team: string; isSteal: boolean; bothSubmitted: boolean; timestamp: string }) => {

      
      if (data.bothSubmitted) {
        // Both teams have submitted, show waiting state
        // Both teams submitted
      } else {
        // Only one team submitted, show waiting for other team
        const otherTeam = data.team === 'blue' ? 'red' : 'blue';
      }
    };

    const handleAnswerProcessingStarted = (data: { message: string; timestamp: string }) => {
      // Could show a loading spinner or progress indicator here
    };

    const handleLobbyReturned = (data: { lobby: any; message: string; timestamp: string }) => {
      
      // Small delay to ensure server state is fully updated
      setTimeout(() => {
        navigate(`/lobby/${code}`);
      }, 1000);
    };

    addSocketListener('chat-message', handleChatMessage);
    addSocketListener('game-ended', handleGameEnded);
    addSocketListener('round-started', handleRoundStarted);
    addSocketListener('round-results', handleRoundResults);
    addSocketListener('round-timeup', handleRoundTimeup as any);
    addSocketListener('player-disconnected', handlePlayerDisconnected);
    addSocketListener('team-answer-submitted', handleTeamAnswerSubmitted);
    addSocketListener('answer-processing-started', handleAnswerProcessingStarted);
    addSocketListener('lobby-returned', handleLobbyReturned);

    return () => {
      removeSocketListener('chat-message', handleChatMessage);
      removeSocketListener('game-ended', handleGameEnded);
      removeSocketListener('round-started', handleRoundStarted);
      removeSocketListener('round-results', handleRoundResults);
      removeSocketListener('round-timeup', handleRoundTimeup as any);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      removeSocketListener('player-disconnected', handlePlayerDisconnected);
      removeSocketListener('team-answer-submitted', handleTeamAnswerSubmitted);
      removeSocketListener('answer-processing-started', handleAnswerProcessingStarted);
      removeSocketListener('lobby-returned', handleLobbyReturned);
    };
  }, [code, navigate]);

  // Fetch lobby data to populate teams and derive current player's team
  useEffect(() => {
    const fetchLobbyData = async () => {
      const token = localStorage.getItem('gameToken');
      if (!token || !code) return;

      try {
        const response = await fetch(`${getBaseUrl()}/api/lobby/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          setBlueTeam(data.data.blueTeam);
          setRedTeam(data.data.redTeam);
          if (Array.isArray(data.data?.blueTeam) && Array.isArray(data.data?.redTeam)) {
            const all = [...data.data.blueTeam, ...data.data.redTeam];
            setCurrentPlayer((prev) => {
              if (!prev) return prev;
              const me = all.find((p) => p.id === prev.id);
              return me ? { ...prev, team: me.team } : prev;
            });
          }
          if (data.data?.settings?.rounds) {
            setMaxScore(Number(data.data.settings.rounds) || 7);
          }
        }
      } catch (error) {
        console.error('Failed to fetch lobby data:', error);
      }
    };

    fetchLobbyData();
  }, [code]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep teams in sync via socket events during the game
  useEffect(() => {
    const syncFromLobby = (lobby: any) => {
      if (!lobby) return;
      setBlueTeam(lobby.blueTeam || []);
      setRedTeam(lobby.redTeam || []);
      if (lobby?.settings?.rounds) setMaxScore(Number(lobby.settings.rounds) || 7);
      
      // Update team scores from game state if available
      if (lobby?.gameState?.scores) {
        setBlueScore(lobby.gameState.scores.blue || 0);
        setRedScore(lobby.gameState.scores.red || 0);
      } else {
        // Initialize scores to 0 if no game state yet
        setBlueScore(0);
        setRedScore(0);
      }
      
      setCurrentPlayer((prev) => {
        if (!prev) return prev;
        const all = [...(lobby.blueTeam || []), ...(lobby.redTeam || [])];
        const me = all.find((p: any) => p.id === prev.id);
        return me ? { ...prev, team: me.team } : prev;
      });
    };

    const onPlayerJoined = (data: any) => syncFromLobby(data.lobby);
    const onPlayerLeft = (data: any) => syncFromLobby(data.lobby);
    const onTeamChanged = (data: any) => syncFromLobby(data.lobby);
    const onPlayerKicked = (data: any) => syncFromLobby(data.lobby);
    const onLobbyUpdated = (data: any) => syncFromLobby(data.lobby);
    const onSettingsUpdated = (data: any) => syncFromLobby(data.lobby);
    const onGameStarted = (data: any) => syncFromLobby(data.lobby);

    addSocketListener('player-joined', onPlayerJoined as any);
    addSocketListener('player-left', onPlayerLeft as any);
    addSocketListener('player-team-changed', onTeamChanged as any);
    addSocketListener('player-kicked', onPlayerKicked as any);
    addSocketListener('lobby-updated', onLobbyUpdated as any);
    addSocketListener('settings-updated', onSettingsUpdated as any);
    addSocketListener('game-started', onGameStarted as any);

    return () => {
      removeSocketListener('player-joined', onPlayerJoined as any);
      removeSocketListener('player-left', onPlayerLeft as any);
      removeSocketListener('player-team-changed', onTeamChanged as any);
      removeSocketListener('player-kicked', onPlayerKicked as any);
      removeSocketListener('lobby-updated', onLobbyUpdated as any);
      removeSocketListener('settings-updated', onSettingsUpdated as any);
      removeSocketListener('game-started', onGameStarted as any);
    };
  }, []);

  const sendMessage = () => {
    if (!chatText.trim() || !currentPlayer) return;

    socketService.sendChatMessage(code!, chatText.trim(), currentPlayer.id, currentPlayer.name, currentPlayer.team, chatMode);

    setChatText("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startRound = async () => {
    const token = localStorage.getItem('gameToken');
    if (!token || !code) return;

    try {
      const response = await fetch(`${getBaseUrl()}/api/lobby/startRound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      if (!data.success) {
        // Failed to start round;
      }
      // Success is handled by the socket listener for 'round-started'
      // The question and phase will be set automatically when the socket event is received
    } catch (error) {
      console.error('Failed to start round:', error);
      // Failed to start round;
    }
  };
  
  const submitAnswer = async (isSteal: boolean) => {
    if (!isSteal && !answer.trim()) return;

    const token = localStorage.getItem('gameToken');
    if (!token || !code || !currentPlayer) return;

    try {
      const response = await fetch(`${getBaseUrl()}/api/lobby/submitAnswer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code,
          isSteal: isSteal,
          answer: answer.trim(),
          playerId: currentPlayer.id,
          team: currentPlayer.team,
          roundNumber: round
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setPhase("answered");
        // Answer submitted;
      } else {
        // Failed to submit answer;
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      // Failed to submit answer;
    }
  };
  
  const nextRound = async () => {
    // Only host can start the next round
    if (!currentPlayer?.isHost) {
      // Only host can start next round;
      return;
    }

    const token = localStorage.getItem('gameToken');
    if (!token || !code) return;

    try {
      const response = await fetch(`${getBaseUrl()}/api/lobby/startRound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      if (!data.success) {
        // Failed to start next round;
      }
      // Success is handled by the socket listener for 'round-started'
    } catch (error) {
      console.error('Failed to start next round:', error);
      // Failed to start next round;
    }
  };

  const returnToLobbyFunc = async () => {
    if (!currentPlayer?.isHost) return;

    const token = localStorage.getItem('gameToken');
    if (!token || !code) return;

    try {
      const response = await fetch(`${getBaseUrl()}/api/lobby/returnToLobby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        // Returning to lobby;
      } else {
        // Failed to return to lobby;
      }
    } catch (error) {
      console.error('Failed to return to lobby:', error);
      // Failed to return to lobby;
    }
  };

  // Show all messages (both game and team) in one view - team messages are filtered in ChatMessage component
  const visibleMessages = messages;

  return (
    <div className="min-h-screen text-white relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-96 w-[40rem] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 grid place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-lg text-slate-950">
              <BanditLogo className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Game of Liars</h1>
          </div>
          <div className="text-xs sm:text-sm text-white/70">Room: {code} • Round {round}/{maxScore}</div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pt-6 pb-16 space-y-6">
        <ScorePillsMobile blueScore={blueScore} redScore={redScore} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="hidden lg:block lg:col-span-3 xl:col-span-2">
            <TeamCard side="Blue" color="blue" score={blueScore} players={blueTeam} currentPlayerId={currentPlayer?.id} />
          </div>

          <div className="lg:col-span-6 xl:col-span-8 space-y-4 order-last lg:order-none">
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl p-8 text-center min-h-[300px] flex flex-col justify-center">
              {phase === "idle" && (
                <div className="space-y-4">
                  <div className="text-2xl font-semibold">Round {round} of {maxScore}</div>
                  {currentPlayer?.isHost ? (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startRound} className="mx-auto inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 font-semibold shadow-lg">
                      <Play className="h-5 w-5"/> Start Round
                    </motion.button>
                  ) : (
                    <div className="text-lg text-white/70">
                      Waiting for host<AnimatedDots />
                    </div>
                  )}
                </div>
              )}
              {phase === "question" && (
                <div className="space-y-5 text-left">
                  <div className="text-lg text-white/80 text-center">Round {round} of {maxScore}</div>
                  <div className="text-md text-white/60 text-center">Time left: {secondsLeft}s</div>
                  <div className="text-xl sm:text-2xl font-bold text-center leading-snug max-w-3xl mx-auto">{question}</div>
                  <div className="flex items-center gap-3">
                    <input value={answer} onChange={(e)=>setAnswer(e.target.value)} placeholder="Type your team answer" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/60" />
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={()=>submitAnswer(false)} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 font-semibold shadow-lg inline-flex items-center gap-2">
                      <Send className="h-4 w-4"/> Submit
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={()=>submitAnswer(true)} className="rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-3 font-semibold shadow-lg">
                      Steal
                    </motion.button>
                  </div>
                </div>
              )}
              {phase === "answered" && (
                <div className="space-y-3">
                  <div className="text-lg text-white/80">Answer locked</div>
                  <div className="text-2xl font-bold">{answer}</div>
                  <div className="text-sm text-white/60">Waiting for the other team<AnimatedDots /></div>
                </div>
              )}
              {phase === "results" && roundResults && (
                <div className="space-y-4">
                  <div className="text-lg text-white/80 text-center">Round {round} Results</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-indigo-600/20 rounded-xl p-4 border border-indigo-500/30">
                      <div className="text-indigo-400 font-semibold mb-2">Blue Team</div>
                      <div className="text-white text-lg">{roundResults.blueSteal ? '🎯 STEAL' : roundResults.blueAnswer}</div>
                      <div className="text-indigo-300 text-sm mt-2">+{roundResults.bluePointsGained} points</div>
                    </div>
                    
                    <div className="bg-rose-600/20 rounded-xl p-4 border border-rose-500/30">
                      <div className="text-rose-400 font-semibold mb-2">Red Team</div>
                      <div className="text-white text-lg">{roundResults.redSteal ? '🎯 STEAL' : roundResults.redAnswer}</div>
                      <div className="text-rose-300 text-sm mt-2">+{roundResults.redPointsGained} points</div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-sm text-white/60 mb-2">Correct Answer:</div>
                    <div className="text-xl font-bold text-emerald-400">{roundResults.answer}</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {roundResults.winner === 'tie' ? (
                        <span className="text-yellow-400">🤝 It's a tie!</span>
                      ) : (
                        <span className={roundResults.winner === 'blue' ? 'text-indigo-400' : 'text-rose-400'}>
                          🏆 {roundResults.winner} team wins!
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Only show Next Round button if game is not complete */}
                  {!gameComplete && (
                    currentPlayer?.isHost ? (
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={nextRound} className="mx-auto inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 font-semibold shadow-lg">
                        Next Round
                      </motion.button>
                    ) : (
                      <div className="text-lg text-white/70 text-center">
                        Waiting for host to start next round<AnimatedDots />
                      </div>
                    )
                  )}
                </div>
              )}
              
              {phase === "summary" && allRounds.length > 0 && (
                <div className="space-y-6">
                  {/* Final Scores at the top */}
                  <div className="text-center space-y-4">
                    <div className="text-3xl font-bold text-emerald-400">🎉 Game Complete! 🎉</div>
                    
                    <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                      <div className="bg-indigo-600/20 rounded-xl p-4 border border-indigo-500/30">
                        <div className="text-indigo-400 font-semibold mb-1">Blue Team</div>
                        <div className="text-2xl font-bold text-white">{blueScore}</div>
                      </div>
                      
                      <div className="bg-rose-600/20 rounded-xl p-4 border border-rose-500/30">
                        <div className="text-rose-400 font-semibold mb-1">Red Team</div>
                        <div className="text-2xl font-bold text-white">{redScore}</div>
                      </div>
                    </div>
                    
                    <div className="text-xl font-bold">
                      {blueScore > redScore ? (
                        <span className="text-indigo-400">🏆 Blue Team Wins!</span>
                      ) : redScore > blueScore ? (
                        <span className="text-rose-400">🏆 Red Team Wins!</span>
                      ) : (
                        <span className="text-yellow-400">🤝 It's a Tie!</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Round Summary List - Condensed */}
                  <div className="space-y-3">
                    <div className="text-lg text-white/80 text-center font-semibold">Round Summary</div>
                    
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {allRounds.map((round, index) => (
                        <div key={index} className="bg-slate-800/30 rounded-lg p-3 border border-white/5 text-sm">
                          <div className="flex items-center justify-between">
                            {/* Round info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="text-white/60 font-medium">R{index + 1}</div>
                              <div className="text-white truncate flex-1 min-w-0">{round.question}</div>
                            </div>
                            
                            {/* Team results */}
                            <div className="flex items-center gap-4 text-xs">
                                                             <div className="flex items-center gap-1">
                                 <span className="text-indigo-400">B:</span>
                                 <span className="text-white">
                                   {round.blueSteal ? 'STEAL' : (round.blueAnswer || 'No Answer Submitted')}
                                 </span>
                                 <span className="text-indigo-300">(+{round.bluePointsGained || 0})</span>
                               </div>
                               
                               <div className="flex items-center gap-1">
                                 <span className="text-rose-400">R:</span>
                                 <span className="text-white">
                                   {round.redSteal ? 'STEAL' : (round.redAnswer || 'No Answer Submitted')}
                                 </span>
                                 <span className="text-rose-300">(+{round.redPointsGained || 0})</span>
                               </div>
                              
                              {/* Winner */}
                              <div className="text-xs font-semibold min-w-0">
                                {round.winner === 'tie' ? (
                                  <span className="text-yellow-400">🤝</span>
                                ) : (
                                  <span className={round.winner === 'blue' ? 'text-indigo-400' : 'text-rose-400'}>
                                    🏆
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Return to Lobby Controls */}
                  <div className="text-center pt-4">
                    {currentPlayer?.isHost ? (
                      <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }} 
                        onClick={returnToLobbyFunc}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-semibold shadow-lg"
                      >
                        Return to Lobby
                      </motion.button>
                    ) : (
                      <div className="text-white/60">
                        Waiting for host to return to lobby<AnimatedDots />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">Chat</div>
                <div className="inline-flex rounded-lg bg-white/5 p-1 border border-white/10">
                  <button onClick={()=>setChatMode("game")} className={`px-3 py-1 text-xs rounded-md transition-colors ${chatMode==='game'?'bg-indigo-600 text-white':'text-white/70 hover:text-white'}`}>All</button>
                  <button onClick={()=>setChatMode("team")} className={`px-3 py-1 text-xs rounded-md transition-colors ${chatMode==='team'?'bg-emerald-600 text-white':'text-white/70 hover:text-white'}`}>Team</button>
                </div>
              </div>
              <div className="h-40 rounded-xl bg-white/5 border border-white/10 p-2 overflow-y-auto">
                {visibleMessages.length === 0 ? (
                  <div className="text-white/40 text-center text-sm mt-16">No messages yet</div>
                ) : (
                  visibleMessages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} currentPlayerTeam={currentPlayer?.team || "blue"} />
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input 
                  value={chatText} 
                  onChange={(e)=>setChatText(e.target.value)} 
                  onKeyPress={handleKeyPress}
                  placeholder={`Type a ${chatMode === 'game' ? 'room' : 'team'} message...`} 
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/60 text-white" 
                />
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  onClick={sendMessage}
                  disabled={!chatText.trim()}
                  className="rounded-xl bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-white/40 px-3 py-2 text-sm font-semibold shadow inline-flex items-center gap-2 transition-colors"
                >
                  <Send className="h-4 w-4"/> Send
                </motion.button>
              </div>
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-3 xl:col-span-2">
            <TeamCard side="Red" color="red" score={redScore} players={redTeam} currentPlayerId={currentPlayer?.id} />
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-white/60">
        Made with bluffs, tells, and just a pinch of chaos.
      </footer>
    </div>
  );
}


