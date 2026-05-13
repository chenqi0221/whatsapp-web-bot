'use strict';

const path = require('path');
const fs = require('fs');
const BaseAuthStrategy = require('./BaseAuthStrategy');

/**
 * Local directory-based authentication
 * @param {object} options - options
 * @param {string} options.clientId - Client id to distinguish instances if you are using multiple, otherwise keep null if you are using only one instance
 * @param {string} options.dataPath - Change the default path for saving session files, default is: "./.wwebjs_auth/"
 * @param {number} options.rmMaxRetries - Sets the maximum number of retries for removing the session directory
 */
class LocalAuth extends BaseAuthStrategy {
    constructor({ clientId, dataPath, rmMaxRetries } = {}) {
        super();

        const idRegex = /^[-_\w]+$/i;
        if (clientId && !idRegex.test(clientId)) {
            throw new Error(
                'Invalid clientId. Only alphanumeric characters, underscores and hyphens are allowed.',
            );
        }

        this.dataPath = path.resolve(dataPath || './.wwebjs_auth/');
        this.clientId = clientId;
        this.rmMaxRetries = rmMaxRetries ?? 4;
    }

    async beforeBrowserInitialized() {
        const puppeteerOpts = this.client.options.puppeteer;

        // 如果使用了 browserWSEndpoint 或 browserURL，说明是连接到已有浏览器
        // 此时无法更改 userDataDir，跳过设置
        if (puppeteerOpts.browserWSEndpoint || puppeteerOpts.browserURL) {
            // 仍然记录 userDataDir 用于其他操作（如 logout）
            const sessionDirName = this.clientId
                ? `session-${this.clientId}`
                : 'session';
            this.userDataDir = path.join(this.dataPath, sessionDirName);
            fs.mkdirSync(this.userDataDir, { recursive: true });
            return;
        }

        const sessionDirName = this.clientId
            ? `session-${this.clientId}`
            : 'session';
        const dirPath = path.join(this.dataPath, sessionDirName);

        if (
            puppeteerOpts.userDataDir &&
            puppeteerOpts.userDataDir !== dirPath
        ) {
            throw new Error(
                'LocalAuth is not compatible with a user-supplied userDataDir.',
            );
        }

        fs.mkdirSync(dirPath, { recursive: true });

        this.client.options.puppeteer = {
            ...puppeteerOpts,
            userDataDir: dirPath,
        };

        this.userDataDir = dirPath;
    }

    async logout() {
        if (this.userDataDir) {
            await fs.promises
                .rm(this.userDataDir, {
                    recursive: true,
                    force: true,
                    maxRetries: this.rmMaxRetries,
                })
                .catch((e) => {
                    throw new Error(e);
                });
        }
    }
}

module.exports = LocalAuth;
