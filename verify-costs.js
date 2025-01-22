import {PrismaClient} from '@prisma/client';
import axios from 'axios';
import XLSX from 'xlsx';
import {format} from 'date-fns';

const prisma = new PrismaClient();
const MARKUP_PERCENTAGE = 30;

const fetchOpenRouterModels = async () => {
	try {
		const response = await axios.get('https://openrouter.ai/api/v1/models', {
			headers: {
				'Authorization': `Bearer ${process.env.OPEN_ROUTER_KEY}`
			}
		});

		console.log('\n=== OpenRouter API Response Structure ===');
		console.log('Total models:', response.data.data.length);

		if (response.data.data && response.data.data.length > 0) {
			const sampleModel = response.data.data[0];
			console.log('\n=== Sample Model Structure ===');
			console.log(JSON.stringify({
				id: sampleModel.id,
				name: sampleModel.name,
				pricing: sampleModel.pricing
			}, null, 2));
		}

		return response.data.data;
	} catch (error) {
		console.error('Error fetching OpenRouter models:', error);
		throw error;
	}
};

const calculateMarkupPrice = (originalPrice) => {
	const price = Number(originalPrice);
	const markup = price * (MARKUP_PERCENTAGE / 100);
	const finalPrice = price + markup;

	return {
		originalPrice: price,
		markup,
		finalPrice
	};
};

const formatPrice = (price) => {
	return Number(price).toFixed(8);
};

const analyzeChatCosts = async (modelId, expectedInputCost, expectedOutputCost) => {
	// Obtener los últimos 100 usos del modelo para análisis
	const recentUsages = await prisma.modelUsage.findMany({
		where: {
			idModel: modelId
		},
		include: {
			message: true,
			aiModel: true
		},
		orderBy: {
			created: 'desc'
		},
		take: 100
	});

	if (recentUsages.length === 0) {
		return null;
	}

	let totalExpectedCost = 0;
	let totalActualCost = 0;
	let issues = [];

	for (const usage of recentUsages) {
		// Calcular costo esperado basado en tokens y tipo de mensaje
		const isPrompt = usage.message.type === 'user';
		const tokenCost = isPrompt ? expectedInputCost : expectedOutputCost;
		const expectedCost = Number(usage.tokensUsed) * Number(tokenCost);
		const actualCost = Number(usage.cost);

		totalExpectedCost += expectedCost;
		totalActualCost += actualCost;

		// Detectar discrepancias significativas (más de 1%)
		const difference = Math.abs(expectedCost - actualCost);
		const percentageDiff = (difference / expectedCost) * 100;

		if (percentageDiff > 1) {
			issues.push({
				messageId: usage.idMessage,
				tokensUsed: usage.tokensUsed,
				expectedCost: expectedCost,
				actualCost: actualCost,
				difference: difference,
				percentageDiff: percentageDiff
			});
		}
	}

	return {
		totalUsages: recentUsages.length,
		totalExpectedCost,
		totalActualCost,
		averageExpectedCost: totalExpectedCost / recentUsages.length,
		averageActualCost: totalActualCost / recentUsages.length,
		issues: issues.sort((a, b) => b.percentageDiff - a.percentageDiff).slice(0, 5) // Top 5 issues
	};
};

