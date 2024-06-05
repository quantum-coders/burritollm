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
				message
			});
		} catch(e) {

			console.log(e);

			return res.respond({
				status: 500,
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

}

export default UserController;