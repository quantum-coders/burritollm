import createError from 'http-errors';
import queryString from 'query-string';
import axios from 'axios';
import UserService from './user.service.js';
import {jwt, PrimateController, PrimateService} from '@thewebchimp/primate';

class UserController extends PrimateController {
    static async register(req, res, next) {
        try {
            const {walletAddress} = req.body;

            if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                throw new Error('Invalid wallet address');
            }

            const existingUser = await UserService.findByWallet(walletAddress);
            if (existingUser) {
                throw new Error(`Wallet address ${walletAddress} already in use`);
            }
            console.log("[Before Crashing]", walletAddress)
            const user = await UserService.create({
                wallet: walletAddress,
                login: walletAddress,
                type: "User",
                status: "Active"
            });
            console.log("[After Crashing]", user)

            // Firmar un JWT para el usuario
            const token = await jwt.signAccessToken(user);

            res.respond({
                data: {
                    user,
                    token
                },
                message: 'Account created successfully',
            });
        } catch (e) {
            next(createError(400, 'Error creating user: ' + e.message));
        }
    };

    static async login(req, res, next) {
        try {
            const data = await UserService.login(req.body);

            res.respond({
                data,
                message: 'Account login successful',
            });

        } catch (e) {

            console.log(e);

            let message = 'Error login user: ' + e.message;

            res.respond({
                status: 400,
                message,
            });
        }
    };

    static async googleRedirect(req, res, next) {
        const params = queryString.stringify({
            client_id: process.env.GOOGLE_CLIENT_ID,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            scope: [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
            ].join(' '), // space seperated string
            response_type: 'code',
            access_type: 'offline',
            prompt: 'consent',
        });

        const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

        res.redirect(googleLoginUrl);
    };

    static async googleAuth(req, res, next) {
        // Get the code from body
        const code = req.body.code;

        if (code) {

            let token;

            try {
                // post to google
                token = await axios.post('https://oauth2.googleapis.com/token', {
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                    grant_type: 'authorization_code',
                    code,
                });
            } catch (e) {
                console.log(e);
                res.respond({
                    status: 400,
                    result: 'error',
                    message: 'Error getting token',
                });
                return;
            }

            const accessToken = token.data.access_token;
            let userInfo;

            try {

                // get user info
                userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo?alt=json', {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

            } catch (e) {
                console.log(e);
                res.respond({
                    status: 400,
                    result: 'error',
                    message: 'Error getting user info',
                });
                return;
            }

            // Check if user exists
            const user = await UserService.findByEmail(userInfo.data.email);

            // If user exists
            if (user) {
                // If the user is not active
                if (user.status !== 'Active') {
                    res.respond({
                        status: 401,
                        result: 'error',
                        message: 'User is not active',
                    });
                } else {
                    const accessToken = await jwt.signAccessToken(user);

                    res.respond({
                        data: {...user, accessToken},
                        message: 'Account login successful',
                    });
                }
            } else {

                // Create user
                const data = {
                    username: userInfo.data.email,
                    email: userInfo.data.email,
                    nicename: userInfo.data.name,
                    firstname: userInfo.data.given_name || '',
                    lastname: userInfo.data.family_name || '',
                    password: '',
                    metas: {
                        firstname: userInfo.data.given_name || '',
                        lastname: userInfo.data.family_name || '',
                    },
                };

                const user = await UserService.create(data);

                const accessToken = await jwt.signAccessToken(user);

                res.respond({
                    data: {...user, accessToken},
                    message: 'Account login successful',
                });
            }

        } else {
            res.respond({
                status: 400,
                message: 'Invalid request',
            });
        }
    };

    static async me(req, res, next) {
        try {
            // Get user from req
            const signedUser = req.user.payload;
            const user = await UserService.findById(signedUser.id);

            if (user) {

                // delete password
                delete user.password;

                res.respond({
                    data: user,
                    message: 'User found',
                });
            }
        } catch (e) {
            next(createError(404, e.message));
        }
    };

}

export default UserController;