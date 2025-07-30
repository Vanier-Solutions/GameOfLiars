import Question from '../db_models/Question.js';
import mongoose from 'mongoose';

const getRandomQuestion = async (lobbyCode) => {
    try {
        const db = mongoose.connection.db;
        const dbName = db.databaseName;
        const collectionName = 'qs';

        const totalQuestions = await Question.countDocuments();
        
        if (totalQuestions === 0) {
            throw new Error('No questions found in database at all');
        }

        // Get questions that haven't been used in this lobby
        const usedQuestions = await Question.distinct('usedInLobbies', { usedInLobbies: lobbyCode });
        const availableQuestions = await Question.find({ 
            _id: { $nin: usedQuestions } 
        });

        if (availableQuestions.length === 0) {
            // All questions have been used, reset by clearing usedInLobbies for this lobby
            await Question.updateMany(
                { usedInLobbies: lobbyCode },
                { $pull: { usedInLobbies: lobbyCode } }
            );
            
            const allQuestions = await Question.find();
            const randomIndex = Math.floor(Math.random() * allQuestions.length);
            const selectedQuestion = allQuestions[randomIndex];
            
            // Mark as used
            await Question.findByIdAndUpdate(selectedQuestion._id, {
                $push: { usedInLobbies: lobbyCode }
            });
            
            return {
                question: selectedQuestion.question,
                correctAnswer: selectedQuestion.correctAnswer
            };
        }

        // Select random question from available ones
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        const selectedQuestion = availableQuestions[randomIndex];
        
        // Mark as used
        await Question.findByIdAndUpdate(selectedQuestion._id, {
            $push: { usedInLobbies: lobbyCode }
        });
        
        return {
            question: selectedQuestion.question,
            correctAnswer: selectedQuestion.correctAnswer
        };
    } catch (error) {
        console.error('Error fetching random question:', error);
        throw error;
    }
};

export default getRandomQuestion;
