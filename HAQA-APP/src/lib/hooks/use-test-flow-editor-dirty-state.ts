import { useMemo, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'

import type { TestFlowEditorFormData } from '@/types'

import { serializeEditorSnapshot } from '@/components/test-flow/editor-snapshot'

type UseTestFlowEditorDirtyStateParams = {
  initialFormData: TestFlowEditorFormData
  initialNodes: Node[]
  initialEdges: Edge[]
  formData: TestFlowEditorFormData
  nodes: Node[]
  edges: Edge[]
}

export const useTestFlowEditorDirtyState = ({
  initialFormData,
  initialNodes,
  initialEdges,
  formData,
  nodes,
  edges,
}: UseTestFlowEditorDirtyStateParams): boolean => {
  const baselineSnapshotRef = useRef(
    serializeEditorSnapshot(initialFormData, initialNodes, initialEdges),
  )

  return useMemo(() => {
    const current = serializeEditorSnapshot(formData, nodes, edges)
    return current !== baselineSnapshotRef.current
  }, [formData, nodes, edges])
}
