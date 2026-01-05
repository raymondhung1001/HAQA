import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { TestFlowNodes } from "./TestFlowNodes";
import { TestFlowVersions } from "./TestFlowVersions";

@Index("pk_test_flow_edges", ["id"], { unique: true })
@Index("uk_test_flow_edges_version", ["id", "testFlowVersionId"], {
  unique: true,
})
@Index("idx_test_flow_edges_test_flow_version_id", ["testFlowVersionId"], {})
@Entity("test_flow_edges", { schema: "haqa_schema" })
export class TestFlowEdges {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("uuid", { name: "test_flow_version_id" })
  testFlowVersionId: string;

  @Column("character varying", {
    name: "source_handle",
    nullable: true,
    length: 50,
  })
  sourceHandle: string | null;

  @Column("character varying", {
    name: "target_handle",
    nullable: true,
    length: 50,
  })
  targetHandle: string | null;

  @Column("character varying", { name: "label", nullable: true, length: 50 })
  label: string | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date | null;

  @ManyToOne(
    () => TestFlowNodes,
    (testFlowNodes) => testFlowNodes.testFlowEdges
  )
  @JoinColumn([{ name: "source_node_id", referencedColumnName: "id" }])
  sourceNode: TestFlowNodes;

  @ManyToOne(
    () => TestFlowNodes,
    (testFlowNodes) => testFlowNodes.testFlowEdges2
  )
  @JoinColumn([{ name: "target_node_id", referencedColumnName: "id" }])
  targetNode: TestFlowNodes;

  @ManyToOne(
    () => TestFlowVersions,
    (testFlowVersions) => testFlowVersions.testFlowEdges,
    { onDelete: "CASCADE" }
  )
  @JoinColumn([{ name: "test_flow_version_id", referencedColumnName: "id" }])
  testFlowVersion: TestFlowVersions;
}

