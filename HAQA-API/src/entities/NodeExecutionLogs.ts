import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { TestFlowExecutions } from "./TestFlowExecutions";
import { TestFlowNodes } from "./TestFlowNodes";

@Index(
  "idx_test_flow_node_execution_logs_execution_id_test_flow_node_id",
  ["executionId", "nodeId"],
  {}
)
@Index("uk_test_flow_node_execution_logs_execution_node", ["executionId", "nodeId"], {
  unique: true,
})
@Index("pk_test_flow_node_execution_logs", ["id"], { unique: true })
@Entity("test_flow_node_execution_logs", { schema: "haqa_schema" })
export class NodeExecutionLogs {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("uuid", { name: "execution_id" })
  executionId: string;

  @Column("uuid", { name: "test_flow_node_id" })
  nodeId: string;

  @Column("character varying", { name: "status", nullable: true, length: 20 })
  status: string | null;

  @Column("text", { name: "console_output", nullable: true })
  consoleOutput: string | null;

  @Column("text", { name: "error_output", nullable: true })
  errorOutput: string | null;

  @Column("jsonb", { name: "evaluation_snapshot", nullable: true })
  evaluationSnapshot: object | null;

  @Column("jsonb", { name: "result_data", nullable: true })
  resultData: object | null;

  @Column("timestamp with time zone", {
    name: "start_time",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  startTime: Date | null;

  @Column("timestamp with time zone", { name: "end_time", nullable: true })
  endTime: Date | null;

  @ManyToOne(
    () => TestFlowExecutions,
    (testFlowExecutions) => testFlowExecutions.nodeExecutionLogs
  )
  @JoinColumn([{ name: "execution_id", referencedColumnName: "id" }])
  execution: TestFlowExecutions;

  @ManyToOne(
    () => TestFlowNodes,
    (testFlowNodes) => testFlowNodes.nodeExecutionLogs
  )
  @JoinColumn([{ name: "test_flow_node_id", referencedColumnName: "id" }])
  testFlowNode: TestFlowNodes;
}
