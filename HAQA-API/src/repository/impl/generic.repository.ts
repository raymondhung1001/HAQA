import { Repository, DeepPartial, FindOptionsWhere, FindOptionsOrder, ObjectLiteral } from 'typeorm';
import { Injectable, Optional } from '@nestjs/common';

import { IRepository, PrimaryKeyInput } from '../generic-repository.interface';
import { SnowflakeService } from '@/service/snowflake.service';

@Injectable()
export class GenericRepository<T extends ObjectLiteral> implements IRepository<T> {

    constructor(
        protected readonly repository: Repository<T>,
        @Optional() protected readonly snowflakeService?: SnowflakeService,
    ) { }

    private buildPrimaryKeyCondition(id: PrimaryKeyInput<T>): FindOptionsWhere<T> {
        const metadata = this.repository.metadata;
        const primaryColumns = metadata.primaryColumns;

        if (primaryColumns.length === 0) {
            throw new Error(`No primary key defined for entity ${metadata.name}`);
        }

        if (primaryColumns.length === 1) {
            if (typeof id === 'object' && id !== null) {
                
                const primaryKeyName = primaryColumns[0].propertyName;
                const keyValue = (id as any)[primaryKeyName];
                if (keyValue !== undefined) {
                    return { [primaryKeyName]: keyValue } as FindOptionsWhere<T>;
                }
            }

            const primaryKeyName = primaryColumns[0].propertyName;
            return { [primaryKeyName]: id } as FindOptionsWhere<T>;
        }

        if (typeof id !== 'object' || id === null) {
            const keyNames = primaryColumns.map(col => col.propertyName).join(', ');
            throw new Error(
                `Composite primary key detected for entity ${metadata.name}. ` +
                `Please provide an object with keys: ${keyNames}`
            );
        }

        const condition: any = {};
        const missingKeys: string[] = [];

        for (const column of primaryColumns) {
            const keyName = column.propertyName;
            const value = (id as any)[keyName];

            if (value === undefined || value === null) {
                missingKeys.push(keyName);
            } else {
                condition[keyName] = value;
            }
        }

        if (missingKeys.length > 0) {
            throw new Error(
                `Missing values for primary key(s): ${missingKeys.join(', ')} ` +
                `in entity ${metadata.name}`
            );
        }

        return condition as FindOptionsWhere<T>;
    }

    async create(data: DeepPartial<T>): Promise<T> {
        const entity = this.repository.create(data);
        return await this.repository.save(entity as DeepPartial<T> as T);
    }

    async createMany(data: DeepPartial<T>[]): Promise<T[]> {
        const entities = this.repository.create(data);
        return await this.repository.save(entities as DeepPartial<T>[] as T[]);
    }

    async findAll(): Promise<T[]> {
        return await this.repository.find();
    }

    async findById(id: PrimaryKeyInput<T>): Promise<T | null> {
        try {
            const whereCondition = this.buildPrimaryKeyCondition(id);
            return await this.repository.findOne({ where: whereCondition });
        } catch (error) {
            console.error('Error finding entity by id:', error);
            throw error;
        }
    }

    async findOne(options: FindOptionsWhere<T>): Promise<T | null> {
        return await this.repository.findOne({ where: options });
    }

    async update(id: PrimaryKeyInput<T>, data: Partial<T>): Promise<T> {
        const entity = await this.findById(id);

        if (!entity) {
            const metadata = this.repository.metadata;
            const idString = typeof id === 'object' ? JSON.stringify(id) : String(id);
            throw new Error(`Entity ${metadata.name} with id ${idString} not found`);
        }

        const metadata = this.repository.metadata;
        const updateData = { ...data };
        for (const column of metadata.primaryColumns) {
            delete (updateData as any)[column.propertyName];
        }

        const updatedEntity = this.repository.merge(entity, updateData as DeepPartial<T>);
        return await this.repository.save(updatedEntity);
    }

    async delete(id: PrimaryKeyInput<T>): Promise<boolean> {
        try {
            const whereCondition = this.buildPrimaryKeyCondition(id);
            const result = await this.repository.delete(whereCondition);
            return result.affected !== 0;
        } catch (error) {
            console.error('Error deleting entity:', error);
            throw error;
        }
    }

    getPrimaryKeyValues(entity: T): PrimaryKeyInput<T> {
        const metadata = this.repository.metadata;
        const primaryColumns = metadata.primaryColumns;

        if (primaryColumns.length === 0) {
            throw new Error(`No primary key defined for entity ${metadata.name}`);
        }

        if (primaryColumns.length === 1) {
            const value = entity[primaryColumns[0].propertyName as keyof T];
            return value as unknown as PrimaryKeyInput<T>;
        }

        const keys: Record<string, any> = {};
        for (const column of primaryColumns) {
            keys[column.propertyName] = entity[column.propertyName as keyof T];
        }
        return keys;
    }

    async exists(id: PrimaryKeyInput<T>): Promise<boolean> {
        try {
            const entity = await this.findById(id);
            return entity !== null;
        } catch {
            return false;
        }
    }

    getPrimaryKeyMetadata(): { name: string; type: string }[] {
        const metadata = this.repository.metadata;
        return metadata.primaryColumns.map(column => ({
            name: column.propertyName,
            type: column.type as string
        }));
    }

