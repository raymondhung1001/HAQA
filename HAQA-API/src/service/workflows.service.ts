import { Injectable } from '@nestjs/common';
import { WorkflowsRepository } from '@/repository';
import { Workflows } from '@/entities/Workflows';
import { DeepPartial } from 'typeorm';
import { randomUUID } from 'crypto';

export interface CreateWorkflowDto {
    name: string;
    description?: string;
    isActive?: boolean;
}

export interface SearchWorkflowsDto {
    query?: string;
    isActive?: boolean;
    userId?: number;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt';
}

@Injectable()
export class WorkflowsService {
    constructor(
        private readonly workflowsRepository: WorkflowsRepository,
    ) {}

    async create(data: CreateWorkflowDto, userId: number): Promise<Workflows> {
        const workflowData: DeepPartial<Workflows> = {
            id: randomUUID(),
            ...data,
            userId,
            isActive: data.isActive !== undefined ? data.isActive : true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        return await this.workflowsRepository.create(workflowData);
    }

    async search(searchDto: SearchWorkflowsDto) {
        const page = searchDto.page && searchDto.page > 0 ? searchDto.page : 1;
        const limit = searchDto.limit && searchDto.limit > 0 ? Math.min(searchDto.limit, 100) : 10; // Max 100 items per page
        const sortBy = searchDto.sortBy || 'createdAt';
        
        return await this.workflowsRepository.search(
            searchDto.query || '',
            searchDto.isActive,
            searchDto.userId,
            page,
            limit,
            sortBy
        );
    }

    async findById(id: string): Promise<Workflows | null> {
        return await this.workflowsRepository.findById(id);
    }

    async findAll(): Promise<Workflows[]> {
        return await this.workflowsRepository.findAll();
    }
}

