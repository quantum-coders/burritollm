import { auth, getRouter } from '@thewebchimp/primate';
import AIController from '../controllers/ai.controller.js';
const router = getRouter();

router.post('/message', auth, AIController.sendMessage);

router.post('/image', auth, AIController.createImage);

router.post('/message/cancel', auth, AIController.cancelMessage);

export { router };
