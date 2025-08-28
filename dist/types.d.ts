import { Request, Response, NextFunction } from "express";
export interface OAuthConfig {
    databaseDsn?: string;
    clientId: string;
    clientSecret: string;
    authorizeUrl?: string;
    scopesSupported?: string;
    encryptionKey: string;
}
export interface ForwardAuthConfig {
    proxyPort?: number;
    binaryPath?: string;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
    oauth: OAuthConfig;
    env?: Record<string, string>;
}
export interface ForwardedHeaders {
    "X-Forwarded-User"?: string;
    "X-Forwarded-Email"?: string;
    "X-Forwarded-Name"?: string;
    "X-Forwarded-Access-Token"?: string;
}
export interface ProxyProcess {
    pid: number;
    port: number;
    kill(): boolean;
}
export type ForwardAuthMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
