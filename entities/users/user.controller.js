import createError from 'http-errors';
import queryString from 'query-string';
import axios from 'axios';
import UserService from './user.service.js';
import { jwt, PrimateController, PrimateService } from '@thewebchimp/primate';

class UserController extends PrimateController {
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
			const user = await UserService.findById(signedUser.id);

			if(user) {

				// delete password
				delete user.password;

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

			const chat = await PrimateService.findBy({
				idUser: idUser,
				uid: uid,
			}, 'chat', { include: { messages: true } });

			if(!chat) {
				return res.respond({
					status: 404,
					message: 'Chat not found',
				});
			}

			return res.respond({
				data: chat,
				message: 'Chat found',
			});

		} catch(e) {
			next(createError(404, e.message));
		}
	}

}

export default UserController;