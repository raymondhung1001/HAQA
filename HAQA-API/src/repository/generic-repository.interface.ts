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
    
    // Snowflake ID search methods
    isSnowflakeId(id: string | number | bigint): boolean;
    parseSnowflakeId(id: string | number | bigint): { timestamp: number; machineId: number; sequence: number; date: Date } | null;
    findBySnowflakeId(id: string | number | bigint): Promise<T | null>;
    findBySnowflakeTimestampRange(startDate: Date, endDate: Date, order?: FindOptionsOrder<T>): Promise<T[]>;
    findBySnowflakeMachineId(machineId: number, order?: FindOptionsOrder<T>): Promise<T[]>;
}