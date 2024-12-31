// controllers/ai.models.controller.js
import {prisma} from "@thewebchimp/primate";
import jwt from 'jsonwebtoken';
import OpenRouterService from "../services/operouter.service.js";


class AIModelsController {
	// GET /models - Obtiene modelos disponibles para el frontend

	static async bulkAction(req, res) {
		const {action, modelIds, ...payload} = req.body;

		if (!Array.isArray(modelIds) || modelIds.length === 0) {
			return res.respond({
				message: 'modelIds must be a non-empty array'
			}, 400);
		}

		try {
			let updatedModels;
			switch (action) {
				case 'toggleVisibility':
					updatedModels = await AIModelsController.performToggleVisibility(modelIds, payload);
					break;
				case 'toggleFeatured':
					updatedModels = await AIModelsController.performToggleFeatured(modelIds, payload);
					break;
				case 'updatePriority':
					updatedModels = await AIModelsController.performUpdatePriority(modelIds, payload);
					break;
				case 'updateStatus':
					updatedModels = await AIModelsController.performUpdateStatus(modelIds, payload);
					break;
				// Añade más casos según sea necesario
				default:
					return res.respond({
						message: 'Invalid action'
					}, 400);
			}

			res.respond({
				data: updatedModels,
				message: `Bulk action '${action}' completed successfully`
			});
		} catch (error) {
			console.error('[bulkAction] Error:', error);
			res.respond({
				error: error.message,
				message: `Failed to perform bulk action '${action}'`
			}, 500);
		}
	}

	static async performToggleVisibility(modelIds, payload) {
		const {isVisible} = payload;
		await prisma.aIModel.updateMany({
			where: {
				id: {
					in: modelIds.map(id => parseInt(id))
				}
			},
			data: {isVisible}
		});

		return await prisma.aIModel.findMany({
			where: {
				id: {
					in: modelIds.map(id => parseInt(id))
				}
			}
		});
	}

	static async toggleSandbox(req, res) {
		try {
			const {id} = req.params; // <-- de la URL
			// Buscar el modelo
			const model = await prisma.aIModel.findUnique({
				where: {id: parseInt(id)},
			});

			if (!model) {
				return res.respond({message: 'Model not found'}, 404);
			}

			// Hacer toggle:
			// Cambiar de true a false, o de false a true
			const updatedModel = await prisma.aIModel.update({
				where: {id: parseInt(id)},
				data: {sandbox: !model.sandbox}
			});

			res.respond({
				data: updatedModel,
				message: `Model sandbox ${updatedModel.sandbox ? 'enabled' : 'disabled'} successfully`
			});
		} catch (error) {
			console.error('[toggleSandbox] Error:', error);
			res.respond({
				status: 500,
				error: error.message,
				message: 'Failed to toggle sandbox'
			});
		}
	}


	static async performToggleFeatured(modelIds, payload) {
		const {isFeatured} = payload;
		await prisma.aIModel.updateMany({
			where: {
				id: {
					in: modelIds.map(id => parseInt(id))
				}
			},
			data: {isFeatured}
		});

		return await prisma.aIModel.findMany({
			where: {
				id: {
					in: modelIds.map(id => parseInt(id))
				}
			}
		});
	}

	static async performUpdatePriority(modelIds, payload) {
		const {priority} = payload;
		await prisma.aIModel.updateMany({
			where: {
				id: {
					in: modelIds.map(id => parseInt(id))
				}
			},
			data: {priority: parseInt(priority)}
		});

		return await prisma.aIModel.findMany({
			where: {
				id: {
					in: modelIds.map(id => parseInt(id))
				}
			}
		});
	}

	static async performUpdateStatus(modelIds, payload) {
		const {status} = payload;
		await prisma.aIModel.updateMany({
			where: {
				id: {
					in: modelIds.map(id => parseInt(id))
				}
			},
			data: {status: status}
		});

		return await prisma.aIModel.findMany({
			where: {
				id: {
					in: modelIds.map(id => parseInt(id))
				}
			}
		});
	}

