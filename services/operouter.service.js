// services/openrouter.service.js
import axios from 'axios';
import {prisma} from "@thewebchimp/primate";

class OpenRouterService {
	static MARKUP_PERCENTAGE = 30; // 30% markup
	static API_KEY = process.env.OPEN_ROUTER_KEY;
	static API_URL = 'https://openrouter.ai/api/v1';

	static calculateMarkupPrice(originalPrice) {
		const price = parseFloat(originalPrice);
		return price + (price * (this.MARKUP_PERCENTAGE / 100));
	}

	static async fetchOpenRouterModels() {
		try {
			const response = await axios.get(`${this.API_URL}/models`, {
				headers: {
					'Authorization': `Bearer ${this.API_KEY}`
				}
			});
			return response.data.data;
		} catch (error) {
			console.error('Error fetching OpenRouter models:', error);
			throw error;
		}
	}

	static async syncModels() {
		try {
			const openRouterModels = await this.fetchOpenRouterModels();
			const updatedModels = [];

			for (const model of openRouterModels) {
				const modelData = {
					name: model.name,
					description: model.description,
					openrouterId: model.id,
					openrouterInputCost: model.pricing.prompt,
					openrouterOutputCost: model.pricing.completion,
					contextLength: model.context_length,
					modelType: model.architecture?.modality || 'text->text',
					modelArchitecture: model.architecture,
					// Calcular precios con markup
					inputCost: this.calculateMarkupPrice(model.pricing.prompt),
					outputCost: this.calculateMarkupPrice(model.pricing.completion),
					// Mantener valores existentes o usar defaults
					maxOutput: model.top_provider?.max_completion_tokens || 4096,
					latency: 1.00,
					throughput: 1.00
				};

				// Buscar si el modelo ya existe
				const existingModel = await prisma.aIModel.findFirst({
					where: {
						OR: [
							{openrouterId: model.id},
							{name: model.name}
						]
					}
				});

				let updatedModel;

				if (existingModel) {
					// Actualizar modelo existente
					updatedModel = await prisma.aIModel.update({
						where: {id: existingModel.id},
						data: {
							...modelData,
							// Mantener configuraciones existentes
							isVisible: existingModel.isVisible,
							priority: existingModel.priority,
							isFeatured: existingModel.isFeatured,
							status: existingModel.status
						}
					});
				} else {
					// Crear nuevo modelo
					updatedModel = await prisma.aIModel.create({
						data: {
							...modelData,
							isVisible: true,
							priority: 0,
							isFeatured: false,
							status: 'active'
						}
					});
				}

				updatedModels.push(updatedModel);
			}

			// Opcionalmente, marcar como inactivos los modelos que ya no existen en OpenRouter
			const existingOpenRouterIds = openRouterModels.map(m => m.id);
			await prisma.aIModel.updateMany({
				where: {
					openrouterId: {
						not: null,
						notIn: existingOpenRouterIds
					}
				},
				data: {
					status: 'inactive'
				}
			});

			return updatedModels;
		} catch (error) {
			console.error('Error syncing models:', error);
			throw error;
		}
	}

	static async getModelPricing(modelId) {
		try {
			const model = await prisma.aIModel.findUnique({
				where: {id: parseInt(modelId)}
			});

			if (!model) {
				throw new Error('Model not found');
			}

			return {
				inputCost: model.inputCost,
				outputCost: model.outputCost,
				openrouterInputCost: model.openrouterInputCost,
				openrouterOutputCost: model.openrouterOutputCost,
				markup: this.MARKUP_PERCENTAGE
			};
		} catch (error) {
			console.error('Error getting model pricing:', error);
			throw error;
		}
	}

	static async updateModelStatus(modelId, status) {
		try {
			return await prisma.aIModel.update({
				where: {id: parseInt(modelId)},
				data: {status}
			});
		} catch (error) {
			console.error('Error updating model status:', error);
			throw error;
		}
	}

	static async updateModelPricing(modelId, {inputCost, outputCost}) {
		try {
			const model = await prisma.aIModel.findUnique({
				where: {id: parseInt(modelId)}
			});

			if (!model) {
				throw new Error('Model not found');
			}

			return await prisma.aIModel.update({
				where: {id: parseInt(modelId)},
				data: {
					inputCost: parseFloat(inputCost),
					outputCost: parseFloat(outputCost)
				}
			});
		} catch (error) {
			console.error('Error updating model pricing:', error);
			throw error;
		}
	}

	static async validateModelAvailability(modelId) {
		try {
			const model = await prisma.aIModel.findUnique({
				where: {id: parseInt(modelId)}
			});

			if (!model) {
				throw new Error('Model not found');
			}

			return {
				isAvailable: model.status === 'active' && model.isVisible,
				model
			};
		} catch (error) {
			console.error('Error validating model availability:', error);
			throw error;
		}
	}

	static async getFeaturedModels() {
		try {
			return await prisma.aIModel.findMany({
				where: {
					isFeatured: true,
					isVisible: true,
					status: 'active'
				},
				orderBy: [
					{priority: 'desc'},
					{name: 'asc'}
				]
			});
		} catch (error) {
			console.error('Error getting featured models:', error);
			throw error;
		}
	}
}

export default OpenRouterService;
