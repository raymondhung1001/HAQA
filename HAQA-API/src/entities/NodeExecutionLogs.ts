import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { WorkflowExecutions } from "./WorkflowExecutions";
import { WorkflowNodes } from "./WorkflowNodes";

@Index(
  "idx_node_execution_logs_execution_id_node_id",
  ["executionId", "nodeId"],
  {}
)
@Index("uk_node_execution_logs_execution_node", ["executionId", "nodeId"], {
  unique: true,
})
@Index("pk_node_execution_logs", ["id"], { unique: true })
@Entity("node_execution_logs", { schema: "haqa_schema" })
export class NodeExecutionLogs {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("uuid", { name: "execution_id" })
  executionId: string;

  @Column("uuid", { name: "node_id" })
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
    () => WorkflowExecutions,
    (workflowExecutions) => workflowExecutions.nodeExecutionLogs
  )
  @JoinColumn([{ name: "execution_id", referencedColumnName: "id" }])
  execution: WorkflowExecutions;

  @ManyToOne(
    () => WorkflowNodes,
    (workflowNodes) => workflowNodes.nodeExecutionLogs
  )
  @JoinColumn([{ name: "node_id", referencedColumnName: "id" }])
  node: WorkflowNodes;
}
