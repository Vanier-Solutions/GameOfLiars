import { GoogleGenAI } from "@google/genai";

class QuestionService {
    constructor() {
        // Initialize Gemini API client
        this.ai = new GoogleGenAI({});
    }

    async generateQuestion(rounds, tags) {
        try {
            const prompt = this.buildGeminiPrompt(rounds, tags);

            const tools = {}

            const response = await this.ai.models.generateContent({
                model: "gemini-2.5-flash-lite",
                contents: prompt,
                config: {
                    thinkingConfig: {
                        thinkingBudget: 0, // Disables thinking
                    },
                }
            });

            const generatedQuestion = response.text;
            return this.parseGeminiResponse(generatedQuestion, rounds, tags);
        } catch (error) {
            console.error('Error generating question:', error);
            throw error;
        }
    }

    buildGeminiPrompt(rounds, tags) {
        const tags_csv = tags.join(',');
        return `You are writing short-answer trivia for a two-team bluffing game.

GOAL
- Produce EXACTLY ${rounds} questions based on these themes: ${tags_csv}.
- Difficulty target: EASY → MEDIUM. Assume players know the basics of each tag; avoid "starter facts" that almost everyone knows.
- Players type one short answer (no choices).

QUESTION REQUIREMENTS
- One unambiguous factual answer per question.
- Prefer "specific but familiar" facts within a tag (e.g., well-known records, origins, nicknames, distances, rule numbers, iconic landmarks/works/figures).
- Avoid trivia where the answer is directly telegraphed by the question wording.
- Prefer timeless/slow-changing facts over recent news.
- Answers should be concise (≤3 words) or a simple number/year.
- CRITICAL: The answer must directly match what the question is asking for (e.g., if question asks for "decade", answer must be a decade like "1960s", not a century like "7th Century BC").

ANTI-TRIVIALITY (tag-agnostic)
- Avoid overused classroom/cliché templates (e.g., "capital of …", extreme superlatives like "largest/smallest/longest…", element symbols, hyper-famous one-step facts).
- Avoid "how many players on the field/court"-style basics for any sport or domain.
- Avoid questions that merely restate the answer (no "What snack … ketchup-flavored chips?"-style giveaways).

OUTPUT FORMAT
Return ONLY a JSON array (no prose, no code fences) of length ${rounds}.
Each item has EXACTLY these keys:
  - "category": short string (derived from a tag)
  - "prompt": clear, self-contained question
  - "answer": single canonical correct answer (string) - MUST match the question format
  - "acceptable_answers": array of common synonyms/variants (can be empty)

SELF-CHECK (do silently; output only the final JSON)
- For each item, ensure: (a) not a starter fact, (b) plausible wrong-but-reasonable alternatives exist within the same tag, (c) answer is not trivially revealed by the prompt, (d) answer format matches what the question asks for.
- If any item fails, replace it before returning the set.`;
    }

    parseGeminiResponse(response, rounds, tags) {
        try {
            let cleanResponse = response.trim();
            
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/```\n?$/, '');
            } else if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/```\n?$/, '');
            }
            
            // Parse the JSON response
            const data = JSON.parse(cleanResponse);
            
            // Handle different response structures
            let questions = [];
            if (data.questions) {
                questions = data.questions;
            } else if (Array.isArray(data)) {
                questions = data;
            } else {
                throw new Error('Unexpected response format');
            }

            const transformedQuestions = questions.slice(0, rounds).map(q => ({
                question: q.prompt,
                answer: q.answer,
                tag: q.category,
                acceptable_answers: q.acceptable_answers || []
            }));

            if (transformedQuestions.length !== rounds) {
                throw new Error(`Expected ${rounds} questions, but got ${transformedQuestions.length}`);
            } else {
                return transformedQuestions;
            }

        } catch (error) {
            console.error('Error parsing Gemini response:', error);
            console.error('Response:', response);
            throw error;
        }
    }
}

export default QuestionService;

