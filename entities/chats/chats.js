import { getRouter, auth, setupRoute } from '@thewebchimp/primate';
const router = getRouter();

setupRoute('chat', router);

export { router };