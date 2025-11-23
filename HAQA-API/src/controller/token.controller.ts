import { Controller, Post } from "@nestjs/common";
import { z } from "zod";

import { AuthService, AuthTokenResponse } from "@/service/auth.service";
import { Public } from "@/decorators";
import { BodySchema } from "@/pipe";

// Define Zod schema for login validation
const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginDto = z.infer<typeof loginSchema>;

@Controller('token')
export class TokenController {

    constructor(private readonly authService: AuthService) { 
    }

    @Public()
    @Post()
    async createToken(@BodySchema(loginSchema) loginDto: LoginDto): Promise<AuthTokenResponse> {
        return this.authService.getToken(loginDto.username, loginDto.password);
    }    

}