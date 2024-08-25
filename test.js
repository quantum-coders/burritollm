import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';

const result = await fal.subscribe('fal-ai/flux', {
	input: {
		prompt: 'nude woman',
	},
	enable_safety_checker: false,
});

console.log(result);