import { PrismaClient, Prisma } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const MARKUP_PERCENTAGE = 30;
const MIN_INPUT_COST = new Prisma.Decimal('0.00001');  // Usando Decimal explícitamente
const MIN_OUTPUT_COST = new Prisma.Decimal('0.00002'); // Usando Decimal explícitamente

const fetchOpenRouterModels = async () => {
    try {
        const response = await axios.get('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${process.env.OPEN_ROUTER_KEY}`
            }
        });
        return response.data.data;
    } catch (error) {
        console.error('Error fetching OpenRouter models:', error);
        throw error;
    }
};

const calculateMarkupPrice = (originalPrice, isInput = true) => {
    // Convertir el precio original a Decimal
    let price = new Prisma.Decimal(originalPrice.toString());
    const markup = new Prisma.Decimal(MARKUP_PERCENTAGE).dividedBy(100);

    // Calcular el precio con markup
    price = price.plus(price.times(markup));

    // Usar el mínimo si es necesario
    const minPrice = isInput ? MIN_INPUT_COST : MIN_OUTPUT_COST;
    return price.lessThanOrEqualTo('0') || price.lessThan(minPrice) ? minPrice : price;
};

const updateModelCosts = async () => {
    try {
        const openRouterModels = await fetchOpenRouterModels();
        let updatedCount = 0;

        for (const model of openRouterModels) {
            const existingModel = await prisma.aIModel.findUnique({
                where: { openrouterId: model.id }
            });

            if (existingModel) {
                const updatedCosts = {
                    inputCost: calculateMarkupPrice(model.pricing.prompt, true),
                    outputCost: calculateMarkupPrice(model.pricing.completion, false)
                };

                await prisma.aIModel.update({
                    where: { openrouterId: model.id },
                    data: updatedCosts
                });

                console.log(`Updated costs for model: ${existingModel.name}`);
                console.log(`Previous costs: Input=${existingModel.inputCost}, Output=${existingModel.outputCost}`);
                console.log(`New costs: Input=${updatedCosts.inputCost}, Output=${updatedCosts.outputCost}`);
                console.log('-----------------------------------');
                updatedCount++;
            }
        }

        // Verificar y actualizar modelos con costo 0
        const zeroModels = await prisma.aIModel.findMany({
            where: {
                OR: [
                    { inputCost: new Prisma.Decimal('0') },
                    { outputCost: new Prisma.Decimal('0') }
                ]
            }
        });

        if (zeroModels.length > 0) {
            console.log('\nActualizando modelos con costos en 0:');
            for (const model of zeroModels) {
                await prisma.aIModel.update({
                    where: { id: model.id },
                    data: {
                        inputCost: MIN_INPUT_COST,
                        outputCost: MIN_OUTPUT_COST
                    }
                });
                console.log(`- ${model.name} actualizado con costos mínimos`);
                updatedCount++;
            }
        }

        console.log(`\nProceso completado. ${updatedCount} modelos actualizados.`);

        // Verificación final
        const finalCheck = await prisma.aIModel.findMany({
            where: {
                OR: [
                    { inputCost: new Prisma.Decimal('0') },
                    { outputCost: new Prisma.Decimal('0') }
                ]
            }
        });

        if (finalCheck.length > 0) {
            console.log('\n⚠️ ADVERTENCIA: Aún hay modelos con costos en 0:');
            finalCheck.forEach(model => {
                console.log(`- ${model.name} (Input: ${model.inputCost}, Output: ${model.outputCost})`);
            });
        } else {
            console.log('\n✅ No quedan modelos con costos en 0');
        }

    } catch (error) {
        console.error('Error updating AI model costs:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
};

// Ejecutar la actualización
updateModelCosts().catch(console.error);
