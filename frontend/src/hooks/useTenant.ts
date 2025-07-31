import { useState, useEffect, createContext, useContext } from 'react';
import { Tenant } from '../types/tenant';

interface TenantContextValue {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  updateTenant: (updates: Partial<Tenant>) => Promise<void>;
  setTenant: (tenant: Tenant | null) => void;
}

export const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

export function useTenantState() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load tenant from localStorage or API
    const loadTenant = async () => {
      try {
        const savedTenant = localStorage.getItem('mymcp_tenant');
        if (savedTenant) {
          setTenant(JSON.parse(savedTenant));
        }
      } catch (err) {
        setError('Failed to load tenant data');
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, []);

  const updateTenant = async (updates: Partial<Tenant>) => {
    const currentTenant = tenant || {
      id: 'default',
      name: 'Default Tenant',
      settings: {}
    };
    
    const updatedTenant = { ...currentTenant, ...updates };
    setTenant(updatedTenant);
    localStorage.setItem('mymcp_tenant', JSON.stringify(updatedTenant));
    
    console.log('Tenant updated:', updatedTenant);
  };

  const handleSetTenant = (newTenant: Tenant | null) => {
    setTenant(newTenant);
    if (newTenant) {
      localStorage.setItem('mymcp_tenant', JSON.stringify(newTenant));
    } else {
      localStorage.removeItem('mymcp_tenant');
    }
  };

  return {
    tenant,
    loading,
    error,
    updateTenant,
    setTenant: handleSetTenant
  };
}