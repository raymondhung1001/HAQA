import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Roles } from "./Roles";
import { UserFunctions } from "./UserFunctions";

@Index("idx_functions_category_code", ["category", "code"], {})
@Index("idx_functions_category", ["category"], {})
@Index("functions_code_unique", ["code"], { unique: true })
@Index("idx_functions_code", ["code"], {})
@Index("functions_pkey", ["id"], { unique: true })
@Index("functions_name_unique", ["name"], { unique: true })
@Entity("functions", { schema: "haqa_schema" })
export class Functions {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "code", length: 100 })
  code: string;

  @Column("character varying", { name: "name", length: 100 })
  name: string;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  @Column("character varying", {
    name: "category",
    nullable: true,
    length: 100,
  })
  category: string | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date | null;

  @Column("timestamp with time zone", {
    name: "updated_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date | null;

  @ManyToMany(() => Roles, (roles) => roles.functions)
  @JoinTable({
    name: "role_functions",
    joinColumns: [{ name: "function_id", referencedColumnName: "id" }],
    inverseJoinColumns: [{ name: "role_id", referencedColumnName: "id" }],
    schema: "haqa_schema",
  })
  roles: Roles[];

  @OneToMany(() => UserFunctions, (userFunctions) => userFunctions.function)
  userFunctions: UserFunctions[];
}
