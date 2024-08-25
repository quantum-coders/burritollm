import {jwt, PrimateController, PrimateService, prisma} from '@thewebchimp/primate';
import AiService from '../../services/ai.service.js';
import ChatService from './chat.service.js';

class ChatController extends PrimateController {

	/**
	 * Retrieves and calculates the total token usage and cost for a specific chat.
	 *
	 * This function finds a chat by its unique identifier (UID), includes related messages and their associated model usages,
	 * and then calculates the total cost and total tokens used across all messages. The results are sent back in the response.
	 * If the chat is not found, it responds with a 404 error. Any other errors are passed to the error handling middleware.
	 *
	 * @param {Object} req - The request object, containing parameters such as the chat UID.
	 * @param {Object} res - The response object, used to send back the total cost and tokens used, or an error message.
	 * @param {Function} next - The next middleware function in the stack, used for error handling.
	 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
	 */
	static async getTokensUsage(req, res, next) {
		const uidChat = req.params.uid;

		try {
			const chat = await prisma.chat.findUnique({
				where: {uid: uidChat},
				include: {
					messages: {
						include: {
							modelUsages: true,
						},
					},
				},
			});

			if (!chat) {
				return res.respond({
					status: 404,
					message: 'Chat not found',
				});
			}

			const totalCost = chat.messages.reduce((acc, message) => {
				return acc + message.modelUsages.reduce((msgAcc, usage) => msgAcc + parseFloat(usage.cost), 0);
			}, 0);

			const tokensUsed = chat.messages.reduce((acc, message) => {
				return acc + message.modelUsages.reduce((msgAcc, usage) => msgAcc + parseFloat(usage.tokensUsed), 0);
			}, 0);

			res.respond({
				data: {
					totalCost,
					tokensUsed,
				},
			});
		} catch (error) {
			next(error); // Pass the error to your error handling middleware
		}
	}

	/**
	 * Generates a name for a chat based on its messages.
	 *
	 * This function attempts to generate a short, descriptive title with an emoji for a chat if it doesn't already have a name or is named "New Chat".
	 * It retrieves the first few messages from the chat, sends them to an AI service to generate a title, and updates the chat with this new name.
	 * If successful, it responds with the updated chat data; otherwise, it handles errors and responds with an appropriate message.
	 *
	 * @param {Object} req - The request object, containing the user and parameters.
	 * @param {Object} res - The response object, used to send back the result or error.
	 * @param {Function} next - The next middleware function in the stack.
	 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
	 */
	static async generateChatName(req, res, next) {
		const idUser = req.user.payload.id;
		const {uid} = req.params;
		try {
			const chat = await PrimateService.findBy({idUser, uid}, 'chat');
			if (!chat) {
				console.error('Chat not found');
				throw new Error('Chat not found');
			}
			if (!chat.name || chat.name === 'New Chat') {
				const getAllMessages = await prisma.message.findMany({
					where: {
						idChat: chat.id,
					},
					select: {
						type: true,
						content: true,
					},
					take: 3,
				});

				// Concatenate all messages into a string like "User: message, AI: message, User: message..."
				const concatenatedMessages = getAllMessages.map(message => {
					return message.type === 'user' ? `User: ${message.content}` : `AI: ${message.content}`;
				}).join(', ');

				const systemPrompt = `You can only do one task, generate as the only output, a short title with emoji for this chat. Here are the messages so far: ${concatenatedMessages}.`;

				const generatedName = await AiService.sendChatCompletion(
					'neversleep/llama-3-lumimaid-8b',
					systemPrompt,
					'Title is:',
				);

				const name = generatedName.choices[0].message.content
					.replace(/"/g, '')
					.replace(/(\r\n|\n|\r)/gm, '');

				chat.name = name;

				await prisma.chat.update({
					where: {
						id: chat.id,
					},
					data: {
						name: chat.name,
					},
				});

				return res.respond({
					data: chat,
					message: 'Chat name generated',
				});
			}
		} catch (e) {
			console.log('Error: ', e);
			return res.respond({
				status: 400,
				message: 'Error generating chat name: ' + e.message,
			});
		}
	}

	/**
	 * Handles the download of a chat by generating a file in the requested format.
	 *
	 * This function retrieves the user's chat data, prepares it for download in the specified format (e.g., 'txt'),
	 * and sends the file as a response. If an error occurs, it sends an error response.
	 *
	 * @param {Object} req - The request object, containing user information and parameters.
	 * @param {Object} res - The response object, used to send the file or an error message.
	 * @param {Function} next - The next middleware function in the stack.
	 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
	 */
	static async downloadChat(req, res, next) {
		const idUser = req.user.payload.id;
		const {uid} = req.params;
		const type = req.query.type || 'txt'; // Assuming the type is passed as a query parameter

		try {
			const {filename, content, contentType} = await ChatService.prepareDownload(idUser, uid, type);

			res.setHeader('Content-disposition', `attachment; filename*=UTF-8''${filename}`);
			res.setHeader('Content-type', contentType);
			res.charset = 'UTF-8';
			res.write(content);
			res.end();
		} catch (e) {
			return res.respond({
				status: 400,
				message: 'Error downloading chat: ' + e.message,
			});
		}
	}

}

export default ChatController;
