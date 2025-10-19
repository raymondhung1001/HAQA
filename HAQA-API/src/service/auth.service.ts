import { Injectable } from "@nestjs/common";

import { UsersRepository } from "@/repository";
import { Users } from "@/entities/Users";

@Injectable()
export class AuthService {

    constructor(private readonly usersRepository: UsersRepository) {

    }

    async getToken(username: string, password: string): Promise<string> {
        const tempUser: Users | null = await this.usersRepository.verifyCredentials(username, password);
        if (tempUser){
            return "Yee1";
        } else {
            return "Yee2";
        }
    }


}