class QuestionService {
    async generateQuestion(rounds, tags) {

        // Temp
        res = [];
        for (let i = 0; i < rounds; i++) {
            res.push({
                question: "What is the capital of France?",
                answer: "Paris",
                tag: "Geography"
            });
        }
        return res;
        
        const response = await fetch(
            "https://api-inference.huggingface.co/models/Qwen/Qwen3-4B-Instruct-2507",
            {
                headers: { 
                    Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    "Content-Type": "application/json"
                },
                method: "POST",
                body: JSON.stringify({
                    inputs: this.buildQwenPrompt(rounds, tags),
                    parameters: {
                        max_new_tokens: 1024,
                        temperature: 0.7,
                        top_p: 0.8,
                        top_k: 20,
                        do_sample: true,
                        presence_penalty: 0.5
                    }
                })
            }
        );

        if(!response.ok) {
            throw new Error(`Failed to generate question: ${response.status}`);
        }

        const data = await response.json();
        return this.parseQwenResponse(data[0].generated_text, rounds);
    }

    buildQwenPrompt(rounds, tags) {
        const tagList = tags.join(', ');
        return `You are a trivia question generator for a game called "Game of Liars". 

Generate ${rounds} engaging trivia questions with the following format:

Q: [Trivia question]
A: [Correct answer]
T: [Tag - choose the most relevant tag from: ${tagList}]

Requirements:
- Each question must relate to at least one of these tags: ${tagList}
- Make questions varied in difficulty
- Questions should be engaging and fun, not too hard but not extremely easy either
- Each question should be unique
- Assign the most appropriate tag from the given list

Generate exactly ${rounds} questions:`;
    }

    parseQwenResponse(response, rounds) {
        try {
            const questions = [];
            const questionBlocks = response.split('\n\n').filter(block => block.trim());
            
            for (let i = 0; i < Math.min(rounds, questionBlocks.length); i++) {
                const block = questionBlocks[i];
                const lines = block.split('\n').map(line => line.trim());
                
                let question = '', answer = '', tag = '';
                
                lines.forEach(line => {
                    if (line.startsWith('Q:')) {
                        question = line.substring(2).trim();
                    } else if (line.startsWith('A:')) {
                        answer = line.substring(2).trim();
                    } else if (line.startsWith('T:')) {
                        tag = line.substring(2).trim();
                    }
                });
                
                if (question && answer && tag) {
                    questions.push({
                        question,
                        answer,
                        tag
                    });
                }
            }
            
            return questions.length > 0 ? questions : null;
        } catch (error) {
            console.error('Error parsing Qwen response:', error);
            return null;
        }
    }
}

export default QuestionService;