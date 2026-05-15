const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/default');

const logDir = path.dirname(config.logging.filePath);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    if (stack) {
        return `${timestamp} [${level}] ${message}\n${stack}${metaStr}`;
    }
    return `${timestamp} [${level}] ${message}${metaStr}`;
});

const logger = winston.createLogger({
    level: config.logging.level,
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(),
                errors({ stack: true }),
                timestamp({ format: 'HH:mm:ss' }),
                customFormat
            ),
        }),
        new winston.transports.File({
            filename: config.logging.filePath,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
        }),
    ],
});

module.exports = logger;