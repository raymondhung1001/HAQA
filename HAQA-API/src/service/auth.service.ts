import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthService { 

    getToken(): string {
        return "token";
    }


}