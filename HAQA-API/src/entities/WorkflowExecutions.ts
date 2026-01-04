import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { NodeExecutionLogs } from "./NodeExecutionLogs";
import { Users } from "./Users";
import { WorkflowVersions } from "./WorkflowVersions";

@Index("uk_workflow_executions_version", ["id", "workflowVersionId"], {
  unique: true,
})
@Index("pk_workflow_executions", ["id"], { unique: true })
@Index(
  "idx_workflow_executions_workflow_version_id_start_time",
  ["startTime", "workflowVersionId"],
  {}
)
@Index("idx_workflow_executions_status", ["status"], {})
@Entity("workflow_executions", { schema: "haqa_schema" })
export class WorkflowExecutions {
  @Column("uuid", { primary: true, name: "id" })
  id!: string;

  @Column("uuid", { name: "workflow_version_id" })
  workflowVersionId!: string;

  @Column("integer", { name: "triggered_by_user_id", nullable: true })
  triggeredByUserId!: number | null;

  @Column("character varying", {
    name: "status",
    nullable: true,
    length: 20,
    default: () => "'PENDING'",
  })
  status!: string | null;

  @Column("timestamp with time zone", {
    name: "start_time",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  startTime!: Date | null;

  @Column("timestamp with time zone", { name: "end_time", nullable: true })
  endTime!: Date | null;

  @Column("jsonb", { name: "global_context", nullable: true, default: {} })
  globalContext!: object | null;

  @OneToMany(
    () => NodeExecutionLogs,
    (nodeExecutionLogs) => nodeExecutionLogs.execution
  )
  nodeExecutionLogs!: NodeExecutionLogs[];

  @ManyToOne(() => Users, (users) => users.workflowExecutions)
  @JoinColumn([{ name: "triggered_by_user_id", referencedColumnName: "id" }])
  triggeredByUser!: Users;

  @ManyToOne(
    () => WorkflowVersions,
    (workflowVersions) => workflowVersions.workflowExecutions
  )
  @JoinColumn([{ name: "workflow_version_id", referencedColumnName: "id" }])
  workflowVersion!: WorkflowVersions;
}
