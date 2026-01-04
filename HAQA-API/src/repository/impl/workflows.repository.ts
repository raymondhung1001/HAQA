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

    async search(query: string, isActive?: boolean, userId?: number, page: number = 1, limit: number = 10, sortBy: 'createdAt' | 'updatedAt' = 'createdAt'): Promise<{ data: Workflows[]; total: number; page: number; limit: number; totalPages: number }> {
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

        queryBuilder.orderBy(`workflow.${sortBy}`, 'DESC');

        // Get total count before pagination
        const total = await queryBuilder.getCount();

        // Apply pagination
        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).take(limit);

        const data = await queryBuilder.getMany();

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            total,
            page,
            limit,
            totalPages,
        };
    }
}