    hasCompositePrimaryKey(): boolean {
        return this.repository.metadata.primaryColumns.length > 1;
    }

    /**
     * Check if an ID is a valid Snowflake ID
     * @param id The ID to check
     * @returns true if the ID is a valid Snowflake ID
     */
    isSnowflakeId(id: string | number | bigint): boolean {
        if (!this.snowflakeService) {
            return false;
        }

        try {
            const idBigInt = BigInt(id);
            // Snowflake IDs are 64-bit integers, so they should be within valid range
            // and have a reasonable timestamp component (not too old or too far in future)
            if (idBigInt < 0n || idBigInt > 0x7FFFFFFFFFFFFFFFn) {
                return false;
            }

            // Try to parse it - if it succeeds, it's a valid snowflake ID
            this.snowflakeService.parseId(id);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Parse a Snowflake ID to extract its components
     * @param id The Snowflake ID to parse
     * @returns Parsed components or null if not a valid Snowflake ID
     */
    parseSnowflakeId(id: string | number | bigint): { timestamp: number; machineId: number; sequence: number; date: Date } | null {
        if (!this.snowflakeService) {
            return null;
        }

        try {
            return this.snowflakeService.parseId(id);
        } catch {
            return null;
        }
    }

    /**
     * Find an entity by Snowflake ID
     * This is a convenience method that uses findById but validates the ID is a Snowflake ID first
     * @param id The Snowflake ID
     * @returns The entity or null if not found
     */
    async findBySnowflakeId(id: string | number | bigint): Promise<T | null> {
        if (!this.isSnowflakeId(id)) {
            return null;
        }

        // Convert to string for consistency (Snowflake IDs are returned as strings)
        const idString = typeof id === 'bigint' ? id.toString() : String(id);
        return await this.findById(idString as PrimaryKeyInput<T>);
    }

    /**
     * Find entities created within a timestamp range based on Snowflake ID timestamps
     * This searches for entities whose ID (if it's a Snowflake ID) falls within the date range
     * @param startDate Start of the date range
     * @param endDate End of the date range
     * @param order Optional ordering
     * @returns Array of entities found in the timestamp range
     */
    async findBySnowflakeTimestampRange(
        startDate: Date,
        endDate: Date,
        order?: FindOptionsOrder<T>
    ): Promise<T[]> {
        if (!this.snowflakeService) {
            throw new Error('SnowflakeService is not available. Cannot search by Snowflake timestamp range.');
        }

        const metadata = this.repository.metadata;
        const primaryColumns = metadata.primaryColumns;

        if (primaryColumns.length !== 1) {
            throw new Error(
                `findBySnowflakeTimestampRange only supports entities with a single primary key. ` +
                `Entity ${metadata.name} has ${primaryColumns.length} primary key(s).`
            );
        }

        const primaryKeyName = primaryColumns[0].propertyName;
        const startTimestamp = startDate.getTime();
        const endTimestamp = endDate.getTime();

        // Get all entities and filter by Snowflake ID timestamp
        // Note: This is not the most efficient approach for large datasets.
        // For better performance, consider adding a created_at column and indexing it.
        const allEntities = await this.repository.find({ order });

        const filteredEntities: T[] = [];

        for (const entity of allEntities) {
            const id = entity[primaryKeyName as keyof T];
            if (id === null || id === undefined) {
                continue;
            }

            const parsed = this.parseSnowflakeId(id as string | number | bigint);
            if (parsed && parsed.timestamp >= startTimestamp && parsed.timestamp <= endTimestamp) {
                filteredEntities.push(entity);
            }
        }

        return filteredEntities;
    }

    /**
     * Find entities created by a specific machine ID based on Snowflake ID
     * @param machineId The machine ID (0-1023)
     * @param order Optional ordering
     * @returns Array of entities found with the specified machine ID
     */
    async findBySnowflakeMachineId(
        machineId: number,
        order?: FindOptionsOrder<T>
    ): Promise<T[]> {
        if (!this.snowflakeService) {
            throw new Error('SnowflakeService is not available. Cannot search by Snowflake machine ID.');
        }

        if (machineId < 0 || machineId > 1023) {
            throw new Error(`Machine ID must be between 0 and 1023, got ${machineId}`);
        }

        const metadata = this.repository.metadata;
        const primaryColumns = metadata.primaryColumns;

        if (primaryColumns.length !== 1) {
            throw new Error(
                `findBySnowflakeMachineId only supports entities with a single primary key. ` +
                `Entity ${metadata.name} has ${primaryColumns.length} primary key(s).`
            );
        }

        // Get all entities and filter by Snowflake ID machine ID
        // Note: This is not the most efficient approach for large datasets.
        const allEntities = await this.repository.find({ order });

        const filteredEntities: T[] = [];
        const primaryKeyName = primaryColumns[0].propertyName;

        for (const entity of allEntities) {
            const id = entity[primaryKeyName as keyof T];
            if (id === null || id === undefined) {
                continue;
            }

            const parsed = this.parseSnowflakeId(id as string | number | bigint);
            if (parsed && parsed.machineId === machineId) {
                filteredEntities.push(entity);
            }
        }

        return filteredEntities;
    }
}