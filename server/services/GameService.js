import { Round } from '../models/Round.js';
import { QuestionService } from './QuestionService.js';

export class GameService {
    
    static startGame(lobby) {
        if (lobby.gamePhase !== 'pregame') {
            throw new Error('Game already started');
        }
        
        if (!lobby.getBlueCaptain() || !lobby.getRedCaptain()) {
            throw new Error('Both teams must have captains to start');
        }
        
        lobby.setGamePhase('playing');
        lobby.setRoundNumber(1);
        
        // Create first round
        return this.createNewRound(lobby);
    }
    
    static createNewRound(lobby) {
        const roundNumber = lobby.gameState.currentRoundNumber;
        const questionData = QuestionService.getRandomQuestion();
        const newRound = new Round(roundNumber, questionData.question, questionData.answer);
        
        lobby.gameState.currentRound = newRound;
        lobby.rounds.push(newRound);
        
        return newRound;
    }
    
    static startRound(lobby) {
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            throw new Error('No active round');
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
        
        currentRound.setTeamAnswer(team, answer, isSteal);
        
        // Check if both teams have answered
        const blueAnswered = currentRound.getTeamAnswer('blue') !== null;
        const redAnswered = currentRound.getTeamAnswer('red') !== null;
        
        return {
            team: team,
            answer: answer,
            isSteal: isSteal,
            bothAnswered: blueAnswered && redAnswered
        };
    }
    
    static determineWinner(lobby, winner) {
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            throw new Error('No active round');
        }
        
        currentRound.setWinner(winner);
        
        if (winner === 'blue') {
            lobby.incrementScore('blue');
        } else if (winner === 'red') {
            lobby.incrementScore('red');
        }
        // If tie, no points awarded
        
        // Check if game should end
        const currentRoundNum = lobby.gameState.currentRoundNumber;
        const maxRounds = lobby.getSettings().rounds;
        
        if (currentRoundNum >= maxRounds) {
            lobby.setGamePhase('ended');
            return { gameEnded: true };
        } else {
            // Create next round
            lobby.incrementRoundNumber();
            this.createNewRound(lobby);
            return { gameEnded: false };
        }
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