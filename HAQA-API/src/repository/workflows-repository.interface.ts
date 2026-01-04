import { IRepository } from './generic-repository.interface';
import { Workflows } from '@/entities/Workflows';

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface IWorkflowsRepository extends IRepository<Workflows> {
    search(query: string, isActive?: boolean, userId?: number, page?: number, limit?: number, sortBy?: 'createdAt' | 'updatedAt'): Promise<PaginatedResult<Workflows>>;
}

