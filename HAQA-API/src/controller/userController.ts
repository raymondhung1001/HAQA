import type { Context } from 'hono'
import { UserService } from '@/service/userService'
import { withApiResponse } from '@/util/apiResponseUtil'

export class UserController {

    private userService: UserService;

    constructor() {
        this.userService = null as any;
    }

    getAllUsers = withApiResponse(async (c: Context) => {
        this.userService = new UserService(c);
        try {
            const users = await this.userService.getAllUsers();
            return users;
        } catch (error) {
            throw error;
        }
    });

}