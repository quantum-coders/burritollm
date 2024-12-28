import {PrismaClient} from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const MARKUP_PERCENTAGE = 30;

const fetchOpenRouterModels = async () => {
	try {
		const response = await axios.get('https://openrouter.ai/api/v1/models', {
			headers: {
				'Authorization':  `Bearer ${process.env.OPEN_ROUTER_KEY}`
			}
		});
		return response.data.data;
	} catch (error) {
		console.error('Error fetching OpenRouter models:', error);
		throw error;
	}
};

const calculateMarkupPrice = (originalPrice) => {
	const price = parseFloat(originalPrice);
	return price + (price * (MARKUP_PERCENTAGE / 100));
};

const generateUniqueName = (baseName, count = 0) => {
	if (count === 0) return baseName;
	return `${baseName} (${count})`;
};

const updateAIModels = async () => {
	try {
		const openRouterModels = await fetchOpenRouterModels();

		for (const model of openRouterModels) {
			let currentName = model.name;
			let nameCounter = 0;
			let modelExists = true;

			// Intentar encontrar un nombre único si es necesario
			while (modelExists) {
				try {
					const existingModel = await prisma.aIModel.findFirst({
						where: {
							OR: [
								{openrouterId: model.id},
								{name: currentName}
							]
						}
					});

					if (!existingModel) {
						modelExists = false;
					} else if (existingModel.openrouterId === model.id) {
						// Si encontramos el mismo modelo por openrouterId, actualizamos
						modelExists = false;
					} else {
						// Si el nombre existe pero es otro modelo, generamos un nuevo nombre
						nameCounter++;
						currentName = generateUniqueName(model.name, nameCounter);
					}
				} catch (error) {
					console.error(`Error checking model existence: ${error}`);
					throw error;
				}
			}

			const modelData = {
				name: currentName,
				description: model.description,
				openrouterId: model.id,
				openrouterInputCost: model.pricing.prompt,
				openrouterOutputCost: model.pricing.completion,
				contextLength: model.context_length,
				modelType: model.architecture?.modality || 'text->text',
				modelArchitecture: model.architecture,
				inputCost: calculateMarkupPrice(model.pricing.prompt),
				outputCost: calculateMarkupPrice(model.pricing.completion),
				maxOutput: model.top_provider?.max_completion_tokens || 4096,
				latency: 1.00,
				throughput: 1.00,
				status: 'active'
			};

			// Usar upsert con openrouterId
			await prisma.aIModel.upsert({
				where: {openrouterId: model.id},
				update: modelData,
				create: modelData
			});

			console.log(`Updated/Created model: ${currentName}`);
		}

		console.log('All models have been successfully synchronized');
	} catch (error) {
		console.error('Error updating AI models:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
};

// Run the update
updateAIModels().catch(console.error);