	static async getAvailableModels(req, res) {
		try {
			// Ver todos los headers que llegan
			console.log('[getAvailableModels] req.headers:', req.headers);

			// 1. Tomar el header Authorization con minúsculas
			const authHeader = req.headers['authorization'];
			console.log('[getAvailableModels] authHeader:', authHeader);

			// Verificar que exista y empiece con 'Bearer '
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				console.log('[getAvailableModels] Falta el bearer token o es inválido');
				return res.respond({
					status: 401,
					message: 'Unauthorized: missing or invalid Bearer token',
				});
			}

			// 2. Extraer el token en sí
			const token = authHeader.split(' ')[1];
			console.log('[getAvailableModels] token extraído:', token);

			// 3. Decodificar / verificar el JWT
			let decoded;
			try {
				decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
				console.log('[getAvailableModels] Token decodificado:', decoded);
			} catch (err) {
				console.error('[getAvailableModels] Error al verificar token:', err);
				return res.respond({
					status: 401,
					message: 'Unauthorized: invalid token',
				});
			}

			// 4. Revisar la estructura del payload (asumiendo payload > user id en decoded.payload.id)
			//    Ajusta esto a como hayas definido el token en tu server.
			if (!decoded.payload?.id) {
				console.log('[getAvailableModels] El token no contiene user ID en decoded.payload.id');
				return res.respond({
					status: 400,
					message: 'Invalid token payload: missing user ID',
				});
			}

			const userId = decoded.payload.id;
			console.log('[getAvailableModels] userId extraído del token:', userId);

			// 5. Buscar el usuario en la BD
			const user = await prisma.user.findUnique({
				where: {id: userId},
			});
			console.log('[getAvailableModels] user encontrado:', user);

			if (!user) {
				console.log('[getAvailableModels] user no existe en la BD');
				return res.respond({
					status: 404,
					message: 'User not found',
				});
			}

			// 6. Decidir filtro: si user.type === 'Admin' => sandbox, else => isVisible
			let models;
			if (user.type === 'Admin') {
				console.log('[getAvailableModels] El usuario es Admin, usaremos sandbox:true');
				models = await prisma.aIModel.findMany({
					where: {
						sandbox: true,
						status: 'active',
					},
					orderBy: [
						{priority: 'desc'},
						{name: 'asc'},
					],
				});
			} else {
				console.log('[getAvailableModels] El usuario NO es Admin, usaremos isVisible:true');
				models = await prisma.aIModel.findMany({
					where: {
						isVisible: true,
						status: 'active',
					},
					orderBy: [
						{priority: 'desc'},
						{name: 'asc'},
					],
				});
			}

			console.log('[getAvailableModels] Models a devolver:', models);

			// 7. Responder
			return res.respond({
				data: models,
				message: "Models fetched successfully",
			});

		} catch (error) {
			console.error('[getAvailableModels] Error general:', error);
			return res.respond({
				status: 500,
				error: error.message,
				message: "Failed to fetch models",
			});
		}
	}

	static async getActiveModels(req, res) {
		try {
			const models = await prisma.aIModel.findMany({
				where: {
					status: 'active'
				},
				orderBy: [
					{priority: 'desc'},
					{name: 'asc'}
				]
			});

			res.respond({
				data: models,
				message: "Models fetched successfully"
			});
		} catch (error) {
			console.error('[getAvailableModels] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch models"
			}, 500);
		}
	}


	// GET /models/:id - Obtiene un modelo específico
	static async getModelById(req, res) {
		const {id} = req.params;
		try {
			const model = await prisma.aIModel.findUnique({
				where: {id: parseInt(id)}
			});

			if (!model) {
				return res.respond({
					message: "Model not found"
				}, 404);
			}

			res.respond({
				data: model,
				message: "Model fetched successfully"
			});
		} catch (error) {
			console.error('[getModelById] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch model"
			}, 500);
		}
	}

	// GET /admin/models - Obtiene todos los modelos para administración
	static async getAllModels(req, res) {
		try {
			const models = await prisma.aIModel.findMany({
				orderBy: [
					{priority: 'desc'},
					{name: 'asc'}
				]
			});

			res.respond({
				data: models,
				message: "All models fetched successfully"
			});
		} catch (error) {
			console.error('[getAllModels] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch models"
			}, 500);
		}
	}

	// PATCH /admin/models/:id/visibility - Toggle visibilidad del modelo
	static async toggleModelVisibility(req, res) {
		const {id} = req.params;
		try {
			const model = await prisma.aIModel.findUnique({
				where: {id: parseInt(id)}
			});

			if (!model) {
				return res.respond({
					message: "Model not found"
				}, 404);
			}

			const updatedModel = await prisma.aIModel.update({
				where: {id: parseInt(id)},
				data: {isVisible: !model.isVisible}
			});

			res.respond({
				data: updatedModel,
				message: `Model visibility ${updatedModel.isVisible ? 'enabled' : 'disabled'} successfully`
			});
		} catch (error) {
			console.error('[toggleModelVisibility] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to toggle model visibility"
			}, 500);
		}
	}

	// PATCH /admin/models/:id/featured - Toggle featured status
	static async toggleModelFeatured(req, res) {
		const {id} = req.params;
		try {
			const model = await prisma.aIModel.findUnique({
				where: {id: parseInt(id)}
			});

			if (!model) {
				return res.respond({
					message: "Model not found"
				}, 404);
			}

			const updatedModel = await prisma.aIModel.update({
				where: {id: parseInt(id)},
				data: {isFeatured: !model.isFeatured}
			});

			res.respond({
				data: updatedModel,
				message: `Model ${updatedModel.isFeatured ? 'featured' : 'unfeatured'} successfully`
			});
		} catch (error) {
			console.error('[toggleModelFeatured] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to toggle model featured status"
			}, 500);
		}
	}

	// PATCH /admin/models/:id/priority - Actualizar prioridad
	static async updateModelPriority(req, res) {
		const {id} = req.params;
		const {priority} = req.body;

		try {
			const updatedModel = await prisma.aIModel.update({
				where: {id: parseInt(id)},
				data: {priority: parseInt(priority)}
			});

			res.respond({
				data: updatedModel,
				message: "Model priority updated successfully"
			});
		} catch (error) {
			console.error('[updateModelPriority] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to update model priority"
			}, 500);
		}
	}

	// PUT /admin/models/:id - Actualizar información del modelo
	static async updateModel(req, res) {
		const {id} = req.params;
		const {
			name,
			description,
			inputCost,
			outputCost,
			status,
			maxOutput,
			latency,
			throughput,
			isVisible,
			priority,
			isFeatured
		} = req.body;

		try {
			const updatedModel = await prisma.aIModel.update({
				where: {id: parseInt(id)},
				data: {
					name,
					description,
					inputCost: inputCost ? parseFloat(inputCost) : undefined,
					outputCost: outputCost ? parseFloat(outputCost) : undefined,
					status,
					maxOutput: maxOutput ? parseInt(maxOutput) : undefined,
					latency: latency ? parseFloat(latency) : undefined,
					throughput: throughput ? parseFloat(throughput) : undefined,
					isVisible: isVisible !== undefined ? Boolean(isVisible) : undefined,
					priority: priority !== undefined ? parseInt(priority) : undefined,
					isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : undefined
				}
			});

			res.respond({
				data: updatedModel,
				message: "Model updated successfully"
			});
		} catch (error) {
			console.error('[updateModel] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to update model"
			}, 500);
		}
	}

	// POST /admin/models/sync - Sincronizar con OpenRouter
	static async syncWithOpenRouter(req, res) {
		try {
			const updatedModels = await OpenRouterService.syncModels();
			res.respond({
				data: updatedModels,
				message: "Models synchronized successfully with OpenRouter"
			});
		} catch (error) {
			console.error('[syncWithOpenRouter] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to sync models with OpenRouter"
			}, 500);
		}
	}
}

export default AIModelsController;
