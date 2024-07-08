import {PrimateService} from '@thewebchimp/primate';
import {prisma} from '@thewebchimp/primate';

class ChatService {
    static async prepareDownload(idUser, uid, type = 'txt') {
        const chat = await PrimateService.findBy({idUser, uid}, 'chat');
        if (!chat) {
            throw new Error('Chat not found');
        }

        const messages = await prisma.message.findMany({
            where: {
                idChat: chat.id,
            },
            select: {
                type: true,
                content: true,
            }
        });

        const encodedFilename = encodeURIComponent(chat.name.replace(/[^a-zA-Z0-9]/g, '_'));
        const filename = `${encodedFilename}.${type}`;

        let content;
        let contentType;

        switch (type.toLowerCase()) {
            case 'txt':
                content = messages.map(message => {
                    return message.type === 'user' ? `user: ${message.content}` : `assistant: ${message.content}`;
                }).join('\n');
                contentType = 'text/plain';
                break;
            // Aquí puedes agregar más casos para otros tipos de archivo si es necesario
            default:
                throw new Error('Unsupported file type');
        }

        return {filename, content, contentType};
    }
}

export default ChatService;