import { getRouter, auth, setupRoute } from '@thewebchimp/primate';
import ChatController from "./chat.controller.js";
const router = getRouter();


// Functions -----------------------------------------------------------------------------------------------------------

// generate chat name
router.post('/generate-chat-name/:uid', auth, ChatController.generateChatName);
// download chat
router.get('/:uid/download', auth, ChatController.downloadChat);

// get tokens usage
router.get('/token-usage/:uid', auth, ChatController.getTokensUsage);
setupRoute('chat', router);

export { router };