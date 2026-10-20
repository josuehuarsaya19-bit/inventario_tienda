const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const PASSWORD_MIN_LENGTH = 8;
const TOKEN_EXPIRATION = '1h';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('Configura JWT_SECRET con al menos 32 caracteres en el archivo .env');
}

// Registra usuarios guardando solamente el hash de su contraseña.
router.post('/register', async (req, res) => {
    const { nombre, email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (typeof nombre !== 'string' || nombre.trim().length === 0 || nombre.trim().length > 100) {
        return res.status(400).json({ error: 'nombre es obligatorio y debe tener hasta 100 caracteres' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Debes proporcionar un correo electrónico válido' });
    }
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const [resultado] = await db.query(
            'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
            [nombre.trim(), normalizedEmail, passwordHash]
        );

        return res.status(201).json({
            id: resultado.insertId,
            nombre: nombre.trim(),
            email: normalizedEmail,
            mensaje: 'Usuario registrado exitosamente'
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
        }
        console.error('Error al registrar usuario:', err.message);
        return res.status(500).json({ error: 'No se pudo registrar el usuario' });
    }
});

// Verifica las credenciales y entrega un JWT firmado con expiración.
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || typeof password !== 'string') {
        return res.status(400).json({ error: 'email y password son obligatorios' });
    }

    try {
        const [usuarios] = await db.query(
            'SELECT id, nombre, email, password FROM usuarios WHERE email = ? LIMIT 1',
            [normalizedEmail]
        );
        const usuario = usuarios[0];

        if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        const token = jwt.sign(
            { email: usuario.email },
            JWT_SECRET,
            { subject: String(usuario.id), expiresIn: TOKEN_EXPIRATION }
        );

        return res.json({
            token,
            tipo: 'Bearer',
            expiraEn: TOKEN_EXPIRATION,
            usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email }
        });
    } catch (err) {
        console.error('Error al iniciar sesión:', err.message);
        return res.status(500).json({ error: 'No se pudo iniciar sesión' });
    }
});

// Protege rutas comprobando la firma y la expiración del token Bearer.
function verificarToken(req, res, next) {
    const authorization = req.get('Authorization');
    const match = authorization && authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        return res.status(401).json({ error: 'Se requiere un token Bearer válido' });
    }

    try {
        const payload = jwt.verify(match[1], JWT_SECRET);
        req.usuario = { id: payload.sub, email: payload.email };
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'El token es inválido o ha expirado' });
    }
}

module.exports = { router, verificarToken };