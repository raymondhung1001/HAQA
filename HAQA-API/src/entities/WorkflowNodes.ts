import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { NodeExecutionLogs } from "./NodeExecutionLogs";
import { WorkflowEdges } from "./WorkflowEdges";
import { WorkflowVersions } from "./WorkflowVersions";

@Index("uk_workflow_nodes_version", ["id", "workflowVersionId"], {
  unique: true,
})
@Index("pk_workflow_nodes", ["id"], { unique: true })
@Index("idx_nodes_version_type", ["nodeType", "workflowVersionId"], {})
@Entity("workflow_nodes", { schema: "haqa_schema" })
export class WorkflowNodes {
  @Column("uuid", { primary: true, name: "id" })
  id!: string;

  @Column("uuid", { name: "workflow_version_id" })
  workflowVersionId!: string;

  @Column("enum", {
    name: "node_type",
    enum: [
      "start",
      "end",
      "script",
      "api-call",
      "if-else",
      "for-loop",
      "do-while",
      "wait",
    ],
  })
  nodeType!:
    | "start"
    | "end"
    | "script"
    | "api-call"
    | "if-else"
    | "for-loop"
    | "do-while"
    | "wait";

  @Column("character varying", { name: "label", nullable: true, length: 100 })
  label!: string | null;

  @Column("enum", {
    name: "script_language",
    nullable: true,
    enum: ["javascript", "python", "bash"],
  })
  scriptLanguage!: "javascript" | "python" | "bash" | null;

  @Column("text", { name: "script_content", nullable: true })
  scriptContent!: string | null;

  @Column("jsonb", { name: "script_dependencies", nullable: true, default: {} })
  scriptDependencies!: object | null;

  @Column("jsonb", { name: "config", nullable: true, default: {} })
  config!: object | null;

  @Column("integer", { name: "position_x", nullable: true })
  positionX!: number | null;

  @Column("integer", { name: "position_y", nullable: true })
  positionY!: number | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date | null;

  @OneToMany(
    () => NodeExecutionLogs,
    (nodeExecutionLogs) => nodeExecutionLogs.node
  )
  nodeExecutionLogs!: NodeExecutionLogs[];

  @OneToMany(() => WorkflowEdges, (workflowEdges) => workflowEdges.sourceNode)
  workflowEdges!: WorkflowEdges[];

  @OneToMany(() => WorkflowEdges, (workflowEdges) => workflowEdges.targetNode)
  workflowEdges2!: WorkflowEdges[];

  @ManyToOne(
    () => WorkflowVersions,
    (workflowVersions) => workflowVersions.workflowNodes,
    { onDelete: "CASCADE" }
  )
  @JoinColumn([{ name: "workflow_version_id", referencedColumnName: "id" }])
  workflowVersion!: WorkflowVersions;
}
