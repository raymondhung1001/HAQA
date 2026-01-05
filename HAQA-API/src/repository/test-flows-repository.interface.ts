import { IRepository } from './generic-repository.interface';
import { TestFlows } from '@/entities/TestFlows';

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ITestFlowsRepository extends IRepository<TestFlows> {
    search(query: string, isActive?: boolean, userId?: number, page?: number, limit?: number, sortBy?: 'createdAt' | 'updatedAt'): Promise<PaginatedResult<TestFlows>>;
}

