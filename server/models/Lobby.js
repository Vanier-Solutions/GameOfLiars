import { Player } from './Player.js';

export class Lobby {

    constructor(code, host) {
        this.code = code;
        this.host = host;
        this.settings = {
            rounds: 7,
            roundLimit: 60,
            tags: ['General']
        };
        this.maxPlayers = 20;
        this.maxTeamSize = 6;
        
        this.blueCaptain = null;
        this.redCaptain = null;
        
        this.blueTeam = [];
        this.redTeam = [];
        this.spectators = [host]; 

        this.gamePhase = "pregame" // "pregame", "playing", "ended"
        this.rounds = []
        this.usedQuestions = [] // Track used questions IDs
        this.gameState = {
            currentRoundNumber: 0,
            scores: {
                blue: 0,
                red: 0,
            },
            currentRound: null,
        }
    }

    addPlayer(player) {
        if (this.getTotalPlayers() >= this.maxPlayers) {
            throw new Error("Lobby is full");
        }
        this.spectators.push(player);
    }

    setTeam(player, team, role=null) {
        this.removeTeamAndRole(player);

        player.setTeam(team, role);
        switch (team) {
            case "blue":
                if (this.blueTeam.includes(player)) {
                    throw new Error("Player is already on the blue team");
                }

                this.blueTeam.push(player);
                if (role === "captain") {
                    if (this.getBlueCaptain) {
                        throw new Error("Blue captain already exists");
                    }
                    this.blueCaptain = player;
                }
                break;
            case "red":
                this.redTeam.push(player);
                if (role === "captain") {
                    if (this.getRedCaptain()) {
                        throw new Error("Red captain already exists");
                    }
                    this.redCaptain = player;
                }
                break;
            case "spectators":
                this.spectators.push(player);
                break;
            default:
                throw new Error("Invalid team");
        }
    }

    removeTeamAndRole(player) {
        if (player.getTeam() === "blue") {
            this.blueTeam = this.blueTeam.filter(p => p !== player);
        } else if (player.getTeam() === "red") {
            this.redTeam = this.redTeam.filter(p => p !== player);
        } else if (player.getTeam() === "spectators") {
            this.spectators = this.spectators.filter(p => p !== player);
        }
        if (player === this.blueCaptain) {
            this.blueCaptain = null;
        } else if (player === this.redCaptain) {
            this.redCaptain = null;
        }
        player.setTeam(null, null);
    }

    incrementScore(team) {
        this.gameState.scores[team]++;
    }

    decrementScore(team) {
        this.gameState.scores[team]--;
    }

    incrementRound() {
        this.gameState.currentRoundNumber++;
    }

    decrementRound() {
        this.gameState.currentRoundNumber--;
    }
        

    // Getters
    getCode() {
        return this.code;
    }
    getHost() {
        return this.host;
    }
    getSettings() {
        return this.settings;
    }
    getMaxPlayers() {
        return this.maxPlayers;
    }
    getBlueCaptain() {
        return this.blueCaptain;
    }
    getRedCaptain() {
        return this.redCaptain;
    }
    getBlueTeam() {
        return this.blueTeam;
    }
    getRedTeam() {
        return this.redTeam;
    }
    getSpectators() {   
        return this.spectators;
    }
    getGamePhase() {
        return this.gamePhase;
    }
    getRounds() {
        return this.rounds;
    }
    getUsedQuestions() {
        return this.usedQuestions;
    }
    getGameState() {
        return this.gameState;
    }
    getTotalPlayers() {
        return this.blueTeam.length + this.redTeam.length + this.spectators.length;
    }
    getMaxTeamSize() {
        return this.maxTeamSize;
    }
}