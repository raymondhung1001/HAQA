import type { Context } from 'hono'
import { UserService } from '@/service/userService'

export class UserController {

  private userService: UserService;

  constructor() {
    this.userService = null as any;
  }

  getAllUsers = async (c: Context) => {
    try {
      this.userService = new UserService(c);
      const users = await this.userService.getAllUsers();
      return c.json(users);
    } catch (error) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 500);
      }
      return c.json({ error: 'An unknown error occurred' }, 500);
    }
  }
}