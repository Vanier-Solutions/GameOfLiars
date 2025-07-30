export class Round {

    constructor(roundNumber, question, correctAnswer) {
        this.roundNumber = roundNumber;
        this.question = question;
        this.correctAnswer = correctAnswer;
        this.roundStatus = 'NS'; // NS = Not Started, QP = Question Period, QR = Question Reveal
        this.roundStartTime = null;
        this.teamAnswers = {
            blue: null,
            red: null
        };
        this.captainReady = {
            blue: false,
            red: false
        };
        this.winner = null;
    }

    // Setters
    setRoundStatus(status) {
        this.roundStatus = status;
    }

    setWinner(winner) {
        this.winner = winner;
    }

    setTeamAnswer(team, answer, isSteal) {
        const answerObj = {
            answer: answer,
            isSteal: isSteal
        };
        
        if (team === "blue") {
            this.blueTeamAnswer = answerObj;
        } else if (team === "red") {
            this.redTeamAnswer = answerObj;
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

    getCorrectAnswer() {
        return this.correctAnswer;
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
    
    getCaptainReady(team) {
        if (team === "blue") {
            return this.blueCaptainReady;
        } else if (team === "red") {
            return this.redCaptainReady;
        }
    }
}