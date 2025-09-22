import { UserDao } from '@/dao/userDao';
import type { User } from "@/db/types";
import type { Context } from 'hono';
import { type Selectable } from "kysely";

export class UserService {

  private userDao: UserDao;

  constructor(c: Context) {
    this.userDao = new UserDao(c.get('dbClient'));
  }

  async getAllUsers(): Promise<Selectable<User>[]> {
    return this.userDao.findAll();
  }
  
}