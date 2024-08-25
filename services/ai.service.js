import 'dotenv/config';
import axios from 'axios';
import {promptTokensEstimate} from 'openai-chat-tokens';
import {groqModels, openAIModels, openRouterModels, perplexityModels} from '../assets/data/ai-models.js';
import ExaService from "./exa.service.js";
import {prisma} from "@thewebchimp/primate";
import Replicate from 'replicate';

const { OPEN_ROUTER_KEY } = process.env;
const replicate = new Replicate();

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
		console.log("DATA: ", data)
		const bearerToken = AIService.solveProviderAuth(provider);
		const url = AIService.solveProviderUrl(provider);
		return await axios.post(url, data, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${bearerToken}`,
			},
			responseType: 'stream',
		});
	}

	/**
	 * Resolves the authentication key for the specified provider.
	 *
	 * This function determines the appropriate authentication key based on the provider name.
	 * It currently supports 'openai' and 'openrouter' providers, using environment variables to retrieve the keys.
	 *
	 * @param {string} provider - The name of the provider for which the authentication key is needed.
	 * @returns {string|undefined} - The authentication key as a string, or `undefined` if the provider is not recognized.
	 */
	static solveProviderAuth(provider) {
		let auth;

		if (provider === 'openai') auth = `${process.env.OPENAI_API_KEY}`;
		if (provider === 'openrouter') auth = `${process.env.OPEN_ROUTER_KEY}`;

		return auth;
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
		if (provider === 'openai') url = 'https://api.openai.com/v1/chat/completions';
		if (provider === 'perplexity') url = 'https://api.perplexity.ai/chat/completions';
		if (provider === 'groq') url = 'https://api.groq.com/openai/v1/chat/completions';
		if (provider === 'openrouter') url = 'https://openrouter.ai/api/v1/chat/completions';

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

		if (!openAIModels.includes(model) && !perplexityModels.includes(model) && !groqModels.includes(model) && !openRouterModels.includes(model)) {
			throw new Error('Invalid model');
		}

		if (groqModels.includes(model)) {
			if (model === 'llama2-70b-4096' && maxTokens > 4096) maxTokens = 4096 - 2500;
			if (model === 'llama3-8b-8192' && maxTokens > 8192) maxTokens = 8192 - 2500;
			if (model === 'llama3-70b-8192' && maxTokens > 8192) maxTokens = 8192 - 2500;
		}

		if (openAIModels.includes(model)) {
			if (model === 'gpt-3.5-turbo-16k' && maxTokens > 16000) maxTokens = 16000;
			if (model === 'gpt-3.5-turbo' && maxTokens > 4096) maxTokens = 4096;
			if (model === 'gpt-4' && maxTokens > 4096) maxTokens = 4096;
			if (model === 'gpt-4-turbo' && maxTokens > 4096) maxTokens = 4096;
			if (model === 'gpt-4-1106-preview' && maxTokens > 4096) maxTokens = 4096;
			if (model === 'gpt-4-turbo-preview' && maxTokens > 4096) maxTokens = 4096;
		}

		if (perplexityModels.includes(model)) {
			if (model === 'sonar-small-chat' && maxTokens > 16384) maxTokens = 16384;
			if (model === 'sonar-small-online' && maxTokens > 12000) maxTokens = 12000;
			if (model === 'sonar-medium-chat' && maxTokens > 16384) maxTokens = 16384;
			if (model === 'sonar-medium-online' && maxTokens > 12000) maxTokens = 12000;
			if (model === 'llama-3-8b-instruct' && maxTokens > 8192) maxTokens = 8192;
			if (model === 'llama-3-70b-instruct' && maxTokens > 8192) maxTokens = 8192;
			if (model === 'codellama-70b-instruct' && maxTokens > 16384) maxTokens = 16384;
			if (model === 'mistral-7b-instruct' && maxTokens > 16384) maxTokens = 16384;
			if (model === 'mixtral-8x7b-instruct' && maxTokens > 16384) maxTokens = 16384;
			if (model === 'mixtral-8x22b-instruct' && maxTokens > 16384) maxTokens = 16384;
			if (model === 'llama-3-sonar-large-32k-online' && maxTokens > 4096) maxTokens = 4096;
			if (model === 'llama-3-sonar-small-32k-online' && maxTokens > 4096) maxTokens = 4096;
		}

		if (openRouterModels.includes(model)) {
			if (model === 'burrito-8x7b' && maxTokens > 16384) maxTokens = 16384;
			if (model === 'google/gemma-2-9b-it:free' && maxTokens > 2046) maxTokens = 2046;
			if (model === 'mistralai/mistral-7b-instruct:free' && maxTokens > 2046) maxTokens = 2046;
			if (model === 'google/gemini-pro' && maxTokens > 2046) maxTokens = 2046;
		}

		let provider;

		if (openAIModels.includes(model)) provider = 'openai';
		if (perplexityModels.includes(model)) provider = 'perplexity';
		if (groqModels.includes(model)) provider = 'groq';
		if (openRouterModels.includes(model)) provider = 'openrouter';

		return {maxTokens, provider};
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
		history = history.map((msg) => {
			return {
				role: msg.type === 'user' ? 'user' : 'assistant',
				content: msg.content,
			};
		})

		let estimate = promptTokensEstimate({
			messages: [
				{'role': 'system', 'content': system || 'You are a helpful assistant.'},
				...history,
				{
					'role': 'user',
					'content': prompt || 'Hello',
				},
			],
		});

		let chunkSize = 250;

		while (estimate > 2500) {
			if (estimate <= 2500) chunkSize = 250;
			if (estimate <= 5000) chunkSize = 500;
			if (estimate > 10000) chunkSize = 5000;
			system = system.substring(0, system.length - chunkSize);

			if (estimate > 2500 && system.length < 1000) {
				if (history.length > 0) {
					if (estimate > 2500 && history[history.length - 1].content.length < 500) {
						prompt = prompt.substring(0, prompt.length - chunkSize);
					}

					history[history.length - 1].content = history[history.length - 1].content.substring(0, history[history.length - 1].content.length - chunkSize);
				} else {
					prompt = prompt.substring(0, prompt.length - chunkSize);
				}
			}
			estimate = promptTokensEstimate({
				messages: [
					{'role': 'system', 'content': system || 'You are a helpful assistant.'},
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

		for (let i = 0; i < history.length; i++) {
			history[i].content = JSON.stringify(history[i].content);
		}

		return {system, history, prompt};
	}

	/**
	 * Sends a chat completion request to an AI model.
	 *
	 * This function constructs a request with the given model, system message, prompt, and conversation history.
	 * It sends the request to the appropriate provider's API and handles the response, including error handling.
	 *
	 * @param {string} model - The model to be used for generating the chat completion.
	 * @param {string} systemMessage - The system message to initialize the conversation context.
	 * @param {string} prompt - The user's prompt to be sent to the AI model.
	 * @param {Array<Object>} [history=[]] - The conversation history as an array of message objects with `role` and `content`.
	 * @param {Array<Object>} [tools=[]] - Optional tools to be included in the request.
	 * @returns {Promise<Object>} - A promise that resolves to the response from the AI model.
	 * @throws {Error} - Throws an error if the API request fails.
	 */
	static async sendChatCompletion(model, systemMessage, prompt, history = [], tools = []) {
		const providerData = AIService.solveModelInfo(model);
		const providerUrl = AIService.solveProviderUrl(providerData.provider);
		const auth = AIService.solveProviderAuth(providerData.provider);

		const messages = [
			{role: 'system', content: systemMessage},
			...history,
			{role: 'user', content: prompt || 'Hello'},
		];

		const adjustedHistory = AIService.adjustHistory(systemMessage, messages, prompt);

		const requestBody = {
			model,
			messages: adjustedHistory.history,
			temperature: 0.5,
			max_tokens: providerData.maxTokens,
			top_p: 1,
			frequency_penalty: 0,
			presence_penalty: 0,
			stream: false,
		};

		if (tools.length > 0) {
			requestBody.tools = tools;
		}

		const requestOptions = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${auth}`,
			},
			body: JSON.stringify(requestBody),
		};

		try {
			const response = await fetch(providerUrl, requestOptions);
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


	/**
	 * Performs a Retrieval-Augmented Generation (RAG) search using the specified query.
	 *
	 * This function conducts a search using the ExaService with a specified query and type.
	 * If the type is 'deep', it retrieves more results. The function concatenates the text from
	 * all the search results into a single string, which is returned along with the original search response.
	 *
	 * @param {string} query - The search query to be used.
	 * @param {string} [type='normal'] - The type of search to perform. Options are 'normal' or 'deep'. 'deep' retrieves more results.
	 * @returns {Promise<Object>} - A promise that resolves to an object containing the search sources and the concatenated text context.
	 */
	static async RAGSearch(query, type = 'normal') {
		let numResults = 10;
		if (type === 'deep') {
			numResults = 30;
		}
		const response = await ExaService.search(query, {
			type: 'neural',
			useAutoprompt: true,
			numResults: 10,
			contents: {
				text: true,
			},
		});

		let textConcatenated = '';
		for (const result of response.results) {
			textConcatenated += result.text + ' ';
		}
		return {sources: response, context: textConcatenated};
	}


	/**
	 * Validates the configuration for web search in a specific chat.
	 *
	 * This function checks whether the given chat ID exists and whether web search is enabled in the chat's metadata.
	 * If the chat ID is not provided or the chat cannot be found, it throws an error.
	 *
	 * @param {string} idChat - The unique identifier of the chat to validate.
	 * @returns {Promise<Object>} - A promise that resolves to an object containing the web search configuration and the chat details.
	 * @throws {Error} - Throws an error if the chat ID is not provided or if the chat is not found.
	 */
	static async validateChatWebSearchConfig(idChat) {
		if (!idChat) {
			throw new Error('Chat not found');
		}
		const chat = await prisma.chat.findUnique({
			where: {id: idChat},
		});
		if (!chat) {
			throw new Error('Chat not found');
		}
		return {webSearch: chat?.metas?.webSearch?.enabled, chat: chat};
	}


	/**
	 * Creates a search query based on the user's prompt and conversation history.
	 *
	 * This function analyzes the conversation history and the user's prompt to generate an optimized search query
	 * for web searches. It first checks if a web search is necessary and then creates a search query of less than 13 words.
	 *
	 * @param {Array} history - The conversation history to be sent to the AI service.
	 * @param {string} prompt - The user's question or prompt that needs to be analyzed.
	 * @param {string} [model='burrito-8x7b'] - The model to be used for the AI service (default is 'burrito-8x7b').
	 * @returns {Promise<string>} - A promise that resolves to the generated search query or an empty string if a web search is not needed.
	 */
	static async createSearchQuery(history, prompt, model = 'burrito-8x7b') {
		const historyAdjusted = history.map((msg) => {
			return {
				role: msg.role,
				content: msg.content,
			};
		});

		const checkAndAdjustHistory = AIService.adjustHistory(
			'Your only output is a search query for web with less than 13 words. Analyze the conversation and create as the only output an optimized big search query based on what the user is asking',
			historyAdjusted,
			prompt + "\n\n\n search query is:"
		);

		let webSearchNeeded;
		try {
			let webSearchNeededResult = await AIService.checkIfWebSearchNeeded(historyAdjusted, prompt, model);
			if (webSearchNeededResult.includes('1') || webSearchNeededResult.includes('True') || webSearchNeededResult.includes('true')) {
				webSearchNeeded = true;
			} else {
				webSearchNeeded = false;
			}
		} catch (e) {
			console.log("ERROR: ", e);
		}

		if (!webSearchNeeded) {
			return "";
		}

		const messages = [
			{role: 'system', content: checkAndAdjustHistory.system},
			...checkAndAdjustHistory.history,
			{role: 'user', content: checkAndAdjustHistory.prompt},
		];

		const response = await AIService.sendChatCompletion(
			model,
			checkAndAdjustHistory.system,
			checkAndAdjustHistory.prompt,
			checkAndAdjustHistory.history,
		);
		return response.choices[0].message.content;
	}


	/**
	 * Checks if a web search is needed based on the user's prompt.
	 *
	 * This function analyzes the user's question and determines whether data retrieval from the web is required.
	 * It sends the prompt and history to the AI service with a system directive to produce an appropriate response,
	 * which can be "1", "true", "True", or "0", "false", "False".
	 *
	 * @param {Array} history - The conversation history to be sent to the AI service.
	 * @param {string} prompt - The user's question or prompt that needs to be analyzed.
	 * @param {string} model - The model to be used for the AI service (e.g., "gpt-4").
	 * @returns {Promise<string>} - A promise that resolves to the AI's response, indicating whether a web search is needed.
	 */
	static async checkIfWebSearchNeeded(history, prompt, model) {
		const system = 'You are a machine that can output 1, true, True or 0, false, False. Analyze the users question and determine the correct output if it needs data retrieved from the web.';
		const response = await AIService.sendChatCompletion(
			model,
			system,
			prompt + "\n\n\ WebSearchNeeded: ",
			history,
		);
		return response.choices[0].message.content;
	}


	static async createImage(prompt, idUser) {
		const input = {
			prompt,
			disable_safety_checker: true,
			output_format: 'jpg',
		};

		const output = await replicate.run('black-forest-labs/flux-schnell', { input });
		const url = output[0];

		// create image in database
		return await prisma.image.create({
			data: {
				prompt,
				url,
				idUser,
			},
		});
	}
}

export default AIService;
