import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserFunctions } from "./UserFunctions";
import { UserRoles } from "./UserRoles";

@Index("idx_users_email", ["email"], {})
@Index("users_email_uk", ["email"], { unique: true })
@Index("idx_users_name", ["firstName", "lastName"], {})
@Index("users_pkey", ["id"], { unique: true })
@Index("idx_users_active", ["isActive"], {})
@Index("idx_users_username", ["username"], {})
@Index("users_username_uk", ["username"], { unique: true })
@Entity("users", { schema: "haqa_schema" })
export class Users {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id!: number;

  @Column("character varying", { name: "username", length: 100 })
  username!: string;

  @Column("character varying", { name: "email", length: 255 })
  email!: string;

  @Column("character varying", { name: "password_hash", length: 255 })
  passwordHash!: string;

  @Column("character varying", {
    name: "first_name",
    nullable: true,
    length: 100,
  })
  firstName!: string | null;

  @Column("character varying", {
    name: "last_name",
    nullable: true,
    length: 100,
  })
  lastName!: string | null;

  @Column("boolean", {
    name: "is_active",
    nullable: true,
    default: () => "true",
  })
  isActive!: boolean | null;

  @Column("timestamp with time zone", { name: "last_login", nullable: true })
  lastLogin!: Date | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date | null;

  @Column("timestamp with time zone", {
    name: "updated_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date | null;

  @OneToMany(() => UserFunctions, (userFunctions) => userFunctions.user)
  userFunctions!: UserFunctions[];

  @OneToMany(() => UserRoles, (userRoles) => userRoles.user)
  userRoles!: UserRoles[];
}
