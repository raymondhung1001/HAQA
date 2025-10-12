import { Module } from "@nestjs/common";

import { TokenController } from "./token.controller";

const controllers = [TokenController];

@Module({
    controllers: controllers,
})
export class ControllerModule {
}