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


	static async createSearchQuery(history, prompt, modelId) {
		const model = await prisma.aIModel.findUnique({
			where: {id: parseInt(modelId)},
		});

		if (!model || model.modelType !== 'chat') {
			console.error('Modelo no encontrado o no es de tipo chat:', modelId);
			return '';
		}

		const systemPrompt = `Given the conversation history and the user's last query, create a single search query to retrieve relevant information from a search engine.
        The query should focus on extracting key information needed to answer the user's query effectively.
        Do not add any additional text or explanation, only the search query is required.`;

		const messages = [
			{role: 'system', content: systemPrompt},
			...history.map(h => ({role: h.role, content: h.content})),
			{role: 'user', content: prompt},
		];

		try {
			const data = {
				model: model.openrouterId, // Usar el openrouterId del modelo
				messages,
				temperature: 0.7,
				max_tokens: 60,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
				stream: false,
			};

			const response = await axios.post(process.env.OPENROUTER_BASE_URL + '/chat/completions', data, {
				headers: {
					'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
					'Content-Type': 'application/json',
				},
			});

			if (response.data && response.data.choices && response.data.choices.length > 0) {
				return response.data.choices[0].message.content.trim();
			} else {
				console.error('Respuesta inesperada de la API:', response.data);
				return '';
			}
		} catch (error) {
			console.error('Error en createSearchQuery:', error);
			return '';
		}
	}

	// Modificar RAGSearch para usar modelos de la BD
	static async RAGSearch(query, searchType = 'normal') {
		try {
			const response = await axios.post(`${process.env.RAG_BASE_URL}`, {
				query,
				searchType,
			});

			if (response.status === 200 && response.data) {
				return response.data;
			} else {
				console.error('Error en la respuesta de RAGSearch:', response);
				return {context: ''};
			}
		} catch (error) {
			console.error('Error en RAGSearch:', error);
			return {context: ''};
		}
	}

	// Función para estimar tokens
	static estimateTokens(messages) {
		let totalTokens = 0;
		for (const message of messages) {
			if (typeof message.content === 'string') {
				totalTokens += message.content.split(/\s+/).length;
			}
		}
		return totalTokens;
	}

	// Modificar adjustContent para usar contextLength de la BD
	static async adjustContent(system, history, prompt, contextWindow) {
		if (!contextWindow) {
			console.error('Longitud del contexto no especificada.');
			return {system, history, prompt};
		}
		const promptTokens = this.estimateTokens([{content: prompt}]);

		// Calcula maxOutputTokens como el 80% del contextWindow,
		// o la diferencia entre contextWindow y promptTokens, lo que sea menor.
		// Asegura que maxOutputTokens nunca sea negativo.
		const maxOutputTokens = Math.max(0, Math.min(Math.floor(contextWindow * 0.8), contextWindow - promptTokens));

		const safetyMargin = 50; // Un margen de seguridad
		let availableTokens = contextWindow - promptTokens - maxOutputTokens - safetyMargin;

		console.log(`Tokens disponibles para el historial y el sistema: ${availableTokens}`);
		console.log(`Tokens estimados para el prompt: ${promptTokens}`);
		console.log(`Tokens maximos para la salida: ${maxOutputTokens}`);

		// Primero, reducir el system si es necesario
		if (this.estimateTokens([{content: system}]) > availableTokens * 0.6) {
			console.log("Reduciendo system...");
			while (this.estimateTokens([{content: system}]) > availableTokens * 0.6 && system.length > 0) {
				system = system.substring(0, system.length - 50); // Reducir de 50 en 50 caracteres
			}
			console.log(`System reducido a ${this.estimateTokens([{content: system}])} tokens`);
			availableTokens -= this.estimateTokens([{content: system}]);
		} else {
			availableTokens -= this.estimateTokens([{content: system}]);
		}

		console.log(`Tokens disponibles para el historial después de ajustar el system: ${availableTokens}`);

		let adjustedHistory = [];
		for (let i = history.length - 1; i >= 0; i--) {
			const message = history[i];
			const messageTokens = this.estimateTokens([message]);

			if (messageTokens <= availableTokens) {
				adjustedHistory.unshift(message);
				availableTokens -= messageTokens;
			} else {
				console.log(`Mensaje ${i} omitido por falta de tokens`);
			}
		}

		console.log(`Historial ajustado a ${this.estimateTokens(adjustedHistory)} tokens`);

		return {system, history: adjustedHistory, prompt};
	}


	// Modificar validateChatWebSearchConfig para obtener la configuración de la base de datos
	static async validateChatWebSearchConfig(idChat) {
		const chat = await prisma.chat.findUnique({
			where: {id: parseInt(idChat)},
			include: {selectedModel: true},
		});

		if (!chat) {
			console.error('Chat no encontrado:', idChat);
			return {webSearch: false};
		}

		const webSearchEnabled = chat.metas?.webSearch?.enabled || false;
		const chatModel = chat.selectedModel?.openrouterId || 'neversleep/llama-3-lumimaid-8b';

		return {webSearch: webSearchEnabled, chat, chatModel};
	}
}

export default AIService;
