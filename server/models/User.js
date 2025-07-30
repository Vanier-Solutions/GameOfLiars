import { v4 as uuidv4 } from 'uuid';

export class User {
    constructor(name, isHost = false) {
        this.id = uuidv4(); // Generate unique UUID for this user
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

    removeTeam() {
        this.team = "spectator";
        this.role = null;
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
    getId() {
        return this.id;
    }

    getName() {
        return this.name;
    }

    getTeam() {
        return this.team;
    }

    getRole() {
        return this.role;
    }

    getIsHost() {
        return this.isHost;
    }

}
