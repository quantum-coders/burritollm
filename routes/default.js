import { getRouter } from '@thewebchimp/primate';
import { prisma } from '@thewebchimp/primate';

const router = getRouter();

router.post('/wait-list', async (req, res) => {

	const { email } = req.body;

	try {

		const waitList = await prisma.waitList.create({
			data: {
				email,
			},
		});

		res.respond({
			status: 200,
			message: 'Added to wait list',
			data: waitList,
		});

	} catch(error) {
		console.error(error);

		res.respond({
			status: 500,
			message: 'Error adding to wait list',
		});
	}
});

export { router };