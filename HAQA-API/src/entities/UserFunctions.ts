import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Functions } from "./Functions";
import { Users } from "./Users";

@Index(
  "idx_user_functions_user_expires",
  ["expiresAt", "functionId", "userId"],
  {}
)
@Index("user_functions_pkey", ["functionId", "userId"], { unique: true })
@Entity("user_functions", { schema: "haqa_schema" })
export class UserFunctions {
  @Column("integer", { primary: true, name: "user_id" })
  userId: number;

  @Column("integer", { primary: true, name: "function_id" })
  functionId: number;

  @Column("timestamp with time zone", {
    name: "granted_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  grantedAt: Date | null;

  @Column("timestamp with time zone", { name: "expires_at", nullable: true })
  expiresAt: Date | null;

  @ManyToOne(() => Functions, (functions) => functions.userFunctions)
  @JoinColumn([{ name: "function_id", referencedColumnName: "id" }])
  function: Functions;

  @ManyToOne(() => Users, (users) => users.userFunctions)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: Users;
}
