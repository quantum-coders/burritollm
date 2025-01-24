import {PrismaClient, Prisma} from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Porcentaje de markup
const MARKUP_PERCENTAGE = 30;

// Si quisieras usar valores mínimos, descomenta esto (pero implica default).
// const MIN_INPUT_COST = new Prisma.Decimal('0.00001');
// const MIN_OUTPUT_COST = new Prisma.Decimal('0.00002');

/**
 * Llama a la API de OpenRouter para obtener modelos.
 */
async function fetchOpenRouterModels() {
	try {
		const response = await axios.get('https://openrouter.ai/api/v1/models', {
			headers: {
				Authorization: `Bearer ${process.env.OPEN_ROUTER_KEY}`
			}
		});
		return response.data.data;
	} catch (error) {
		console.error('❌ Error fetching OpenRouter models:', error);
		throw error;
	}
}

/**
 * Aplica markup del 30% al precio original.
 * - NO aplica valores mínimos por defecto, ni “0” si no hay precio.
 * - Si `originalPrice` es undefined o null, retornará `null`.
 * @param {string|number} originalPrice
 * @param {boolean} isInput Indica si es costo de entrada (prompt) o de salida (completion).
 * @returns {Prisma.Decimal|null}
 */
function calculateMarkupPrice(originalPrice, isInput = true) {
	if (originalPrice == null) {
		// Si no hay precio, devolvemos null (NO guardamos default).
		return null;
	}
	const decimalPrice = new Prisma.Decimal(originalPrice.toString());
	const markup = new Prisma.Decimal(MARKUP_PERCENTAGE).dividedBy(100);
	// Aplica: price + (price * 30%)
	const finalPrice = decimalPrice.plus(decimalPrice.times(markup));
	return finalPrice;
}

/**
 * Compara dos valores (incluso objetos/JSON) y retorna la diferencia si existe.
 * @param {string} fieldName Nombre del campo a comparar.
 * @param {*} oldVal Valor antiguo (en la base de datos).
 * @param {*} newVal Valor nuevo (de OpenRouter).
 * @returns {string|null} Una descripción de la diferencia o null si no hay cambios.
 */
function compareFields(fieldName, oldVal, newVal) {
	// Para objetos (ej. JSON), comparamos su string JSON
	if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
		const oldStr = JSON.stringify(oldVal);
		const newStr = JSON.stringify(newVal);
		if (oldStr !== newStr) {
			return `${fieldName}: ${oldStr} → ${newStr}`;
		}
	} else {
		// Para valores simples.
		// Ojo: Si son Prisma.Decimal, conviene convertirlos a string antes de comparar (ver ejemplo abajo).
		const oldCompare = oldVal instanceof Prisma.Decimal ? oldVal.toString() : (oldVal ?? null);
		const newCompare = newVal instanceof Prisma.Decimal ? newVal.toString() : (newVal ?? null);
		if (oldCompare !== newCompare) {
			return `${fieldName}: ${oldCompare} → ${newCompare}`;
		}
	}
	return null;
}

/**
 * Sincroniza (compara/crea/actualiza) los modelos de OpenRouter con la BD.
 * - NO mete valores por defecto cuando no hay info en la API.
 * - SOLO guarda lo que viene de la API (con markup si hay precios).
 */
