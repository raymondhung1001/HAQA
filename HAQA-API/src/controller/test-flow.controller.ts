import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { TestFlowsService, CreateTestFlowDto, SearchTestFlowsDto } from "@/service/test-flows.service";
import { CurrentUser } from "@/decorators";
import { Users } from "@/entities/Users";
import { BodySchema, QuerySchema } from "@/pipe";
import { JwtAuthGuard } from "@/guards";

// Define Zod schema for create test flow validation
const createTestFlowSchema = z.object({
    name: z.string().min(1, 'Name is required').max(150, 'Name must be less than 150 characters'),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
});

// Define Zod schema for search test flows validation
const searchTestFlowsSchema = z.object({
    query: z.string().optional(),
    isActive: z.boolean().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
});

type CreateTestFlowRequest = z.infer<typeof createTestFlowSchema>;
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
        const testFlow = await this.testFlowsService.create(
            createDto,
            user.id
        );
        return testFlow;
    }

    @Get()
    async search(
        @QuerySchema(searchTestFlowsSchema) searchDto: SearchTestFlowsRequest,
        @CurrentUser() user: Users
    ) {
        // Always filter by the current user's ID
        const testFlows = await this.testFlowsService.search({
            ...searchDto,
            userId: user.id,
        });
        return testFlows;
    }
}

