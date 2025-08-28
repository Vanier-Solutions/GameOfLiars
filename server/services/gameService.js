import { Lobby } from '../models/Lobby.js';
import { Player } from '../models/Player.js';
import { Round } from '../models/Round.js';
import jwt from 'jsonwebtoken';
import QuestionService from './questionService.js';
import { lobbyStore, getLobbySnapshot } from './lobbyService.js';
import { emitGameStarted, emitRoundStarted, emitRoundResults, emitCustomEventToLobby } from '../socket/socketService.js';
import AnswerCheckService from './answercheckService.js';

const answerCheckService = new AnswerCheckService();

export const startGame = async (lobby) => {
    try {
        lobby.gamePhase = 'playing';
        lobby.gameState.currentRoundNumber = 0;
        lobby.gameState.rounds = [];
        lobby.gameState.questions = [];
        lobby.gameState.currentRound = null;
        lobby.gameState.scores = {
            blue: 0,
            red: 0,
        };

        const snapshot = getLobbySnapshot(lobby);
        emitGameStarted(lobby.code, { lobby: snapshot });

        const questionService = new QuestionService();
        const { rounds, tags } = lobby.getSettings();
        
        try {
            const generated = await questionService.generateQuestion(rounds, tags);
            lobby.gameState.questions = Array.isArray(generated) ? generated : [];
            
            // Create rounds with the generated questions
            for (let i = 0; i < rounds && i < lobby.gameState.questions.length; i++) {
                const questionData = lobby.gameState.questions[i];
                if (questionData && questionData.question) {
                    const round = new Round(
                        questionData.question, 
                        questionData.answer || 'No answer provided', 
                        questionData.tag || 'General', 
                        i + 1
                    );
                    lobby.gameState.rounds.push(round);
                    console.log(questionData);
                }
            }
            
            console.log(`Game started for lobby ${lobby.code} with ${lobby.gameState.rounds.length} rounds`);
        } catch (err) {
            console.error('Failed to generate questions:', err);
            lobby.gameState.questions = [];
            
            // Create default rounds if question generation fails
            for (let i = 0; i < rounds; i++) {
                const round = new Round(
                    `Question ${i + 1} (Failed to generate)`, 
                    'Default answer', 
                    'General', 
                    i + 1
                );
                lobby.gameState.rounds.push(round);
            }
        }

        return { success: true, lobby: getLobbySnapshot(lobby) };
    } catch (error) {
        console.error('Error starting game:', error);
        return { success: false, message: 'Failed to start game' };
    }
}


export const startRound = (playerId, code) => {
	const lobby = lobbyStore.get(code);
	if (!lobby) {
		return { success: false, message: 'Lobby not found' };
	}

	// Only host can start a round
	if (lobby.getHost().id !== playerId) {
		return { success: false, message: 'Only host can start a round' };
	}

	// Game must be in progress
	if (lobby.getGamePhase() !== 'playing') {
		return { success: false, message: 'Game is not in progress' };
	}

    lobby.gameState.currentRoundNumber++;
    lobby.gameState.currentRound = lobby.gameState.rounds[lobby.gameState.currentRoundNumber - 1];
    
    if (!lobby.gameState.currentRound) {
        return { success: false, message: 'No rounds available' };
    }

    const snapshot = getGameStateSnapshot(lobby);
    emitRoundStarted(code, { game: snapshot });
    
	return { 
		success: true,
		message: 'Round started successfully',
        game: snapshot,
	};
};

