"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyManager = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
class ProxyManager {
    constructor(config) {
        this.process = null;
        this.isStarting = false;
        this.validateConfig(config);
        this.config = {
            proxyPort: config.proxyPort || 8081,
            binaryPath: config.binaryPath || this.getDefaultBinaryPath(),
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000,
            oauth: config.oauth,
            env: config.env || {},
        };
    }
    validateConfig(config) {
        if (!config.oauth) {
            throw new Error("OAuth configuration is required");
        }
        const { clientId, encryptionKey } = config.oauth;
        if (!clientId) {
            throw new Error("clientId is required in oauth configuration");
        }
        if (!encryptionKey) {
            throw new Error("encryptionKey is required in oauth configuration");
        }
    }
    getDefaultBinaryPath() {
        return path_1.default.join(__dirname, "..", "bin", "mcp-oauth-proxy");
    }
    async ensureProxyRunning() {
        if (await this.isProxyHealthy()) {
            return;
        }
        if (this.isStarting) {
            // Wait for the current startup attempt
            await this.waitForProxy();
            return;
        }
        await this.startProxy();
    }
    async isProxyHealthy() {
        try {
            const response = await fetch(`http://localhost:${this.config.proxyPort}/health`, { signal: AbortSignal.timeout(5000) });
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
    async startProxy() {
        if (this.isStarting) {
            return;
        }
        this.isStarting = true;
        try {
            await this.ensureBinaryExists();
            const env = {
                PORT: this.config.proxyPort.toString(),
                // OAuth configuration environment variables
                DATABASE_DSN: this.config.oauth.databaseDsn,
                OAUTH_CLIENT_ID: this.config.oauth.clientId,
                OAUTH_CLIENT_SECRET: this.config.oauth.clientSecret,
                OAUTH_AUTHORIZE_URL: this.config.oauth.authorizeUrl,
                SCOPES_SUPPORTED: this.config.oauth.scopesSupported,
                ENCRYPTION_KEY: this.config.oauth.encryptionKey,
                PROXY_MODE: "forward_auth",
                // Additional environment variables
                ...this.config.env,
            };
            this.process = (0, child_process_1.spawn)(this.config.binaryPath, [], {
                env,
                stdio: ["ignore", "pipe", "pipe"],
            });
            this.process.stdout?.on("data", (data) => {
                console.log(`mcp-oauth-proxy: ${data}`);
            });
            this.process.stderr?.on("data", (data) => {
                console.error(`mcp-oauth-proxy error: ${data}`);
            });
            this.process.on("exit", (code) => {
                console.log(`mcp-oauth-proxy exited with code ${code}`);
                this.process = null;
            });
            this.process.on("error", (error) => {
                console.error("Failed to start mcp-oauth-proxy:", error);
                this.process = null;
                this.isStarting = false;
            });
            await this.waitForProxy();
        }
        catch (error) {
            this.isStarting = false;
            throw error;
        }
        this.isStarting = false;
    }
    async ensureBinaryExists() {
        try {
            await fs_1.promises.access(this.config.binaryPath, fs_1.promises.constants.F_OK | fs_1.promises.constants.X_OK);
        }
        catch {
            throw new Error(`mcp-oauth-proxy binary not found at ${this.config.binaryPath}. ` +
                "Make sure the postinstall script ran successfully or provide a custom binaryPath.");
        }
    }
    async waitForProxy() {
        let attempts = 0;
        const maxAttempts = Math.ceil(this.config.timeout / this.config.retryDelay);
        while (attempts < maxAttempts) {
            if (await this.isProxyHealthy()) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
            attempts++;
        }
        throw new Error(`mcp-oauth-proxy failed to become healthy within ${this.config.timeout}ms`);
    }
    async forwardRequest(originalUrl, proxiedURL, headers, method, body) {
        await this.ensureProxyRunning();
        const proxyUrl = `http://localhost:${this.config.proxyPort}${originalUrl}`;
        // Copy the headers and remove the Content-length header
        const headersCopy = new Headers(headers);
        headersCopy.delete("Content-Length");
        headersCopy.set("X-Mcp-Oauth-Proxy-URL", proxiedURL);
        const contentType = headersCopy.get("Content-Type");
        if (contentType === "application/json") {
            body = JSON.stringify(body);
        }
        else if (contentType === "application/x-www-form-urlencoded") {
            // Handle form-encoded data
            if (typeof body === "object" && body !== null) {
                body = new URLSearchParams(body).toString();
            }
            else if (typeof body === "string") {
                // Body is already a string, pass it through
                body = body;
            }
        }
        const response = await fetch(proxyUrl, {
            method: method,
            headers: headersCopy,
            redirect: "manual",
            body: body,
            signal: AbortSignal.timeout(this.config.timeout),
        });
        // Convert ReadableStream to Buffer for Express compatibility
        let responseData = null;
        if (response.body) {
            const reader = response.body.getReader();
            const chunks = [];
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    chunks.push(value);
                }
                // Concatenate all chunks into a single buffer
                const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                const buffer = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    buffer.set(chunk, offset);
                    offset += chunk.length;
                }
                responseData = Buffer.from(buffer);
            }
            finally {
                reader.releaseLock();
            }
        }
        return {
            status: response.status,
            headers: response.headers,
            data: responseData,
        };
    }
    stop() {
        if (this.process) {
            this.process.kill("SIGTERM");
            this.process = null;
        }
    }
    getStatus() {
        if (!this.process || !this.process.pid) {
            return null;
        }
        return {
            pid: this.process.pid,
            port: this.config.proxyPort,
            kill: () => {
                this.stop();
                return true;
            },
        };
    }
}
exports.ProxyManager = ProxyManager;
