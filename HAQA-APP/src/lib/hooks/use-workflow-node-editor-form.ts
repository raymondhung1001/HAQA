import { useEffect, useMemo, useState } from 'react'
import type { Node } from '@xyflow/react'

import { getWorkflowNodeLabel } from '@/components/test-flow/workflow-node-definitions'
import {
  addIfElseBranch,
  addLoopBreakExit,
  DEFAULT_LOOP_BRANCHES,
  isElseBranchIndex,
  isLoopNodeType,
  migrateLoopNodeConfig,
  normalizeIfElseBranches,
  normalizeLoopBreakExits,
  readIfElseBranches,
  readLoopBodyNodeIds,
  readLoopBreakExits,
  removeIfElseBranch,
  removeLoopBreakExit,
  resolveLoopBodySteps,
  type IfElseBranch,
  type LoopBodyStep,
  type WorkflowNodeData,
} from '@/lib/test-flow-graph'
import type { UseWorkflowNodeEditorFormReturn } from '@/types'
import type {
  ApiCallNodeConfig,
  HttpMethod,
  ScriptLanguage,
  WaitDurationUnit,
  WaitNodeConfig,
} from '@/types/workflow'

const MIN_IF_ELSE_BRANCHES = 2

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const readApiCallConfig = (config?: Record<string, unknown>): ApiCallNodeConfig => {
  const method = config?.method
  const url = config?.url
  const body = config?.body
  const expectedStatus = config?.expectedStatus
  const rawHeaders = config?.headers

  let headers: Record<string, string> = {}
  if (rawHeaders && typeof rawHeaders === 'object' && !Array.isArray(rawHeaders)) {
    headers = Object.fromEntries(
      Object.entries(rawHeaders as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  }

  return {
    method:
      typeof method === 'string' && HTTP_METHODS.includes(method as HttpMethod)
        ? (method as HttpMethod)
        : 'GET',
    url: typeof url === 'string' ? url : '',
    headers,
    body: typeof body === 'string' ? body : '',
    expectedStatus: typeof expectedStatus === 'number' ? expectedStatus : undefined,
  }
}

const readWaitConfig = (config?: Record<string, unknown>): WaitNodeConfig => {
  const duration = config?.duration
  const durationUnit = config?.durationUnit

  return {
    duration: typeof duration === 'number' && duration >= 0 ? duration : 1,
    durationUnit: durationUnit === 'ms' || durationUnit === 's' ? durationUnit : 's',
  }
}

export const useWorkflowNodeEditorForm = (
  node: Node | null,
  allNodes: Node[] = [],
): UseWorkflowNodeEditorFormReturn => {
  const nodeData = (node?.data ?? {}) as WorkflowNodeData
  const nodeType = nodeData.nodeType ?? 'script'

  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [scriptLanguage, setScriptLanguage] = useState<ScriptLanguage>('javascript')
  const [scriptContent, setScriptContent] = useState('')
  const [branches, setBranches] = useState<IfElseBranch[]>([])
  const [breakExits, setBreakExits] = useState<IfElseBranch[]>([])
  const [apiMethod, setApiMethod] = useState<HttpMethod>('GET')
  const [apiUrl, setApiUrl] = useState('')
  const [apiHeaders, setApiHeaders] = useState<Array<{ key: string; value: string }>>([])
  const [apiBody, setApiBody] = useState('')
  const [apiExpectedStatus, setApiExpectedStatus] = useState('')
  const [waitDuration, setWaitDuration] = useState('1')
  const [waitDurationUnit, setWaitDurationUnit] = useState<WaitDurationUnit>('s')

  const isIfElseNode = nodeType === 'if-else'
  const isLoopNode = isLoopNodeType(nodeType)
  const isApiCallNode = nodeType === 'api-call'
  const isWaitNode = nodeType === 'wait'

  const loopBodySteps = useMemo<LoopBodyStep[]>(() => {
    if (!node || !isLoopNode) return []
    return resolveLoopBodySteps(readLoopBodyNodeIds(nodeData.config), allNodes)
  }, [allNodes, isLoopNode, node, nodeData.config])

  useEffect(() => {
    if (!node) return

    setLabel(nodeData.label ?? getWorkflowNodeLabel(nodeType))
    setDescription(nodeData.description ?? '')
    setScriptLanguage(nodeData.scriptLanguage ?? 'javascript')
    setScriptContent(nodeData.scriptContent ?? '')
    setBranches(isIfElseNode ? readIfElseBranches(nodeData.config) : [])
    setBreakExits(isLoopNode ? readLoopBreakExits(nodeData.config) : [])

    if (isApiCallNode) {
      const apiConfig = readApiCallConfig(nodeData.config)
      setApiMethod(apiConfig.method ?? 'GET')
      setApiUrl(apiConfig.url ?? '')
      setApiBody(apiConfig.body ?? '')
      setApiExpectedStatus(
        apiConfig.expectedStatus !== undefined ? String(apiConfig.expectedStatus) : '',
      )
      const headerRows = Object.entries(apiConfig.headers ?? {}).map(([key, value]) => ({
        key,
        value,
      }))
      setApiHeaders(headerRows.length > 0 ? headerRows : [{ key: '', value: '' }])
    }

    if (isWaitNode) {
      const waitConfig = readWaitConfig(nodeData.config)
      setWaitDuration(String(waitConfig.duration ?? 1))
      setWaitDurationUnit(waitConfig.durationUnit ?? 's')
    }
  }, [
    node,
    isIfElseNode,
    isLoopNode,
    isApiCallNode,
    isWaitNode,
    nodeData.config,
    nodeData.description,
    nodeData.label,
    nodeData.scriptContent,
    nodeData.scriptLanguage,
    nodeType,
  ])

  const handleBranchLabelChange = (branchId: string, nextLabel: string) => {
    setBranches((current) =>
      normalizeIfElseBranches(
        current.map((branch, index) =>
          branch.id === branchId && !isElseBranchIndex(index, current.length)
            ? { ...branch, label: nextLabel }
            : branch,
        ),
      ),
    )
  }

  const handleLoopBreakLabelChange = (branchId: string, nextLabel: string) => {
    setBreakExits((current) =>
      normalizeLoopBreakExits(
        current.map((branch) =>
          branch.id === branchId ? { ...branch, label: nextLabel } : branch,
        ),
      ),
    )
  }

  const handleAddBranch = () => {
    setBranches((current) => (isLoopNode ? current : addIfElseBranch(current)))
    if (isLoopNode) {
      setBreakExits((current) => addLoopBreakExit(current))
    }
  }

  const handleRemoveBranch = (branchId: string) => {
    if (isLoopNode) {
      setBreakExits((current) => removeLoopBreakExit(current, branchId))
      return
    }
    setBranches((current) => removeIfElseBranch(current, branchId))
  }

  const handleApiHeaderChange = (index: number, field: 'key' | 'value', nextValue: string) => {
    setApiHeaders((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: nextValue } : row,
      ),
    )
  }

  const handleAddApiHeader = () => {
    setApiHeaders((current) => [...current, { key: '', value: '' }])
  }

  const handleRemoveApiHeader = (index: number) => {
    setApiHeaders((current) => {
      if (current.length <= 1) return [{ key: '', value: '' }]
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  const buildSavePayload = (): Partial<WorkflowNodeData> | null => {
    if (!node) return null

    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      return null
    }

    const normalizedIfElseBranches = normalizeIfElseBranches(
      branches.map((branch) => ({
        ...branch,
        label: branch.label.trim() || branch.id,
      })),
    )

    if (nodeType === 'if-else' && normalizedIfElseBranches.length < MIN_IF_ELSE_BRANCHES) {
      return null
    }

    const normalizedLoopBreakExits = normalizeLoopBreakExits(
      breakExits.map((branch) => ({
        ...branch,
        label: branch.label.trim() || branch.id,
      })),
    )

    const baseConfig = { ...(nodeData.config ?? {}) }

    if (isApiCallNode) {
      const headers = Object.fromEntries(
        apiHeaders
          .filter((row) => row.key.trim())
          .map((row) => [row.key.trim(), row.value]),
      )
      const parsedStatus = apiExpectedStatus.trim()
        ? Number.parseInt(apiExpectedStatus, 10)
        : undefined

      Object.assign(baseConfig, {
        method: apiMethod,
        url: apiUrl.trim(),
        body: apiBody,
        ...(parsedStatus !== undefined && !Number.isNaN(parsedStatus)
          ? { expectedStatus: parsedStatus }
          : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      })
    }

    if (isWaitNode) {
      const parsedDuration = Number.parseFloat(waitDuration)
      Object.assign(baseConfig, {
        duration: Number.isFinite(parsedDuration) && parsedDuration >= 0 ? parsedDuration : 0,
        durationUnit: waitDurationUnit,
      })
    }

    return {
      label: trimmedLabel,
      description: description.trim(),
      scriptLanguage: nodeType === 'script' ? scriptLanguage : nodeData.scriptLanguage,
      scriptContent: nodeType === 'script' ? scriptContent : nodeData.scriptContent,
      ...(isIfElseNode
        ? {
            config: {
              ...baseConfig,
              branches: normalizedIfElseBranches,
            },
          }
        : isLoopNode
          ? {
              config: migrateLoopNodeConfig({
                ...baseConfig,
                branches: [...DEFAULT_LOOP_BRANCHES],
                breakExits: normalizedLoopBreakExits,
                bodyNodeIds: readLoopBodyNodeIds(nodeData.config),
              }),
            }
          : isApiCallNode || isWaitNode
            ? { config: baseConfig }
            : {}),
    }
  }

  return {
    nodeType,
    nodeData,
    label,
    setLabel,
    description,
    setDescription,
    scriptLanguage,
    setScriptLanguage,
    scriptContent,
    setScriptContent,
    branches,
    breakExits,
    isIfElseNode,
    isLoopNode,
    isApiCallNode,
    isWaitNode,
    loopBodySteps,
    minIfElseBranches: MIN_IF_ELSE_BRANCHES,
    apiMethod,
    setApiMethod,
    apiUrl,
    setApiUrl,
    apiHeaders,
    apiBody,
    setApiBody,
    apiExpectedStatus,
    setApiExpectedStatus,
    waitDuration,
    setWaitDuration,
    waitDurationUnit,
    setWaitDurationUnit,
    handleBranchLabelChange,
    handleLoopBreakLabelChange,
    handleAddBranch,
    handleRemoveBranch,
    handleApiHeaderChange,
    handleAddApiHeader,
    handleRemoveApiHeader,
    buildSavePayload,
  }
}
