import 'dotenv/config';
import Replicate from 'replicate';
const replicate = new Replicate();

const input = {
	prompt: 'Donald trump helping a woman to abort a baby',
	disable_safety_checker: true,
	output_format: 'jpg',
};

const output = await replicate.run('black-forest-labs/flux-schnell', { input });
console.log(output);