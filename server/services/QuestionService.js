import Question from '../db_models/Question.js';
import mongoose from 'mongoose';
import { activeLobbies } from '../routes/lobby.js';

export class QuestionService {
    constructor(lobbyCode) {
        this.lobbyCode = lobbyCode;
    }

    async getRandomQuestion() {
        try {
            const db = mongoose.connection.db;
            
            if (mongoose.connection.readyState !== 1) {
                throw new Error('Database not connected');
            }
            
            const totalQuestions = await db.collection('qs').countDocuments();
            
            if (totalQuestions === 0) {
                throw new Error('No questions found in database');
            }
            
            // Get all questions that haven't been used in this lobby
            const lobby = activeLobbies.get(this.lobbyCode);
            const usedQuestions = lobby ? lobby.getUsedQuestions() : [];
            
            const availableQuestions = await db.collection('qs').find({
                _id: { $nin: usedQuestions }
            }).toArray();
            
            if (availableQuestions.length === 0) {
                // All questions used, reset for this lobby
                const allQuestions = await db.collection('qs').find({}).toArray();
                
                if (lobby) {
                    lobby.clearUsedQuestions();
                }
                
                const randomIndex = Math.floor(Math.random() * allQuestions.length);
                const selectedQuestion = allQuestions[randomIndex];
                
                if (lobby) {
                    lobby.addUsedQuestion(selectedQuestion._id);
                }
                
                return {
                    question: selectedQuestion.question,
                    correctAnswer: selectedQuestion.correctAnswer
                };
            }
            
            // Select random question from available
            const randomIndex = Math.floor(Math.random() * availableQuestions.length);
            const selectedQuestion = availableQuestions[randomIndex];
            
            if (lobby) {
                lobby.addUsedQuestion(selectedQuestion._id);
            }
            
            return {
                question: selectedQuestion.question,
                correctAnswer: selectedQuestion.correctAnswer
            };
        } catch (error) {
            throw new Error(`Error fetching random question: ${error.message}`);
        }
    }
}
