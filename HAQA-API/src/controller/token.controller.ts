import { Body, Controller, Post } from "@nestjs/common";

import { AuthService, AuthTokenResponse } from "@/service/auth.service";

class LoginDto {
    username: string;
    password: string;
}

@Controller('token')
export class TokenController {

    constructor(private readonly authService: AuthService) { 
    }

    @Post()
    async createToken(@Body() loginDto: LoginDto): Promise<AuthTokenResponse> {
        return this.authService.getToken(loginDto.username, loginDto.password);
    }    

}