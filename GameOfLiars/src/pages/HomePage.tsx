import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  const [playerName, setPlayerName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreateLobby = async () => {
    if (!playerName.trim()) return;
    
    setIsCreating(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:5051/api/lobby/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });
      
      const data = await response.json();
      
      if (data.success && data.code) {
        // Store player name and navigate to lobby
        localStorage.setItem('playerName', playerName.trim());
        console.log(`Created lobby ${data.code} with host ${playerName.trim()}`);
        window.location.href = `/lobby/${data.code}?player=${encodeURIComponent(playerName.trim())}`;
      } else {
        setError(data.error || 'Failed to create lobby');
      }
    } catch (error) {
      console.error('Failed to create lobby:', error);
      setError('Failed to connect to server');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!playerName.trim() || !lobbyCode.trim()) return;
    
    setIsJoining(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:5051/api/lobby/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          playerName: playerName.trim(),
          code: lobbyCode.trim().toUpperCase()
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Store player name and navigate to lobby
        localStorage.setItem('playerName', playerName.trim());
        console.log(`Joined lobby ${lobbyCode.toUpperCase()} as ${playerName.trim()}`);
        window.location.href = `/lobby/${lobbyCode.trim().toUpperCase()}?player=${encodeURIComponent(playerName.trim())}`;
      } else {
        setError(data.error || 'Failed to join lobby');
      }
    } catch (error) {
      console.error('Failed to join lobby:', error);
      setError('Failed to connect to server');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-light text-gray-900 tracking-tight">
            Game of Liars
          </h1>
        </div>

        {/* Main Game Card */}
        <Card className="bg-white/80 border-gray-200 shadow-xl backdrop-blur-sm">
          <CardContent className="space-y-4 pt-6">
            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Player Name Input */}
            <div className="space-y-2">
              <Label htmlFor="playerName" className="text-sm text-gray-600 font-medium">Player Name</Label>
              <Input
                id="playerName"
                placeholder="Enter your name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                className="h-11 border-gray-300 focus:border-gray-400 focus:ring-gray-400/20 text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {/* Create Lobby Button */}
            <Button 
              onClick={handleCreateLobby}
              disabled={!playerName.trim() || isCreating}
              className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-medium transition-colors duration-200"
            >
              {isCreating ? 'Creating...' : 'Create New Game'}
            </Button>

            {/* Separator */}
            <div className="relative py-3">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full border-gray-300" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-gray-500 font-medium">Or</span>
              </div>
            </div>

            {/* Join Lobby Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lobbyCode" className="text-sm text-gray-600 font-medium">Join with Code</Label>
                <Input
                  id="lobbyCode"
                  placeholder="ABCD"
                  value={lobbyCode}
                  onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  className="text-center text-lg font-mono tracking-widest h-11 border-gray-300 focus:border-gray-400 focus:ring-gray-400/20 text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <Button 
                onClick={handleJoinLobby}
                disabled={!playerName.trim() || !lobbyCode.trim() || isJoining}
                className="w-full h-11 bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors duration-200"
              >
                {isJoining ? 'Joining...' : 'Join Game'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 