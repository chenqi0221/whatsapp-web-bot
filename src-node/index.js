const { startApiServer } = require('./api-server');

const PORT = process.env.NODE_PORT || 3003;

async function main() {
    console.log('Starting WhatsApp Bot Node.js service...');
    
    try {
        const server = await startApiServer(PORT);
        console.log(`API server running on port ${PORT}`);
        
        if (process.send) {
            process.send({ type: 'ready', port: PORT });
        }
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

main();
