import {jwt, PrimateController, PrimateService} from '@thewebchimp/primate';
import AiService from "../../services/ai.service.js";



class ChatController extends PrimateController{

    static async generateChatName(req, res, next) {
        const idUser = req.user.payload.id;
        const {uid} = req.params;
        try {
            // get the chat by uid
            const chat = await PrimateService.findFirst({where: {uid}});
            if(!chat) {
                throw new Error('Chat not found');
            }
            if(!chat.name || chat.name === 'New Chat') {
                const getAllMessages = await PrimateService.findMany({where: {idChat: chat.id}, orderBy: {createdAt: 'asc'}});
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

                console.log("Resultado: ", generatedName)
                const name = generatedName.choices[0].text;
                chat.name = name.replace(/"/g, '');
                await PrimateService.update(chat, 'chat', {id: chat.id, idUser});
                return res.respond({
                    data: chat,
                    message: 'Chat name generated',
                });
            }
        }catch (e) {

        }


    }


}
export default ChatController;