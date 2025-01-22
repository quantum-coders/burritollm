/**
 * Compare data from OpenRouter API with what's stored in your DB (AIModel).
 *
 * 1) Llama a la API de OpenRouter con OPEN_ROUTER_KEY.
 * 2) Imprime TODO el JSON crudo que responde la API (para ver "cómo viene" la data).
 * 3) Recorre cada modelo de OpenRouter y busca en DB por openrouterId.
 * 4) Imprime lado a lado sus precios: prompt/completion vs. lo guardado.
 * 5) Aplica markup si lo deseas para ver si coincide con tu inputCost / outputCost.
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

// Ajusta si tu script de markup es distinto:
const MARKUP_PERCENTAGE = 30; // 30%
function applyMarkup(originalPrice) {
  const price = parseFloat(originalPrice);
  return price + price * (MARKUP_PERCENTAGE / 100);
}

async function main() {
  try {
    console.log('\n=== 1) Llamando a la API de OpenRouter... ===\n');

    // 1) Llamada a la API de OpenRouter
    const openRouterResponse = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${process.env.OPEN_ROUTER_KEY}`
      }
    });

    // 2) Imprimir todo el JSON tal cual, para ver cómo viene
    console.log('\n=== RAW OpenRouter Response (puede ser muy extenso) ===\n');
    console.log(JSON.stringify(openRouterResponse.data, null, 2));

    // Extraer la lista de modelos de la propiedad data
    const openRouterModels = openRouterResponse.data?.data || [];
    console.log(`\n=== Total de modelos en la respuesta: ${openRouterModels.length} ===\n`);

    if (openRouterModels.length === 0) {
      console.log('No se recibieron modelos de la API. Saliendo...');
      return;
    }

    console.log('\n=== 2) Comparando cada modelo con la BD (AIModel) ===\n');

    // Para no saturar la consola, definimos un "limit" a cuántos mostramos
    const limit = Math.min(openRouterModels.length, 10);
    if (openRouterModels.length > limit) {
      console.log(`(Solo mostraremos los primeros ${limit} para no saturar logs)\n`);
    }

    for (let i = 0; i < limit; i++) {
      const apiModel = openRouterModels[i];
      const openrouterId = apiModel.id;

      console.log('=================================================');
      console.log(`[${i + 1}] OpenRouter ID: ${openrouterId}`);
      console.log(`API Name: "${apiModel.name}"`);

      // Precios que vienen de la API (en model.pricing)
      const apiPromptPrice = apiModel.pricing?.prompt || 'N/A';
      const apiCompletionPrice = apiModel.pricing?.completion || 'N/A';

      console.log(`API Price prompt: ${apiPromptPrice}`);
      console.log(`API Price completion: ${apiCompletionPrice}`);

      // Ejemplo de precio con markup si lo deseas
      let apiPromptWithMarkup = 'N/A';
      let apiCompletionWithMarkup = 'N/A';
      if (apiModel.pricing?.prompt) {
        apiPromptWithMarkup = applyMarkup(apiModel.pricing.prompt);
      }
      if (apiModel.pricing?.completion) {
        apiCompletionWithMarkup = applyMarkup(apiModel.pricing.completion);
      }
      console.log(`(API + 30% markup) => prompt: ${apiPromptWithMarkup}, completion: ${apiCompletionWithMarkup}`);

      // 3) Buscar el modelo correspondiente en DB
      const dbModel = await prisma.aIModel.findUnique({
        where: { openrouterId }
      });

      if (!dbModel) {
        console.log('-> No se encontró este modelo en la DB (por openrouterId).');
      } else {
        console.log('\n-> Modelo en DB:');
        console.log(`   ID: ${dbModel.id}`);
        console.log(`   name: "${dbModel.name}"`);
        console.log(`   openrouterId: "${dbModel.openrouterId}"`);
        console.log(`   openrouterInputCost: ${dbModel.openrouterInputCost}`);
        console.log(`   openrouterOutputCost: ${dbModel.openrouterOutputCost}`);
        console.log(`   inputCost: ${dbModel.inputCost}`);
        console.log(`   outputCost: ${dbModel.outputCost}`);

        console.log('\n   Comparación real:');
        console.log(`   - (DB) openrouterInputCost vs (API) pricing.prompt => ${dbModel.openrouterInputCost} vs ${apiPromptPrice}`);
        console.log(`   - (DB) openrouterOutputCost vs (API) pricing.completion => ${dbModel.openrouterOutputCost} vs ${apiCompletionPrice}`);
        console.log(`   - (DB) inputCost (con markup) => ${dbModel.inputCost}, vs (API + markup) => ${apiPromptWithMarkup}`);
        console.log(`   - (DB) outputCost (con markup) => ${dbModel.outputCost}, vs (API + markup) => ${apiCompletionWithMarkup}`);
      }
      console.log('\n');
    }

    console.log('\n=== Fin de la comparación ===\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
main().catch(console.error);
