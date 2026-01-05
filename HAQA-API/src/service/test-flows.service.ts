import { Injectable } from '@nestjs/common';
import { TestFlowsRepository } from '@/repository';
import { TestFlows } from '@/entities/TestFlows';
import { DeepPartial } from 'typeorm';
import { randomUUID } from 'crypto';

export interface CreateTestFlowDto {
    name: string;
    description?: string;
    isActive?: boolean;
}

export interface SearchTestFlowsDto {
    query?: string;
    isActive?: boolean;
    userId?: number;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt';
}

@Injectable()
export class TestFlowsService {
    constructor(
        private readonly testFlowsRepository: TestFlowsRepository,
    ) {}

    async create(data: CreateTestFlowDto, userId: number): Promise<TestFlows> {
        const testFlowData: DeepPartial<TestFlows> = {
            id: randomUUID(),
            ...data,
            userId,
            isActive: data.isActive !== undefined ? data.isActive : true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        return await this.testFlowsRepository.create(testFlowData);
    }

    async search(searchDto: SearchTestFlowsDto) {
        const page = searchDto.page && searchDto.page > 0 ? searchDto.page : 1;
        const limit = searchDto.limit && searchDto.limit > 0 ? Math.min(searchDto.limit, 100) : 10; // Max 100 items per page
        const sortBy = searchDto.sortBy || 'createdAt';
        
        return await this.testFlowsRepository.search(
            searchDto.query || '',
            searchDto.isActive,
            searchDto.userId,
            page,
            limit,
            sortBy
        );
    }

    async findById(id: string): Promise<TestFlows | null> {
        return await this.testFlowsRepository.findById(id);
    }

    async findAll(): Promise<TestFlows[]> {
        return await this.testFlowsRepository.findAll();
    }
}

