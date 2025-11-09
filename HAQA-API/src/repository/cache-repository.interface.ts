export interface ICacheRepository<T> {
    get(id: string): Promise<T | null>;
    getAll(): Promise<T[]>;
    getMany(ids: string[]): Promise<T[]>;
    set(id: string, entity: T, ttl?: number): Promise<T>;
    update(id: string, entity: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    exists(id: string): Promise<boolean>;
    invalidate(): Promise<void>;
    size(): Promise<number>;
}