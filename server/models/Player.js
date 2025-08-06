export class Player {
    constructor(name, isHost = false) {
        this.name = name;
        this.isHost = isHost;
        this.team = "spectator"; // "spectator", "blue", "red"
        this.role = null;        // "captain", "member"
        this.isConnected = true;
        this.joinedAt = new Date();
    }

    setTeam(team, role=null) {
        this.team = team;
        this.role = null;
    }

    isCaptain() {
        return this.role === "captain";
    }

    isMember() {
        return this.role === "member"
    }

    isSpectator() {
        return this.team === "spectator";
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
    
    getRole() {
        return this.role;
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