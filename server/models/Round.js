export class Round {

    constructor(question, answer, tag, roundNumber) {
        this.question = question;
        this.answer = answer;
        this.tag = tag;
        this.roundNumber = roundNumber;

        this.blueSteal = false;
        this.redSteal = false;
        this.blueAnswer = null;
        this.redAnswer = null;

        this.winner = null;
        this.bluePointsGained = 0;
        this.redPointsGained = 0;
    }

    getQuestion() {
        return this.question;
    }
    
    getAnswer() {
        return this.answer;
    }
    
    getTag() {
        return this.tag;
    }
    
    getRoundNumber() {
        return this.roundNumber;
    }

    getBlueSteal() {
        return this.blueSteal;
    }
    
    getRedSteal() {
        return this.redSteal;
    }

    getBlueAnswer() {
        return this.blueAnswer;
    }
    
    getRedAnswer() {
        return this.redAnswer;
    }
    
    getWinner() {
        return this.winner;
    }
    
    getBluePointsGained() {
        return this.bluePointsGained;
    }
    
    
    getRedPointsGained() {
        return this.redPointsGained;
    }
    
    
    
}