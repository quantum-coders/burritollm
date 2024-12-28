import createError from 'http-errors';
import UserService from './user.service.js';
import {jwt, PrimateController, PrimateService, prisma} from '@thewebchimp/primate';

class UserController extends PrimateController {
	static async updateChatModel(req, res, next) {
		console.info('Iniciando updateChatModel');
		console.info('Parámetros recibidos:', {params: req.params, body: req.body});

		try {
			const {uid} = req.params;
			const idUser = req.user.payload.id;
			const {idModel} = req.body; // ID del modelo seleccionado

			console.info('Datos extraídos:', {uid, idUser, idModel});

			console.info('Buscando chat en la base de datos');
			const chat = await prisma.chat.findFirst({
				where: {
					idUser: idUser,
					uid: uid,
				},
			});

			console.info('Resultado de la búsqueda del chat:', chat);

			if (!chat) {
				console.info('Chat no encontrado');
				return res.respond({
					status: 404,
					message: 'Chat not found',
				});
			}

			console.info('Chat encontrado, procediendo a actualizar el modelo');
			console.info('ID del modelo a actualizar:', idModel);

			const updatedChat = await prisma.chat.update({
				where: {id: chat.id},
				data: {idModel: parseInt(idModel)}, // Actualizar el ID del modelo seleccionado
			});

			console.info('Chat actualizado con el nuevo modelo:', updatedChat);

			console.info('Enviando respuesta exitosa');
			return res.respond({
				data: updatedChat,
				message: 'Chat model updated successfully',
			});

		} catch (e) {
			console.error('Error en updateChatModel:', e);
			res.respond({status: 400, message: e?.message})
		}
	}

	static async deleteChat(req, res, next) {
		try {
			const {id} = req.params;
			const idUser = req.user.payload.id;

			console.log('📥 Delete Request Details:', {id, idUser, time: new Date().toISOString()});

			// Get chat with all its data before deletion
			const existingChat = await prisma.chat.findUnique({
				where: {id: parseInt(id, 10)},
			});

			console.log('📊 Chat Found:', {
				exists: !!existingChat,
				chatId: existingChat?.id,
				messages: existingChat?.messages?.length || 0,
				usages: existingChat?.modelUsages?.length || 0
			});

			if (!existingChat) {
				console.log('❌ Chat Not Found:', {searchedId: id});
				return res.respond({
					status: 404,
					message: 'Chat not found',
				});
			}

			if (existingChat.idUser !== idUser) {
				console.log('🚫 Wrong User:', {owner: existingChat.idUser, requester: idUser});
				return res.respond({
					message: 'Chat not found'
				});
			}

			// Delete all related model usages first
			await prisma.modelUsage.deleteMany({
				where: {
					OR: [
						{idChat: existingChat.id},
						{message: {idChat: existingChat.id}}
					]
				}
			});

			// Now safe to delete the chat (messages will cascade delete)
			await prisma.chat.delete({
				where: {id: existingChat.id}
			});


			return res.respond({
				message: 'Chat deleted successfully',
				data: existingChat
			});

		} catch (error) {
			console.error('🔥 Error:', {
				name: error.name,
				message: error.message,
				code: error.code,
				meta: error.meta
			});

			return res.respond({
				message: 'Internal server error',
				error: error.message
			});
		}
	}

	static async getChats(req, res, next) {
		try {
			const idUser = req.user.payload.id;

			const chats = await prisma.chat.findMany({
				where: {idUser},
				select: {
					id: true,
					name: true,
					uid: true,
					description: true,
					idUser: true,
					system: true,
					status: true,
					created: true,
					user: {
						select: {
							wallet: true,
						},
					},
					messages: {
						orderBy: {
							modified: 'desc',
						},
						take: 1,
						select: {
							modified: true,
						},
					},
					_count: {
						select: {
							messages: true,
						},
					},
				},
			});
			// if there is only one chat it is an object so convert to array
			const chatsArray = Array.isArray(chats) ? chats : [chats];
			const formattedChats = chatsArray.map(chat => ({
				...chat,
				userName: chat.user.name,
				modified: chat.messages[0]?.modified || chat.modified,
				user: undefined,
				messages: undefined,
				wallet: chat.user.wallet,
			}));

			return res.respond({
				data: formattedChats,
				message: 'Chats found',
			});

		} catch (e) {
			next(createError(404, e.message));
		}
	}

	static async getImages(req, res, next) {
		try {
			const idUser = req.user.payload.id;
			const images = await prisma.image.findMany({
				where: {idUser},
			});
			res.respond({
				data: images,
				message: 'Images found',
			});
		} catch (e) {
			next(createError(404, e.message));
		}

	}

