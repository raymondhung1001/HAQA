export interface CreateTestFlowDto {
    name: string;
    description?: string;
    isActive?: boolean;
}

export interface UpdateTestFlowDto {
    name?: string;
    description?: string;
    isActive?: boolean;
}

export interface SearchTestFlowsDto {
    query?: string;
    isActive?: boolean;
    userId?: number;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt';
}

/** Summary row returned by GET /api/test-flow list/search */
export interface TestFlowListItem {
    id: string;
    userId: number;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    latestVersionNumber: number | null;
    nodeCount: number;
}
