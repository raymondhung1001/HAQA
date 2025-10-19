import { Module } from "@nestjs/common";

import { TokenController } from "./token.controller";
import { ServiceModule } from "@/service/service.module";

const controllers = [TokenController];

@Module({
    imports: [ServiceModule],
    controllers: controllers,
})
export class ControllerModule {
}