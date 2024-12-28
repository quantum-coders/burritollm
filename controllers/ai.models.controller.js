// controllers/ai.models.controller.js
import {prisma} from "@thewebchimp/primate";
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
			const models = await prisma.aIModel.findMany({
				where: {
					isVisible: true,
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
