import bcrypt from 'bcrypt';
import { PrimateService, prisma } from '@thewebchimp/primate';
import createError from 'http-errors';

class UserService {
	static async findByWallet(walletAddress) {
		return prisma.user.findFirst({
			where: {
				wallet: walletAddress,
			},
		});
	}

	static async create(data) {

		data.nicename = '';
		data.password = '';

		return PrimateService.create(data, 'user');
	}
}

export default UserService;