import { getRouter, auth, setupRoute } from '@thewebchimp/primate';
import UserController from './user.controller.js';
const router = getRouter();

const options = {
	searchField: [ 'username' ],
	queryableFields: [ 'nicename', 'email' ],
};

router.post('/authenticate', UserController.authenticate);
router.get('/me', auth, UserController.me);

/*
router.post('/me/chats', auth, UserController.chat);
router.get('/me/chats', auth, UserController.chats);
router.get('/me/chats/:id', auth, UserController.chat);
router.get('/me/chats/:id/messages', auth, UserController.chatMessages);
router.post('/me/chats/:id/messages', auth, UserController.chatMessage);
*/

setupRoute('user', router, options);

export { router };