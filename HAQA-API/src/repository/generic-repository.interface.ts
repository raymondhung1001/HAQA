import { DeepPartial, FindOptionsWhere, FindOptionsOrder } from 'typeorm';

export type PrimaryKeyInput<T = any> = string | number | Record<string, any>;

export interface IRepository<T> {
    create(data: DeepPartial<T>): Promise<T>;
    createMany(data: DeepPartial<T>[]): Promise<T[]>;
    findAll(): Promise<T[]>;
    findById(id: PrimaryKeyInput<T>): Promise<T | null>;
    findOne(options: FindOptionsWhere<T>): Promise<T | null>;
    update(id: PrimaryKeyInput<T>, data: Partial<T>): Promise<T>;
    delete(id: PrimaryKeyInput<T>): Promise<boolean>;
    exists(id: PrimaryKeyInput<T>): Promise<boolean>;
    getPrimaryKeyValues(entity: T): PrimaryKeyInput<T>;
    getPrimaryKeyMetadata(): { name: string; type: string }[];
    hasCompositePrimaryKey(): boolean;
    
    // Mist ID search methods
    isMistId(id: string | number | bigint): boolean;
    parseMistId(id: string | number | bigint): { sequence: bigint; salt1: number; salt2: number } | null;
    findByMistId(id: string | number | bigint): Promise<T | null>;
}