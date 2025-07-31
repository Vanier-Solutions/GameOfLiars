import Question from '../db_models/Question.js';
import mongoose from 'mongoose';

const getRandomQuestion = async (lobbyCode) => {
    try {
        console.log('QuestionService: Starting to fetch random question for lobby:', lobbyCode);
        
        const db = mongoose.connection.db;
        console.log('QuestionService: Database connection status:', mongoose.connection.readyState);
        console.log('QuestionService: Database name:', db?.databaseName);
        
        const dbName = db.databaseName;
        const collectionName = 'qs';

        const totalQuestions = await Question.countDocuments();
        console.log('QuestionService: Total questions in database:', totalQuestions);
        
        if (totalQuestions === 0) {
            console.log('QuestionService: No questions found in database, throwing error');
            throw new Error('No questions found in database at all');
        }

        // Get questions that haven't been used in this lobby
        const usedQuestions = await Question.distinct('usedInLobbies', { usedInLobbies: lobbyCode });
        console.log('QuestionService: Questions already used in this lobby:', usedQuestions.length);
        
        const availableQuestions = await Question.find({ 
            _id: { $nin: usedQuestions } 
        });
        console.log('QuestionService: Available questions (not used in this lobby):', availableQuestions.length);

        if (availableQuestions.length === 0) {
            console.log('QuestionService: All questions used, resetting for this lobby');
            // All questions have been used, reset by clearing usedInLobbies for this lobby
            await Question.updateMany(
                { usedInLobbies: lobbyCode },
                { $pull: { usedInLobbies: lobbyCode } }
            );
            
            const allQuestions = await Question.find();
            console.log('QuestionService: Total questions after reset:', allQuestions.length);
            const randomIndex = Math.floor(Math.random() * allQuestions.length);
            const selectedQuestion = allQuestions[randomIndex];
            
            // Mark as used
            await Question.findByIdAndUpdate(selectedQuestion._id, {
                $push: { usedInLobbies: lobbyCode }
            });
            
            console.log('QuestionService: Selected question after reset:', selectedQuestion.question);
            return {
                question: selectedQuestion.question,
                correctAnswer: selectedQuestion.correctAnswer
            };
        }

        // Select random question from available ones
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        const selectedQuestion = availableQuestions[randomIndex];
        console.log('QuestionService: Selected question from available:', selectedQuestion.question);
        
        // Mark as used
        await Question.findByIdAndUpdate(selectedQuestion._id, {
            $push: { usedInLobbies: lobbyCode }
        });
        
        return {
            question: selectedQuestion.question,
            correctAnswer: selectedQuestion.correctAnswer
        };
    } catch (error) {
        console.error('QuestionService: Error fetching random question:', error);
        throw error;
    }
};

export default getRandomQuestion;
