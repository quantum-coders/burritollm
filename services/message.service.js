import {prisma} from "@thewebchimp/primate";

class MessageService {
    /**
     * Stores a new message in the database.
     * @param {Object} messageData - The data for the new message.
     * @param {number} messageData.idChat - The ID of the chat this message belongs to.
     * @param {number} messageData.idUser - The ID of the user sending the message.
     * @param {string} messageData.content - The content of the message.
     * @param {string} messageData.uuid - The UUID of the message.
     * @param {string} [messageData.type] - The type of the message (default is "user" in the database).
     * @param {number|null} [messageData.responseTo] - The ID of the message this is responding to, if any.
     * @returns {Promise<Object>} The newly created message object.
     * @throws {Error} If there's an issue storing the message.
     */
    static async storeMessage({
        idChat,
        idUser,
        content,
        uid,
        type,
        responseTo
    }) {
        try {
            const messageData = {
                idChat,
                idUser,
                content,
                uid
            };

            // Only add optional fields if they are provided
            if (type !== undefined) {
                messageData.type = type;
            }
            if (responseTo !== undefined) {
                messageData.responseTo = responseTo;
            }

            const newMessage = await prisma.message.create({
                data: messageData
            });

            return newMessage;
        } catch (error) {
            console.error('Error storing message:', error);
            throw new Error('Failed to store message');
        }
    }

}

export default MessageService;
