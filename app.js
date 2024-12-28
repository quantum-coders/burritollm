import primate from '@thewebchimp/primate';
import { router as ai } from './routes/ai.js';
import { router as base } from './routes/default.js';
import { router as web3 } from './routes/web3.js';
import {router as analytics} from './routes/web3Analytics.js';
import {router as admin} from './routes/ai.models.routes.js';

await primate.setup();

primate.app.use('/', base);
primate.app.use('/ai', ai);
primate.app.use('/web3', web3);
primate.app.use('/analytics', analytics);
primate.app.use('/admin', admin);

await primate.start();
