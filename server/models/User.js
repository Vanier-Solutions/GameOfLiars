export class User {

    name = null;
    isHost = null;
    role = null;
    team = null;

    constructor(name, isHost) {
        this.name = name;
        this.isHost = isHost;
        this.team = "spectator";
    }

    
    getName() {
        return this.name;
    }

    checkIsHost() {
        return this.isHost;
    }



}