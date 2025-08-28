import { ForwardAuthConfig, ProxyProcess } from "./types";
export declare class ProxyManager {
    private config;
    private process;
    private isStarting;
    constructor(config: ForwardAuthConfig);
    private validateConfig;
    private getDefaultBinaryPath;
    ensureProxyRunning(): Promise<void>;
    private isProxyHealthy;
    private startProxy;
    private ensureBinaryExists;
    private waitForProxy;
    forwardRequest(originalUrl: string, proxiedURL: string, headers: Headers, method: string, body: any): Promise<{
        status: number;
        headers: Headers;
        data: any;
    }>;
    stop(): void;
    getStatus(): ProxyProcess | null;
}
