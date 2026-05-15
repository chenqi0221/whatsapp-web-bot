require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const logger = require('./utils/logger');
const { startApiServer } = require('./api-server');

const PORT = process.env.NODE_PORT || 3003;

async function main() {
    logger.info(`Starting WhatsApp Bot Node.js service [${process.env.NODE_ENV || 'development'}]...`);
    
    try {
        const server = await startApiServer(PORT);
        logger.info(`API server running on port ${PORT}`);
        
        if (process.send) {
            process.send({ type: 'ready', port: PORT });
        }
    } catch (error) {
        logger.error('Failed to start server:', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

main();