async function updateAIModels() {
	try {
		// 1. Traer los modelos desde OpenRouter
		const openRouterModels = await fetchOpenRouterModels();
		console.log(`\n=== Se encontraron ${openRouterModels.length} modelos en OpenRouter ===\n`);

		for (const model of openRouterModels) {
			// Identificadores principales
			const openrouterId = model.id;
			const name = model.name;
			console.log(`\n>>> Procesando modelo de OpenRouter: "${name}" (ID: ${openrouterId})...`);

			// Buscar si existe en la BD
			const existingModel = await prisma.aIModel.findUnique({
				where: {openrouterId}
			});

			// Extraer campos crudos de la API, SIN default
			const description = model.description; // Podría ser undefined o string
			const openrouterInputCost = model.pricing?.prompt; // undefined si no existe
			const openrouterOutputCost = model.pricing?.completion; // undefined si no existe
			const contextLength = model.context_length; // undefined si no existe
			const modelType = model.architecture?.modality; // undefined si no existe
			const modelArchitecture = model.architecture; // undefined si no existe
			const maxOutput = model.top_provider?.max_completion_tokens ||model.context_length;

			// Aplica markup si hay precio; si no, resultará null
			const inputCost = calculateMarkupPrice(openrouterInputCost, true);
			const outputCost = calculateMarkupPrice(openrouterOutputCost, false);

			// Data que usaremos para crear o actualizar
			const dataToWrite = {
				name,
				description,
				openrouterId,
				openrouterInputCost,
				openrouterOutputCost,
				contextLength,
				modelType,
				modelArchitecture,
				inputCost,
				outputCost,
				maxOutput,
				// Estos dos, en tu schema, probablemente sean Decimal no opcional:
				// Así que si no quieres meterles default, ponlos a null y asegúrate de
				// tenerlos marcados como "Decimal?" en tu schema.
				latency: new Prisma.Decimal('1.00'),    // <-- si no quieres poner default, pon null,
				throughput: new Prisma.Decimal('1.00'), // <-- pero revisa que sea Decimal? en tu schema
				status: 'active' // igual si no quieres default, pon null o lo que requiera tu DB
			};

			if (!existingModel) {
				// 2. Si NO existe -> crear
				console.log('   ❗ Modelo NO existe en la BD, creando...');
				console.log('   Datos a CREAR:\n', dataToWrite);
				console.log("RAW MODEL: ", model);
				// IMPORTANTE: Si en tu schema hay campos no-nulos y estás pasando null/undefined, dará error.
				await prisma.aIModel.create({
					data: dataToWrite
				});
				console.log(`   ✅ Modelo "${name}" creado exitosamente.`);
			} else {
				// 3. Si existe -> comparar campo por campo
				console.log(`   ✔ Encontrado en BD (ID interno: ${existingModel.id}). Comprobando diferencias...`);

				const diffs = [];
				diffs.push(compareFields('name', existingModel.name, name));
				diffs.push(compareFields('description', existingModel.description, description));
				diffs.push(compareFields('openrouterInputCost', existingModel.openrouterInputCost, openrouterInputCost));
				diffs.push(compareFields('openrouterOutputCost', existingModel.openrouterOutputCost, openrouterOutputCost));
				diffs.push(compareFields('contextLength', existingModel.contextLength, contextLength));
				diffs.push(compareFields('modelType', existingModel.modelType, modelType));
				diffs.push(compareFields('modelArchitecture', existingModel.modelArchitecture, modelArchitecture));
				diffs.push(compareFields('inputCost', existingModel.inputCost, inputCost)); // Decimal
				diffs.push(compareFields('outputCost', existingModel.outputCost, outputCost)); // Decimal
				diffs.push(compareFields('maxOutput', existingModel.maxOutput, maxOutput));
				diffs.push(compareFields('latency', existingModel.latency, dataToWrite.latency));
				diffs.push(compareFields('throughput', existingModel.throughput, dataToWrite.throughput));
				diffs.push(compareFields('status', existingModel.status, dataToWrite.status));

				// Filtra null (sin cambios)
				const filteredDiffs = diffs.filter(Boolean);

				if (filteredDiffs.length > 0) {
					console.log('   ❗ Diferencias encontradas:');
					filteredDiffs.forEach(diff => console.log('      -', diff));

					console.log('\n   Datos a ACTUALIZAR:\n', dataToWrite);
					/* await prisma.aIModel.update({
					   where: { openrouterId },
					   data: dataToWrite
					 });*/
					console.log(`   ✅ Modelo "${existingModel.name}" (ID BD: ${existingModel.id}) actualizado.`);
				} else {
					console.log('   ✅ No hay diferencias; no se actualiza nada.');
				}
			}
		}

		console.log('\n=== Proceso completado. Todos los modelos revisados. ===');
	} catch (error) {
		console.error('❌ Error actualizando modelos:', error);
	} finally {
		await prisma.$disconnect();
	}
}

// Ejecutar
updateAIModels();
