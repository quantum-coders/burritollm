import {promptTokensEstimate} from 'openai-chat-tokens';

const {OPEN_ROUTER_KEY} = process.env;

class AiService {
    static async sendChatCompletion(model, systemMessage, prompt, history = [], tools = []) {
        const messages = [
            {role: 'system', content: systemMessage},
            ...history,
            {role: 'user', content: prompt || 'Hello'}
        ];

        const tokenEstimate = promptTokensEstimate({messages, functions: tools});
        console.log(`Estimated token count: ${tokenEstimate}`);

        const requestBody = {
            model,
            messages,
            temperature: 0.5,
            max_tokens: 4096,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: false
        };

        if (tools.length > 0) {
            requestBody.tools = tools;
        }

        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPEN_ROUTER_KEY}`,
            },
            body: JSON.stringify(requestBody)
        };

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', requestOptions);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error in sendChatCompletion:', error);
            throw error;
        }
    }
}

export default AiService;