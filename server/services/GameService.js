import { Round } from '../models/Round.js';
import QuestionService from './QuestionService.js';

export class GameService {
    
    static isAnswerCorrect(userAnswer, correctAnswer) {
        if (!userAnswer || !correctAnswer) return false;
        
        const user = userAnswer.toLowerCase().trim();
        const correct = correctAnswer.toLowerCase().trim();
        
        // Exact match
        if (user === correct) return true;
        
        // Check if user answer is contained in correct answer
        if (correct.includes(user)) return true;
        
        // Check if correct answer is contained in user answer
        if (user.includes(correct)) return true;
        
        // Check for common variations (remove common words like "river", "mountain", etc.)
        const commonWords = ['river', 'mountain', 'lake', 'ocean', 'sea', 'city', 'country', 'state', 'province'];
        const userClean = commonWords.reduce((str, word) => str.replace(new RegExp(`\\b${word}\\b`, 'gi'), ''), user).trim();
        const correctClean = commonWords.reduce((str, word) => str.replace(new RegExp(`\\b${word}\\b`, 'gi'), ''), correct).trim();
        
        if (userClean && correctClean) {
            if (userClean === correctClean) return true;
            if (correctClean.includes(userClean)) return true;
            if (userClean.includes(correctClean)) return true;
        }
        
        return false;
    }
    
    static async startGame(lobby) {
        if (lobby.gamePhase !== 'pregame') {
            throw new Error('Game already started');
        }
        
        if (!lobby.getBlueCaptain() || !lobby.getRedCaptain()) {
            throw new Error('Both teams must have captains to start');
        }
        
        lobby.setGamePhase('playing');
        lobby.setRoundNumber(1);
        
        // Create first round
        return await this.createNewRound(lobby);
    }
    
    static async createNewRound(lobby) {
        const roundNumber = lobby.gameState.currentRoundNumber;
        
        try {
            const questionData = await QuestionService.getRandomQuestion(lobby.getCode());
            const newRound = new Round(roundNumber, questionData.question, questionData.correctAnswer);
            
            lobby.gameState.currentRound = newRound;
            lobby.rounds.push(newRound);
            
            return newRound;
        } catch (error) {
            console.error('Error fetching random question:', error.message);
            // Fallback to a default question if DB fetch fails
            const fallbackQuestion = { question: "What's 2+2?", correctAnswer: "4" };
            const newRound = new Round(roundNumber, fallbackQuestion.question, fallbackQuestion.correctAnswer);
            
            lobby.gameState.currentRound = newRound;
            lobby.rounds.push(newRound);
            
            return newRound;
        }
    }
    
    static async startRound(lobby) {
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            throw new Error('No active round to start');
        }
        
        currentRound.setRoundStatus('QP'); // Question Period
        currentRound.roundStartTime = new Date().getTime();
        
