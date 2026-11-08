import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
export default function AdminLayout(){ const {user,adminProfile,logout}=useAuth(); return (<div className="min-h-screen flex"><Sidebar /><div className="flex-1 p-4 sm:p-6"><header className="flex justify-between items-center mb-6"><h1 className="font-display text-2xl font-bold">Admin Panel</h1><div className="flex gap-3 items-center text-sm"><span>{adminProfile?.name||user?.email} ({adminProfile?.role})</span><Link to="/" className="underline">View site</Link><button onClick={logout} className="bg-ink text-white px-3 py-1.5 rounded-full">Sign out</button></div></header><Outlet /></div></div>) }
