import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { WorkflowNodes } from "./WorkflowNodes";
import { WorkflowVersions } from "./WorkflowVersions";

@Index("pk_workflow_edges", ["id"], { unique: true })
@Index("uk_workflow_edges_version", ["id", "workflowVersionId"], {
  unique: true,
})
@Index("idx_workflow_edges_workflow_version_id", ["workflowVersionId"], {})
@Entity("workflow_edges", { schema: "haqa_schema" })
export class WorkflowEdges {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("uuid", { name: "workflow_version_id" })
  workflowVersionId: string;

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
    () => WorkflowNodes,
    (workflowNodes) => workflowNodes.workflowEdges
  )
  @JoinColumn([{ name: "source_node_id", referencedColumnName: "id" }])
  sourceNode: WorkflowNodes;

  @ManyToOne(
    () => WorkflowNodes,
    (workflowNodes) => workflowNodes.workflowEdges2
  )
  @JoinColumn([{ name: "target_node_id", referencedColumnName: "id" }])
  targetNode: WorkflowNodes;

  @ManyToOne(
    () => WorkflowVersions,
    (workflowVersions) => workflowVersions.workflowEdges,
    { onDelete: "CASCADE" }
  )
  @JoinColumn([{ name: "workflow_version_id", referencedColumnName: "id" }])
  workflowVersion: WorkflowVersions;
}
