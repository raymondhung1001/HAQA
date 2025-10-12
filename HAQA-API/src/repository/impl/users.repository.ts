import { Injectable } from '@nestjs/common';

import { Users } from '@/entities/Users';
import { GenericRepository } from './generic.repository';
import { IUserRepository } from '../users-repository.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UsersRepository extends GenericRepository<Users> implements IUserRepository {

    constructor(@InjectRepository(Users) protected readonly repository: Repository<Users>) {
        super(repository);
    }

}