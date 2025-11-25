import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';

import { Roles } from "@/entities/Roles";
import { Functions } from "@/entities/Functions";
import { Users } from "@/entities/Users";
import { UserFunctions } from "@/entities/UserFunctions";
import { UserRoles } from "@/entities/UserRoles";

import { UsersRepository } from "./impl/users.repository";
import { AuthCacheRepository } from "./impl/auth-cache.repository";
import { ServiceModule } from "@/service/service.module";

const entities = [Roles, Functions, Users, UserFunctions, UserRoles];
const repositories = [UsersRepository, AuthCacheRepository];

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature(entities),
        ServiceModule, // Import ServiceModule to make MistService available
    ],
    providers: repositories,
    exports: repositories,
})
export class RepositoryModule {

}