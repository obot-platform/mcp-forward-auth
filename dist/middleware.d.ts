import { Request, Response, NextFunction } from "express";
import { ForwardAuthConfig } from "./types";
export declare class ForwardAuthMiddleware {
    private proxyManager;
    private oauthPaths;
    constructor(config: ForwardAuthConfig);
    middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private removeForwardedHeaders;
    private extractForwardedHeaders;
    private isAllowedResponseHeader;
    getProxiedURL(request: Request): string;
}
export declare function createForwardAuthMiddleware(config: ForwardAuthConfig): (req: Request, res: Response, next: NextFunction) => Promise<void>;
