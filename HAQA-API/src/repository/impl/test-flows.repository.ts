import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TestFlows } from '@/entities/TestFlows';
import { TestFlowNodes } from '@/entities/TestFlowNodes';
import { TestFlowVersions } from '@/entities/TestFlowVersions';
import { TestFlowListItem } from '@/service/test-flows.service.types';
import { GenericRepository } from './generic.repository';
import { ITestFlowsRepository } from '../test-flows-repository.interface';

@Injectable()
export class TestFlowsRepository extends GenericRepository<TestFlows> implements ITestFlowsRepository {

    constructor(@InjectRepository(TestFlows) protected readonly repository: Repository<TestFlows>) {
        super(repository);
    }

    async search(query: string, isActive?: boolean, userId?: number, page: number = 1, limit: number = 10, sortBy: 'createdAt' | 'updatedAt' = 'createdAt'): Promise<{ data: TestFlowListItem[]; total: number; page: number; limit: number; totalPages: number }> {
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

        const total = await queryBuilder.getCount();

        queryBuilder
            .addSelect((subQuery) => {
                return subQuery
                    .select('MAX(lv.version_number)')
                    .from(TestFlowVersions, 'lv')
                    .where('lv.test_flow_id = testFlow.id');
            }, 'latestVersionNumber')
            .addSelect((subQuery) => {
                const maxVersionSubQuery = subQuery
                    .subQuery()
                    .select('MAX(lv2.version_number)')
                    .from(TestFlowVersions, 'lv2')
                    .where('lv2.test_flow_id = testFlow.id')
                    .getQuery();

                return subQuery
                    .select('COUNT(n.id)::int')
                    .from(TestFlowNodes, 'n')
                    .innerJoin(
                        TestFlowVersions,
                        'lv',
                        `lv.id = n.test_flow_version_id AND lv.test_flow_id = testFlow.id AND lv.version_number = (${maxVersionSubQuery})`,
                    );
            }, 'nodeCount');

        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).take(limit);

        const { entities, raw } = await queryBuilder.getRawAndEntities();

        const data: TestFlowListItem[] = entities.map((flow, index) => {
            const rawRow = raw[index] as Record<string, unknown> | undefined;
            const latestVersionRaw = rawRow?.latestVersionNumber;
            const nodeCountRaw = rawRow?.nodeCount;

            return {
                id: flow.id,
                userId: flow.userId,
                name: flow.name,
                description: flow.description,
                isActive: flow.isActive ?? true,
                createdAt: flow.createdAt ?? new Date(0),
                updatedAt: flow.updatedAt ?? new Date(0),
                latestVersionNumber:
                    latestVersionRaw === null || latestVersionRaw === undefined
                        ? null
                        : Number(latestVersionRaw),
                nodeCount: nodeCountRaw === null || nodeCountRaw === undefined ? 0 : Number(nodeCountRaw),
            };
        });

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

