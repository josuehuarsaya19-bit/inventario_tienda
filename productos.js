const express = require('express');
const db = require('./db');
const { verificarToken } = require('./auth');
const {
    hasValidImageSignature,
    receiveProductImage,
    removeImage,
    urlForImage
} = require('./imageStorage');

const router = express.Router();
const idValido = /^[1-9]\d*$/;

function validarProducto({ nombre, precio, stock }) {
    return typeof nombre === 'string'
        && nombre.trim().length > 0
        && nombre.trim().length <= 150
        && Number.isFinite(Number(precio))
        && Number(precio) >= 0
        && Number.isInteger(Number(stock))
        && Number(stock) >= 0;
}

async function limpiarImagen(imageUrl) {
    try {
        await removeImage(imageUrl);
    } catch (err) {
        console.error('No se pudo limpiar un archivo de imagen:', err.message);
    }
}

async function validarArchivo(req, res) {
    if (!req.file) return true;
    if (await hasValidImageSignature(req.file)) return true;

    await limpiarImagen(urlForImage(req.file.filename));
    res.status(400).json({ error: 'El archivo no contiene una imagen JPG, PNG o WebP válida' });
    return false;
}

// READ: lista todos los productos.
router.get('/', async (req, res) => {
    try {
        const [productos] = await db.query(
            'SELECT id, nombre, descripcion, precio, stock, imagen_url FROM productos ORDER BY id'
        );
        return res.json(productos);
    } catch (err) {
        console.error('Error al consultar productos:', err.message);
        return res.status(500).json({ error: 'No se pudieron consultar los productos' });
    }
});

// SIMULATE PURCHASE: validates and decrements inventory atomically.
router.post('/simular-compra', async (req, res) => {
    const articulos = req.body && req.body.articulos;
    if (!Array.isArray(articulos) || articulos.length === 0) {
        return res.status(400).json({ error: 'La compra debe incluir al menos un producto' });
    }

    const cantidades = new Map();
    for (const articulo of articulos) {
        const id = Number(articulo && articulo.id);
        const cantidad = Number(articulo && articulo.cantidad);
        if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(cantidad) || cantidad < 1) {
            return res.status(400).json({ error: 'Cada producto debe tener un id y una cantidad válidos' });
        }
        if (cantidades.has(id)) {
            return res.status(400).json({ error: 'No se permiten productos duplicados en la compra' });
        }
        cantidades.set(id, cantidad);
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const ids = [...cantidades.keys()].sort((a, b) => a - b);
        const [productos] = await connection.query(
            'SELECT id, stock FROM productos WHERE id IN (?) ORDER BY id FOR UPDATE',
            [ids]
        );
        if (productos.length !== ids.length) {
            await connection.rollback();
            return res.status(404).json({ error: 'Uno o más productos ya no están disponibles' });
        }

        for (const producto of productos) {
            const cantidad = cantidades.get(producto.id);
            if (producto.stock < cantidad) {
                await connection.rollback();
                return res.status(409).json({
                    error: 'Stock insuficiente para uno o más productos. Actualiza el catálogo e inténtalo nuevamente.',
                    producto_id: producto.id,
                    stock_disponible: producto.stock
                });
            }
        }

        for (const id of ids) {
            const cantidad = cantidades.get(id);
            const [resultado] = await connection.query(
                'UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?',
                [cantidad, id, cantidad]
            );
            if (resultado.affectedRows !== 1) {
                throw new Error(`No se pudo actualizar el stock del producto ${id}`);
            }
        }

        await connection.commit();
        return res.json({ mensaje: 'Compra simulada y stock actualizado correctamente' });
    } catch (err) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error al revertir la compra:', rollbackError.message);
            }
        }
        console.error('Error al procesar la compra simulada:', err.message);
        return res.status(500).json({ error: 'No se pudo completar la compra simulada' });
    } finally {
        if (connection) connection.release();
    }
});

