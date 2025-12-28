import {
  Column,
  Entity,
  Index,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Functions } from "./Functions";
import { UserRoles } from "./UserRoles";

@Index("roles_pkey", ["id"], { unique: true })
@Index("idx_roles_system", ["isSystemRole"], {})
@Index("roles_name_unique", ["name"], { unique: true })
@Index("idx_roles_name", ["name"], {})
@Entity("roles", { schema: "haqa_schema" })
export class Roles {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id!: number;

  @Column("character varying", { name: "name", length: 50 })
  name!: string;

  @Column("text", { name: "description", nullable: true })
  description!: string | null;

  @Column("boolean", {
    name: "is_system_role",
    nullable: true,
    default: () => "false",
  })
  isSystemRole!: boolean | null;

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

  @ManyToMany(() => Functions, (functions) => functions.roles)
  functions!: Functions[];

  @OneToMany(() => UserRoles, (userRoles) => userRoles.role)
  userRoles!: UserRoles[];
}
