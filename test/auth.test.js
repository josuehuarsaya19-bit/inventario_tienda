const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret-for-auth-middleware-only-32-chars';

const jwt = require('jsonwebtoken');
const { verificarToken } = require('../auth');

function crearRespuesta() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test('rechaza solicitudes sin token Bearer', () => {
    const req = { get: () => undefined };
    const res = crearRespuesta();
    let nextCalled = false;

    verificarToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
});

test('acepta un JWT válido y adjunta la identidad del usuario', () => {
    const token = jwt.sign(
        { email: 'usuario@example.com' },
        process.env.JWT_SECRET,
        { subject: '42', expiresIn: '1h' }
    );
    const req = { get: () => `Bearer ${token}` };
    const res = crearRespuesta();
    let nextCalled = false;

    verificarToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.usuario, { id: '42', email: 'usuario@example.com' });
});

test('rechaza un token inválido', () => {
    const req = { get: () => 'Bearer token-invalido' };
    const res = crearRespuesta();
    let nextCalled = false;

    verificarToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
});