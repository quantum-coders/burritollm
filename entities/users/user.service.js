import { PrimateService, prisma } from '@thewebchimp/primate';
import createError from 'http-errors';

class UserService {
	static findById(id) {
		if(!id) throw createError.BadRequest('Invalid user id');

		try {

			return prisma.user.findUnique({
				where: {
					id: parseInt(id),
				},
			});
		} catch(e) {
			throw e;
		}
	}

	static async findByWallet(wallet) {
		if(!wallet) throw createError.BadRequest('Invalid wallet address');

		try {
			return prisma.user.findFirst({
				where: { wallet },
			});
		} catch(e) {
			throw e;
		}
	}

	static async create(data) {
		try {

			data.nicename = '';
			data.password = '';

			return await PrimateService.create(data, 'user');
		} catch(e) {
			throw e;
		}
	}

	static async createChat(idUser) {
		try {

			const data = {
				idUser,
				system: '',
			};

			return await PrimateService.create(data, 'chat');

		} catch(e) {
			throw e;
		}
	}
}

export default UserService;