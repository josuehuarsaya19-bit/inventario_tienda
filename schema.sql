CREATE DATABASE IF NOT EXISTS inventario_tienda
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE inventario_tienda;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    stock INT UNSIGNED NOT NULL DEFAULT 0,
    imagen_url VARCHAR(255) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO productos (nombre, descripcion, precio, stock)
SELECT 'Subaru Impreza WRC 2001', 'Réplica de colección · Escala 1:18 · Rally de Montecarlo', 189.90, 8
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Subaru Impreza WRC 2001');

INSERT INTO productos (nombre, descripcion, precio, stock)
SELECT 'Lancia Delta Integrale HF', 'Clásico de rally · Escala 1:24 · Edición coleccionista', 119.90, 12
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Lancia Delta Integrale HF');

INSERT INTO productos (nombre, descripcion, precio, stock)
SELECT 'Ford Fiesta WRC 2017', 'Coche de competición · Escala 1:24 · Acabado detallado', 99.90, 6
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Ford Fiesta WRC 2017');

INSERT INTO productos (nombre, descripcion, precio, stock)
SELECT 'Audi Quattro S1 E2', 'Leyenda del Grupo B · Escala 1:18 · Edición especial', 229.90, 4
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Audi Quattro S1 E2');