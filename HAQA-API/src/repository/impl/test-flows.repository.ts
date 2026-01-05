import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TestFlows } from '@/entities/TestFlows';
import { GenericRepository } from './generic.repository';
import { ITestFlowsRepository } from '../test-flows-repository.interface';

@Injectable()
export class TestFlowsRepository extends GenericRepository<TestFlows> implements ITestFlowsRepository {

    constructor(@InjectRepository(TestFlows) protected readonly repository: Repository<TestFlows>) {
        super(repository);
    }

    async search(query: string, isActive?: boolean, userId?: number, page: number = 1, limit: number = 10, sortBy: 'createdAt' | 'updatedAt' = 'createdAt'): Promise<{ data: TestFlows[]; total: number; page: number; limit: number; totalPages: number }> {
        const queryBuilder = this.repository.createQueryBuilder('testFlow');

        if (query) {
            queryBuilder.where(
                '(testFlow.name ILIKE :query OR testFlow.description ILIKE :query)',
                { query: `%${query}%` }
            );
        }

        if (isActive !== undefined) {
            queryBuilder.andWhere('testFlow.isActive = :isActive', { isActive });
        }

        if (userId) {
            queryBuilder.andWhere('testFlow.userId = :userId', { userId });
        }

        queryBuilder.orderBy(`testFlow.${sortBy}`, 'DESC');

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

