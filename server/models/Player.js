export class Player {
    constructor(name, isHost = false) {
        this.name = name;
        this.isHost = isHost;
        this.isCaptain = false;
        this.team = null; // "blue", "red"
        this.isConnected = true;
        this.joinedAt = new Date();
    }

    setTeam(team, isCaptain=false) {
        this.team = team;
        this.isCaptain = isCaptain;
    }

    isCaptain() {
        return this.isCaptain;
    }

    setConnectionStatus(connected) {
        this.isConnected = connected;
    }

    // Getters
    getName() {
        return this.name;
    }

    getTeam() {
        return this.team;
    }
    
    getIsCaptain() {
        return this.isCaptain;
    }

    getIsConnected() {
        return this.isConnected;
    }
    
    getIsHost() {
        return this.isHost;
    }

    getJoinedAt() {
        return this.joinedAt;
    }
}