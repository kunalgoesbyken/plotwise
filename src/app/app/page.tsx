import type { Metadata } from 'next'
import { FeasibilityApp } from '@/feasibility/feasibility-app'
import { REGION } from '@/region/regions'

export const metadata: Metadata = { title: `Plotwise · ${REGION.city} plot feasibility` }

export default function Workspace() {
  return <FeasibilityApp />
}
