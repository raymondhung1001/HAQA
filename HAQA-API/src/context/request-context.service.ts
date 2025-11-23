import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
    requestId: string;
}

class RequestContextService {
    private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

    run<T>(context: RequestContext, callback: () => T): T {
        return this.asyncLocalStorage.run(context, callback);
    }

    getContext(): RequestContext | undefined {
        return this.asyncLocalStorage.getStore();
    }

    getRequestId(): string | undefined {
        return this.getContext()?.requestId;
    }
}

export const requestContextService = new RequestContextService();

