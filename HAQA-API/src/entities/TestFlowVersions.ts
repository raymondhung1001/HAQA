import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { TestFlowEdges } from "./TestFlowEdges";
import { TestFlowExecutions } from "./TestFlowExecutions";
import { TestFlowNodes } from "./TestFlowNodes";
import { TestFlows } from "./TestFlows";

@Index("pk_test_flow_versions", ["id"], { unique: true })
@Index(
  "idx_test_flow_versions_test_flow_id_version_number",
  ["versionNumber", "testFlowId"],
  {}
)
@Index(
  "uk_test_flow_versions_test_flow_id_version_number",
  ["versionNumber", "testFlowId"],
  { unique: true }
)
@Entity("test_flow_versions", { schema: "haqa_schema" })
export class TestFlowVersions {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("uuid", { name: "test_flow_id" })
  testFlowId: string;

  @Column("integer", { name: "version_number" })
  versionNumber: number;

  @Column("jsonb", { name: "ui_layout_json", nullable: true })
  uiLayoutJson: object | null;

  @OneToMany(
    () => TestFlowEdges,
    (testFlowEdges) => testFlowEdges.testFlowVersion
  )
  testFlowEdges: TestFlowEdges[];

  @OneToMany(
    () => TestFlowExecutions,
    (testFlowExecutions) => testFlowExecutions.testFlowVersion
  )
  testFlowExecutions: TestFlowExecutions[];

  @OneToMany(
    () => TestFlowNodes,
    (testFlowNodes) => testFlowNodes.testFlowVersion
  )
  testFlowNodes: TestFlowNodes[];

  @ManyToOne(() => TestFlows, (testFlows) => testFlows.testFlowVersions)
  @JoinColumn([{ name: "test_flow_id", referencedColumnName: "id" }])
  testFlow: TestFlows;
}

