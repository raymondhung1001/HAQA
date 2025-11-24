import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
    requestId: string;
    userId?: number;
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

    setUserId(userId: number): void {
        const context = this.getContext();
        if (context) {
            context.userId = userId;
        }
    }

    getUserId(): number | undefined {
        return this.getContext()?.userId;
    }
}

export const requestContextService = new RequestContextService();

