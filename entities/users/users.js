import { getRouter, auth, setupRoute } from '@thewebchimp/primate';
import UserController from './user.controller.js';
const router = getRouter();

const options = {
	searchField: [ 'username' ],
	queryableFields: [ 'nicename', 'email' ],
};

router.post('/authenticate', UserController.authenticate);
router.get('/me', auth, UserController.me);

router.post('/me/chats', auth, UserController.createChat);
router.get('/me/chats', auth, UserController.getChats);
router.get('/me/chats/:uid', auth, UserController.getChat);
router.post('/me/chats/:uid/messages', auth, UserController.createChatMessage);

/*
router.get('/me/chats', auth, UserController.chats);
router.get('/me/chats/:uid/messages', auth, UserController.chatMessages);
*/

setupRoute('user', router, options);

export { router };