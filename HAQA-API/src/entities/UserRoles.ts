import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Roles } from "./Roles";
import { Users } from "./Users";

@Index("idx_user_roles_user_expires", ["expiresAt", "roleId", "userId"], {})
@Index("user_roles_pkey", ["roleId", "userId"], { unique: true })
@Entity("user_roles", { schema: "haqa_schema" })
export class UserRoles {
  @Column("integer", { primary: true, name: "user_id" })
  userId: number;

  @Column("integer", { primary: true, name: "role_id" })
  roleId: number;

  @Column("timestamp with time zone", {
    name: "granted_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  grantedAt: Date | null;

  @Column("timestamp with time zone", { name: "expires_at", nullable: true })
  expiresAt: Date | null;

  @ManyToOne(() => Roles, (roles) => roles.userRoles)
  @JoinColumn([{ name: "role_id", referencedColumnName: "id" }])
  role: Roles;

  @ManyToOne(() => Users, (users) => users.userRoles)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: Users;
}
