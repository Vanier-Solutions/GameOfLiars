    import { GoogleGenAI } from "@google/genai";

    class QuestionService {
        constructor() {
            // Initialize Gemini API client
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY environment variable is required');
            }
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
            return `You are a meticulous trivia author creating questions for a two-team bluffing game.

    ABSOLUTE PRIORITY
    - Your highest priority is FACTUAL ACCURACY. Every answer must be verifiably correct according to well-established, public sources as of the current year.
    - Do not generate a question if you are not 100% certain of the answer. It is better to fail than to provide incorrect information.

    GOAL
    - Produce EXACTLY ${rounds} questions based on these themes: ${tags_csv}.
    - Difficulty target: EASY → MEDIUM. Assume players know the basics of each tag; avoid "starter facts" that almost everyone knows.
    - Players type one short answer (no choices).

    QUESTION REQUIREMENTS
    - One verifiably correct and unambiguous factual answer per question.
    - Prefer "specific but familiar" facts within a tag (e.g., well-known records, origins, nicknames, distances, rule numbers, iconic landmarks/works/figures).
    - Avoid trivia where the answer is directly telegraphed by the question wording.
    - Prefer timeless/slow-changing facts over recent news or statistics that change yearly.
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

    SELF-CHECK (do this silently; output only the final JSON)
    - Before outputting, for each generated item, critically evaluate:
    - 1. **Factual Verification:** Is the answer absolutely, verifiably correct? If there is any ambiguity, recent change, or uncertainty, discard and replace this question.
    - 2. **Quality Check:** Is it a "starter fact"? Do plausible wrong-but-reasonable alternatives exist? Is the answer revealed by the prompt? Does the answer format match the question?
    - If any item fails these checks, replace it before returning the final set.`;
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

