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
        this.maxPlayers = 16;
        this.maxTeamSize = 8;
        
        this.blueCaptain = null;
        this.redCaptain = null;
        
        this.blueTeam = [host];
        this.redTeam = []; 

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

    setPlayer(player, team, isCaptain=false) {
        if (team === "blue") {
            if (this.blueTeam.includes(player)) {
                throw new Error("Player is already on blue team");
            }
            if (isCaptain && this.getBlueCaptain) {
                throw new Error("Blue Captain already exists");
            }

            this.removeTeamAndRole(player);
            player.setTeam(team, isCaptain);
            this.blueTeam.push(player);
            if (isCaptain) {
                this.setCaptain(player, "blue");
            }
        } else if (team === "red") {
            if (this.redTeam.includes(player)) {
                throw new Error("Player is already on red team");
            }
            if (isCaptain && this.getRedCaptain) {
                throw new Error("Red Captain already exists");
            }
            
            this.removeTeamAndRole(player);
            player.setTeam(team, isCaptain);
            this.redTeam.push(player);
            if (isCaptain) {
                this.setCaptain(player, "red");
            }
        } else {
            throw new Error("Invalid team");
        }
    }

    removeTeamAndRole(player) {
        if (player.getTeam() === "blue") {
            this.blueTeam = this.blueTeam.filter(p => p !== player);
        } else if (player.getTeam() === "red") {
            this.redTeam = this.redTeam.filter(p => p !== player);
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

    setCaptain(player, team) {
        if (team == "blue") {
            this.blueCaptain = player;
        } else if (team == "red") {
            this.redCaptain = player;
        } else {
            throw new Error("Invalid team");
        }
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
    getAllPlayers() {
        return [...this.blueTeam, ...this.redTeam];
    }
    getBlueTeamSize() {
        return this.blueTeam.length;
    }
    getRedTeamSize() {
        return this.redTeam.length;
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
        return this.blueTeam.length + this.redTeam.length;
    }
    getMaxTeamSize() {
        return this.maxTeamSize;
    }
}