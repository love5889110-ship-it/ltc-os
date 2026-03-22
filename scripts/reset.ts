import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { db } from '../src/db'
import {
  executionLogs,
  approvalTasks,
  agentActions,
  agentDecisions,
  agentRuns,
  agentThreads,
  tasks,
  drafts,
  assetUsages,
  assets,
  stateSnapshots,
  feedbackSamples,
  opportunityWorkspaces,
  signalBindings,
  signalEvents,
  humanInterventions,
  opportunities,
  contacts,
  customers,
  connectorInstances,
  agentRules,
} from '../src/db/schema'

async function reset() {
  console.log('🗑️  清空所有数据（按 FK 顺序）...')

  await db.delete(executionLogs)
  await db.delete(approvalTasks)
  await db.delete(tasks)
  await db.delete(drafts)
  await db.delete(assetUsages)
  await db.delete(agentActions)
  await db.delete(agentDecisions)
  await db.delete(agentRuns)
  await db.delete(agentThreads)
  await db.delete(assetUsages)
  await db.delete(assets)
  await db.delete(stateSnapshots)
  await db.delete(feedbackSamples)
  await db.delete(opportunityWorkspaces)
  await db.delete(signalBindings)
  await db.delete(signalEvents)
  await db.delete(humanInterventions)
  await db.delete(opportunities)
  await db.delete(contacts)
  await db.delete(customers)
  await db.delete(connectorInstances)
  await db.delete(agentRules)

  console.log('✅ 数据库已清空\n')
}

reset()
  .then(() => {
    // Dynamically require seed after reset completes
    return import('./seed')
  })
  .catch(console.error)
