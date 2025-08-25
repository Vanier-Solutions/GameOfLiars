import AnswerCheckService from './services/answercheckService.js';

const answerCheckService = new AnswerCheckService();

async function testAnswerCheck() {
    console.log('Testing AnswerCheckService...\n');

    const testCases = [
        {
            question: "What is the capital of France?",
            correctAnswer: "Paris",
            playerAnswer: "French City",
            acceptableAnswers: ["paris"]
        },
        {
            question: "Who has the most points in the nba of all time in total?",
            correctAnswer: "Lebron James",
            playerAnswer: "King James",
            acceptableAnswers: ["LeBron"]
        },
        {
            question: "What is 2 + 2?",
            correctAnswer: "4",
            playerAnswer: "fore",
            acceptableAnswers: ["four", "Four"]
        }
    ];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`Test ${i + 1}:`);
        console.log(`Question: ${testCase.question}`);
        console.log(`Correct: ${testCase.correctAnswer}`);
        console.log(`Player: ${testCase.playerAnswer}`);
        console.log(`Acceptable: ${testCase.acceptableAnswers.join(', ')}`);
        
        try {
            const result = await answerCheckService.checkAnswer(testCase);
            console.log(`Result: ${result}\n`);
        } catch (error) {
            console.error(`Error: ${error.message}\n`);
        }
    }
}

testAnswerCheck().catch(console.error);
