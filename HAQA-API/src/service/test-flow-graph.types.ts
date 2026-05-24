export const TEST_FLOW_NODE_TYPES = [
    'start',
    'end',
    'script',
    'api-call',
    'if-else',
    'for-loop',
    'do-while',
    'wait',
] as const;

export type TestFlowNodeType = (typeof TEST_FLOW_NODE_TYPES)[number];

export const SCRIPT_LANGUAGES = ['javascript', 'python', 'bash'] as const;

export type ScriptLanguage = (typeof SCRIPT_LANGUAGES)[number];

export interface TestFlowGraphNodeDto {
    id: string;
    nodeType: TestFlowNodeType;
    label?: string;
    scriptLanguage?: ScriptLanguage;
    scriptContent?: string;
    scriptDependencies?: Record<string, unknown>;
    config?: Record<string, unknown>;
    positionX?: number;
    positionY?: number;
}

export interface TestFlowGraphEdgeDto {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string;
    targetHandle?: string;
    label?: string;
}

export interface TestFlowGraphDto {
    uiLayoutJson?: Record<string, unknown> | null;
    nodes: TestFlowGraphNodeDto[];
    edges: TestFlowGraphEdgeDto[];
}

export interface TestFlowVersionGraphResponse {
    id: string;
    testFlowId: string;
    versionNumber: number;
    uiLayoutJson: Record<string, unknown> | null;
    nodes: TestFlowGraphNodeDto[];
    edges: TestFlowGraphEdgeDto[];
}

export interface TestFlowDetailResponse {
    id: string;
    userId: number;
    name: string;
    description: string | null;
    isActive: boolean | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    latestVersion: TestFlowVersionGraphResponse | null;
}
