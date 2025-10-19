import { Body, Controller, Get, Post } from "@nestjs/common";

import { AuthService } from "@/service/auth.service";

class LoginDto {
    username: string;
    password: string;
}

@Controller('token')
export class TokenController {

    constructor(private readonly authService: AuthService) { 
    }

    @Post()
    async createToken(@Body() loginDto: LoginDto): Promise<string> {
        return this.authService.getToken(loginDto.username, loginDto.password);
    }    

}