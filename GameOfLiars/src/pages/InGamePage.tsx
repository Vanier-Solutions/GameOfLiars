import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GameData {
  roundNumber: number;
  question: string;
  timeRemaining: number;
  scores: {
    blue: number;
    red: number;
  };
  teams: {
    blue: Array<{ name: string; role: string }>;
    red: Array<{ name: string; role: string }>;
  };
  captains: {
    blue: string | null;
    red: string | null;
  };
}

export default function InGamePage() {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [answer, setAnswer] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [gameChat, setGameChat] = useState<Array<{ player: string; message: string; timestamp: string }>>([]);
  const [teamChat, setTeamChat] = useState<Array<{ player: string; message: string; timestamp: string }>>([]);
  const [playerName, setPlayerName] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);

  // Get lobby code from URL
  const lobbyCode = window.location.pathname.split('/')[2];

  useEffect(() => {
    // Get player name from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const nameFromUrl = urlParams.get('player');
    const nameFromStorage = localStorage.getItem('playerName');
    const playerNameValue = nameFromUrl || nameFromStorage || '';
    setPlayerName(playerNameValue);
  }, []);

  useEffect(() => {
    if (lobbyCode && playerName) {
      fetchGameData();
      // Poll for updates every second
      const interval = setInterval(fetchGameData, 1000);
      return () => clearInterval(interval);
    }
  }, [lobbyCode, playerName]);

  const fetchGameData = async () => {
    try {
      const response = await fetch(`http://localhost:5051/api/game/${lobbyCode}/status`);
      const data = await response.json();
      if (data.success) {
        setGameData(data.gameData);
        
        // Check if current player is a captain
        const isPlayerCaptain = 
          data.gameData.captains.blue === playerName || 
          data.gameData.captains.red === playerName;
        setIsCaptain(isPlayerCaptain);
      }
    } catch (error) {
      console.error('Failed to fetch game data:', error);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim() || !isCaptain) return;
    
    try {
      const response = await fetch(`http://localhost:5051/api/game/${lobbyCode}/round/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName,
          answer: answer.trim(),
          isSteal: false
        }),
      });
      
      if (response.ok) {
        setAnswer('');
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  const submitSteal = async () => {
    if (!isCaptain) return;
    
    try {
      const response = await fetch(`http://localhost:5051/api/game/${lobbyCode}/round/steal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName
        }),
      });
      
      if (response.ok) {
        // Handle steal submission
      }
    } catch (error) {
      console.error('Failed to submit steal:', error);
    }
  };

  const sendChatMessage = (message: string, isTeamChat: boolean) => {
    const newMessage = {
      player: playerName,
      message: message.trim(),
      timestamp: new Date().toLocaleTimeString()
    };

    if (isTeamChat) {
      setTeamChat(prev => [...prev, newMessage]);
    } else {
      setGameChat(prev => [...prev, newMessage]);
    }
    setChatMessage('');
  };

  if (!gameData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700">Loading game...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto h-screen flex gap-4">
        {/* Left Section - Blue Team */}
        <div className="w-1/4">
          <Card className="h-full border-l-4 border-l-blue-500">
            <CardHeader className="bg-blue-500 text-white">
              <CardTitle className="flex justify-between items-center">
                Blue Team
                <span className="text-3xl font-bold">{gameData.scores.blue}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {gameData.teams.blue.map((player, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <span className="text-sm font-medium">{player.name}</span>
                  <div className="flex space-x-1">
                    {player.role === 'captain' && (
                      <Badge variant="default" className="text-xs">CAPTAIN</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Middle Section - Game & Chat */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Game Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Round {gameData.roundNumber}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-lg text-gray-600">Waiting for next round...</p>
                <div className="text-2xl font-mono">--</div>
              </div>
              
              {isCaptain && (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter your answer..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  <div className="flex space-x-2">
                    <Button 
                      onClick={submitAnswer}
                      className="flex-1 bg-blue-500 hover:bg-blue-600"
                      disabled={!answer.trim()}
                    >
                      Submit Answer
                    </Button>
                    <Button 
                      onClick={submitSteal}
                      variant="outline"
                      className="flex-1 border-orange-500 text-orange-500 hover:bg-orange-50"
                    >
                      Steal
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="game" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="game">Game Chat</TabsTrigger>
                  <TabsTrigger value="team">Team Chat</TabsTrigger>
                </TabsList>
                
                <TabsContent value="game" className="flex-1 flex flex-col">
                  <div className="flex-1 bg-gray-50 p-3 rounded overflow-y-auto space-y-2 mb-3">
                    {gameChat.map((msg, index) => (
                      <div key={index} className="bg-white p-2 rounded shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{msg.player}</span>
                          <span className="text-xs text-gray-500">{msg.timestamp}</span>
                        </div>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Type a game message..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage(chatMessage, false)}
                    />
                    <Button onClick={() => sendChatMessage(chatMessage, false)}>Send</Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="team" className="flex-1 flex flex-col">
                  <div className="flex-1 bg-gray-50 p-3 rounded overflow-y-auto space-y-2 mb-3">
                    {teamChat.map((msg, index) => (
                      <div key={index} className="bg-white p-2 rounded shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{msg.player}</span>
                          <span className="text-xs text-gray-500">{msg.timestamp}</span>
                        </div>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Type a team message..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage(chatMessage, true)}
                    />
                    <Button onClick={() => sendChatMessage(chatMessage, true)}>Send</Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Section - Red Team */}
        <div className="w-1/4">
          <Card className="h-full border-l-4 border-l-red-500">
            <CardHeader className="bg-red-500 text-white">
              <CardTitle className="flex justify-between items-center">
                Red Team
                <span className="text-3xl font-bold">{gameData.scores.red}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {gameData.teams.red.map((player, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                  <span className="text-sm font-medium">{player.name}</span>
                  <div className="flex space-x-1">
                    {player.role === 'captain' && (
                      <Badge variant="default" className="text-xs">CAPTAIN</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 