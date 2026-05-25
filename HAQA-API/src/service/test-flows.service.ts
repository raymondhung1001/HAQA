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
    TestFlowNodeType,
    TestFlowVersionGraphResponse,
} from './test-flow-graph.types';

export type { CreateTestFlowDto, SearchTestFlowsDto, UpdateTestFlowDto } from './test-flows.service.types';

export interface CreateTestFlowWithGraphDto extends CreateTestFlowDto {
    graph?: TestFlowGraphDto;
}

const START_NODE_TYPE: TestFlowNodeType = 'start';
const END_NODE_TYPE: TestFlowNodeType = 'end';
const IF_ELSE_NODE_TYPE: TestFlowNodeType = 'if-else';
const LOOP_NODE_TYPES = new Set<TestFlowNodeType>(['for-loop', 'do-while']);
const TREE_NODE_TYPES_WITH_SINGLE_OUTGOING = new Set<TestFlowNodeType>([
    'start',
    'script',
    'api-call',
    'wait',
    'end',
]);

const IF_ELSE_ELSE_BRANCH_ID = 'false';
const LOOP_BRANCH_ID = 'loop';
const LOOP_DONE_BRANCH_ID = 'done';

interface BranchSpec {
    id: string;
    label: string;
}

interface ParsedLoopConfig {
    bodyNodeIds: string[];
    breakExitIds: string[];
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

        const nodeById = this.buildNodeMap(graph.nodes);
        this.ensureExactlyOneStartNode(graph.nodes);
        this.ensureAtLeastOneEndNode(graph.nodes);

        const edgeById = this.buildEdgeMap(graph.edges);
        const adjacency = this.buildAdjacency(graph.edges, nodeById);
        this.ensureAcyclicGraph(nodeById, adjacency);
        this.ensureReachableFromStart(graph.nodes, adjacency);

        const outgoingByNodeId = this.groupOutgoingEdges(graph.edges);
        const incomingByNodeId = this.groupIncomingEdges(graph.edges);
        this.validateTreeIncomingEdges(graph.nodes, incomingByNodeId);
        this.validateNodeDirectionConstraints(graph.nodes, outgoingByNodeId, incomingByNodeId);

