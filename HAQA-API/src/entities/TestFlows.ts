import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { TestFlowVersions } from "./TestFlowVersions";
import { Users } from "./Users";

@Index("pk_test_flows", ["id"], { unique: true })
@Index("uk_test_flows_user_id", ["id", "userId"], { unique: true })
@Index("idx_test_flows_user_id_is_active", ["isActive", "userId"], {})
@Entity("test_flows", { schema: "haqa_schema" })
export class TestFlows {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("integer", { name: "user_id" })
  userId: number;

  @Column("character varying", { name: "name", length: 150 })
  name: string;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  @Column("boolean", {
    name: "is_active",
    nullable: true,
    default: () => "true",
  })
  isActive: boolean | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date | null;

  @Column("timestamp with time zone", {
    name: "updated_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date | null;

  @OneToMany(
    () => TestFlowVersions,
    (testFlowVersions) => testFlowVersions.testFlow
  )
  testFlowVersions: TestFlowVersions[];

  @ManyToOne(() => Users, (users) => users.testFlows)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: Users;
}

