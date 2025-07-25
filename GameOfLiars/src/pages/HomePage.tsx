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

  const handleCreateLobby = async () => {
    if (!playerName.trim()) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('http://localhost:5051/api/lobby/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });
      
      const data = await response.json();
      if (data.success) {
        // Store player name and navigate to lobby
        localStorage.setItem('playerName', playerName.trim());
        window.location.href = `/lobby/${data.code}?player=${encodeURIComponent(playerName.trim())}`;
      }
    } catch (error) {
      console.error('Failed to create lobby:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!playerName.trim() || !lobbyCode.trim()) return;
    
    setIsJoining(true);
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
        window.location.href = `/lobby/${lobbyCode.trim().toUpperCase()}?player=${encodeURIComponent(playerName.trim())}`;
      }
    } catch (error) {
      console.error('Failed to join lobby:', error);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Game of Liars
          </h1>
          <p className="text-gray-600">
            The ultimate bluffing game where deception meets strategy
          </p>
        </div>

        {/* Player Name Input */}
        <Card>
          <CardHeader>
            <CardTitle>Enter Your Name</CardTitle>
            <CardDescription>
              Choose a name to display in the game
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="playerName">Player Name</Label>
              <Input
                id="playerName"
                placeholder="Enter your name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Create Lobby */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Game</CardTitle>
            <CardDescription>
              Start a new lobby and invite friends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleCreateLobby}
              disabled={!playerName.trim() || isCreating}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isCreating ? 'Creating...' : 'Create Lobby'}
            </Button>
          </CardContent>
        </Card>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gradient-to-br from-blue-50 to-purple-50 px-2 text-gray-500">
              Or
            </span>
          </div>
        </div>

        {/* Join Lobby */}
        <Card>
          <CardHeader>
            <CardTitle>Join Existing Game</CardTitle>
            <CardDescription>
              Enter a lobby code to join friends
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lobbyCode">Lobby Code</Label>
              <Input
                id="lobbyCode"
                placeholder="Enter 4-letter code..."
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="text-center text-lg font-mono tracking-widest"
              />
            </div>
            <Button 
              onClick={handleJoinLobby}
              disabled={!playerName.trim() || !lobbyCode.trim() || isJoining}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
            >
              {isJoining ? 'Joining...' : 'Join Lobby'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 