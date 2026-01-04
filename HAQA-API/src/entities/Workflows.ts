import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { WorkflowVersions } from "./WorkflowVersions";
import { Users } from "./Users";

@Index("pk_workflows", ["id"], { unique: true })
@Index("uk_workflows_user_id", ["id", "userId"], { unique: true })
@Index("idx_workflows_user_id_is_active", ["isActive", "userId"], {})
@Entity("workflows", { schema: "haqa_schema" })
export class Workflows {
  @Column("uuid", { primary: true, name: "id" })
  id!: string;

  @Column("integer", { name: "user_id" })
  userId!: number;

  @Column("character varying", { name: "name", length: 150 })
  name!: string;

  @Column("text", { name: "description", nullable: true })
  description!: string | null;

  @Column("boolean", {
    name: "is_active",
    nullable: true,
    default: () => "true",
  })
  isActive!: boolean | null;

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

  @OneToMany(
    () => WorkflowVersions,
    (workflowVersions) => workflowVersions.workflow
  )
  workflowVersions!: WorkflowVersions[];

  @ManyToOne(() => Users, (users) => users.workflows)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user!: Users;
}