        const loopConfigByNodeId = this.parseLoopConfigs(graph.nodes, nodeById);
        this.validateLoopBodyMembership(loopConfigByNodeId, nodeById);
        this.validateNestedLoopContainment(loopConfigByNodeId, nodeById);
        this.validateNodeOutgoingSemantics(graph.nodes, outgoingByNodeId, edgeById, nodeById, loopConfigByNodeId);
        this.validateLoopBodyIncomingSemantics(loopConfigByNodeId, incomingByNodeId);
    }

    private buildNodeMap(nodes: TestFlowGraphNodeDto[]): Map<string, TestFlowGraphNodeDto> {
        const nodeById = new Map<string, TestFlowGraphNodeDto>();
        for (const node of nodes) {
            if (nodeById.has(node.id)) {
                throw new BadRequestException(`Duplicate node id detected: ${node.id}`);
            }
            nodeById.set(node.id, node);
        }
        return nodeById;
    }

    private buildEdgeMap(edges: TestFlowGraphEdgeDto[]): Map<string, TestFlowGraphEdgeDto> {
        const edgeById = new Map<string, TestFlowGraphEdgeDto>();
        for (const edge of edges) {
            if (edgeById.has(edge.id)) {
                throw new BadRequestException(`Duplicate edge id detected: ${edge.id}`);
            }
            edgeById.set(edge.id, edge);
        }
        return edgeById;
    }

    private buildAdjacency(
        edges: TestFlowGraphEdgeDto[],
        nodeById: Map<string, TestFlowGraphNodeDto>,
    ): Map<string, string[]> {
        const adjacency = new Map<string, string[]>();
        for (const nodeId of nodeById.keys()) {
            adjacency.set(nodeId, []);
        }

        for (const edge of edges) {
            if (!nodeById.has(edge.sourceNodeId) || !nodeById.has(edge.targetNodeId)) {
                throw new BadRequestException('All edges must reference existing node ids');
            }
            if (edge.sourceNodeId === edge.targetNodeId) {
                throw new BadRequestException(`Self-referencing edge is not allowed: ${edge.id}`);
            }
            adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
        }

        return adjacency;
    }

    private ensureExactlyOneStartNode(nodes: TestFlowGraphNodeDto[]): void {
        const startCount = nodes.filter((node) => node.nodeType === START_NODE_TYPE).length;
        if (startCount !== 1) {
            throw new BadRequestException('Graph must contain exactly one start node');
        }
    }

    private ensureAtLeastOneEndNode(nodes: TestFlowGraphNodeDto[]): void {
        const endCount = nodes.filter((node) => node.nodeType === END_NODE_TYPE).length;
        if (endCount < 1) {
            throw new BadRequestException('Graph must contain at least one end node');
        }
    }

    private ensureAcyclicGraph(
        nodeById: Map<string, TestFlowGraphNodeDto>,
        adjacency: Map<string, string[]>,
    ): void {
        const visiting = new Set<string>();
        const visited = new Set<string>();

        const dfs = (nodeId: string): void => {
            if (visiting.has(nodeId)) {
                throw new BadRequestException(`Cycle detected in graph at node ${nodeId}`);
            }
            if (visited.has(nodeId)) return;

            visiting.add(nodeId);
            for (const nextNodeId of adjacency.get(nodeId) ?? []) {
                dfs(nextNodeId);
            }
            visiting.delete(nodeId);
            visited.add(nodeId);
        };

        for (const nodeId of nodeById.keys()) {
            if (!visited.has(nodeId)) {
                dfs(nodeId);
            }
        }
    }

    private ensureReachableFromStart(
        nodes: TestFlowGraphNodeDto[],
        adjacency: Map<string, string[]>,
    ): void {
        const startNode = nodes.find((node) => node.nodeType === START_NODE_TYPE);
        if (!startNode) return;

        const visited = new Set<string>();
        const stack: string[] = [startNode.id];

        while (stack.length > 0) {
            const currentId = stack.pop()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            for (const nextId of adjacency.get(currentId) ?? []) {
                if (!visited.has(nextId)) {
                    stack.push(nextId);
                }
            }
        }

        const unreachable = nodes.find((node) => !visited.has(node.id));
        if (unreachable) {
            throw new BadRequestException(`All nodes must be reachable from start node. Unreachable: ${unreachable.id}`);
        }
    }

    private groupOutgoingEdges(edges: TestFlowGraphEdgeDto[]): Map<string, TestFlowGraphEdgeDto[]> {
        const grouped = new Map<string, TestFlowGraphEdgeDto[]>();
        for (const edge of edges) {
            const list = grouped.get(edge.sourceNodeId) ?? [];
            list.push(edge);
            grouped.set(edge.sourceNodeId, list);
        }
        return grouped;
    }

    private groupIncomingEdges(edges: TestFlowGraphEdgeDto[]): Map<string, TestFlowGraphEdgeDto[]> {
        const grouped = new Map<string, TestFlowGraphEdgeDto[]>();
        for (const edge of edges) {
            const list = grouped.get(edge.targetNodeId) ?? [];
            list.push(edge);
            grouped.set(edge.targetNodeId, list);
        }
        return grouped;
    }

    private validateTreeIncomingEdges(
        nodes: TestFlowGraphNodeDto[],
        incomingByNodeId: Map<string, TestFlowGraphEdgeDto[]>,
    ): void {
        for (const node of nodes) {
            const incomingCount = incomingByNodeId.get(node.id)?.length ?? 0;
            if (node.nodeType === START_NODE_TYPE) {
                if (incomingCount > 0) {
                    throw new BadRequestException('Start node cannot have incoming edges');
                }
                continue;
            }

            if (incomingCount === 0) {
                throw new BadRequestException(`Node ${node.id} must have an incoming edge`);
            }
            if (incomingCount > 1) {
                throw new BadRequestException(
                    `Tree flow semantics require max one incoming edge per node. Node ${node.id} has ${incomingCount}`,
                );
            }
        }
    }

    private validateNodeDirectionConstraints(
        nodes: TestFlowGraphNodeDto[],
        outgoingByNodeId: Map<string, TestFlowGraphEdgeDto[]>,
        incomingByNodeId: Map<string, TestFlowGraphEdgeDto[]>,
    ): void {
        for (const node of nodes) {
            const outgoing = outgoingByNodeId.get(node.id) ?? [];
            const incoming = incomingByNodeId.get(node.id) ?? [];

            if (node.nodeType === START_NODE_TYPE && outgoing.length === 0) {
                throw new BadRequestException('Start node must have at least one outgoing edge');
            }

            if (node.nodeType === END_NODE_TYPE) {
                if (outgoing.length > 0) {
                    throw new BadRequestException(`End node ${node.id} cannot have outgoing edges`);
                }
                if (incoming.length === 0) {
                    throw new BadRequestException(`End node ${node.id} must be reachable`);
                }
            }

            if (TREE_NODE_TYPES_WITH_SINGLE_OUTGOING.has(node.nodeType) && node.nodeType !== END_NODE_TYPE) {
                if (outgoing.length > 1) {
                    throw new BadRequestException(
                        `Node ${node.id} (${node.nodeType}) can have at most one outgoing edge in tree flow`,
                    );
                }
            }
        }
    }

    private parseLoopConfigs(
        nodes: TestFlowGraphNodeDto[],
        nodeById: Map<string, TestFlowGraphNodeDto>,
    ): Map<string, ParsedLoopConfig> {
        const loopConfigByNodeId = new Map<string, ParsedLoopConfig>();

        for (const node of nodes) {
            if (!LOOP_NODE_TYPES.has(node.nodeType)) continue;

            const rawConfig = node.config ?? {};
            const bodyNodeIds = this.readStringList(rawConfig.bodyNodeIds, `Loop node ${node.id} config.bodyNodeIds`);
            const breakExitIds = this.readBranchIdList(rawConfig.breakExits, `Loop node ${node.id} config.breakExits`);

            const uniqueBodyNodeIds = [...new Set(bodyNodeIds)];
            if (uniqueBodyNodeIds.length !== bodyNodeIds.length) {
                throw new BadRequestException(`Loop node ${node.id} has duplicate body node ids`);
            }

            for (const bodyNodeId of uniqueBodyNodeIds) {
                const bodyNode = nodeById.get(bodyNodeId);
                if (!bodyNode) {
                    throw new BadRequestException(
                        `Loop node ${node.id} references missing body node ${bodyNodeId}`,
                    );
                }
                if (bodyNodeId === node.id) {
                    throw new BadRequestException(`Loop node ${node.id} cannot include itself in body`);
                }
                if (bodyNode.nodeType === START_NODE_TYPE || bodyNode.nodeType === END_NODE_TYPE) {
                    throw new BadRequestException(
                        `Loop node ${node.id} body cannot include ${bodyNode.nodeType} node ${bodyNodeId}`,
                    );
                }
            }

            loopConfigByNodeId.set(node.id, {
                bodyNodeIds: uniqueBodyNodeIds,
                breakExitIds,
            });
        }

        return loopConfigByNodeId;
    }

    private validateLoopBodyMembership(
        loopConfigByNodeId: Map<string, ParsedLoopConfig>,
        nodeById: Map<string, TestFlowGraphNodeDto>,
    ): void {
        const ownerByBodyNodeId = new Map<string, string>();

        for (const [loopNodeId, loopConfig] of loopConfigByNodeId.entries()) {
            for (const bodyNodeId of loopConfig.bodyNodeIds) {
                const existingOwner = ownerByBodyNodeId.get(bodyNodeId);
                if (existingOwner && existingOwner !== loopNodeId) {
                    throw new BadRequestException(
                        `Node ${bodyNodeId} cannot belong to multiple loop bodies (${existingOwner}, ${loopNodeId})`,
                    );
                }
                ownerByBodyNodeId.set(bodyNodeId, loopNodeId);
            }
        }

        for (const [bodyNodeId, loopNodeId] of ownerByBodyNodeId.entries()) {
            if (!nodeById.has(loopNodeId)) {
                throw new BadRequestException(`Loop owner ${loopNodeId} not found for node ${bodyNodeId}`);
            }
        }
    }

    private validateNestedLoopContainment(
        loopConfigByNodeId: Map<string, ParsedLoopConfig>,
        nodeById: Map<string, TestFlowGraphNodeDto>,
    ): void {
        const containedLoopIdsByLoopId = new Map<string, string[]>();

        for (const [loopId, config] of loopConfigByNodeId.entries()) {
            const childLoopIds = config.bodyNodeIds.filter((nodeId) => {
                const node = nodeById.get(nodeId);
                return Boolean(node && LOOP_NODE_TYPES.has(node.nodeType));
            });
            containedLoopIdsByLoopId.set(loopId, childLoopIds);
        }

        const visiting = new Set<string>();
        const visited = new Set<string>();

        const dfs = (loopId: string): void => {
            if (visiting.has(loopId)) {
                throw new BadRequestException(
                    `Nested loop containment cycle detected involving loop node ${loopId}`,
                );
            }
            if (visited.has(loopId)) return;

            visiting.add(loopId);
            for (const childLoopId of containedLoopIdsByLoopId.get(loopId) ?? []) {
                dfs(childLoopId);
            }
            visiting.delete(loopId);
            visited.add(loopId);
        };

        for (const loopId of loopConfigByNodeId.keys()) {
            dfs(loopId);
        }
    }

    private validateNodeOutgoingSemantics(
        nodes: TestFlowGraphNodeDto[],
        outgoingByNodeId: Map<string, TestFlowGraphEdgeDto[]>,
        edgeById: Map<string, TestFlowGraphEdgeDto>,
        nodeById: Map<string, TestFlowGraphNodeDto>,
        loopConfigByNodeId: Map<string, ParsedLoopConfig>,
    ): void {
        for (const node of nodes) {
            const outgoing = outgoingByNodeId.get(node.id) ?? [];

            if (node.nodeType === IF_ELSE_NODE_TYPE) {
                const branches = this.readIfElseBranches(node);
                const allowedHandles = new Set(branches.map((branch) => branch.id));
                this.validateHandledOutgoingEdges(node.id, outgoing, allowedHandles, 'if-else');
                continue;
            }

            if (LOOP_NODE_TYPES.has(node.nodeType)) {
                const loopConfig = loopConfigByNodeId.get(node.id)!;
                const allowedHandles = new Set<string>([
                    LOOP_BRANCH_ID,
                    LOOP_DONE_BRANCH_ID,
                    ...loopConfig.breakExitIds,
                ]);

                this.validateHandledOutgoingEdges(node.id, outgoing, allowedHandles, 'loop');

                const bodyNodeSet = new Set(loopConfig.bodyNodeIds);
                const loopEdges = outgoing.filter((edge) => edge.sourceHandle === LOOP_BRANCH_ID);
                const doneEdges = outgoing.filter((edge) => edge.sourceHandle === LOOP_DONE_BRANCH_ID);
                const breakEdges = outgoing.filter((edge) => edge.sourceHandle && loopConfig.breakExitIds.includes(edge.sourceHandle));

                if (loopConfig.bodyNodeIds.length > 0 && loopEdges.length === 0) {
                    throw new BadRequestException(`Loop node ${node.id} must connect Loop handle to its body`);
                }
                if (loopConfig.bodyNodeIds.length === 0 && loopEdges.length > 0) {
                    throw new BadRequestException(`Loop node ${node.id} cannot use Loop handle without body nodes`);
                }

                for (const loopEdge of loopEdges) {
                    if (!bodyNodeSet.has(loopEdge.targetNodeId)) {
                        throw new BadRequestException(
                            `Loop edge ${loopEdge.id} of loop node ${node.id} must target one of its body nodes`,
                        );
                    }
                }

                for (const exitEdge of [...doneEdges, ...breakEdges]) {
                    if (bodyNodeSet.has(exitEdge.targetNodeId)) {
                        throw new BadRequestException(
                            `Loop exit edge ${exitEdge.id} of loop node ${node.id} cannot target its own body node`,
                        );
                    }
                }

                const hasIfElseInBody = loopConfig.bodyNodeIds.some((bodyNodeId) => {
                    const bodyNode = nodeById.get(bodyNodeId);
                    return bodyNode?.nodeType === IF_ELSE_NODE_TYPE;
                });

                if (!hasIfElseInBody && breakEdges.length > 0) {
                    throw new BadRequestException(
                        `Loop node ${node.id} cannot use break exits without an if-else node in its body`,
                    );
                }

                continue;
            }

            for (const edge of outgoing) {
                if (edge.sourceHandle) {
                    throw new BadRequestException(
                        `Node ${node.id} (${node.nodeType}) cannot use source handle ${edge.sourceHandle}`,
                    );
                }
            }
        }

        for (const edgeId of edgeById.keys()) {
            if (!edgeById.has(edgeId)) {
                throw new BadRequestException(`Invalid edge reference: ${edgeId}`);
            }
        }
    }

    private validateLoopBodyIncomingSemantics(
        loopConfigByNodeId: Map<string, ParsedLoopConfig>,
        incomingByNodeId: Map<string, TestFlowGraphEdgeDto[]>,
    ): void {
        for (const [loopNodeId, loopConfig] of loopConfigByNodeId.entries()) {
            const bodySet = new Set(loopConfig.bodyNodeIds);
            for (const bodyNodeId of loopConfig.bodyNodeIds) {
                const incoming = incomingByNodeId.get(bodyNodeId) ?? [];
                for (const edge of incoming) {
                    const sourceInSameBody = bodySet.has(edge.sourceNodeId);
                    const sourceIsLoopEntry =
                        edge.sourceNodeId === loopNodeId && edge.sourceHandle === LOOP_BRANCH_ID;

                    if (!sourceInSameBody && !sourceIsLoopEntry) {
                        throw new BadRequestException(
                            `Loop body node ${bodyNodeId} can only be entered from loop ${loopNodeId} Loop handle or same loop body`,
                        );
                    }
                }
            }
        }
    }

    private validateHandledOutgoingEdges(
        nodeId: string,
        outgoing: TestFlowGraphEdgeDto[],
        allowedHandles: Set<string>,
        nodeKind: 'if-else' | 'loop',
    ): void {
        const handleUsageCount = new Map<string, number>();

        for (const edge of outgoing) {
            const handle = edge.sourceHandle;
            if (!handle) {
                throw new BadRequestException(
                    `${nodeKind} node ${nodeId} requires sourceHandle on outgoing edge ${edge.id}`,
                );
            }
            if (!allowedHandles.has(handle)) {
                throw new BadRequestException(
                    `${nodeKind} node ${nodeId} has invalid sourceHandle "${handle}" on edge ${edge.id}`,
                );
            }

            const usage = (handleUsageCount.get(handle) ?? 0) + 1;
            handleUsageCount.set(handle, usage);
            if (usage > 1) {
                throw new BadRequestException(
                    `${nodeKind} node ${nodeId} cannot have multiple outgoing edges from handle "${handle}"`,
                );
            }
        }
    }

    private readIfElseBranches(node: TestFlowGraphNodeDto): BranchSpec[] {
        const rawBranches = node.config?.branches;
        if (!Array.isArray(rawBranches) || rawBranches.length < 2) {
            throw new BadRequestException(
                `If-else node ${node.id} must define at least two branches in config.branches`,
            );
        }

        const branches: BranchSpec[] = [];
        const seen = new Set<string>();

        for (const branch of rawBranches) {
            if (!branch || typeof branch !== 'object') {
                throw new BadRequestException(`If-else node ${node.id} has invalid branch config shape`);
            }
            const record = branch as Record<string, unknown>;
            const id = record.id;
            const label = record.label;
            if (typeof id !== 'string' || id.length === 0 || typeof label !== 'string') {
                throw new BadRequestException(`If-else node ${node.id} has invalid branch id/label`);
            }
            if (seen.has(id)) {
                throw new BadRequestException(`If-else node ${node.id} has duplicate branch id "${id}"`);
            }
            seen.add(id);
            branches.push({ id, label });
        }

        const elseBranch = branches[branches.length - 1];
        if (elseBranch.id !== IF_ELSE_ELSE_BRANCH_ID) {
            throw new BadRequestException(
                `If-else node ${node.id} must keep "${IF_ELSE_ELSE_BRANCH_ID}" as the last branch id`,
            );
        }

        return branches;
    }

    private readStringList(value: unknown, fieldName: string): string[] {
        if (!Array.isArray(value)) {
            return [];
        }
        const result: string[] = [];
        for (const item of value) {
            if (typeof item !== 'string' || item.length === 0) {
                throw new BadRequestException(`${fieldName} must be an array of non-empty strings`);
            }
            result.push(item);
        }
        return result;
    }

    private readBranchIdList(value: unknown, fieldName: string): string[] {
        if (!Array.isArray(value)) return [];

        const ids: string[] = [];
        const seen = new Set<string>();
        for (const item of value) {
            if (!item || typeof item !== 'object') {
                throw new BadRequestException(`${fieldName} must contain objects with id`);
            }

            const record = item as Record<string, unknown>;
            const id = record.id;
            if (typeof id !== 'string' || id.length === 0) {
                throw new BadRequestException(`${fieldName} branch id must be a non-empty string`);
            }
            if (id === LOOP_BRANCH_ID || id === LOOP_DONE_BRANCH_ID) {
                throw new BadRequestException(
                    `${fieldName} cannot contain reserved ids "${LOOP_BRANCH_ID}" or "${LOOP_DONE_BRANCH_ID}"`,
                );
            }
            if (seen.has(id)) {
                throw new BadRequestException(`${fieldName} contains duplicate id "${id}"`);
            }
            seen.add(id);
            ids.push(id);
        }

        return ids;
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
