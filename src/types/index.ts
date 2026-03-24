export type SignalType = 'demand' | 'risk' | 'opportunity' | 'blocker' | 'escalation' | 'info'
export type SignalStatus = 'unbound' | 'pending_confirm' | 'bound' | 'triggered' | 'closed'
export type BindingStatus = 'candidate' | 'confirmed' | 'rejected' | 'auto_bound'
export type AgentType =
  | 'coordinator'
  | 'sales'
  | 'presales_assistant'
  | 'tender_assistant'
  | 'handover'
  | 'service_triage'
  | 'asset_governance'
export type ActionType =
  | 'create_task'
  | 'create_collab'
  | 'update_status'
  | 'send_draft'
  | 'escalate'
  | 'create_snapshot'
  | 'notify'
export type ActionStatus =
  | 'pending'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'
export type FeedbackLabel = 'accepted' | 'modified' | 'rejected'
export type WorkspaceStatus = 'active' | 'paused' | 'closed'
export type ThreadStatus = 'idle' | 'running' | 'error' | 'paused'
export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface SignalEventRow {
  id: string
  sourceType: string
  contentSummary: string | null
  signalType: SignalType | null
  priority: number | null
  confidenceScore: number | null
  status: SignalStatus
  eventTime: Date | null
  createdAt: Date | null
}

export interface BindingCandidate {
  type: 'customer' | 'contact' | 'opportunity'
  id: string
  name: string
  confidence: number
}

export interface AgentRunResult {
  runId: string
  decisions: Array<{
    type: string
    label: string
    confidence: number
    rationale: string
  }>
  actions: Array<{
    type: ActionType
    payload: Record<string, unknown>
    priority: number
    requiresApproval: boolean
  }>
  outputSummary: string
}
