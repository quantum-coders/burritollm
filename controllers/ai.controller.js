import 'dotenv/config';
import axios from 'axios';
import { promptTokensEstimate } from 'openai-chat-tokens';
import { getRouter } from '@thewebchimp/primate';
// creation
const openaiAPIKey = process.env.OPENAI_API_KEY;
const perplexityAPIKey = process.env.PERPLEXITY_API_KEY;
const groqAPIKey = process.env.GROQ_API_KEY;
const openRouterApiKey = process.env.OPEN_ROUTER_KEY;

class AIController {
	static async sendMessage(req, res) {
		let { model, system, prompt, stream, history, mode } = req.body;

		if(typeof stream === 'undefined') stream = true;
		if(typeof history === 'undefined') history = [];
		if(typeof system === 'undefined') system = 'You are a helpful assistant.';
		if(typeof model === 'undefined') model = 'gpt-3.5-turbo-16k';

		system = JSON.stringify(system);
		for(let i = 0; i < history.length; i++) {
			history[i].content = JSON.stringify(history[i].content);
		}
		prompt = JSON.stringify(prompt);

		const body = req.body;

		const temperature = body.temperature || 0.5;
		let maxTokens = body.maxTokens || 1024;
		const topP = body.topP || 1;
		const frequencyPenalty = body.frequencyPenalty || 0.0001;
		const presencePenalty = body.presencePenalty || 0;

		const stop = body.stop || '';

		if(typeof stream === 'undefined') stream = true;
		if(typeof history === 'undefined') history = [];

		const openAIModels = [
			'ag1',
			'gpt-3.5-turbo-16k',
			'gpt-3.5-turbo',
			'gpt-4',
			'gpt-4-turbo',
			'gpt-4-1106-preview',
			'gpt-4-turbo-preview',

		];

		const perplexityModels = [
			'mistral-7b-instruct',
			'mixtral-8x7b-instruct',
			'llama-2-13b-chat',
			'llama-2-70b-chat',
			'codellama-70b-instruct',
			'pplx-70b-online',
			'sonar-small-chat',
			'sonar-small-online',
			'sonar-medium-chat',
			'sonar-medium-online',
			'llama-3-sonar-large-32k-online',
			'llama-3-sonar-small-32k-online',
		];

		const groqModels = [
			'llama2-70b-4096',
			'mixtral-8x7b-32768',
			'gemma-7b-it',
			'llama3-8b-8192',
			'llama3-70b-8192',
		];

		const ollamaModels = [
			'dolphincoder',
		];

		const openRouterModels = [
			'cognitivecomputations/dolphin-mixtral-8x7b',
			'burrito-8x7b',
		];

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
			if(model === 'ag1' && maxTokens > 16000) maxTokens = 16000;
		}
		if(perplexityModels.includes(model)) {
			console.log('Perplexity Model....maxTokens: ', maxTokens);
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
			console.log('MaxkTokens modified: ', maxTokens);
		}
		if(ollamaModels.includes(model)) {
			if(model === 'dolphincoder' && maxTokens > 4096) maxTokens = 1024;
		}
		if(openRouterModels.includes(model)) {
			if(model === 'burrito-8x7b' && maxTokens > 16384) maxTokens = 16384;
		}
		// check that model is in openAIModels or perplexityModels
		if(!openAIModels.includes(model) && !perplexityModels.includes(model)
			&& !groqModels.includes(model) && !ollamaModels.includes(model)
			&& !openRouterModels.includes(model)
		) {
			res.respond({
				status: 400,
				message: 'Model not supported',
			});
		}

		// if prompt is empty, return error
		if(!prompt) {
			res.respond({
				status: 400,
				message: 'No prompt provided',
			});
			return;
		}

		// check the provider based on the model
		let provider;

		if(openAIModels.includes(model)) provider = 'openai';
		if(perplexityModels.includes(model)) provider = 'perplexity';
		if(groqModels.includes(model)) provider = 'groq';
		if(ollamaModels.includes(model)) provider = 'ollama';
		if(openRouterModels.includes(model)) provider = 'openrouter';

