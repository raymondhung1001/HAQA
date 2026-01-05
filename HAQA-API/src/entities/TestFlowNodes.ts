import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { NodeExecutionLogs } from "./NodeExecutionLogs";
import { TestFlowEdges } from "./TestFlowEdges";
import { TestFlowVersions } from "./TestFlowVersions";

@Index("uk_test_flow_nodes_version", ["id", "testFlowVersionId"], {
  unique: true,
})
@Index("pk_test_flow_nodes", ["id"], { unique: true })
@Index("idx_test_flow_nodes_version_type", ["nodeType", "testFlowVersionId"], {})
@Entity("test_flow_nodes", { schema: "haqa_schema" })
export class TestFlowNodes {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("uuid", { name: "test_flow_version_id" })
  testFlowVersionId: string;

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
  nodeType:
    | "start"
    | "end"
    | "script"
    | "api-call"
    | "if-else"
    | "for-loop"
    | "do-while"
    | "wait";

  @Column("character varying", { name: "label", nullable: true, length: 100 })
  label: string | null;

  @Column("enum", {
    name: "script_language",
    nullable: true,
    enum: ["javascript", "python", "bash"],
  })
  scriptLanguage: "javascript" | "python" | "bash" | null;

  @Column("text", { name: "script_content", nullable: true })
  scriptContent: string | null;

  @Column("jsonb", { name: "script_dependencies", nullable: true, default: {} })
  scriptDependencies: object | null;

  @Column("jsonb", { name: "config", nullable: true, default: {} })
  config: object | null;

  @Column("integer", { name: "position_x", nullable: true })
  positionX: number | null;

  @Column("integer", { name: "position_y", nullable: true })
  positionY: number | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date | null;

  @OneToMany(
    () => NodeExecutionLogs,
    (nodeExecutionLogs) => nodeExecutionLogs.testFlowNode
  )
  nodeExecutionLogs: NodeExecutionLogs[];

  @OneToMany(() => TestFlowEdges, (testFlowEdges) => testFlowEdges.sourceNode)
  testFlowEdges: TestFlowEdges[];

  @OneToMany(() => TestFlowEdges, (testFlowEdges) => testFlowEdges.targetNode)
  testFlowEdges2: TestFlowEdges[];

  @ManyToOne(
    () => TestFlowVersions,
    (testFlowVersions) => testFlowVersions.testFlowNodes,
    { onDelete: "CASCADE" }
  )
  @JoinColumn([{ name: "test_flow_version_id", referencedColumnName: "id" }])
  testFlowVersion: TestFlowVersions;
}

