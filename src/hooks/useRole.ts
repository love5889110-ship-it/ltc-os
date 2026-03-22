'use client'

import { useState, useEffect } from 'react'

export type UserRole = 'sales' | 'solution' | 'manager' | null

export const ROLE_LABELS: Record<NonNullable<UserRole>, string> = {
  sales: '销售',
  solution: '解方经理',
  manager: '管理层',
}

export function useRole() {
  const [role, setRoleState] = useState<UserRole>(null)

  useEffect(() => {
    const stored = localStorage.getItem('ltc_role') as UserRole
    if (stored && ['sales', 'solution', 'manager'].includes(stored)) {
      setRoleState(stored)
    }
  }, [])

  const setRole = (r: UserRole) => {
    if (r) {
      localStorage.setItem('ltc_role', r)
    } else {
      localStorage.removeItem('ltc_role')
    }
    setRoleState(r)
  }

  return { role, setRole }
}