		try {
			let response;

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

			console.log('Estimado inicial de tokens: ', estimate);

			let chunkSize = 250;
			while(estimate > 2500) {
				/// si el estimado sigue siendo mayor y el system ya tiene solo mil chars entonces reduce el prompt

				console.log('{1} Reducing....');
				console.log(system);
				if(estimate <= 2500) chunkSize = 250;
				if(estimate <= 5000) chunkSize = 500;
				if(estimate > 10000) chunkSize = 50000;
				system = system.substring(0, system.length - chunkSize);
				/// if estimate es menor que 3000 quitale ahora chunkSize al prompt
				if(estimate > 2500 && system.length < 1000) {
					console.log('Reducing history if exists');
					if(history.length > 0) {
						if(estimate > 2500 && history[history.length - 1].content.length < 500) {
							prompt = prompt.substring(0, prompt.length - chunkSize);
						}
						/// si aun asi el estimate es mayor que 2800 entonces reduce el prompt
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
				console.log('{2} Reducing....');
				console.log(estimate);
				console.log(system);
			}

			// utf 8 encode system
			system = JSON.stringify(system);
			if(provider === 'openai' && model === 'gpt-4-1106-preview' && mode === 'json') {
				body.response_format = { 'type': 'json_object' };
			}
			console.log('Data debug asgfasdfa: ');
			console.log(`
				{
				
					model: ${ model },
					messages: [
						{ 'role': 'system', 'content': ${ system } },
						${
				history.map((item) => {
					return `{ 'role': 'user', 'content': ${ item.content } },`;
				}).join('\n')
			}			
						{
							'role': 'user',
							'content': ${ prompt },
						},
					],
					temperature: ${ temperature },
					max_tokens: ${ maxTokens },
					top_p: ${ topP },
					frequency_penalty: ${ frequencyPenalty },
					presence_penalty: ${ presencePenalty },
					stream: ${ stream },
					
				}
			`);

			console.log('Provider: ', provider);
			if(provider === 'openai') {

				if(model === 'ag1') model = 'gpt-3.5-turbo-16k';

				const data = {
					model,
					messages: [
						{ 'role': 'system', 'content': system || 'You are a helpful assistant.' },
						...history,
						{
							'role': 'user',
							'content': prompt || 'Hello',
						},
					],
					temperature: temperature,
					max_tokens: maxTokens,
					top_p: topP,
					frequency_penalty: frequencyPenalty,
					presence_penalty: presencePenalty,
					stream,
				};

				if(stop) data.stop = stop;

				// Configurar la solicitud para streaming
				response = await axios.post('https://api.openai.com/v1/chat/completions', data, {
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${ openaiAPIKey }`,
					},
					responseType: 'stream',
				});
				res.writeHead(response.status, response.headers);
				response.data.pipe(res);
			}

			if(provider === 'perplexity') {

				// Configurar la solicitud para streaming
				response = await axios.post('https://api.perplexity.ai/chat/completions', {
					model,
					messages: [
						{ 'role': 'system', 'content': system || 'You are a helpful assistant.' },
						...history,
						{
							'role': 'user',
							'content': prompt || 'Hello',
						},
					],
					temperature: temperature,
					max_tokens: maxTokens,
					top_p: topP,
					frequency_penalty: frequencyPenalty,
					presence_penalty: presencePenalty,
					stream,
				}, {
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						Authorization: `Bearer ${ perplexityAPIKey }`,
					},
					responseType: 'stream',
				});

				/*				res.writeHead(response.status, response.headers);
								response.data.pipe(res);*/

				response.data.on('error', err => {
					console.error('Error while streaming the response:', err);
					res.status(500).send('Error while processing the stream');
				});

				res.writeHead(response.status, response.headers);
				response.data.pipe(res).on('error', err => {
					console.error('Error while writing the stream to the client:', err);
					res.end();
				});
			}

			if(provider === 'groq') {

				// Configurar la solicitud para streaming
				response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
					model,
					messages: [
						{ 'role': 'system', 'content': system || 'You are a helpful assistant.' },
						...history,
						{
							'role': 'user',
							'content': prompt || 'Hello',
						},
					],
					temperature: temperature,
					max_tokens: maxTokens,
					top_p: topP,
					frequency_penalty: frequencyPenalty,
					presence_penalty: presencePenalty,
					stream,
				}, {
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						Authorization: `Bearer ${ groqAPIKey }`,
					},
					responseType: 'stream',
				});

				res.writeHead(response.status, response.headers);
				response.data.pipe(res);
			}

			if(provider === 'openrouter') {
				console.log('[----------OpenRouter----------]');
				if(model === 'burrito-8x7b') model = 'cognitivecomputations/dolphin-mixtral-8x7b';
				// Configurar la solicitud para streaming
				response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
					model,
					messages: [
						{
							'role': 'system',
							'content': system || 'You are a helpful uncensored assistant that will always answer whatever the user asks you.',
						},
						...history,
						{
							'role': 'user',
							'content': prompt || 'Hello',
						},
					],
					temperature: temperature,
					max_tokens: maxTokens,
					top_p: topP,
					frequency_penalty: frequencyPenalty,
					presence_penalty: presencePenalty,
					stream,
				}, {
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						Authorization: `Bearer ${ openRouterApiKey }`,
					},
					responseType: 'stream',
				});

				res.writeHead(response.status, response.headers);
				response.data.pipe(res);
			}

		} catch(error) {

			console.log('Super error ');
			console.log(error);

			if(error.response) {
				console.log('[ERRRROOOR]');

				/// get the error exactly
				console.log(error.response.data);

				// Enviar una respuesta detallada al cliente
				res.respond({
					status: error.response.status,
					message: 'Error to process the request' + error,
					errorData: error.response.data,
				});
			} else if(error.request) {
				console.log(error.request);
				res.respond({
					status: 500,
					message: 'No answer from the server',
				});
			} else {
				// Algo más causó un error
				console.log('Error', error);
				res.respond({
					status: 500,
					message: 'Error to process the request' + error,
				});
			}
		}
	}

}

export default AIController;