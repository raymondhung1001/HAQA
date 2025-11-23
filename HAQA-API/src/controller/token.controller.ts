import { Body, Controller, Post } from "@nestjs/common";

import { AuthService, AuthTokenResponse } from "@/service/auth.service";
import { Public } from "@/decorators";

class LoginDto {
    username: string;
    password: string;
}

@Controller('token')
export class TokenController {

    constructor(private readonly authService: AuthService) { 
    }

    @Public()
    @Post()
    async createToken(@Body() loginDto: LoginDto): Promise<AuthTokenResponse> {
        return this.authService.getToken(loginDto.username, loginDto.password);
    }    

}