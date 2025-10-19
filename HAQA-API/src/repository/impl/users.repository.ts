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

    async verifyCredentials(username: string, password: string): Promise<Users | null> {
        const rows = await this.repository.query(
            `SELECT * FROM haqa_schema.users 
        WHERE username = $1 
            AND haqa_schema.verify_password($2, password_hash)
        LIMIT 1`,
            [username, password]
        );

        const raw = rows[0] ?? null;
        if (!raw) return null;

        const mapped = {
            id: raw.id,
            username: raw.username,
            email: raw.email,
            passwordHash: raw.password_hash,
            firstName: raw.first_name ?? null,
            lastName: raw.last_name ?? null,
            isActive:
                typeof raw.is_active === 'boolean'
                    ? raw.is_active
                    : raw.is_active === 't' || raw.is_active === 'true',
            lastLogin: raw.last_login ? new Date(raw.last_login) : null,
            createdAt: raw.created_at ? new Date(raw.created_at) : null,
            updatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
        } as Partial<Users>;

        const userEntity = Object.assign(new Users(), mapped) as Users;
        return userEntity;

    }

}