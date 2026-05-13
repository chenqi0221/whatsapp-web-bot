const { MessageMedia } = require('whatsapp-web.js');

function createMediaRoutes(app, clientRef, clientState) {
    // 发送媒体文件
    app.post('/api/send-media', async (req, res) => {
        const { to, media, caption, type } = req.body;
        
        if (!to || !media) {
            return res.json({ success: false, error: '接收者和媒体数据不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            let messageMedia;
            
            if (media.data && media.mimetype) {
                // Base64 数据
                messageMedia = new MessageMedia(media.mimetype, media.data, media.filename);
            } else if (media.url) {
                // URL
                messageMedia = await MessageMedia.fromUrl(media.url);
            } else {
                return res.json({ success: false, error: '无效的媒体数据' });
            }

            const options = {};
            if (caption) options.caption = caption;
            if (type === 'document') options.sendMediaAsDocument = true;

            const result = await clientRef.client.sendMessage(to, messageMedia, options);
            res.json({ success: true, messageId: result.id._serialized });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 发送贴纸
    app.post('/api/send-sticker', async (req, res) => {
        const { to, media } = req.body;
        
        if (!to || !media) {
            return res.json({ success: false, error: '接收者和媒体数据不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            let messageMedia;
            
            if (media.data && media.mimetype) {
                messageMedia = new MessageMedia(media.mimetype, media.data);
            } else if (media.url) {
                messageMedia = await MessageMedia.fromUrl(media.url);
            } else {
                return res.json({ success: false, error: '无效的媒体数据' });
            }

            const result = await clientRef.client.sendMessage(to, messageMedia, {
                sendMediaAsSticker: true
            });
            res.json({ success: true, messageId: result.id._serialized });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 发送位置
    app.post('/api/send-location', async (req, res) => {
        const { to, lat, lng, title } = req.body;
        
        if (!to || lat === undefined || lng === undefined) {
            return res.json({ success: false, error: '接收者、纬度和经度不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const location = new (require('whatsapp-web.js')).Location(lat, lng, title || '');
            const result = await clientRef.client.sendMessage(to, location);
            res.json({ success: true, messageId: result.id._serialized });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 发送投票
    app.post('/api/send-poll', async (req, res) => {
        const { to, question, options, allowMultiple } = req.body;
        
        if (!to || !question || !options || !Array.isArray(options)) {
            return res.json({ success: false, error: '接收者、问题和选项不能为空' });
        }

        if (!clientRef.client || clientState.status !== 'ready') {
            return res.json({ success: false, error: 'Client not ready' });
        }

        try {
            const poll = new (require('whatsapp-web.js')).Poll(question, options, {
                allowMultipleAnswers: allowMultiple || false
            });
            const result = await clientRef.client.sendMessage(to, poll);
            res.json({ success: true, messageId: result.id._serialized });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });

    // 上传文件
    app.post('/api/upload', async (req, res) => {
        const { file } = req.body;
        
        if (!file || !file.data) {
            return res.json({ success: false, error: '文件数据不能为空' });
        }

        try {
            // 返回文件信息，实际发送时使用 send-media
            res.json({ 
                success: true, 
                file: {
                    mimetype: file.mimetype,
                    filename: file.filename,
                    size: file.data.length
                }
            });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    });
}

module.exports = { createMediaRoutes };
