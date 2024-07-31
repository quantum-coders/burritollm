import createError from 'http-errors';
import queryString from 'query-string';
import axios from 'axios';
import UserService from './user.service.js';
import { jwt, PrimateController, PrimateService, prisma } from '@thewebchimp/primate';

class UserController extends PrimateController {

	static async getChats(req, res, next) {
		try {
			const idUser = req.user.payload.id;

			console.log('[GETCHATS: ], ', idUser);
			const chats = await prisma.chat.findMany({
				where: { idUser },
				select: {
					id: true,
					name: true,
					uid: true,
					description: true,
					idUser: true,
					system: true,
					status: true,
					created: true,
					user: {
						select: {
							wallet: true,
						},
					},
					messages: {
						orderBy: {
							modified: 'desc',
						},
						take: 1,
						select: {
							modified: true,
						},
					},
					_count: {
						select: {
							messages: true,
						},
					},
				},
			});
			console.log(chats);
			// if there is only one chat it is an object so convert to array
			const chatsArray = Array.isArray(chats) ? chats : [ chats ];
			const formattedChats = chatsArray.map(chat => ({
				...chat,
				userName: chat.user.name,
				modified: chat.messages[0]?.modified || chat.modified,
				user: undefined,
				messages: undefined,
				wallet: chat.user.wallet,
			}));

			return res.respond({
				data: formattedChats,
				message: 'Chats found',
			});

		} catch(e) {
			next(createError(404, e.message));
		}
	}

	static async authenticate(req, res, next) {
		try {
			const { wallet } = req.body;
			let message = 'User authenticated successfully';

			// check for valid wallet address with regex
			if(!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
				return res.respond({
					status: 400,
					message: 'Error: Invalid wallet address',
				});
			}

			let user = await UserService.findByWallet(wallet);

			if(!user) {
				user = await UserService.create({
					wallet,
					login: wallet,
					type: 'User',
					status: 'Active',
				});

				message = 'User created successfully';
			}

			// Firmar un JWT para el usuario
			const token = await jwt.signAccessToken(user);

			return res.respond({
				data: user,
				props: { token },
				message,
			});
		} catch(e) {

			console.log(e);

			return res.respond({
				status: 400,
				message: 'Error creating user: ' + e.message,
			});
		}
	};

	static async me(req, res, next) {
		try {
			// Get user from req
			const signedUser = req.user.payload;
			console.log('SIGNED USER: ', signedUser);

			const user = await UserService.findById(signedUser.id);
			console.log('USER: ', user);

			if(user) {
				const balance = await prisma.userBalance.findFirst({
					where: {
						idUser: user.id,
					},
				});

				// si no tiene balance y no tiene ningun registro en la tabla de balance crea una entrada y ponle de balance 5.00 usd
				if(!balance) {
					await prisma.userBalance.create({
						data: {
							idUser: user.id,
							balance: 5.00,
						},
					});
				}
				// delete password
				delete user.password;
				/// add the balance to the user object
				user.balance = balance ? balance.balance : 0.00;
				// parse float
				user.balance = parseFloat(user.balance);
				res.respond({
					data: user,
					message: 'User found',
				});
			}
		} catch(e) {
			next(createError(404, e.message));
		}
	};

	static async createChat(req, res, next) {
		try {

			const idUser = req.user.payload.id;

			console.log('IDUSER: ', idUser);
			const data = await UserService.createChat(idUser);

			return res.respond({
				data,
				message: 'Chat created successfully',
			});

		} catch(e) {
			next(createError(404, e.message));
		}
	}

	static async createChatMessage(req, res, next) {
		try {
			const { uid } = req.params;
			const idUser = req.user.payload.id;
			const { message } = req.body;
			const { type } = req.body;

			console.log(uid, idUser, message);

			const chat = await PrimateService.findBy({ idUser, uid }, 'chat');
			console.log(chat);

			if(!chat) {
				return res.respond({
					status: 404,
					message: 'Chat not found',
				});
			}

			const data = {
				idChat: chat.id,
				idUser,
				content: message,
			};

			if(type) {
				data.type = type;
			}

			const chatMessage = await PrimateService.create(data, 'message');

			return res.respond({
				data: chatMessage,
				message: 'Chat message created successfully',
			});

		} catch(e) {
			next(createError(404, e.message));
		}
	}

	static async getChat(req, res, next) {
		try {
			const { uid } = req.params;
			const idUser = req.user.payload.id;

			const chat = await prisma.chat.findFirst({
				where: {
					idUser: idUser,
					uid: uid,
				},
				include: {
					messages: true,
					user: {
						select: {
							wallet: true,
						},
					},
					_count: {
						select: {
							messages: true,
						},
					},
				},
			});

			// if metas is empty define {}
			if(!chat.metas) {
				chat.metas = {};
			}
			if(!chat) {
				return res.respond({
					status: 404,
					message: 'Chat not found',
				});
			}

			const messageStatistics = {
				count: chat._count.messages,
				created: chat.created,
				modified: chat.messages.length > 0
					? chat.messages.reduce((latest, message) =>
							message.modified > latest ? message.modified : latest,
						chat.created,
					)
					: chat.created,
			};

			const formattedChat = {
				...chat,
				messageStatistics,
				_count: undefined,
			};

			return res.respond({
				data: formattedChat,
				message: 'Chat found',
			});

		} catch(e) {
			next(createError(404, e.message));
		}
	}

	//updateChatPatch
	static async updateChatPatch(req, res, next) {
		try {
			const { uid } = req.params;
			const idUser = req.user.payload.id;
			const updateData = req.body;

			// Verificar que el chat existe y pertenece al usuario
			const chat = await prisma.chat.findFirst({
				where: {
					idUser: idUser,
					uid: uid,
				},
			});

			if(!chat) {
				return res.respond({
					status: 404,
					message: 'Chat not found',
				});
			}

			// Actualizar solo los campos proporcionados
			const updatedChat = await prisma.chat.update({
				where: { id: chat.id },
				data: updateData,
			});

			return res.respond({
				data: updatedChat,
				message: 'Chat updated successfully',
			});

		} catch(e) {
			next(createError(400, e.message));
		}
	}

}

export default UserController;