// middlewares/isAdmin.js
import { prisma } from '@thewebchimp/primate';

const isAdmin = async (req, res, next) => {
    console.log('\n[isAdmin] 🚀 Middleware iniciado');
    console.log('[isAdmin] Headers:', JSON.stringify(req.headers, null, 2));

    try {
        // Log del usuario en el request
        console.log('[isAdmin] 👤 req.user:', JSON.stringify(req.user, null, 2));

        // Verificar que existe req.user y req.user.payload (estructura del JWT)
        if (!req.user || !req.user.payload || !req.user.payload.id) {
            console.log('[isAdmin] ❌ No se encontró usuario válido en el request');
            return res.respond({
                error: 'Authentication required',
                message: 'No valid user found in request',
                status: 401
            });
        }

        const userId = req.user.payload.id;
        console.log(`[isAdmin] 🔍 Buscando usuario con ID: ${userId}`);

        // Buscar el usuario en la base de datos
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                type: true,
                status: true
            }
        });

        console.log('[isAdmin] 📋 Usuario encontrado:', JSON.stringify(user, null, 2));

        // Verificar que el usuario existe y está activo
        if (!user) {
            console.log('[isAdmin] ❌ Usuario no encontrado en la base de datos');
            return res.respond({
                error: 'Authorization failed',
                message: 'User not found',
                status: 403
            });
        }

        if (user.status !== 'Active') {
            console.log(`[isAdmin] ❌ Usuario inactivo. Status actual: ${user.status}`);
            return res.respond({
                error: 'Authorization failed',
                message: 'User inactive',
                status: 403
            });
        }

        // Verificar que el usuario es administrador
        const adminTypes = ['Admin', 'SuperAdmin'];
        console.log(`[isAdmin] 🔐 Verificando tipo de usuario: ${user.type}`);
        console.log(`[isAdmin] 📜 Tipos de admin permitidos: ${adminTypes.join(', ')}`);

        if (!adminTypes.includes(user.type)) {
            console.log('[isAdmin] ⛔ Usuario no es administrador');
            return res.respond({
                error: 'Insufficient privileges',
                message: 'Admin access required',
                status: 403
            });
        }

        // Agregar información adicional al request
        req.admin = {
            id: user.id,
            type: user.type
        };

        console.log('[isAdmin] ✅ Verificación exitosa. req.admin:', JSON.stringify(req.admin, null, 2));

        // Continuar con la siguiente función
        console.log('[isAdmin] ➡️ Continuando al siguiente middleware/controlador');
        next();
    } catch (error) {
        console.error('[isAdmin] 🔴 Error crítico:', error);
        console.error('[isAdmin] Stack trace:', error.stack);
        console.error('[isAdmin] Request details:', {
            method: req.method,
            path: req.path,
            query: req.query,
            body: req.body,
            headers: req.headers
        });

        return res.respond({
            error: error.message,
            message: 'Internal server error during admin verification',
            status: 500
        });
    }
};

export { isAdmin };
