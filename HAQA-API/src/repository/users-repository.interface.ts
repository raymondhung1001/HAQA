import { IRepository } from './generic-repository.interface';
import { Users } from '@/entities/Users';

export interface IUserRepository extends IRepository<Users> {

    verifyCredentials(username: string, password: string): Promise<Users | null>;
    
}