import { auth, getRouter } from '@thewebchimp/primate';
import AIController from '../controllers/ai.controller.js';
const router = getRouter();

router.post('/message', auth, AIController.sendMessage);
export { router };