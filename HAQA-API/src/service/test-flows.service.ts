import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';

import { TestFlowsRepository } from '@/repository';
import { TestFlows } from '@/entities/TestFlows';
import { TestFlowVersions } from '@/entities/TestFlowVersions';
import { TestFlowNodes } from '@/entities/TestFlowNodes';
import { TestFlowEdges } from '@/entities/TestFlowEdges';
import { DeepPartial } from 'typeorm';
import {
    CreateTestFlowDto,
    SearchTestFlowsDto,
    UpdateTestFlowDto,
} from './test-flows.service.types';
import {
    TestFlowDetailResponse,
    TestFlowGraphDto,
    TestFlowGraphEdgeDto,
    TestFlowGraphNodeDto,
    TestFlowVersionGraphResponse,
} from './test-flow-graph.types';

export type { CreateTestFlowDto, SearchTestFlowsDto, UpdateTestFlowDto } from './test-flows.service.types';

export interface CreateTestFlowWithGraphDto extends CreateTestFlowDto {
    graph?: TestFlowGraphDto;
}

@Injectable()
export class TestFlowsService {
    constructor(
        private readonly testFlowsRepository: TestFlowsRepository,
        private readonly dataSource: DataSource,
    ) {}

    async create(data: CreateTestFlowWithGraphDto, userId: number): Promise<TestFlowDetailResponse> {
        return this.dataSource.transaction(async (manager) => {
            const flowId = randomUUID();
            const now = new Date();

            const testFlowData: DeepPartial<TestFlows> = {
                id: flowId,
                name: data.name,
                description: data.description,
                userId,
                isActive: data.isActive !== undefined ? data.isActive : true,
                createdAt: now,
                updatedAt: now,
            };

            const flow = await manager.getRepository(TestFlows).save(testFlowData);

            let latestVersion: TestFlowVersionGraphResponse | null = null;
            if (data.graph) {
                this.validateGraph(data.graph);
                latestVersion = await this.persistGraphVersion(
                    manager,
                    flow.id,
                    1,
                    data.graph,
                );
            }

            return this.toDetailResponse(flow, latestVersion);
        });
    }

    async findByIdForUser(id: string, userId: number): Promise<TestFlowDetailResponse> {
        const flow = await this.testFlowsRepository.findById(id);
        if (!flow || flow.userId !== userId) {
            throw new NotFoundException('Test flow not found');
        }

        const latestVersion = await this.loadLatestVersion(id);
        return this.toDetailResponse(flow, latestVersion);
    }

    async update(id: string, data: UpdateTestFlowDto, userId: number): Promise<TestFlows> {
        const flow = await this.getOwnedFlow(id, userId);

        return this.testFlowsRepository.update(flow.id, {
            ...data,
            updatedAt: new Date(),
        } as Partial<TestFlows>);
    }

    async saveGraph(
        testFlowId: string,
        graph: TestFlowGraphDto,
        userId: number,
    ): Promise<TestFlowVersionGraphResponse> {
        await this.getOwnedFlow(testFlowId, userId);
        this.validateGraph(graph);

        return this.dataSource.transaction(async (manager) => {
            const versionRepo = manager.getRepository(TestFlowVersions);
            const latest = await versionRepo.findOne({
                where: { testFlowId },
                order: { versionNumber: 'DESC' },
            });

            const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;

            await manager.getRepository(TestFlows).update(testFlowId, {
                updatedAt: new Date(),
            });

            return this.persistGraphVersion(
                manager,
                testFlowId,
                nextVersionNumber,
                graph,
            );
        });
    }

    async search(searchDto: SearchTestFlowsDto) {
        const page = searchDto.page && searchDto.page > 0 ? searchDto.page : 1;
        const limit = searchDto.limit && searchDto.limit > 0 ? Math.min(searchDto.limit, 100) : 10;
        const sortBy = searchDto.sortBy || 'createdAt';

        return await this.testFlowsRepository.search(
            searchDto.query || '',
            searchDto.isActive,
            searchDto.userId,
            page,
            limit,
            sortBy,
        );
    }

    async findById(id: string): Promise<TestFlows | null> {
        return await this.testFlowsRepository.findById(id);
    }

    async findAll(): Promise<TestFlows[]> {
        return await this.testFlowsRepository.findAll();
    }

    private async getOwnedFlow(id: string, userId: number): Promise<TestFlows> {
        const flow = await this.testFlowsRepository.findById(id);
        if (!flow || flow.userId !== userId) {
            throw new NotFoundException('Test flow not found');
        }
        return flow;
    }

