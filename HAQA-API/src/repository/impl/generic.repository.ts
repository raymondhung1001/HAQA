import { Repository, DeepPartial, FindOptionsWhere, FindOptionsOrder, ObjectLiteral } from 'typeorm';
import { Injectable, Optional } from '@nestjs/common';

import { IRepository, PrimaryKeyInput } from '../generic-repository.interface';
import { MistService } from '@/service/mist.service';

@Injectable()
export class GenericRepository<T extends ObjectLiteral> implements IRepository<T> {

    constructor(
        protected readonly repository: Repository<T>,
        @Optional() protected readonly mistService?: MistService,
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
     * Check if an ID is a valid Mist ID
     * @param id The ID to check
     * @returns true if the ID is a valid Mist ID
     */
    isMistId(id: string | number | bigint): boolean {
        if (!this.mistService) {
            return false;
        }

        try {
            const idBigInt = BigInt(id);
            // Mist IDs are 64-bit integers, so they should be within valid range
            if (idBigInt < 0n || idBigInt > 0x7FFFFFFFFFFFFFFFn) {
                return false;
            }

            // Try to parse it - if it succeeds, it's a valid Mist ID
            this.mistService.parseId(id);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Parse a Mist ID to extract its components
     * @param id The Mist ID to parse
     * @returns Parsed components or null if not a valid Mist ID
     */
    parseMistId(id: string | number | bigint): { sequence: bigint; salt1: number; salt2: number } | null {
        if (!this.mistService) {
            return null;
        }

        try {
            return this.mistService.parseId(id);
        } catch {
            return null;
        }
    }

    /**
     * Find an entity by Mist ID
     * This is a convenience method that uses findById but validates the ID is a Mist ID first
     * @param id The Mist ID
     * @returns The entity or null if not found
     */
    async findByMistId(id: string | number | bigint): Promise<T | null> {
        if (!this.isMistId(id)) {
            return null;
        }

        // Convert to string for consistency (Mist IDs are returned as strings)
        const idString = typeof id === 'bigint' ? id.toString() : String(id);
        return await this.findById(idString as PrimaryKeyInput<T>);
    }
}