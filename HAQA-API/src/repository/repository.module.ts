import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { Roles } from "@/entities/Roles";
import { Functions } from "@/entities/Functions";
import { Users } from "@/entities/Users";
import { UserFunctions } from "@/entities/UserFunctions";
import { UserRoles } from "@/entities/UserRoles";
import { Workflows } from "@/entities/Workflows";
import { WorkflowVersions } from "@/entities/WorkflowVersions";
import { WorkflowNodes } from "@/entities/WorkflowNodes";
import { WorkflowEdges } from "@/entities/WorkflowEdges";
import { WorkflowExecutions } from "@/entities/WorkflowExecutions";
import { NodeExecutionLogs } from "@/entities/NodeExecutionLogs";

import { UsersRepository } from "./impl/users.repository";
import { AuthCacheRepository } from "./impl/auth-cache.repository";
import { WorkflowsRepository } from "./impl/workflows.repository";
import { ServiceModule } from "@/service/service.module";

const entities = [
    Roles,
    Functions,
    Users,
    UserFunctions,
    UserRoles,
    Workflows,
    WorkflowVersions,
    WorkflowNodes,
    WorkflowEdges,
    WorkflowExecutions,
    NodeExecutionLogs,
];
const repositories = [UsersRepository, AuthCacheRepository, WorkflowsRepository];

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature(entities),
        ServiceModule,
    ],
    providers: repositories,
    exports: repositories,
})
export class RepositoryModule {

}