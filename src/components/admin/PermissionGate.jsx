import React from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
export default function PermissionGate({permission,children,fallback}){ const {can}=useAuth(); if(!can(permission)) return fallback||<p className="p-6">You do not have permission for this module. Ask the Coordinator.</p>; return <>{children}</> }
