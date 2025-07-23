export class Lobby {
    
    code = null;
    players = [];
    gameState = "waiting";
    currentRound = 0;
    maxPlayers = 16;
    rounds = 10;

    constructor(code, hostName) {
        this.code = code;
        this.addPlayer(hostName, true);
    }

    addPlayer(name, isHost = false) {
        if (this.players.length >= this.maxPlayers) {
            return false;
        }
        
        const player = {
            name: name,
            isHost: isHost,
            team: "spectator",
            role: null,
            score: 0
        };
        
        this.players.push(player);
        return true;
    }

    removePlayer(name) {
        this.players = this.players.filter(p => p.name !== name);
    }

    getPlayer(name) {
        return this.players.find(p => p.name === name);
    }

    assignTeam(playerName, team, role = null) {
        const player = this.getPlayer(playerName);
        if (player) {
            player.team = team;
            player.role = role;
        }
    }

    getPlayersByTeam(team) {
        return this.players.filter(p => p.team === team);
    }

    startGame() {
        if (this.canStart()) {
            this.gameState = "playing";
            this.currentRound = 1;
        }
    }

    canStart() {
        const blueTeam = this.getPlayersByTeam("blue");
        const redTeam = this.getPlayersByTeam("red");
        
        return blueTeam.length >= 1 && redTeam.length >= 1 && 
               blueTeam.some(p => p.role === "captain") && 
               redTeam.some(p => p.role === "captain");
    }

    getCode() {
        return this.code;
    }

    getGameState() {
        return this.gameState;
    }

    getCurrentRound() {
        return this.currentRound;
    }

    isFull() {
        return this.players.length >= this.maxPlayers;
    }
} 