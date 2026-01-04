import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { WorkflowEdges } from "./WorkflowEdges";
import { WorkflowExecutions } from "./WorkflowExecutions";
import { WorkflowNodes } from "./WorkflowNodes";
import { Workflows } from "./Workflows";

@Index("pk_workflows_versions", ["id"], { unique: true })
@Index(
  "idx_workflow_versions_workflow_id_version_number",
  ["versionNumber", "workflowId"],
  {}
)
@Index(
  "uk_workflows_versions_workflow_id_version_number",
  ["versionNumber", "workflowId"],
  { unique: true }
)
@Entity("workflow_versions", { schema: "haqa_schema" })
export class WorkflowVersions {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("uuid", { name: "workflow_id" })
  workflowId: string;

  @Column("integer", { name: "version_number" })
  versionNumber: number;

  @Column("jsonb", { name: "ui_layout_json", nullable: true })
  uiLayoutJson: object | null;

  @OneToMany(
    () => WorkflowEdges,
    (workflowEdges) => workflowEdges.workflowVersion
  )
  workflowEdges: WorkflowEdges[];

  @OneToMany(
    () => WorkflowExecutions,
    (workflowExecutions) => workflowExecutions.workflowVersion
  )
  workflowExecutions: WorkflowExecutions[];

  @OneToMany(
    () => WorkflowNodes,
    (workflowNodes) => workflowNodes.workflowVersion
  )
  workflowNodes: WorkflowNodes[];

  @ManyToOne(() => Workflows, (workflows) => workflows.workflowVersions)
  @JoinColumn([{ name: "workflow_id", referencedColumnName: "id" }])
  workflow: Workflows;
}
