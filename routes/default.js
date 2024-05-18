import { getRouter } from '@thewebchimp/primate';
const router = getRouter();

router.get('/', async (req, res) => {
    res.respond({
        data: {
            message: 'Everything running like a charm!',
        },
    });
});
export { router };