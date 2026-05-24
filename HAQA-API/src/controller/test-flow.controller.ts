import { Controller, Get, Post, Patch, Put, UseGuards } from "@nestjs/common";
import { z } from "zod";

import {
    TestFlowsService,
    CreateTestFlowWithGraphDto,
    UpdateTestFlowDto,
    SearchTestFlowsDto,
} from "@/service/test-flows.service";
import {
    SCRIPT_LANGUAGES,
    TEST_FLOW_NODE_TYPES,
} from "@/service/test-flow-graph.types";
import { CurrentUser } from "@/decorators";
import { Users } from "@/entities/Users";
import { BodySchema, QuerySchema, ParamSchema } from "@/pipe";
import { JwtAuthGuard } from "@/guards";

const graphNodeSchema = z.object({
    id: z.string().uuid('Node id must be a valid UUID'),
    nodeType: z.enum(TEST_FLOW_NODE_TYPES),
    label: z.string().max(100).optional(),
    scriptLanguage: z.enum(SCRIPT_LANGUAGES).optional(),
    scriptContent: z.string().optional(),
    scriptDependencies: z.record(z.string(), z.unknown()).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    positionX: z.number().int().optional(),
    positionY: z.number().int().optional(),
});

const graphEdgeSchema = z.object({
    id: z.string().uuid('Edge id must be a valid UUID'),
    sourceNodeId: z.string().uuid(),
    targetNodeId: z.string().uuid(),
    sourceHandle: z.string().max(50).optional(),
    targetHandle: z.string().max(50).optional(),
    label: z.string().max(50).optional(),
});

const graphSchema = z.object({
    uiLayoutJson: z.record(z.string(), z.unknown()).nullable().optional(),
    nodes: z.array(graphNodeSchema).min(1, 'Graph must include at least one node'),
    edges: z.array(graphEdgeSchema).default([]),
});

const createTestFlowSchema = z.object({
    name: z.string().min(1, 'Name is required').max(150, 'Name must be less than 150 characters'),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    graph: graphSchema.optional(),
});

const updateTestFlowSchema = z.object({
    name: z.string().min(1).max(150).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
});

const searchTestFlowsSchema = z.object({
    query: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
});

const testFlowIdSchema = z.object({
    id: z.string().uuid('Invalid test flow id'),
});

type CreateTestFlowRequest = z.infer<typeof createTestFlowSchema>;
type UpdateTestFlowRequest = z.infer<typeof updateTestFlowSchema>;
type SearchTestFlowsRequest = z.infer<typeof searchTestFlowsSchema>;

@Controller('test-flow')
@UseGuards(JwtAuthGuard)
export class TestCasesController {

    constructor(private readonly testFlowsService: TestFlowsService) { }

    @Post()
    async create(
        @BodySchema(createTestFlowSchema) createDto: CreateTestFlowRequest,
        @CurrentUser() user: Users
    ) {
        return this.testFlowsService.create(
            createDto as CreateTestFlowWithGraphDto,
            user.id
        );
    }

    @Get()
    async search(
        @QuerySchema(searchTestFlowsSchema) searchDto: SearchTestFlowsRequest,
        @CurrentUser() user: Users
    ) {
        return this.testFlowsService.search({
            ...searchDto,
            userId: user.id,
        } as SearchTestFlowsDto);
    }

    @Get(':id')
    async findById(
        @ParamSchema(testFlowIdSchema) params: z.infer<typeof testFlowIdSchema>,
        @CurrentUser() user: Users
    ) {
        return this.testFlowsService.findByIdForUser(params.id, user.id);
    }

    @Patch(':id')
    async update(
        @ParamSchema(testFlowIdSchema) params: z.infer<typeof testFlowIdSchema>,
        @BodySchema(updateTestFlowSchema) updateDto: UpdateTestFlowRequest,
        @CurrentUser() user: Users
    ) {
        return this.testFlowsService.update(
            params.id,
            updateDto as UpdateTestFlowDto,
            user.id
        );
    }

    @Put(':id/graph')
    async saveGraph(
        @ParamSchema(testFlowIdSchema) params: z.infer<typeof testFlowIdSchema>,
        @BodySchema(graphSchema) graph: z.infer<typeof graphSchema>,
        @CurrentUser() user: Users
    ) {
        return this.testFlowsService.saveGraph(params.id, graph, user.id);
    }
}
