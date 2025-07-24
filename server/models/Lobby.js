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
            rounds: 7,          // # Rounds
            roundLimit: 60,     // Time Limit for each round
            maxPlayers: 16,     // Max Players In Lobby (Unchangeable)
            // tags: ["General"]   // TODO: Question categories
        }

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
            currentRound: Round,
        }
    }

    addPlayer(user) {
        if (this.getTotalPlayers() >= this.settings.maxPlayers) {
            throw new Error("Lobby full");
        }

        if (this.getPlayerByName(user.getName())) {
            throw new Error("Name taken");
        }

        this.spectators.push(user);
    }


    setPlayer(user, team = "spectator", role = null) {
        this.removePlayerFromTeam(user);
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
        this.spectators = this.spectators.filter(p => p.name !== user.name);
        this.blueTeam = this.blueTeam.filter(p => p.name !== user.name);
        this.redTeam = this.redTeam.filter(p => p.name !== user.name);
    }

    incrementScore(team) {
        this.gameState.scores[team]++;
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
        return this.spectators.find(p => p.name === name) ||
               this.blueTeam.find(p => p.name === name) ||
               this.redTeam.find(p => p.name === name);
    }
    
    
} 