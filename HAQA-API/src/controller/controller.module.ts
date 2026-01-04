import { Module } from "@nestjs/common";

import { TokenController } from "./token.controller";
import { TestCasesController } from "./test-flow.controller";
import { ServiceModule } from "@/service/service.module";

const controllers = [TokenController, TestCasesController];

@Module({
    imports: [ServiceModule],
    controllers: controllers,
})
export class ControllerModule {
}