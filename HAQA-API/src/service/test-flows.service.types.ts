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
