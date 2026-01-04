import { Controller, Get, Post, Query, Body } from "@nestjs/common";
import { z } from "zod";

import { WorkflowsService, CreateWorkflowDto, SearchWorkflowsDto } from "@/service/workflows.service";
import { CurrentUser } from "@/decorators";
import { Users } from "@/entities/Users";
import { BodySchema, QuerySchema } from "@/pipe";

// Define Zod schema for create workflow (test case) validation
const createWorkflowSchema = z.object({
    name: z.string().min(1, 'Name is required').max(150, 'Name must be less than 150 characters'),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
});

// Define Zod schema for search workflows (test cases) validation
const searchWorkflowsSchema = z.object({
    query: z.string().optional(),
    isActive: z.boolean().optional(),
    userId: z.number().int().positive().optional(),
});

type CreateWorkflowRequest = z.infer<typeof createWorkflowSchema>;
type SearchWorkflowsRequest = z.infer<typeof searchWorkflowsSchema>;

@Controller('test-cases')
export class TestCasesController {

    constructor(private readonly workflowsService: WorkflowsService) { }

    @Post()
    async create(
        @BodySchema(createWorkflowSchema) createDto: CreateWorkflowRequest,
        @CurrentUser() user: Users
    ) {
        const workflow = await this.workflowsService.create(
            createDto,
            user.id
        );
        return workflow;
    }

    @Get()
    async search(
        @QuerySchema(searchWorkflowsSchema) searchDto: SearchWorkflowsRequest
    ) {
        const workflows = await this.workflowsService.search(searchDto);
        return workflows;
    }
}