	static async authenticate(req, res, next) {
		try {
			const {wallet} = req.body;
			let message = 'User authenticated successfully';

			// check for valid wallet address with regex
			if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
				return res.respond({
					status: 400,
					message: 'Error: Invalid wallet address',
				});
			}

			let user = await UserService.findByWallet(wallet);

			if (!user) {
				user = await UserService.create({
					wallet,
					login: wallet,
					type: 'User',
					status: 'Active',
				});

				message = 'User created successfully';
			}

			// Firmar un JWT para el usuario
			const token = await jwt.signAccessToken(user);

			return res.respond({
				data: user,
				props: {token},
				message,
			});
		} catch (e) {

			console.log(e);

			return res.respond({
				status: 400,
				message: 'Error creating user: ' + e.message,
			});
		}
	};

	static async me(req, res, next) {
		try {
			// Get user from req
			const signedUser = req.user.payload;
			console.warn('SIGNED USER: ', signedUser);

			const user = await UserService.findById(signedUser.id);
			console.warn('USER: ', user);

			if (user) {
				let balance = await prisma.userBalance.findFirst({
					where: {
						idUser: user.id,
					},
				});

				console.warn('BALANCE: ', balance);
				// si no tiene balance y no tiene ningun registro en la tabla de balance crea una entrada y ponle de balance 5.00 usd
				if (!balance) {
					balance = await prisma.userBalance.create({
						data: {
							idUser: user.id,
							balance: 0.5,
						},
					});
				}
				console.warn('BALANCE after create: ', balance);
				// delete password
				delete user.password;
				/// add the balance to the user object
				user.balance = balance ? balance.balance : 0.00;
				// parse float
				user.balance = parseFloat(user.balance);
				res.respond({
					data: user,
					message: 'User found',
				});
			}
		} catch (e) {
			next(createError(404, e.message));
		}
	};

	static async createChat(req, res, next) {
		try {

			const idUser = req.user.payload.id;

			const data = await UserService.createChat(idUser);

			return res.respond({
				data,
				message: 'Chat created successfully',
			});

		} catch (e) {
			next(createError(404, e.message));
		}
	}

	static async createChatMessage(req, res, next) {
		try {
			const {uid} = req.params;
			const idUser = req.user.payload.id;
			const {message} = req.body;
			const {type} = req.body;

			const chat = await PrimateService.findBy({idUser, uid}, 'chat');

			if (!chat) {
				return res.respond({
					status: 404,
					message: 'Chat not found',
				});
			}

			const data = {
				idChat: chat.id,
				idUser,
				content: message,
			};

			if (type) {
				data.type = type;
			}

			const chatMessage = await PrimateService.create(data, 'message');

			return res.respond({
				data: chatMessage,
				message: 'Chat message created successfully',
			});

		} catch (e) {
			next(createError(404, e.message));
		}
	}

	static async getChat(req, res, next) {
    try {
        const { uid } = req.params;
        const idUser = req.user.payload.id;

        let chat = await prisma.chat.findFirst({
            where: {
                idUser: idUser,
                uid: uid,
            },
            include: {
                modelUsages: true,
                messages: true,
                selectedModel: true, // Incluir el modelo seleccionado
                user: {
                    select: {
                        wallet: true,
                    },
                },
                _count: {
                    select: {
                        messages: true,
                    },
                },
            },
        });

        if (!chat) {
            return res.respond({
                status: 404,
                message: 'Chat not found',
            });
        }

        // Si el chat no tiene un modelo seleccionado, asignar el modelo por defecto
        if (!chat.selectedModel) {
            const defaultModel = await prisma.aIModel.findFirst({
                where: { openrouterId: 'neversleep/llama-3-lumimaid-70b' },
            });

            if (defaultModel) {
                chat = await prisma.chat.update({
                    where: { id: chat.id },
                    data: { idModel: defaultModel.id },
                    include: {
                        modelUsages: true,
                        messages: true,
                        selectedModel: true,
                        user: {
                            select: {
                                wallet: true,
                            },
                        },
                        _count: {
                            select: {
                                messages: true,
                            },
                        },
                    },
                });
            }
        }

        // if metas is empty define {}
        if (!chat.metas) {
            chat.metas = {};
        }

        const messageStatistics = {
            count: chat._count.messages,
            created: chat.created,
            modified: chat.messages.length > 0
                ? chat.messages.reduce((latest, message) =>
                    message.modified > latest ? message.modified : latest,
                    chat.created,
                )
                : chat.created,
        };

        let totalCost = 0;
        for (const usage of chat.modelUsages) {
            const tokens = parseFloat(usage.cost);
            totalCost += tokens;
        }

        const tokensUsed = [];
        for (const message of chat.messages) {
            let msgTotal = 0;
            if (message.modelUsages && message.modelUsages.length > 0) {
                for (const usage of message.modelUsages) {
                    msgTotal += parseFloat(usage.tokensUsed);
                }
            }
            tokensUsed.push(msgTotal);
        }

        const formattedChat = {
            ...chat,
            messageStatistics,
            _count: undefined,
            totalCost,
            tokensUsed,
        };

        return res.respond({
            data: formattedChat,
            message: 'Chat found',
        });

    } catch (e) {
        res.respond({
            status: 400,
            message: e.message,
        })
    }
}

	//updateChatPatch
	static async updateChatPatch(req, res, next) {
		console.info('Iniciando updateChatPatch');
		console.info('Parámetros recibidos:', {params: req.params, body: req.body});

		try {
			const {uid} = req.params;
			const idUser = req.user.payload.id;
			const updateData = req.body;

			console.info('Datos extraídos:', {uid, idUser, updateData});

			console.info('Buscando chat en la base de datos');
			const chat = await prisma.chat.findFirst({
				where: {
					idUser: idUser,
					uid: uid,
				},
			});

			console.info('Resultado de la búsqueda del chat:', chat);

			if (!chat) {
				console.info('Chat no encontrado');
				return res.respond({
					status: 404,
					message: 'Chat not found',
				});
			}

			console.info('Chat encontrado, procediendo a actualizar');
			console.info('Datos de actualización:', updateData);

			const updatedChat = await prisma.chat.update({
				where: {id: chat.id},
				data: updateData,
			});

			console.info('Chat actualizado:', updatedChat);

			console.info('Enviando respuesta exitosa');
			return res.respond({
				data: updatedChat,
				message: 'Chat updated successfully',
			});

		} catch (e) {
			console.error('Error en updateChatPatch:', e);
			res.respond({status: 400, message: e?.message})
		}
	}

	static async deleteImage(req, res, next) {
		try {
			const idUser = req.user.payload.id;
			const {id} = req.params;

			const image = await prisma.image.findFirst({
				where: {id: parseInt(id), idUser: parseInt(idUser)},
			});

			if (!image) {
				return res.respond({
					status: 404,
					message: 'Image not found',
				});
			}

			await prisma.image.delete({
				where: {id: parseInt(id)},
			});

			return res.respond({
				message: 'Image deleted successfully',
			});

		} catch (e) {
			next(createError(404, e.message));
		}
	}


	static async searchChats(req, res, next) {
		try {
			console.log('[searchChats] Usuario actual:', req.user);
			console.log('[searchChats] Query params:', req.query);

			const idUser = req.user?.payload?.id;
			const {q} = req.query;

			console.log(`[searchChats] idUser: ${idUser}, buscando con query: "${q}"`);

			const chats = await prisma.chat.findMany({
				where: {
					idUser,
					OR: [
						{
							name: {
								contains: q,
							},
						},
						{
							description: {
								contains: q,
							},
						},
						{
							messages: {
								some: {
									content: {
										contains: q,
									},
								},
							},
						},
					],
				},
				select: {
					id: true,
					uid: true,
					name: true,
					description: true,
					status: true,
					created: true,
					modified: true,
					metas: true,
					user: {
						select: {
							id: true,
							nicename: true,
							metas: true
						}
					},
					messages: {
						orderBy: {
							modified: 'desc'
						},
						take: 1,
						select: {
							modified: true
						}
					},
					_count: {
						select: {
							messages: true
						}
					}
				}
			});

			if (!chats) {
				console.log('[searchChats] Ningún chat encontrado');
				return res.respond({
					data: [],
					message: 'No chats found'
				});
			}

			// Parse JSON fields
			const parsedChats = chats.map(chat => ({
				...chat,
				metas: chat.metas ? (typeof chat.metas === 'string' ? JSON.parse(chat.metas) : chat.metas) : {},
				user: chat.user ? {
					...chat.user,
					metas: chat.user.metas ? (typeof chat.user.metas === 'string' ? JSON.parse(chat.user.metas) : chat.user.metas) : {}
				} : null
			}));

			console.log(`[searchChats] Chats encontrados: ${parsedChats.length}`);

			return res.respond({
				data: parsedChats,
				message: 'Chats filtered successfully'
			});
		} catch (e) {
			console.error('[searchChats] Error:', e);
			return res.respond({
				status: 400,
				message: e.message
			});
		}
	}


}

export default UserController;
