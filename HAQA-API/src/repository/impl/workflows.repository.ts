import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Workflows } from '@/entities/Workflows';
import { GenericRepository } from './generic.repository';
import { IWorkflowsRepository } from '../workflows-repository.interface';

@Injectable()
export class WorkflowsRepository extends GenericRepository<Workflows> implements IWorkflowsRepository {

    constructor(@InjectRepository(Workflows) protected readonly repository: Repository<Workflows>) {
        super(repository);
    }

    async search(query: string, isActive?: boolean, userId?: number): Promise<Workflows[]> {
        const queryBuilder = this.repository.createQueryBuilder('workflow');

        if (query) {
            queryBuilder.where(
                '(workflow.name ILIKE :query OR workflow.description ILIKE :query)',
                { query: `%${query}%` }
            );
        }

        if (isActive !== undefined) {
            queryBuilder.andWhere('workflow.isActive = :isActive', { isActive });
        }

        if (userId) {
            queryBuilder.andWhere('workflow.userId = :userId', { userId });
        }

        queryBuilder.orderBy('workflow.createdAt', 'DESC');

        return await queryBuilder.getMany();
    }
}

