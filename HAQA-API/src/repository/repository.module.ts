import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { Roles } from "@/entities/Roles";
import { Functions } from "@/entities/Functions";
import { Users } from "@/entities/Users";
import { UserFunctions } from "@/entities/UserFunctions";
import { UserRoles } from "@/entities/UserRoles";
import { TestFlows } from "@/entities/TestFlows";
import { TestFlowVersions } from "@/entities/TestFlowVersions";
import { TestFlowNodes } from "@/entities/TestFlowNodes";
import { TestFlowEdges } from "@/entities/TestFlowEdges";
import { TestFlowExecutions } from "@/entities/TestFlowExecutions";
import { NodeExecutionLogs } from "@/entities/NodeExecutionLogs";

import { UsersRepository } from "./impl/users.repository";
import { AuthCacheRepository } from "./impl/auth-cache.repository";
import { TestFlowsRepository } from "./impl/test-flows.repository";
import { ServiceModule } from "@/service/service.module";

const entities = [
    Roles,
    Functions,
    Users,
    UserFunctions,
    UserRoles,
    TestFlows,
    TestFlowVersions,
    TestFlowNodes,
    TestFlowEdges,
    TestFlowExecutions,
    NodeExecutionLogs,
];
const repositories = [UsersRepository, AuthCacheRepository, TestFlowsRepository];

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