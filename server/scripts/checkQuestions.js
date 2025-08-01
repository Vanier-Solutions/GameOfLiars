import mongoose from 'mongoose';
import Question from '../db_models/Question.js';

// Connect to MongoDB
const uri = process.env.URI || 'mongodb://localhost:27017/gol';
mongoose.connect(uri, {
    dbName: 'gol'
}).then(() => {
    console.log('MongoDB connected successfully');
    checkQuestions();
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

async function checkQuestions() {
    try {
        const db = mongoose.connection.db;
        const questionCount = await db.collection('qs').countDocuments();
        
        if (questionCount === 0) {
            console.log('No questions found. Adding sample questions...');
            
            const sampleQuestions = [
                { question: "What is 2 + 2?", correctAnswer: "4" },
                { question: "What is the capital of France?", correctAnswer: "Paris" },
                { question: "What is the largest planet in our solar system?", correctAnswer: "Jupiter" },
                { question: "What is the chemical symbol for gold?", correctAnswer: "Au" },
                { question: "What year did World War II end?", correctAnswer: "1945" },
                { question: "What is the square root of 144?", correctAnswer: "12" },
                { question: "What is the main component of the sun?", correctAnswer: "Hydrogen" },
                { question: "What is the largest ocean on Earth?", correctAnswer: "Pacific" },
                { question: "What is the speed of light in miles per second?", correctAnswer: "186,282" },
                { question: "What is the atomic number of carbon?", correctAnswer: "6" }
            ];
            
            for (const questionData of sampleQuestions) {
                await db.collection('qs').insertOne(questionData);
            }
            
            console.log(`Successfully added ${sampleQuestions.length} questions to the database`);
        } else {
            console.log('Database already has questions. No need to add more.');
        }
        
        // Show sample questions
        const questions = await db.collection('qs').find({}).limit(5).toArray();
        console.log('Sample questions in database:');
        questions.forEach((q, index) => {
            console.log(`${index + 1}. ${q.question} -> ${q.correctAnswer}`);
        });
        
    } catch (error) {
        console.error('Error checking questions:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
} 