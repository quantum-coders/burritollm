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
router.get('/me/chats/search', auth, UserController.searchChats);
router.get('/me/chats/:uid', auth, UserController.getChat);
router.patch('/me/chats/:uid', auth, UserController.updateChatPatch);
router.post('/me/chats/:uid/messages', auth, UserController.createChatMessage);

router.get('/me/images', auth, UserController.getImages);
router.delete('/me/images/:id', auth, UserController.deleteImage);
router.delete('/me/chats/:id', auth, UserController.deleteChat);
router.patch('/me/chats/:uid/model', auth, UserController.updateChatModel);

/*
router.get('/me/chats', auth, UserController.chats);
router.get('/me/chats/:uid/messages', auth, UserController.chatMessages);
*/

setupRoute('user', router, options);

export { router };