const verifyModelCosts = async () => {
	try {
		console.log('\n=== Iniciando verificación de costos ===\n');

		// Obtener modelos de OpenRouter
		const openRouterModels = await fetchOpenRouterModels();

		// Obtener modelos de la base de datos
		const dbModels = await prisma.aIModel.findMany({
			where: {
				openrouterId: {
					not: null
				}
			},
			include: {
				modelUsages: {
					take: 1 // Solo para verificar si hay usos
				}
			}
		});

		console.log(`Modelos en OpenRouter: ${openRouterModels.length}`);
		console.log(`Modelos en Base de Datos: ${dbModels.length}\n`);

		// Crear array para el reporte
		const reportData = [];
		const usageReportData = [];
		const discrepancies = [];

		// Comparar cada modelo
		for (const orModel of openRouterModels) {
			const dbModel = dbModels.find(m => m.openrouterId === orModel.id);

			if (dbModel) {
				console.log(`\n=== Analizando modelo: ${dbModel.name} ===`);
				console.log('OpenRouter ID:', orModel.id);

				// Calcular precios con markup
				const inputPricing = calculateMarkupPrice(orModel.pricing.prompt);
				const outputPricing = calculateMarkupPrice(orModel.pricing.completion);

				// Verificar usos del modelo
				const usageAnalysis = await analyzeChatCosts(
					dbModel.id,
					inputPricing.finalPrice,
					outputPricing.finalPrice
				);

				if (usageAnalysis) {
					console.log('\n=== Análisis de Uso del Modelo ===');
					console.log(`Total de usos analizados: ${usageAnalysis.totalUsages}`);
					console.log(`Costo total esperado: ${formatPrice(usageAnalysis.totalExpectedCost)}`);
					console.log(`Costo total actual: ${formatPrice(usageAnalysis.totalActualCost)}`);

					if (usageAnalysis.issues.length > 0) {
						console.log('\nProblemas detectados:');
						usageAnalysis.issues.forEach(issue => {
							console.log(`- Message ${issue.messageId}: Diferencia de ${formatPrice(issue.difference)} (${issue.percentageDiff.toFixed(2)}%)`);
						});
					}

					usageReportData.push({
						'Model Name': dbModel.name,
						'OpenRouter ID': orModel.id,
						'Total Usages': usageAnalysis.totalUsages,
						'Expected Total Cost': formatPrice(usageAnalysis.totalExpectedCost),
						'Actual Total Cost': formatPrice(usageAnalysis.totalActualCost),
						'Average Expected Cost': formatPrice(usageAnalysis.averageExpectedCost),
						'Average Actual Cost': formatPrice(usageAnalysis.averageActualCost),
						'Issues Found': usageAnalysis.issues.length
					});
				}

				// Calcular diferencias en precios base
				const inputDiff = Math.abs(Number(dbModel.inputCost) - inputPricing.finalPrice);
				const outputDiff = Math.abs(Number(dbModel.outputCost) - outputPricing.finalPrice);

				const TOLERANCE = 0.00000001;
				const hasDiscrepancy = inputDiff > TOLERANCE || outputDiff > TOLERANCE;

				if (hasDiscrepancy) {
					discrepancies.push({
						modelId: orModel.id,
						modelName: dbModel.name,
						inputDiff,
						outputDiff
					});
				}

				reportData.push({
					'Model ID': orModel.id,
					'Model Name': dbModel.name,
					'OpenRouter Input': formatPrice(orModel.pricing.prompt),
					'OpenRouter Output': formatPrice(orModel.pricing.completion),
					'DB Input': formatPrice(dbModel.inputCost),
					'DB Output': formatPrice(dbModel.outputCost),
					'Expected Input': formatPrice(inputPricing.finalPrice),
					'Expected Output': formatPrice(outputPricing.finalPrice),
					'Input Difference': formatPrice(inputDiff),
					'Output Difference': formatPrice(outputDiff),
					'Status': hasDiscrepancy ? 'Requiere revisión' : 'OK'
				});
			} else {
				console.log(`\nModelo no encontrado en DB: ${orModel.id}`);
			}
		}

		// Crear workbook de Excel
		const wb = XLSX.utils.book_new();

		// Hoja de precios base
		const ws1 = XLSX.utils.json_to_sheet(reportData);
		XLSX.utils.book_append_sheet(wb, ws1, 'Price Verification');

		// Hoja de análisis de uso
		if (usageReportData.length > 0) {
			const ws2 = XLSX.utils.json_to_sheet(usageReportData);
			XLSX.utils.book_append_sheet(wb, ws2, 'Usage Analysis');
		}

		// Generar nombre de archivo con fecha
		const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
		const fileName = `model_cost_verification_${timestamp}.xlsx`;

		// Guardar archivo
		XLSX.writeFile(wb, fileName);

		// Imprimir resumen
		console.log('\n=== Resumen del análisis ===');
		console.log(`Total de modelos analizados: ${reportData.length}`);
		console.log(`Modelos con discrepancias en precios: ${discrepancies.length}`);
		console.log(`Modelos con uso analizado: ${usageReportData.length}`);

		if (discrepancies.length > 0) {
			console.log('\n=== Top 5 discrepancias más grandes en precios ===');
			discrepancies
				.sort((a, b) => (b.inputDiff + b.outputDiff) - (a.inputDiff + a.outputDiff))
				.slice(0, 5)
				.forEach(d => {
					console.log(`\nModelo: ${d.modelName}`);
					console.log(`ID: ${d.modelId}`);
					console.log(`Diferencia en input: ${formatPrice(d.inputDiff)}`);
					console.log(`Diferencia en output: ${formatPrice(d.outputDiff)}`);
				});
		}

		console.log(`\nReporte generado: ${fileName}`);

	} catch (error) {
		console.error('Error en la verificación:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
};

// Ejecutar verificación
verifyModelCosts().catch(console.error);
