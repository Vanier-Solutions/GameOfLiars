export class User {
    constructor(name, isHost = false) {
        this.name = name;
        this.isHost = isHost;
        this.team = "spectator";
        this.role = null; // "captain", "member", or null
        this.isConnected = true;
        this.joinedAt = new Date();
    }

    assignTeam(team, role = null) {
        this.team = team;
        this.role = role;
    }

    isCaptain() {
        return this.role === "captain";
    }

    isMember() {
        return this.role === "member";
    }

    isSpectator() {
        return this.team === "spectator";
    }

    setConnectionStatus(connected) {
        this.isConnected = connected;
    }

    // Getters for data integrity
    getName() {
        return this.name;
    }

    getTeam() {
        return this.team;
    }

    getRole() {
        return this.role;
    }

    getScore() {
        return this.score;
    }
}