export const submitAnswer = async (playerId, code, isSteal, answer, team, roundNumber) => {
    console.log(`Submit answer request: playerId=${playerId}, code=${code}, isSteal=${isSteal}, answer="${answer}", team=${team}, roundNumber=${roundNumber}`);
    
    // Validate required parameters
    if (!playerId || !code || isSteal === undefined || (!answer && !isSteal) || !team || !roundNumber) {
        console.log('Missing required parameters:', { playerId, code, isSteal, answer, team, roundNumber });
        return { success: false, message: 'Missing required parameters' };
    }
    
    const lobby = lobbyStore.get(code);
    if (!lobby) {
        return { success: false, message: 'Lobby not found' };
    }

    const allPlayers = [...lobby.blueTeam, ...lobby.redTeam];
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) {
        return { success: false, message: 'Player not found' };
    }
    if (lobby.gamePhase !== 'playing') {
        return { success: false, message: 'Game is not in progress' };
    }
    if (lobby.gameState.currentRoundNumber !== roundNumber) {
        return { success: false, message: `Round number mismatch. Expected ${lobby.gameState.currentRoundNumber}, got ${roundNumber}` };
    }
    
    if (!lobby.gameState.currentRound) {
        return { success: false, message: 'No active round found' };
    }
    
    const teamCaptain = lobby.getTeamCaptain(team);
    console.log(`Team captain for ${team}:`, teamCaptain ? { id: teamCaptain.id, name: teamCaptain.getName() } : null);
    console.log(`Player attempting submission:`, { id: playerId, name: player.getName() });
    
    if (!teamCaptain) {
        console.log(`No captain assigned for ${team} team`);
        return { success: false, message: 'No captain assigned for your team' };
    }
    if (teamCaptain.id !== playerId) {
        console.log(`Captain validation failed: expected ${teamCaptain.id}, got ${playerId}`);
        return { success: false, message: 'You are not the captain of your team' };
    }
    
    // Check if team has already submitted for this round
    const currentRound = lobby.gameState.currentRound;
    if (team === 'blue' && currentRound.blueSubmitted) {
        return { success: false, message: 'Blue team has already submitted for this round' };
    }
    if (team === 'red' && currentRound.redSubmitted) {
        return { success: false, message: 'Red team has already submitted for this round' };
    }

    try {
        lobby.gameState.currentRound.setTeamAnswer(team, isSteal, answer);
        console.log(`${team} team submitted: ${isSteal ? 'STEAL' : answer}`);
        
        // Emit immediate feedback that team has submitted
        emitCustomEventToLobby(code, 'team-answer-submitted', {
            team,
            isSteal,
            bothSubmitted: lobby.gameState.currentRound.bothSubmitted(),
            timestamp: new Date().toISOString()
        });
        
        // If both teams have submitted, process answers asynchronously
        if (lobby.gameState.currentRound.bothSubmitted()) {
            console.log('Both teams submitted, processing answers...');
            
            // Emit that processing has started
            emitCustomEventToLobby(code, 'answer-processing-started', {
                message: 'Checking answers...',
                timestamp: new Date().toISOString()
            });
            
            // Process answers in the background to avoid blocking the response
            processRoundResults(lobby, code).catch(error => {
                console.error('Error processing round results:', error);
            });
        }
    } catch (error) {
        console.error('Error processing answer submission:', error);
        return { success: false, message: 'Failed to process answer submission' };
    }
    
    return { success: true, message: 'Answer submitted successfully' };
}

const processRoundResults = async (lobby, code) => {
    try {
        console.log('Starting answer checking process...');
        await checkAnswers(lobby);
        
        lobby.gameState.scores.blue += lobby.gameState.currentRound.bluePointsGained;
        lobby.gameState.scores.red += lobby.gameState.currentRound.redPointsGained;
        
        console.log('Answer checking complete, emitting results...');
        
        // Check if this was the final round
        const totalRounds = lobby.gameState.rounds.length;
        const isGameEnd = lobby.gameState.currentRoundNumber >= totalRounds;
        
        if (isGameEnd) {
            // This was the final round - emit game end results
            lobby.gamePhase = 'ended';
            
            emitRoundResults(code, {
                round: lobby.gameState.currentRound,
                scores: lobby.gameState.scores,
                game: getGameStateSnapshot(lobby),
                isGameEnd: true,
                gameComplete: true
            });
            
            console.log(`Game ended for lobby ${code}. Final scores - Blue: ${lobby.gameState.scores.blue}, Red: ${lobby.gameState.scores.red}`);
        } else {
            // Regular round results
            emitRoundResults(code, {
                round: lobby.gameState.currentRound,
                scores: lobby.gameState.scores,
                game: getGameStateSnapshot(lobby),
                isGameEnd: false
            });
        }
        
        console.log('Round results emitted successfully');
    } catch (error) {
        console.error('Error in processRoundResults:', error);
        // Even if answer checking fails, emit basic results
        lobby.gameState.currentRound.winner = 'tie';
        lobby.gameState.currentRound.bluePointsGained = 0;
        lobby.gameState.currentRound.redPointsGained = 0;
        
        emitRoundResults(code, {
            round: lobby.gameState.currentRound,
            scores: lobby.gameState.scores,
            game: getGameStateSnapshot(lobby),
            error: 'Answer checking failed'
        });
    }
};

