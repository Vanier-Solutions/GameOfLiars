import { GoogleGenAI } from "@google/genai";

class AnswerCheckService {
	constructor() {
		// Initialize Gemini API client with API key
		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			throw new Error('GEMINI_API_KEY environment variable is required');
		}
		this.ai = new GoogleGenAI({ apiKey });
	}

	/**
	 * Check if a player's answer matches the correct answer.
	 * Returns: "correct" or "incorrect"
	 */
	async checkAnswer({ correctAnswer, playerAnswer, question = "", acceptableAnswers = [] }) {
		if (!correctAnswer || !playerAnswer) {
			return "incorrect";
		}

		try {
			const prompt = this.buildGeminiPrompt({ correctAnswer, playerAnswer, question, acceptableAnswers });

			const response = await this.ai.models.generateContent({
				model: "gemini-2.5-flash-lite",
				contents: prompt,
				config: {
					thinkingConfig: {
						thinkingBudget: 0, // Disables thinking
					},
				}
			});

			const generatedAnswer = response.text;
			return this.parseGeminiResponse(generatedAnswer);
		} catch (error) {
			console.error('Error checking answer:', error);
			throw error;
		}
	}

	buildGeminiPrompt({ correctAnswer, playerAnswer, question, acceptableAnswers }) {
		return `Check if this answer is correct for the trivia question.

Question: ${question}
Correct Answer: ${correctAnswer}
${acceptableAnswers && acceptableAnswers.length ? `Acceptable Answers: ${acceptableAnswers.join(', ')}\n` : ''}Player's Answer: ${playerAnswer}

Reply with ONLY "correct" if the player's answer is correct, it can be similar to the correct or acceptable answers (case-insensitive, ignoring punctuation, spelling, etc.), or "incorrect" if wrong.`;
	}

	parseGeminiResponse(response) {
		try {
			const cleanResponse = response.trim().toLowerCase();
			return cleanResponse === 'correct' ? 'correct' : 'incorrect';
		} catch (error) {
			console.error('Error parsing Gemini response:', error);
			console.error('Response:', response);
			throw error;
		}
	}
}

export default AnswerCheckService;


