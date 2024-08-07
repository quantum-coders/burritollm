import axios from 'axios';

import { promptTokensEstimate } from 'openai-chat-tokens';
import { openAIModels, perplexityModels, groqModels, openRouterModels } from '../assets/data/ai-models.js';

const { OPEN_ROUTER_KEY } = process.env;

class AIService {
	/**
	 * Sends a message to the AI model and streams the response back to the client.
	 *
	 * @param {Object} data - The data to send to the AI model.
	 * @param {string} provider - The provider of the AI model.
	 * @returns {Promise<Object>} - A promise that resolves to the response from the AI model.
	 * @throws {Error} - Throws an error if there is an issue with the request or the response.
	 */
	static async sendMessage(data, provider) {

		const url = AIService.solveProviderUrl(provider);
		return await axios.post(url, data, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${ process.env.OPEN_ROUTER_KEY }`,
			},
			responseType: 'stream',
		});
	}

	/**
	 * Solves the provider URL based on the given provider name.
	 *
	 * @param {string} provider - The name of the provider (e.g., 'openai', 'perplexity', 'groq').
	 * @returns {string} - The URL corresponding to the given provider.
	 * @throws {Error} - Throws an error if the provider is not recognized.
	 */
	static solveProviderUrl(provider) {
		let url;

		// return url based on provider
		if(provider === 'openai') url = 'https://api.openai.com/v1/chat/completions';
		if(provider === 'perplexity') url = 'https://api.perplexity.ai/chat/completions';
		if(provider === 'groq') url = 'https://api.groq.com/openai/v1/chat/completions';
		if(provider === 'openrouter') url = 'https://openrouter.ai/api/v1/chat/completions';

		return url;
	}

	/**
	 * Retrieves model information including the provider and maximum tokens.
	 *
	 * @param {string} model - The name of the model.
	 * @returns {Object} - An object containing the provider and maximum tokens for the model.
	 * @throws {Error} - Throws an error if the model is not recognized.
	 */
	static solveModelInfo(model) {
		let maxTokens = 4096;

		if(!openAIModels.includes(model) && !perplexityModels.includes(model) && !groqModels.includes(model) && !openRouterModels.includes(model)) {
			throw new Error('Invalid model');
		}

		if(groqModels.includes(model)) {
			if(model === 'llama2-70b-4096' && maxTokens > 4096) maxTokens = 4096 - 2500;
			if(model === 'llama3-8b-8192' && maxTokens > 8192) maxTokens = 8192 - 2500;
			if(model === 'llama3-70b-8192' && maxTokens > 8192) maxTokens = 8192 - 2500;
		}

		if(openAIModels.includes(model)) {
			if(model === 'gpt-3.5-turbo-16k' && maxTokens > 16000) maxTokens = 16000;
			if(model === 'gpt-3.5-turbo' && maxTokens > 4096) maxTokens = 4096;
			if(model === 'gpt-4' && maxTokens > 4096) maxTokens = 4096;
			if(model === 'gpt-4-turbo' && maxTokens > 4096) maxTokens = 4096;
			if(model === 'gpt-4-1106-preview' && maxTokens > 4096) maxTokens = 4096;
			if(model === 'gpt-4-turbo-preview' && maxTokens > 4096) maxTokens = 4096;
		}

		if(perplexityModels.includes(model)) {
			if(model === 'sonar-small-chat' && maxTokens > 16384) maxTokens = 16384;
			if(model === 'sonar-small-online' && maxTokens > 12000) maxTokens = 12000;
			if(model === 'sonar-medium-chat' && maxTokens > 16384) maxTokens = 16384;
			if(model === 'sonar-medium-online' && maxTokens > 12000) maxTokens = 12000;
			if(model === 'llama-3-8b-instruct' && maxTokens > 8192) maxTokens = 8192;
			if(model === 'llama-3-70b-instruct' && maxTokens > 8192) maxTokens = 8192;
			if(model === 'codellama-70b-instruct' && maxTokens > 16384) maxTokens = 16384;
			if(model === 'mistral-7b-instruct' && maxTokens > 16384) maxTokens = 16384;
			if(model === 'mixtral-8x7b-instruct' && maxTokens > 16384) maxTokens = 16384;
			if(model === 'mixtral-8x22b-instruct' && maxTokens > 16384) maxTokens = 16384;
			if(model === 'llama-3-sonar-large-32k-online' && maxTokens > 4096) maxTokens = 4096;
			if(model === 'llama-3-sonar-small-32k-online' && maxTokens > 4096) maxTokens = 4096;
		}

		if(openRouterModels.includes(model)) {
			if(model === 'burrito-8x7b' && maxTokens > 16384) maxTokens = 16384;
		}

		let provider;

		if(openAIModels.includes(model)) provider = 'openai';
		if(perplexityModels.includes(model)) provider = 'perplexity';
		if(groqModels.includes(model)) provider = 'groq';
		if(openRouterModels.includes(model)) provider = 'openrouter';

		return { maxTokens, provider };
	}

	/**
	 * Adjusts the history and system message for the AI model.
	 *
	 * @param {string} system - The system message to be used.
	 * @param {Array<Object>} history - The conversation history.
	 * @param {string} prompt - The user prompt.
	 * @returns {Object} - An object containing the adjusted system message and history.
	 * @throws {Error} - Throws an error if there is an issue with the adjustment.
	 */
	static adjustHistory(system, history, prompt) {

		let estimate = promptTokensEstimate({
			messages: [
				{ 'role': 'system', 'content': system || 'You are a helpful assistant.' },
				...history,
				{
					'role': 'user',
					'content': prompt || 'Hello',
				},
			],
		});

		let chunkSize = 250;

		while(estimate > 2500) {
			if(estimate <= 2500) chunkSize = 250;
			if(estimate <= 5000) chunkSize = 500;
			if(estimate > 10000) chunkSize = 5000;
			system = system.substring(0, system.length - chunkSize);

			if(estimate > 2500 && system.length < 1000) {
				if(history.length > 0) {
					if(estimate > 2500 && history[history.length - 1].content.length < 500) {
						prompt = prompt.substring(0, prompt.length - chunkSize);
					}

					history[history.length - 1].content = history[history.length - 1].content.substring(0, history[history.length - 1].content.length - chunkSize);
				} else {
					prompt = prompt.substring(0, prompt.length - chunkSize);
				}
			}
			estimate = promptTokensEstimate({
				messages: [
					{ 'role': 'system', 'content': system || 'You are a helpful assistant.' },
					...history,
					{
						'role': 'user',
						'content': prompt || 'Hello',
					},
				],
			});
		}

		system = JSON.stringify(system);
		prompt = JSON.stringify(prompt);

		for(let i = 0; i < history.length; i++) {
			history[i].content = JSON.stringify(history[i].content);
		}

		return { system, history, prompt };
	}

	static async sendChatCompletion(model, systemMessage, prompt, history = [], tools = []) {
		const messages = [
			{ role: 'system', content: systemMessage },
			...history,
			{ role: 'user', content: prompt || 'Hello' },
		];

		const tokenEstimate = promptTokensEstimate({ messages, functions: tools });
		console.log(`Estimated token count: ${ tokenEstimate }`);
		console.log('MEssages', messages);
		const requestBody = {
			model,
			messages,
			temperature: 0.5,
			max_tokens: 1500,
			top_p: 1,
			frequency_penalty: 0,
			presence_penalty: 0,
			stream: false,
		};

		if(tools.length > 0) {
			requestBody.tools = tools;
		}

		const requestOptions = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${ OPEN_ROUTER_KEY }`,
			},
			body: JSON.stringify(requestBody),
		};

		try {
			const response = await fetch('https://openrouter.ai/api/v1/chat/completions', requestOptions);

			if(!response.ok) {
				const errorData = await response.json();
				throw new Error(`API request failed with status ${ response.status }: ${ JSON.stringify(errorData) }`);
			}

			return await response.json();
		} catch(error) {
			console.error('Error in sendChatCompletion:', error);
			throw error;
		}
	}
}

export default AIService;