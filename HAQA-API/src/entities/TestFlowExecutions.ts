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
import { TestFlowVersions } from "./TestFlowVersions";

@Index("uk_test_flow_executions_version", ["id", "testFlowVersionId"], {
  unique: true,
})
@Index("pk_test_flow_executions", ["id"], { unique: true })
@Index(
  "idx_test_flow_executions_test_flow_version_id_start_time",
  ["startTime", "testFlowVersionId"],
  {}
)
@Index("idx_test_flow_executions_status", ["status"], {})
@Entity("test_flow_executions", { schema: "haqa_schema" })
export class TestFlowExecutions {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("uuid", { name: "test_flow_version_id" })
  testFlowVersionId: string;

  @Column("character varying", {
    name: "status",
    nullable: true,
    length: 20,
    default: () => "'PENDING'",
  })
  status: string | null;

  @Column("timestamp with time zone", {
    name: "start_time",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  startTime: Date | null;

  @Column("timestamp with time zone", { name: "end_time", nullable: true })
  endTime: Date | null;

  @Column("jsonb", { name: "global_context", nullable: true, default: {} })
  globalContext: object | null;

  @OneToMany(
    () => NodeExecutionLogs,
    (nodeExecutionLogs) => nodeExecutionLogs.execution
  )
  nodeExecutionLogs: NodeExecutionLogs[];

  @ManyToOne(() => Users, (users) => users.testFlowExecutions)
  @JoinColumn([{ name: "triggered_by_user_id", referencedColumnName: "id" }])
  triggeredByUser: Users;

  @ManyToOne(
    () => TestFlowVersions,
    (testFlowVersions) => testFlowVersions.testFlowExecutions
  )
  @JoinColumn([{ name: "test_flow_version_id", referencedColumnName: "id" }])
  testFlowVersion: TestFlowVersions;
}

