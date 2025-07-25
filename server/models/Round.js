export class Round {

    constructor(roundNumber, question, answer) {
        this.roundNumber = roundNumber;
        this.question = question;
        this.answer = answer;
        // this.questionTags = []; TODO

        this.roundStatus = "NS" // NS = Not Started, QP = Question period, QR = Question reveal, E = Ended
        this.winner = null; // "blue" or "red"

        this.blueTeamAnswer = null;
        this.redTeamAnswer = null;
        this.blueTeamStole = false;
        this.redTeamStole = false;
        this.blueCaptainReady = false;
        this.redCaptainReady = false;

        this.roundStartTime = null;
    }

    // Setters
    setRoundStatus(status) {
        this.roundStatus = status;
    }

    setWinner(winner) {
        this.winner = winner;
    }

    setTeamAnswer(team, answer, isSteal) {
        if (team === "blue") {
            this.blueTeamAnswer = answer;
            this.blueTeamStole = isSteal;
        } else if (team === "red") {
            this.redTeamAnswer = answer;
            this.redTeamStole = isSteal;
        }
    }

    setCaptainReady(team, ready) {
        if (team === "blue") {
            this.blueCaptainReady = ready;
        } else if (team === "red") {
            this.redCaptainReady = ready;
        }
    }

    // Getters
    getRoundNumber() {
        return this.roundNumber;
    }

    getQuestion() {
        return this.question;
    }

    getAnswer() {
        return this.answer;
    }

    getRoundStatus() {
        return this.roundStatus;
    }

    getWinner() {
        return this.winner;
    }

    getTeamAnswer(team) {
        if (team === "blue") {
            return this.blueTeamAnswer;
        } else if (team === "red") {
            return this.redTeamAnswer;
        }
    }
    
    getTeamStole(team) {
        if (team === "blue") {
            return this.blueTeamStole;
        } else if (team === "red") {
            return this.redTeamStole;
        }
    }
    
    getCaptainReady(team) {
        if (team === "blue") {
            return this.blueCaptainReady;
        } else if (team === "red") {
            return this.redCaptainReady;
        }
    }
    
    
}