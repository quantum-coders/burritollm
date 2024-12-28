import { auth, getRouter } from '@thewebchimp/primate';
import AIModelsController from '../controllers/ai.models.controller.js';
import {isAdmin} from "../middlewares/isAdmin.js";

const router = getRouter();

// Rutas públicas
router.get('/models', AIModelsController.getAvailableModels); // Obtiene modelos visibles para el frontend}
router.get('/models/all', AIModelsController.getActiveModels); // Obtiene modelos destacados
router.get('/models/:id', AIModelsController.getModelById); // Obtiene un modelo específico

// Rutas protegidas para administradores
router.get('/models', auth, isAdmin, AIModelsController.getAllModels); // Obtiene todos los modelos (visible y no visible)
router.patch('/models/:id/visibility', auth, isAdmin, AIModelsController.toggleModelVisibility); // Toggle visibilidad
router.patch('/models/:id/featured', auth, isAdmin, AIModelsController.toggleModelFeatured); // Toggle featured status
router.patch('/models/:id/priority', auth, isAdmin, AIModelsController.updateModelPriority); // Actualizar prioridad
router.put('/models/:id', auth, isAdmin, AIModelsController.updateModel); // Actualizar información del modelo
router.post('/models/sync', auth, isAdmin, AIModelsController.syncWithOpenRouter); // Sincronizar con OpenRouter
router.patch('/models/bulk-action', auth, isAdmin, AIModelsController.bulkAction);

router.get('/check', auth, isAdmin, (req, res) => {
  res.respond({ message: 'Allowed' });
});


export { router };
