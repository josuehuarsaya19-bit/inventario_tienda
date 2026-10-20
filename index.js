const express = require('express');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

const { router: authRoutes } = require('./auth');
const productosRoutes = require('./productos');
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);

app.get('/', (req, res) => {
    res.json({ mensaje: 'API de Inventario funcionando correctamente' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'El cuerpo de la solicitud no contiene JSON válido' });
    }

    console.error('Error inesperado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
});

async function iniciarServidor() {
    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        throw new Error('PORT debe ser un número entre 1 y 65535');
    }

    await db.query('SELECT 1');

    const server = app.listen(PORT, () => {
        console.log(`Servidor HTTP escuchando en http://localhost:${PORT}`);
    });

    const cerrarServidor = (signal) => {
        console.log(`Señal ${signal} recibida; cerrando servidor...`);
        server.close(async () => {
            await db.end();
            process.exit(0);
        });
    };

    process.once('SIGINT', () => cerrarServidor('SIGINT'));
    process.once('SIGTERM', () => cerrarServidor('SIGTERM'));
}

iniciarServidor().catch((err) => {
    console.error('No se pudo iniciar el servidor:', err.message);
    process.exitCode = 1;
});