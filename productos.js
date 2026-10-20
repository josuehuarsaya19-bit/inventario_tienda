const express = require('express');
const db = require('./db');
const { verificarToken } = require('./auth');

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

// READ: lista todos los productos.
router.get('/', async (req, res) => {
    try {
        const [productos] = await db.query(
            'SELECT id, nombre, descripcion, precio, stock FROM productos ORDER BY id'
        );
        return res.json(productos);
    } catch (err) {
        console.error('Error al consultar productos:', err.message);
        return res.status(500).json({ error: 'No se pudieron consultar los productos' });
    }
});

// CREATE: registra un producto nuevo.
router.post('/', verificarToken, async (req, res) => {
    const { nombre, descripcion = null, precio, stock } = req.body;

    if (!validarProducto({ nombre, precio, stock })) {
        return res.status(400).json({
            error: 'nombre, precio y stock son obligatorios y deben tener valores válidos'
        });
    }

    try {
        const [resultado] = await db.query(
            'INSERT INTO productos (nombre, descripcion, precio, stock) VALUES (?, ?, ?, ?)',
            [nombre.trim(), descripcion, Number(precio), Number(stock)]
        );
        return res.status(201).json({
            id: resultado.insertId,
            mensaje: 'Producto creado exitosamente'
        });
    } catch (err) {
        console.error('Error al crear producto:', err.message);
        return res.status(500).json({ error: 'No se pudo crear el producto' });
    }
});

// UPDATE: reemplaza los datos editables del producto indicado.
router.put('/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion = null, precio, stock } = req.body;

    if (!idValido.test(id)) {
        return res.status(400).json({ error: 'El id debe ser un entero positivo' });
    }
    if (!validarProducto({ nombre, precio, stock })) {
        return res.status(400).json({
            error: 'nombre, precio y stock son obligatorios y deben tener valores válidos'
        });
    }

    try {
        const [existentes] = await db.query('SELECT id FROM productos WHERE id = ?', [id]);
        if (existentes.length === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        await db.query(
            'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ? WHERE id = ?',
            [nombre.trim(), descripcion, Number(precio), Number(stock), id]
        );
        return res.json({ mensaje: 'Producto actualizado exitosamente' });
    } catch (err) {
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
        const [resultado] = await db.query('DELETE FROM productos WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }
        return res.json({ mensaje: 'Producto eliminado exitosamente' });
    } catch (err) {
        console.error('Error al eliminar producto:', err.message);
        return res.status(500).json({ error: 'No se pudo eliminar el producto' });
    }
});

module.exports = router;