    private validateGraph(graph: TestFlowGraphDto): void {
        if (!graph.nodes.length) {
            throw new BadRequestException('Graph must include at least one node');
        }

        const nodeIds = new Set(graph.nodes.map((node) => node.id));

        for (const edge of graph.edges) {
            if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
                throw new BadRequestException(
                    'All edges must reference existing node ids',
                );
            }
        }
    }

    private async persistGraphVersion(
        manager: EntityManager,
        testFlowId: string,
        versionNumber: number,
        graph: TestFlowGraphDto,
    ): Promise<TestFlowVersionGraphResponse> {
        const versionId = randomUUID();

        await manager.getRepository(TestFlowVersions).save({
            id: versionId,
            testFlowId,
            versionNumber,
            uiLayoutJson: graph.uiLayoutJson ?? null,
        });

        const nodeRepo = manager.getRepository(TestFlowNodes);
        const edgeRepo = manager.getRepository(TestFlowEdges);

        for (const node of graph.nodes) {
            await nodeRepo.save({
                id: node.id,
                testFlowVersionId: versionId,
                nodeType: node.nodeType,
                label: node.label ?? null,
                scriptLanguage: node.scriptLanguage ?? null,
                scriptContent: node.scriptContent ?? null,
                scriptDependencies: node.scriptDependencies ?? {},
                config: node.config ?? {},
                positionX: node.positionX ?? null,
                positionY: node.positionY ?? null,
                createdAt: new Date(),
            });
        }

        for (const edge of graph.edges) {
            await edgeRepo.save({
                id: edge.id,
                testFlowVersionId: versionId,
                sourceNode: { id: edge.sourceNodeId },
                targetNode: { id: edge.targetNodeId },
                sourceHandle: edge.sourceHandle ?? null,
                targetHandle: edge.targetHandle ?? null,
                label: edge.label ?? null,
                createdAt: new Date(),
            });
        }

        return {
            id: versionId,
            testFlowId,
            versionNumber,
            uiLayoutJson: graph.uiLayoutJson ?? null,
            nodes: graph.nodes,
            edges: graph.edges,
        };
    }

    private async loadLatestVersion(
        testFlowId: string,
    ): Promise<TestFlowVersionGraphResponse | null> {
        const version = await this.dataSource.getRepository(TestFlowVersions).findOne({
            where: { testFlowId },
            order: { versionNumber: 'DESC' },
            relations: {
                testFlowNodes: true,
                testFlowEdges: {
                    sourceNode: true,
                    targetNode: true,
                },
            },
        });

        if (!version) {
            return null;
        }

        return this.toVersionResponse(version);
    }

    private toVersionResponse(version: TestFlowVersions): TestFlowVersionGraphResponse {
        const nodes: TestFlowGraphNodeDto[] = (version.testFlowNodes ?? []).map((node) => ({
            id: node.id,
            nodeType: node.nodeType,
            label: node.label ?? undefined,
            scriptLanguage: node.scriptLanguage ?? undefined,
            scriptContent: node.scriptContent ?? undefined,
            scriptDependencies: (node.scriptDependencies as Record<string, unknown>) ?? undefined,
            config: (node.config as Record<string, unknown>) ?? undefined,
            positionX: node.positionX ?? undefined,
            positionY: node.positionY ?? undefined,
        }));

        const edges: TestFlowGraphEdgeDto[] = (version.testFlowEdges ?? []).map((edge) => ({
            id: edge.id,
            sourceNodeId: edge.sourceNode?.id ?? '',
            targetNodeId: edge.targetNode?.id ?? '',
            sourceHandle: edge.sourceHandle ?? undefined,
            targetHandle: edge.targetHandle ?? undefined,
            label: edge.label ?? undefined,
        }));

        return {
            id: version.id,
            testFlowId: version.testFlowId,
            versionNumber: version.versionNumber,
            uiLayoutJson: (version.uiLayoutJson as Record<string, unknown>) ?? null,
            nodes,
            edges,
        };
    }

    private toDetailResponse(
        flow: TestFlows,
        latestVersion: TestFlowVersionGraphResponse | null,
    ): TestFlowDetailResponse {
        return {
            id: flow.id,
            userId: flow.userId,
            name: flow.name,
            description: flow.description,
            isActive: flow.isActive,
            createdAt: flow.createdAt,
            updatedAt: flow.updatedAt,
            latestVersion,
        };
    }
}
