import 'dotenv/config';
import axios from 'axios';
import {promptTokensEstimate} from 'openai-chat-tokens';
import {groqModels, openAIModels, openRouterModels, perplexityModels} from '../assets/data/ai-models.js';
import ExaService from "./exa.service.js";
import {prisma} from "@thewebchimp/primate";
import Replicate from 'replicate';

const {OPEN_ROUTER_KEY} = process.env;
const replicate = new Replicate();

class AIService {
	/**
	 * Sends a message to the AI model and streams the response back to the client.
	 *
	 * @param {Object} data - The data to send to the AI model.
	 * @param {string} provider - The provider of the AI model.
	 * @param  {AbortSignal} signal - The signal to cancel the request.
	 * @returns {Promise<Object>} - A promise that resolves to the response from the AI model.
	 * @throws {Error} - Throws an error if there is an issue with the request or the response.
	 */
	static async sendMessage(data, provider, signal) {
		const bearerToken = AIService.solveProviderAuth(provider);
		const url = AIService.solveProviderUrl(provider);

		/// console info the payload of the request
		console.info('Request payload:', data);
		return await axios.post(url, data, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${bearerToken}`,
			},
			signal,
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

	static estimateTokens(messages) {
		return promptTokensEstimate({messages});
	}

	static adjustContent(system, history, prompt, contextWindow, reservedTokens = 100) {
		const targetTokens = contextWindow - reservedTokens;
		let currentTokens = this.estimateTokens([
			{role: 'system', content: system},
			...history,
			{role: 'user', content: prompt}
		]);

		console.info(`Starting adjustContent: currentTokens=${currentTokens}, targetTokens=${targetTokens}`);

		let iteration = 0;
		const maxIterations = 100; // Establecemos un máximo de iteraciones para evitar bucles infinitos

		while (currentTokens > targetTokens) {
			iteration++;
			if (iteration > maxIterations) {
				console.error('adjustContent: Max iterations reached, exiting loop to prevent infinite loop.');
				break;
			}

			const tokensOver = currentTokens - targetTokens;
			console.info(`Iteration ${iteration}: currentTokens=${currentTokens}, tokensOver=${tokensOver}, history length=${history.length}, system length=${system.length}, prompt length=${prompt.length}`);

			// Calculamos el chunkSize dinámicamente
			let chunkSize = Math.ceil(tokensOver * 0.5); // Tomamos el 50% de los tokens sobrantes como chunkSize

			// Convertimos chunkSize a número de caracteres aproximado (asumiendo que un token es aproximadamente 4 caracteres)
			const approxCharsPerToken = 4;
			const charsToRemove = chunkSize * approxCharsPerToken;

			if (history.length > 1) {
				// Remove the oldest message from history
				const removedMessage = history.shift();
				console.info(`Removed oldest message from history: ${JSON.stringify(removedMessage)}`);
			} else if (system.length > 50) {
				// Trim the system message
				const trimLength = Math.min(charsToRemove, system.length - 50);
				console.info(`Trimming system message by ${trimLength} characters.`);
				system = system.slice(0, -trimLength);
			} else if (prompt.length > 50) {
				// Trim the prompt as a last resort
				const trimLength = Math.min(charsToRemove, prompt.length - 50);
				console.info(`Trimming prompt by ${trimLength} characters.`);
				prompt = prompt.slice(0, -trimLength);
			} else {
				console.info('Cannot reduce content further, breaking the loop.');
				break; // Can't reduce further
			}

			// Recalculamos los tokens actuales después de los ajustes
			currentTokens = this.estimateTokens([
				{role: 'system', content: system},
				...history,
				{role: 'user', content: prompt}
			]);

			console.info(`After adjustment: currentTokens=${currentTokens}`);
		}

		console.info(`Finished adjustContent: currentTokens=${currentTokens}, targetTokens=${targetTokens}`);

		return {system, history, prompt};
	}


	/**
	 * Retrieves model information including the provider and maximum tokens.
	 *
	 * @param {string} model - The name of the model.
	 * @returns {Object} - An object containing the provider and maximum tokens for the model.
	 * @throws {Error} - Throws an error if the model is not recognized.
	 */
	static solveModelInfo(model) {
		const allModels = [...openAIModels, ...perplexityModels, ...groqModels, ...openRouterModels];
		const modelInfo = allModels.find(m => m.name === model);

		if (!modelInfo) {
			throw new Error(`Model info not found for ${model}`);
		}

		let provider, authToken;

		if (openAIModels.some(m => m.name === model)) {
			provider = 'openai';
			authToken = process.env.OPENAI_API_KEY;
		} else if (perplexityModels.some(m => m.name === model)) {
			provider = 'perplexity';
			authToken = process.env.PERPLEXITY_API_KEY;
		} else if (groqModels.some(m => m.name === model)) {
			provider = 'groq';
			authToken = process.env.GROQ_API_KEY;
		} else if (openRouterModels.some(m => m.name === model)) {
			provider = 'openrouter';
			authToken = process.env.OPEN_ROUTER_KEY;

		} else {
			throw new Error(`Provider not found for model: ${model}`);
		}

		if (!authToken) {
			throw new Error(`Auth token not found for provider: ${provider}`);
		}

		// Use the contextWindow from the modelInfo, or set a default if not specified
		const contextWindow = modelInfo.contextWindow || 4096;  // Default to 4096 if not specified

		return {
			...modelInfo,
			provider,
			authToken,
			contextWindow
		};
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
	 * It adjusts the content to fit within the model's context window using `adjustContent`.
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

		// Ajustar el contenido utilizando adjustContent
		const adjustedContent = AIService.adjustContent(
			systemMessage,
			history,
			prompt,
			providerData.contextWindow
		);

		const messages = [
			{role: 'system', content: adjustedContent.system},
			...adjustedContent.history,
			{role: 'user', content: adjustedContent.prompt || 'Hello'},
		];

		const requestBody = {
			model,
			messages: messages,
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
			console.info("------------------------------------------>BODY: ", JSON.stringify(requestBody));
			const response = await fetch(providerUrl, requestOptions);
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					`API request failed with status ${response.status}: ${JSON.stringify(errorData)}`
				);
			}
			console.info('Response:', response);
			return await response.json();
		} catch (error) {
			console.error('Error in sendChatCompletion:', error);
			throw error;
		}
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

		const systemMessage = 'Your only output is a search query for web with less than 13 words. Analyze the conversation and create as the only output an optimized big search query based on what the user is asking';

		// Obtener información del modelo
		const providerData = AIService.solveModelInfo(model);

		// Ajustar el contenido utilizando adjustContent
		const adjustedContent = AIService.adjustContent(
			systemMessage,
			historyAdjusted,
			prompt + "\n\n\n search query is:",
			providerData.contextWindow
		);

		// Verificar si se necesita búsqueda web
		let webSearchNeeded;
		try {
			let webSearchNeededResult = await AIService.checkIfWebSearchNeeded(historyAdjusted, prompt, 'gpt-4');
			console.info("Web search needed result: ", webSearchNeededResult);
			if (
				webSearchNeededResult.includes('1') ||
				webSearchNeededResult.includes('True') ||
				webSearchNeededResult.includes('true')
			) {
				webSearchNeeded = true;
			} else {
				webSearchNeeded = false;
			}
		} catch (e) {
			console.log("ERROR: ", e);
		}

		if (!webSearchNeeded) {
			console.info("-------------------------> NO WEB SEARCH NEEDED");
			return "";
		}

		const response = await AIService.sendChatCompletion(
			model,
			adjustedContent.system,
			adjustedContent.prompt,
			adjustedContent.history
		);
		return response.choices[0].message.content;
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
		const startPublishedDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString();
		const endPublishedDate = new Date().toISOString();
		console.info('Fecha de inicio:', startPublishedDate);
		console.info('Fecha de fin:', endPublishedDate);
		const response = await ExaService.search(query, {
			type: 'neural',
			startPublishedDate,
			endPublishedDate,
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
		console.info('Web search needed response:', response.choices[0].message.content);
		return response.choices[0].message.content;
	}

	static async createImage(prompt, idUser) {
		const input = {
			prompt,
			disable_safety_checker: true,
			output_format: 'jpg',
		};

		const output = await replicate.run('black-forest-labs/flux-schnell', {input});
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
