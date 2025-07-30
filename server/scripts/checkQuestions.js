import mongoose from 'mongoose';
import Question from '../db_models/Question.js';

// Connect to MongoDB
try {
  await mongoose.connect(process.env.URI || 'mongodb://localhost:27017/gol');
  console.log('MongoDB connected successfully');
} catch (error) {
  console.error('MongoDB connection error:', error);
  process.exit(1);
}

// Sample questions to add if database is empty
const sampleQuestions = [
  {
    question: "What is the capital of France?",
    correctAnswer: "Paris",
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is 2 + 2?",
    correctAnswer: "4",
    category: "Math",
    difficulty: "easy"
  },
  {
    question: "What is the largest planet in our solar system?",
    correctAnswer: "Jupiter",
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "Who wrote Romeo and Juliet?",
    correctAnswer: "William Shakespeare",
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "What is the chemical symbol for gold?",
    correctAnswer: "Au",
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What year did World War II end?",
    correctAnswer: "1945",
    category: "History",
    difficulty: "medium"
  },
  {
    question: "What is the square root of 144?",
    correctAnswer: "12",
    category: "Math",
    difficulty: "easy"
  },
  {
    question: "What is the main component of the sun?",
    correctAnswer: "Hydrogen",
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the largest ocean on Earth?",
    correctAnswer: "Pacific Ocean",
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Who painted the Mona Lisa?",
    correctAnswer: "Leonardo da Vinci",
    category: "Art",
    difficulty: "medium"
  }
];

const checkAndAddQuestions = async () => {
  try {
    await connectDB();
    
    // Check if there are any questions in the database
    const questionCount = await Question.countDocuments();
    console.log(`Found ${questionCount} questions in the database`);
    
    if (questionCount === 0) {
      console.log('No questions found. Adding sample questions...');
      
      // Add sample questions
      for (let i = 0; i < sampleQuestions.length; i++) {
        const questionData = {
          ...sampleQuestions[i],
          id: i + 1
        };
        
        const newQuestion = new Question(questionData);
        await newQuestion.save();
        console.log(`Added question: ${questionData.question}`);
      }
      
      console.log(`Successfully added ${sampleQuestions.length} questions to the database`);
    } else {
      console.log('Database already has questions. No need to add more.');
      
      // Show a few sample questions
      const sampleQuestions = await Question.find().limit(3);
      console.log('Sample questions in database:');
      sampleQuestions.forEach((q, index) => {
        console.log(`${index + 1}. ${q.question} -> ${q.correctAnswer}`);
      });
    }
    
    mongoose.connection.close();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
};

checkAndAddQuestions(); 