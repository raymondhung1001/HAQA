import { Controller, Get, Post } from "@nestjs/common";

@Controller('token')
export class TokenController {

    @Get()
    async creatreToken() {
        return "token";
    }    

}