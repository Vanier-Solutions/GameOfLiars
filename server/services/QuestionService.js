// Temporary hardcoded questions until we implement database
const questions = [
    {
        question: "What do cows drink?",
        answer: "Water"
    },
    {
        question: "What color is the sky?",
        answer: "Blue"
    },
    {
        question: "How many legs does a cat have?",
        answer: "Four"
    },
    {
        question: "What is the opposite of hot?",
        answer: "Cold"
    },
    {
        question: "What do you use to write on paper?",
        answer: "Pen"
    },
    {
        question: "What is the largest planet in our solar system?",
        answer: "Jupiter"
    },
    {
        question: "What do you call a baby dog?",
        answer: "Puppy"
    },
    {
        question: "What is the capital of France?",
        answer: "Paris"
    },
    {
        question: "How many days are in a week?",
        answer: "Seven"
    },
    {
        question: "What do you wear on your feet?",
        answer: "Shoes"
    }
];

export class QuestionService {
    static getRandomQuestion() {
        const randomIndex = Math.floor(Math.random() * questions.length);
        return questions[randomIndex];
    }
    
    static getAllQuestions() {
        return questions;
    }
} 