import { Lobby } from '../models/Lobby.js';
import { Player } from '../models/Player.js';
import { Round } from '../models/Round.js';
import jwt from 'jsonwebtoken';
import QuestionService from './questionService.js';
import { lobbyStore, getLobbySnapshot } from './lobbyService.js';
import { emitGameStarted } from '../socket/socketService.js';


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