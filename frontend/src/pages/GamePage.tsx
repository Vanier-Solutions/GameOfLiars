"use client"

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Send, Users } from "lucide-react";
import { socketService, addSocketListener, removeSocketListener } from "@/lib/socket";
import { toast } from "@/components/ui/use-toast";
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

function TeamCard({ side, color, score, maxScore, players, currentPlayerId }: { side: "Blue" | "Red"; color: "blue" | "red"; score: number; maxScore: number; players: Player[]; currentPlayerId?: string; }) {
  const colorClasses = color === "blue" ? "from-indigo-500 to-blue-600" : "from-rose-600 to-red-600";
  const panelBg = color === "blue" ? "bg-indigo-50/5" : "bg-rose-50/5";
  return (
    <div className={`rounded-2xl shadow-xl border border-white/10 overflow-hidden`}>
      <div className={`px-4 py-3 text-white font-semibold bg-gradient-to-r ${colorClasses} flex items-center justify-between`}>
        <span>{side} Team</span>
        <div className="text-right leading-none">
          <div className="text-xl font-extrabold">{score}</div>
          <div className="text-xs opacity-80">/ {maxScore}</div>
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

function ScorePillsMobile({ blueScore, redScore, maxScore }: { blueScore: number; redScore: number; maxScore: number; }) {
  return (
    <div className="lg:hidden grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 flex items-center justify-between shadow border border-white/10">
        <span className="font-semibold">Blue</span>
        <span className="font-extrabold">{blueScore} / {maxScore}</span>
      </div>
      <div className="rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 flex items-center justify-between shadow border border-white/10">
        <span className="font-semibold">Red</span>
        <span className="font-extrabold">{redScore} / {maxScore}</span>
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
          {isTeamChat ? `[TEAM] ${message.playerName}` : `[GAME] ${message.playerName}`}
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
  const [phase, setPhase] = useState<"idle" | "question" | "answered">("idle");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [chatMode, setChatMode] = useState<"game" | "team">("team");
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [blueTeam, setBlueTeam] = useState<Player[]>([]);
  const [redTeam, setRedTeam] = useState<Player[]>([]);
  const [maxScore, setMaxScore] = useState<number>(7);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('gameToken');
    if (!token || !code) {
      navigate('/');
      return;
    }

    // Connect to socket and join lobby
    socketService.connect();
    socketService.joinLobby(token);

    // Get current player base info from token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setCurrentPlayer({
        id: payload.sub,
        name: payload.name,
        team: "blue"
      });
    } catch (error) {
      console.error('Failed to parse token:', error);
    }
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
      toast({ title: 'Game ended', description: data?.reason || 'Returning to lobby' });
      navigate(`/lobby/${code}`);
    };

    addSocketListener('chat-message', handleChatMessage);
    addSocketListener('game-ended', handleGameEnded);

    return () => {
      removeSocketListener('chat-message', handleChatMessage);
      removeSocketListener('game-ended', handleGameEnded);
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

    const messageData = {
      message: chatText.trim(),
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      team: currentPlayer.team,
      chatType: chatMode,
      timestamp: new Date().toISOString()
    };

    // Emit chat message via socket
    socketService.sendChatMessage(code!, chatText.trim(), currentPlayer.id, currentPlayer.name, currentPlayer.team, chatMode);

    // Add message to local state immediately
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      ...messageData
    };
    setMessages(prev => [...prev, newMessage]);
    setChatText("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startRound = () => {
    setPhase("question");
    setQuestion("In this round, think carefully: when people are asked the classic trick question 'What do cows drink?' many say milk by reflex. Write the best answer your team agrees on and decide whether to bluff or set up a steal opportunity.");
  };
  
  const submitAnswer = () => {
    if (!answer.trim()) return;
    setPhase("answered");
    alert(`Answer submitted: ${answer}`);
  };
  
  const steal = () => {
    if (phase !== "question") return;
    alert("Attempting to steal! Your host logic should emit a STEAL event here.");
  };
  
  const nextRound = () => {
    setRound(prev => prev + 1);
    setPhase("idle");
    setQuestion("");
    setAnswer("");
  };

  // Show all messages (both game and team) in one view
  const visibleMessages = messages.filter(msg => {
    if (msg.chatType === "team") {
      return msg.team === currentPlayer?.team; // Only show team messages from own team
    }
    return true; // Show all game messages
  });

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
          <div className="text-xs sm:text-sm text-white/70">Room: {code} • Round {round}/10</div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pt-6 pb-16 space-y-6">
        <ScorePillsMobile blueScore={blueTeam.length} redScore={redTeam.length} maxScore={maxScore} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="hidden lg:block lg:col-span-3 xl:col-span-2">
            <TeamCard side="Blue" color="blue" score={blueTeam.length} maxScore={maxScore} players={blueTeam} currentPlayerId={currentPlayer?.id} />
          </div>

          <div className="lg:col-span-6 xl:col-span-8 space-y-4 order-last lg:order-none">
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl p-8 text-center min-h-[300px] flex flex-col justify-center">
              {phase === "idle" && (
                <div className="space-y-4">
                  <div className="text-2xl font-semibold">Round {round}</div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startRound} className="mx-auto inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 font-semibold shadow-lg">
                    <Play className="h-5 w-5"/> Start Round
                  </motion.button>
                </div>
              )}
              {phase === "question" && (
                <div className="space-y-5 text-left">
                  <div className="text-lg text-white/80 text-center">Round {round}</div>
                  <div className="text-xl sm:text-2xl font-bold text-center leading-snug max-w-3xl mx-auto">{question}</div>
                  <div className="flex items-center gap-3">
                    <input value={answer} onChange={(e)=>setAnswer(e.target.value)} placeholder="Type your team answer" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/60" />
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={submitAnswer} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 font-semibold shadow-lg inline-flex items-center gap-2">
                      <Send className="h-4 w-4"/> Submit
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={steal} className="rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-3 font-semibold shadow-lg">
                      Steal
                    </motion.button>
                  </div>
                </div>
              )}
              {phase === "answered" && (
                <div className="space-y-3">
                  <div className="text-lg text-white/80">Answer locked</div>
                  <div className="text-2xl font-bold">{answer}</div>
                  <div className="text-sm text-white/60">Waiting for the other team…</div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={nextRound} className="mx-auto inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 font-semibold shadow-lg">
                    Next Round
                  </motion.button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">Chat</div>
                <div className="inline-flex rounded-lg bg-white/5 p-1 border border-white/10">
                  <button onClick={()=>setChatMode("game")} className={`px-3 py-1 text-xs rounded-md transition-colors ${chatMode==='game'?'bg-indigo-600 text-white':'text-white/70 hover:text-white'}`}>Game</button>
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
                  placeholder={`Type a ${chatMode} message...`} 
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
            <TeamCard side="Red" color="red" score={redTeam.length} maxScore={maxScore} players={redTeam} currentPlayerId={currentPlayer?.id} />
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-white/60">
        Made with bluffs, tells, and just a pinch of chaos.
      </footer>
    </div>
  );
}


