import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";

import { AuthService } from "./auth.service";
import { WorkflowsService } from "./workflows.service";
import { JwtStrategy } from "@/strategies/jwt.strategy";

const services = [AuthService, WorkflowsService];

@Module({
    imports: [
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('auth.jwt.secret'),
                signOptions: {
                    expiresIn: configService.get<number>('auth.jwt.expiresIn'),
                    issuer: configService.get<string>('auth.jwt.issuer'),
                    audience: configService.get<string>('auth.jwt.audience'),
                },
            }),
        }),
    ],
    providers: [...services, JwtStrategy],
    exports: services,
})
export class ServiceModule {

}