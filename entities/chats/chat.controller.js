import {jwt, PrimateController, PrimateService, prisma} from '@thewebchimp/primate';
import AiService from "../../services/ai.service.js";
import ChatService from "./chat.service.js";


class ChatController extends PrimateController {

    static async generateChatName(req, res, next) {
        console.log("CHECKPONT????")
        const idUser = req.user.payload.id;
        const {uid} = req.params;
        try {
            const chat = await PrimateService.findBy({idUser, uid}, 'chat')
            console.log("Found you: ", chat)
            if (!chat) {
                throw new Error('Chat not found');
            }
            if (!chat.name || chat.name === 'New Chat') {
                const getAllMessages = await prisma.message.findMany({
                    where: {
                        idChat: chat.id,
                    },
                    select: {
                        type: true,
                        content: true,
                    }
                });
                // concatenate all messages like this User: message, AI: message, User: message...., ech message has type, one is user the other assistant
                const concatenatedMessages = getAllMessages.map(message => {
                    return message.type === 'user' ? `User: ${message.content}` : `AI: ${message.content}`;
                }).join(', ');
                const systemPrompt = `You can only do one task, generate as the only output, a short title with emoji for this chat. Here are the messages so far: ${concatenatedMessages}.`;
                const generatedName = await AiService.sendChatCompletion(
                    'google/gemma-2-9b-it:free',
                    systemPrompt,
                    'Title is:',
                )
                const name = generatedName.choices[0].message.content
                chat.name = name.replace(/"/g, '');
                chat.name = chat.name.replace(/(\r\n|\n|\r)/gm, "");
                await prisma.chat.update({
                    where: {
                        id: chat.id,
                    },
                    data: {
                        name: chat.name,
                    },
                });
                return res.respond({
                    data: chat,
                    message: 'Chat name generated',
                });
            }
        } catch (e) {
            console.log("Error: ", e)
            return res.respond({
                status: 400,
                message: 'Error generating chat name: ' + e.message,
            });
        }
    }

    static async downloadChat(req, res, next) {
        const idUser = req.user.payload.id;
        const {uid} = req.params;
        const type = req.query.type || 'txt'; // Asumiendo que el tipo se pasa como query parameter

        try {
            const {filename, content, contentType} = await ChatService.prepareDownload(idUser, uid, type);

            res.setHeader('Content-disposition', `attachment; filename*=UTF-8''${filename}`);
            res.setHeader('Content-type', contentType);
            res.charset = 'UTF-8';
            res.write(content);
            res.end();
        } catch (e) {
            return res.respond({
                status: 400,
                message: 'Error downloading chat: ' + e.message,
            });
        }
    }

}

export default ChatController;