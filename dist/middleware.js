"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForwardAuthMiddleware = void 0;
exports.createForwardAuthMiddleware = createForwardAuthMiddleware;
const proxy_manager_1 = require("./proxy-manager");
class ForwardAuthMiddleware {
    constructor(config) {
        this.middleware = async (req, res, next) => {
            try {
                // Remove any existing forwarded headers from the incoming request
                this.removeForwardedHeaders(req);
                // Check if this is an OAuth path
                const isOAuthPath = this.oauthPaths.includes(req.path) ||
                    req.path.startsWith("/.well-known");
                // Forward request to the OAuth proxy (including Authorization header)
                const proxyResponse = await this.proxyManager.forwardRequest(req.originalUrl || req.url, this.getProxiedURL(req), new Headers(req.headers), req.method, isOAuthPath && req.method === "POST" ? req.body : undefined);
                // For OAuth paths, always pass through the proxy response directly
                if (isOAuthPath || proxyResponse.status === 401) {
                    // Check if this is a redirect response
                    if (proxyResponse.status >= 300 && proxyResponse.status < 400) {
                        const location = proxyResponse.headers.get("location");
                        if (location) {
                            res.redirect(proxyResponse.status, location);
                            return;
                        }
                    }
                    // Set response headers (excluding hop-by-hop headers)
                    for (const [key, value] of proxyResponse.headers.entries()) {
                        if (this.isAllowedResponseHeader(key)) {
                            res.setHeader(key, value);
                        }
                    }
                    // Pass through the proxy response directly
                    res.status(proxyResponse.status);
                    res.send(proxyResponse.data);
                    return;
                }
                // For non-OAuth paths, handle authentication normally
                // Remove Authorization header before continuing
                delete req.headers.authorization;
                // If proxy returns authentication headers, add them to the request
                const forwardedHeaders = this.extractForwardedHeaders(proxyResponse.headers);
                // Add the forwarded headers to the request
                Object.entries(forwardedHeaders).forEach(([key, value]) => {
                    if (value) {
                        req.headers[key.toLowerCase()] = value;
                    }
                });
                // Continue with the authenticated request
                next();
            }
            catch (error) {
                res.status(500).json({
                    error: "Authentication service unavailable",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.proxyManager = new proxy_manager_1.ProxyManager(config);
        this.oauthPaths = [
            "/authorize",
            "/refresh",
            "/callback",
            "/token",
            "/revoke",
            "/register",
        ];
    }
    removeForwardedHeaders(req) {
        const headersToRemove = [
            "x-forwarded-user",
            "x-forwarded-email",
            "x-forwarded-name",
            "x-forwarded-access-token",
        ];
        headersToRemove.forEach((header) => {
            delete req.headers[header];
        });
    }
    extractForwardedHeaders(headers) {
        return {
            "X-Forwarded-User": headers.get("x-forwarded-user") ?? undefined,
            "X-Forwarded-Email": headers.get("x-forwarded-email") ?? undefined,
            "X-Forwarded-Name": headers.get("x-forwarded-name") ?? undefined,
            "X-Forwarded-Access-Token": headers.get("x-forwarded-access-token") ?? undefined,
        };
    }
    isAllowedResponseHeader(headerName) {
        // Filter out hop-by-hop headers and other problematic headers
        const forbiddenHeaders = [
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "transfer-encoding",
            "upgrade",
        ];
        return !forbiddenHeaders.includes(headerName.toLowerCase());
    }
    getProxiedURL(request) {
        let host = request.headers["x-forwarded-host"] ?? request.headers["host"];
        let port = request.headers["x-forwarded-port"] ?? request.headers["port"];
        if (!host) {
            throw new Error("Unable to determine proxied host");
        }
        if (Array.isArray(host)) {
            host = host[0];
        }
        if (Array.isArray(port)) {
            port = port[0];
        }
        let scheme = request.headers["x-forwarded-proto"] ??
            (host.startsWith("localhost") || host.startsWith("127.0.0.1")
                ? "http"
                : "https");
        if (Array.isArray(scheme)) {
            scheme = scheme[0];
        }
        return `${scheme}://${host}${port ? `:${port}` : ""}`;
    }
}
exports.ForwardAuthMiddleware = ForwardAuthMiddleware;
function createForwardAuthMiddleware(config) {
    const middleware = new ForwardAuthMiddleware(config);
    return middleware.middleware;
}
