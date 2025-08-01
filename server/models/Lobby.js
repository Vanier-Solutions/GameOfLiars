import { User } from './User.js';
import { Round } from './Round.js';

export class Lobby {
    
    // PARAMS:
    // code is a UNIQUE 4 letter alphabetic code
    // host is a type User 
    constructor(code, host) {
        host.isHost = true;
        this.host = host;
        this.code = code;
        this.gamePhase = "pregame"; // "pregame", "playing", "ended"
        this.settings = {
            rounds: 10,
            roundLimit: 60,
            maxScore: 7,
            maxPlayers: 20 // Add missing maxPlayers setting
        };

        this.allPlayerIds = [this.host.getId()];
        this.spectators = [this.host];

        this.blueTeam = [];
        this.blueCaptain = null;
        this.redTeam = [];
        this.redCaptain = null;

        this.rounds = [];
        this.gameState = {
            currentRoundNumber: 0,
            scores: {
                blue: 0,
                red: 0,
            },
            currentRound: null,
        }
    }

    addPlayer(user) {
        if (this.getTotalPlayers() >= this.settings.maxPlayers) {
            throw new Error("Lobby full");
        }
        
        // Check if player already exists
        const existingPlayer = this.getPlayerByName(user.getName());
        if (existingPlayer) {
            return; // Don't add duplicate
        }
        
        this.spectators.push(user);
        this.allPlayerIds.push(user.getId());
    }


    setPlayer(user, team = "spectator", role = null) {
        this.removePlayerFromTeam(user);
        
        user.assignTeam(team, role);
        
        if (team === "spectator") {
            this.spectators.push(user);
        } else if (team === "blue") {
            this.blueTeam.push(user);
            if (role === "captain") {
                this.blueCaptain = user;
            }
        } else if (team === "red") {
            this.redTeam.push(user);
            if (role === "captain") {
                this.redCaptain = user;
            }
        }
    }

    removePlayerFromTeam(user) {
        this.spectators = this.spectators.filter(p => p.getName() !== user.getName());
        this.blueTeam = this.blueTeam.filter(p => p.getName() !== user.getName());
        this.redTeam = this.redTeam.filter(p => p.getName() !== user.getName());
        if (this.blueCaptain === user) {
            this.blueCaptain = null;
        }
        if (this.redCaptain === user) {
            this.redCaptain = null;
        }
        user.removeTeam();
    }

    incrementScore(team, points = 1) {
        this.gameState.scores[team] += points;
        // Ensure score doesn't go below 0
        if (this.gameState.scores[team] < 0) {
            this.gameState.scores[team] = 0;
        }
    }

    getScore(team) {
        return this.gameState.scores[team];
    }

    incrementRoundNumber() {
        this.gameState.currentRoundNumber++;
    }
    

    
    // Setters
    setNumberOfRounds(numberOfRounds) {
        this.settings.rounds = numberOfRounds;
    }

    setRoundLimit(roundLimit) {
        this.settings.roundLimit = roundLimit;
    }

    setMaxScore(maxScore) {
        this.settings.maxScore = maxScore;
    }

    setGamePhase(phase) {
        this.gamePhase = phase;
    }

    setRoundNumber(roundNumber) {
        this.gameState.currentRoundNumber = roundNumber;
    }
    
    setScore(team, score) {
        this.gameState.scores[team] = score;
    }


    // Getters
    getHost() {
        return this.host;
    }

    getCode() {
        return this.code;
    }
    
    getSettings() {
        return this.settings;
    }

    getSpectators() {
        return this.spectators;
    }
    
    getBlueTeam() {
        return this.blueTeam;
    }

    getRedTeam() {
        return this.redTeam;
    }
    
    getBlueCaptain() {
        return this.blueCaptain;
    }

    getRedCaptain() {
        return this.redCaptain;
    }
    
    getGameState() {
        return this.gameState;
    }

    getTotalPlayers() {
        return this.spectators.length + this.blueTeam.length + this.redTeam.length;
    }

    getPlayerByName(name) {
        return this.spectators.find(p => p.getName() === name) ||
               this.blueTeam.find(p => p.getName() === name) ||
               this.redTeam.find(p => p.getName() === name);
    }

    getPlayerById(id) {
        return this.spectators.find(p => p.getId() === id) ||
               this.blueTeam.find(p => p.getId() === id) ||
               this.redTeam.find(p => p.getId() === id);
    }
    
    hasPlayerId(id) {
        return this.getPlayerById(id) !== undefined;
    }
    
    // Remove a player completely from the lobby
    removePlayer(player) {
        // Remove from all teams
        this.removePlayerFromTeam(player);
        
        // Remove from allPlayerIds
        this.allPlayerIds = this.allPlayerIds.filter(id => id !== player.getId());
    }
    
    // Check if lobby should be deleted (no players or only host)
    shouldBeDeleted() {
        // Don't delete lobbies that are in playing phase
        if (this.gamePhase === 'playing' || this.gamePhase === 'ended') {
            return false;
        }
        
        const totalPlayers = this.getTotalPlayers();
        
        // If no players at all, delete
        if (totalPlayers === 0) {
            return true;
        }
        
        // If only 1 player and that player is the host, delete
        if (totalPlayers === 1) {
            const hostPlayer = this.getPlayerByName(this.host.getName());
            return hostPlayer !== undefined;
        }
        
        return false;
    }
    
    
} 