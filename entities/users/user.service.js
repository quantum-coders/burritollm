import bcrypt from 'bcrypt';
import { jwt, PrimateService, prisma } from '@thewebchimp/primate';
import createError from 'http-errors';
import slugify from 'slugify';

class UserService extends PrimateService {
    static async findByWallet(walletAddress) {
        return prisma.user.findUnique({
            where: {
                wallet: walletAddress
            }
        });
    }

    static async create(data) {
        const { email, password, metas } = data;

        if(!email || !metas.firstname || !metas.lastname) {
            throw createError.BadRequest('Missing required fields:' + (email ? '' : ' username') + (metas.firstname ? '' : ' firstname') + (metas.lastname ? '' : ' lastname'));
        }

        data.login = email;

        // Create nice name with firstname and lastname
        data.nicename = metas.firstname + ' ' + metas.lastname;

        // If we are receiving a password, we hash it
        if(password) data.password = bcrypt.hashSync(password, 8);

        return prisma.user.create({
            data,
        });
    }
}
export default UserService;