// CREATE: registra un producto nuevo.
router.post('/', verificarToken, receiveProductImage, async (req, res) => {
    const { nombre, descripcion = null, precio, stock } = req.body || {};

    if (!validarProducto({ nombre, precio, stock })) {
        await limpiarImagen(req.file && urlForImage(req.file.filename));
        return res.status(400).json({
            error: 'nombre, precio y stock son obligatorios y deben tener valores válidos'
        });
    }
    if (!(await validarArchivo(req, res))) return undefined;

    try {
        const [resultado] = await db.query(
            'INSERT INTO productos (nombre, descripcion, precio, stock, imagen_url) VALUES (?, ?, ?, ?, ?)',
            [
                nombre.trim(),
                typeof descripcion === 'string' && descripcion.trim() ? descripcion.trim() : null,
                Number(precio),
                Number(stock),
                req.file ? urlForImage(req.file.filename) : null
            ]
        );
        return res.status(201).json({
            id: resultado.insertId,
            mensaje: 'Producto creado exitosamente'
        });
    } catch (err) {
        await limpiarImagen(req.file && urlForImage(req.file.filename));
        console.error('Error al crear producto:', err.message);
        return res.status(500).json({ error: 'No se pudo crear el producto' });
    }
});

// UPDATE: reemplaza los datos editables del producto indicado.
router.put('/:id', verificarToken, receiveProductImage, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion = null, precio, stock, quitar_imagen: quitarImagen } = req.body || {};

    if (!idValido.test(id)) {
        await limpiarImagen(req.file && urlForImage(req.file.filename));
        return res.status(400).json({ error: 'El id debe ser un entero positivo' });
    }
    if (!validarProducto({ nombre, precio, stock })) {
        await limpiarImagen(req.file && urlForImage(req.file.filename));
        return res.status(400).json({
            error: 'nombre, precio y stock son obligatorios y deben tener valores válidos'
        });
    }
    if (!(await validarArchivo(req, res))) return undefined;

    try {
        const [existentes] = await db.query(
            'SELECT id, imagen_url FROM productos WHERE id = ?',
            [id]
        );
        if (existentes.length === 0) {
            await limpiarImagen(req.file && urlForImage(req.file.filename));
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        const imagenAnterior = existentes[0].imagen_url;
        const imagenNueva = req.file
            ? urlForImage(req.file.filename)
            : quitarImagen === 'true' ? null : imagenAnterior;
        await db.query(
            'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, imagen_url = ? WHERE id = ?',
            [
                nombre.trim(),
                typeof descripcion === 'string' && descripcion.trim() ? descripcion.trim() : null,
                Number(precio),
                Number(stock),
                imagenNueva,
                id
            ]
        );
        if (imagenAnterior && imagenAnterior !== imagenNueva) await limpiarImagen(imagenAnterior);
        return res.json({ mensaje: 'Producto actualizado exitosamente' });
    } catch (err) {
        await limpiarImagen(req.file && urlForImage(req.file.filename));
        console.error('Error al actualizar producto:', err.message);
        return res.status(500).json({ error: 'No se pudo actualizar el producto' });
    }
});

// DELETE: elimina el producto indicado.
router.delete('/:id', verificarToken, async (req, res) => {
    const { id } = req.params;

    if (!idValido.test(id)) {
        return res.status(400).json({ error: 'El id debe ser un entero positivo' });
    }

    try {
        const [existentes] = await db.query(
            'SELECT imagen_url FROM productos WHERE id = ?',
            [id]
        );
        if (existentes.length === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        const [resultado] = await db.query('DELETE FROM productos WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }
        await limpiarImagen(existentes[0].imagen_url);
        return res.json({ mensaje: 'Producto eliminado exitosamente' });
    } catch (err) {
        console.error('Error al eliminar producto:', err.message);
        return res.status(500).json({ error: 'No se pudo eliminar el producto' });
    }
});

module.exports = router;