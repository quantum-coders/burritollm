import primate from '@thewebchimp/primate';
import { router as ai } from './routes/ai.js';
import { router as base } from './routes/default.js';
import * as bodyParser from "express";
await primate.setup();
primate.app.use('/', base);
primate.app.use('/ai', ai);

await primate.start();