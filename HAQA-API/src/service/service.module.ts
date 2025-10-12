import { Module } from "@nestjs/common";

import { AuthService } from "./auth.service";

const services = [AuthService];

@Module({
    providers: services,
    exports: services,
})
export class ServiceModule {

}