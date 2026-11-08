import React from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
export default function PermissionRoute({permission,children}){ const {can}=useAuth(); return (<ProtectedRoute>{can(permission)?children:<p className="p-10 text-center">You do not have permission for this module.</p>}</ProtectedRoute>) }
