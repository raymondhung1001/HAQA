import { IRepository } from './generic-repository.interface';
import { Workflows } from '@/entities/Workflows';

export interface IWorkflowsRepository extends IRepository<Workflows> {
    search(query: string, isActive?: boolean, userId?: number): Promise<Workflows[]>;
}