const checkAnswers = async (lobby) => {
    const round = lobby.gameState.currentRound;
    
    // Check answers for both teams in parallel for faster processing
    let isCorrectBlue = false;
    let isCorrectRed = false;
    
    const answerChecks = [];
    
    if (!round.blueSteal && round.blueAnswer) {
        answerChecks.push(
            answerCheckService.checkAnswer({
                correctAnswer: round.answer,
                playerAnswer: round.blueAnswer,
                question: round.question,
                acceptableAnswers: round.acceptableAnswers,
            }).then(result => ({ team: 'blue', correct: result }))
        );
    }
    
    if (!round.redSteal && round.redAnswer) {
        answerChecks.push(
            answerCheckService.checkAnswer({
                correctAnswer: round.answer,
                playerAnswer: round.redAnswer,
                question: round.question,
                acceptableAnswers: round.acceptableAnswers,
            }).then(result => ({ team: 'red', correct: result }))
        );
    }
    
    // Wait for all answer checks to complete
    if (answerChecks.length > 0) {
        const results = await Promise.all(answerChecks);
        results.forEach(result => {
            if (result.team === 'blue') {
                isCorrectBlue = result.correct;
            } else if (result.team === 'red') {
                isCorrectRed = result.correct;
            }
        });
    }

    // Determine winner and points based on game rules
    if (round.blueSteal && round.redSteal) {
        round.winner = 'tie';
        round.bluePointsGained = 0;
        round.redPointsGained = 0;
    } else if (round.blueSteal && !round.redSteal) {
        if (isCorrectRed) {
            round.winner = 'blue';
            round.redPointsGained = 0;
            round.bluePointsGained = 2;
        } else {
            round.winner = 'red';
            round.redPointsGained = 2;
            round.bluePointsGained = 0;
        }
    } else if (!round.blueSteal && round.redSteal) {
        if (isCorrectBlue) {
            round.winner = 'red';
            round.redPointsGained = 2;
            round.bluePointsGained = 0;
        } else {
            round.winner = 'blue';
            round.redPointsGained = 0;
            round.bluePointsGained = 2;
        }
    } else if (!round.blueSteal && !round.redSteal) {
        if (isCorrectBlue && isCorrectRed) {
            round.winner = 'tie';
            round.bluePointsGained = 1;
            round.redPointsGained = 1;
        } else if (isCorrectBlue) {
            round.winner = 'blue';
            round.redPointsGained = 0;
            round.bluePointsGained = 1;
        } else if (isCorrectRed) {
            round.winner = 'red';
            round.redPointsGained = 1;
            round.bluePointsGained = 0;
        } else {
            round.winner = 'tie';
            round.bluePointsGained = 0;
            round.redPointsGained = 0;
        }
    }
}


export const returnToLobby = (playerId, code) => {
    const lobby = lobbyStore.get(code);
    if (!lobby) {
        return { success: false, message: 'Lobby not found' };
    }

    // Only host can return to lobby
    if (lobby.getHost().id !== playerId) {
        return { success: false, message: 'Only host can return to lobby' };
    }

    // Reset lobby to pregame state
    lobby.gamePhase = 'pregame';
    lobby.gameState = {
        rounds: [],
        questions: [],
        currentRoundNumber: 0,
        scores: {
            blue: 0,
            red: 0,
        },
        currentRound: null,
    };


    // Get the final lobby snapshot after reset
    const finalSnapshot = getLobbySnapshot(lobby);

    // Emit lobby returned event to all players
    emitCustomEventToLobby(code, 'lobby-returned', {
        lobby: finalSnapshot,
        message: 'Game ended, returned to lobby',
        timestamp: new Date().toISOString()
    });

    return { success: true, lobby: finalSnapshot };
};

const getGameStateSnapshot = (lobby) => {
    return {
        currentRoundNumber: lobby.gameState.currentRoundNumber,
        currentRound: lobby.gameState.currentRound,
        scores: lobby.gameState.scores,
        gamePhase: lobby.gamePhase,
        rounds: lobby.gameState.rounds,
    }    
}