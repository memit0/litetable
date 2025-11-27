"use client"

import * as React from "react"

type Tenant = {
  id: string
  name: string
  role?: string
}

type TenantContextType = {
  tenant: Tenant | null
  setTenant: (tenant: Tenant | null) => void
  tenants: Tenant[]
  setTenants: (tenants: Tenant[]) => void
}

const TenantContext = React.createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({
  children,
  initialTenant,
  initialTenants = [],
}: {
  children: React.ReactNode
  initialTenant?: Tenant | null
  initialTenants?: Tenant[]
}) {
  const [tenant, setTenant] = React.useState<Tenant | null>(initialTenant || null)
  const [tenants, setTenants] = React.useState<Tenant[]>(initialTenants)

  return (
    <TenantContext.Provider value={{ tenant, setTenant, tenants, setTenants }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = React.useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}

