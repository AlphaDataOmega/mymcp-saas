import React, { createContext, useContext } from 'react';
import { TenantContext, useTenantState } from '../hooks/useTenant';

interface TenantProviderProps {
  children: React.ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const tenantState = useTenantState();

  return (
    <TenantContext.Provider value={tenantState}>
      {children}
    </TenantContext.Provider>
  );
}