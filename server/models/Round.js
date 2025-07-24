export class Round {

    constructor(roundNumber, question, answer) {
        this.roundNumber = roundNumber;
        this.question = question;
        this.answer = answer;

        // this.questionTags = []; TODO

        this.roundStatus = "NS" // NS = Not Started, QP = Question period, QR = Question reveal, E = Ended
        this.winner = null; // "Blue" or "Red"
    }

    // Setters
    setRoundStatus(status) {
        this.roundStatus = status;
    }

    setWinner(winner) {
        this.winner = winner;
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
}