import primate from '@thewebchimp/primate';
import { router as ai } from './routes/ai.js';
import { router as base } from './routes/default.js';
import {router as web3 } from './routes/web3.js';
import * as bodyParser from "express";
await primate.setup();
primate.app.use('/', base);
primate.app.use('/ai', ai);
primate.app.use('/web3', web3);

await primate.start();