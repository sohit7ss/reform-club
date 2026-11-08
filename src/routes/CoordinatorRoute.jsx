import React from 'react'
import { Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { isCoordinator } from '../config/roles.js'
export default function CoordinatorRoute({children}){ const {adminProfile,loading}=useAuth(); if(loading) return <p className="p-10 text-center">Checking access…</p>; return (<ProtectedRoute>{isCoordinator(adminProfile)?children:<p className="p-10 text-center">Users and Permissions is coordinator-only.</p>}</ProtectedRoute>) }
