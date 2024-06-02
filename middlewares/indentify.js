import { jwt } from '@thewebchimp/primate';

const auth = async (req, res, next) => {

	let token;

	if(req.headers.authorization) {
		token = req.headers.authorization.split(' ')[1];
	}

	if(token) {

		await jwt.verifyAccessToken(token).then(user => {
			req.user = user;
			next();

		}).catch(e => {

			next(e);

		});
	}
};

export default auth;