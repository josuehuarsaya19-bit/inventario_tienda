const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const multer = require('multer');

const uploadDirectory = path.join(__dirname, 'uploads');
const imagePrefix = '/api/uploads/';
const imageExtensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename(req, file, callback) {
        callback(null, `${randomUUID()}${imageExtensions[file.mimetype]}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter(req, file, callback) {
        if (!imageExtensions[file.mimetype]) {
            return callback(new Error('Formato no admitido. Usa imágenes JPG, PNG o WebP.'));
        }
        return callback(null, true);
    }
});

function urlForImage(filename) {
    return `${imagePrefix}${filename}`;
}

async function removeImage(imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith(imagePrefix)) return;
    const filename = imageUrl.slice(imagePrefix.length);
    if (!filename || path.basename(filename) !== filename) return;

    try {
        await fs.promises.unlink(path.join(uploadDirectory, filename));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

async function hasValidImageSignature(file) {
    const handle = await fs.promises.open(file.path, 'r');
    try {
        const header = Buffer.alloc(12);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        const bytes = header.subarray(0, bytesRead);

        if (file.mimetype === 'image/jpeg') {
            return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        }
        if (file.mimetype === 'image/png') {
            return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        }
        if (file.mimetype === 'image/webp') {
            return bytes.length >= 12
                && bytes.toString('ascii', 0, 4) === 'RIFF'
                && bytes.toString('ascii', 8, 12) === 'WEBP';
        }
        return false;
    } finally {
        await handle.close();
    }
}

function receiveProductImage(req, res, next) {
    upload.single('imagen')(req, res, (error) => {
        if (!error) return next();
        return res.status(400).json({ error: error.message || 'No se pudo procesar la imagen' });
    });
}

module.exports = {
    imagePrefix,
    receiveProductImage,
    removeImage,
    urlForImage,
    hasValidImageSignature,
    uploadDirectory
};
