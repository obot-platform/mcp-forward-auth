"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyManager = exports.ForwardAuthMiddleware = exports.createForwardAuthMiddleware = void 0;
var middleware_1 = require("./middleware");
Object.defineProperty(exports, "createForwardAuthMiddleware", { enumerable: true, get: function () { return middleware_1.createForwardAuthMiddleware; } });
Object.defineProperty(exports, "ForwardAuthMiddleware", { enumerable: true, get: function () { return middleware_1.ForwardAuthMiddleware; } });
var proxy_manager_1 = require("./proxy-manager");
Object.defineProperty(exports, "ProxyManager", { enumerable: true, get: function () { return proxy_manager_1.ProxyManager; } });