        return {
            roundNumber: currentRound.getRoundNumber(),
            question: currentRound.getQuestion(),
            roundStartTime: currentRound.roundStartTime,
            roundLimit: lobby.getSettings().roundLimit
        };
    }
    
    static submitAnswer(lobby, team, answer, isSteal) {
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            throw new Error('No active round');
        }
        
        if (currentRound.getRoundStatus() !== 'QP') {
            throw new Error('Round is not in question period');
        }
        
        // Check if team has already answered
        if (currentRound.getTeamAnswer(team) !== null) {
            throw new Error('Team has already submitted an answer');
        }
        
        currentRound.setTeamAnswer(team, answer, isSteal);
        
        // Check if both teams have answered
        const blueAnswered = currentRound.getTeamAnswer('blue') !== null;
        const redAnswered = currentRound.getTeamAnswer('red') !== null;
        
        const bothAnswered = blueAnswered && redAnswered;
        
        return {
            team: team,
            answer: answer,
            isSteal: isSteal,
            bothAnswered: bothAnswered,
            roundData: bothAnswered ? this.evaluateRound(lobby, currentRound) : null
        };
    }
    
    static evaluateRound(lobby, round) {
        const blueAnswer = round.getTeamAnswer('blue');
        const redAnswer = round.getTeamAnswer('red');
        const correctAnswer = round.getCorrectAnswer();
        
        let bluePoints = 0;
        let redPoints = 0;
        let winner = null;
        
        // If a team doesn't answer, other team gets 2 points
        if (blueAnswer === null && redAnswer !== null) {
            redPoints = 2;
            winner = 'red';
        } else if (redAnswer === null && blueAnswer !== null) {
            bluePoints = 2;
            winner = 'blue';
        } else if (blueAnswer !== null && redAnswer !== null) {
            // Both teams answered - evaluate based on stealing logic
            const blueIsCorrect = blueAnswer.answer && this.isAnswerCorrect(blueAnswer.answer, correctAnswer);
            const redIsCorrect = redAnswer.answer && this.isAnswerCorrect(redAnswer.answer, correctAnswer);
            
            if (blueAnswer.isSteal && redAnswer.isSteal) {
                // Both teams stole - evaluate normally
                if (blueIsCorrect && !redIsCorrect) {
                    bluePoints = 1;
                    redPoints = 0;
                    winner = 'blue';
                } else if (redIsCorrect && !blueIsCorrect) {
                    redPoints = 1;
                    bluePoints = 0;
                    winner = 'red';
                } else if (blueIsCorrect && redIsCorrect) {
                    bluePoints = 1;
                    redPoints = 1;
                    winner = 'tie';
                } else {
                    bluePoints = 0;
                    redPoints = 0;
                    winner = 'tie';
                }
            } else if (blueAnswer.isSteal) {
                // Blue stole, Red answered normally
                // Blue gets Red's result (inverted)
                if (redIsCorrect) {
                    // Red answered correctly, so Blue (who stole) gets +2
                    bluePoints = 2;
                    redPoints = 0;
                    winner = 'blue';
                } else {
                    // Red answered incorrectly, so Blue (who stole) gets -1, Red gets +1
                    bluePoints = -1;
                    redPoints = 1;
                    winner = 'red';
                }
            } else if (redAnswer.isSteal) {
                // Red stole, Blue answered normally
                // Red gets Blue's result (inverted)
                if (blueIsCorrect) {
                    // Blue answered correctly, so Red (who stole) gets +2
                    redPoints = 2;
                    bluePoints = 0;
                    winner = 'red';
                } else {
                    // Blue answered incorrectly, so Red (who stole) gets -1, Blue gets +1
                    redPoints = -1;
                    bluePoints = 1;
                    winner = 'blue';
                }
            } else {
                // Both teams answered normally
                if (blueIsCorrect && !redIsCorrect) {
                    bluePoints = 1;
                    redPoints = 0;
                    winner = 'blue';
                } else if (redIsCorrect && !blueIsCorrect) {
                    redPoints = 1;
                    bluePoints = 0;
                    winner = 'red';
                } else if (blueIsCorrect && redIsCorrect) {
                    bluePoints = 1;
                    redPoints = 1;
                    winner = 'tie';
                } else {
                    bluePoints = 0;
                    redPoints = 0;
                    winner = 'tie';
                }
            }
        }
        
        // Apply points (negative points are capped at 0)
        if (bluePoints !== 0) {
            lobby.incrementScore('blue', bluePoints);
        }
        if (redPoints !== 0) {
            lobby.incrementScore('red', redPoints);
        }
        
        // Set round winner
        round.setWinner(winner);
        
        return {
            blueAnswer: blueAnswer,
            redAnswer: redAnswer,
            correctAnswer: correctAnswer,
            bluePoints: bluePoints,
            redPoints: redPoints,
            winner: winner,
            blueScore: lobby.getScore('blue'),
            redScore: lobby.getScore('red')
        };
    }
    
    static async nextRound(lobby) {
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            throw new Error('No active round');
        }
        
        // Check if game should end
        const blueScore = lobby.getScore('blue');
        const redScore = lobby.getScore('red');
        const maxScore = lobby.getSettings().maxScore;
        const maxRounds = lobby.getSettings().rounds;
        const currentRoundNumber = lobby.gameState.currentRoundNumber;
        
        if (blueScore >= maxScore || redScore >= maxScore || currentRoundNumber >= maxRounds) {
            lobby.setGamePhase('ended');
            return {
                gameEnded: true,
                winner: blueScore >= maxScore ? 'blue' : redScore >= maxScore ? 'red' : 
                        blueScore > redScore ? 'blue' : redScore > blueScore ? 'red' : 'tie',
                finalScores: {
                    blue: blueScore,
                    red: redScore
                }
            };
        }
        
        // Create next round
        lobby.incrementRoundNumber();
        const newRound = await this.createNewRound(lobby);
        
        // Automatically start the round
        const roundData = this.startRound(lobby);
        
        return {
            gameEnded: false,
            newRound: newRound,
            currentRoundNumber: lobby.gameState.currentRoundNumber,
            roundData: roundData
        };
    }
    
    static setCaptainReady(lobby, team, ready) {
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            throw new Error('No active round');
        }
        
        currentRound.setCaptainReady(team, ready);
        
        // Check if both captains are ready
        const blueReady = currentRound.getCaptainReady('blue');
        const redReady = currentRound.getCaptainReady('red');
        
        let roundStarted = false;
        let roundData = null;
        
        // Auto-start round if both captains are ready
        if (blueReady && redReady && currentRound.getRoundStatus() === 'NS') {
            roundData = this.startRound(lobby);
            roundStarted = true;
        }
        
        return {
            ready: ready,
            team: team,
            bothReady: blueReady && redReady,
            roundStarted: roundStarted,
            roundData: roundData
        };
    }
}
