import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

import { AuthService } from "./auth.service";

const services = [AuthService];

@Module({
    imports: [
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
    providers: services,
    exports: services,
})
export class ServiceModule {

}