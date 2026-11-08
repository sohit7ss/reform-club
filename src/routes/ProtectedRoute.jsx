import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
export default function ProtectedRoute({children}){ const {user,adminProfile,loading}=useAuth(); if(loading) return <p className="p-10 text-center">Checking access…</p>; if(!user) return <Navigate to="/admin/login" replace />; if(!adminProfile) return <div className="p-10 text-center"><p className="font-bold">You are signed in, but you do not have an admin profile.</p><p className="text-sm">Ask the Coordinator to create an admins/{'{uid}'} document for your account.</p></div>; return children }
