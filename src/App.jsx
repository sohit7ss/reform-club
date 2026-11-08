import React, { Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import AppRoutes from './routes/AppRoutes.jsx'
import ScrollToTop from './components/layout/ScrollToTop.jsx'
export default function App(){ return (<BrowserRouter><AuthProvider><ToastProvider><ScrollToTop /><Suspense fallback={<div className="p-10 text-center">Loading RE:FORM…</div>}><AppRoutes /></Suspense></ToastProvider></AuthProvider></BrowserRouter>) }
