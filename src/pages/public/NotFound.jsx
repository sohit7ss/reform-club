import React from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
export default function NotFound(){ return (<PageShell title="Page not found"><div className="text-center py-16"><h1 className="font-display text-5xl font-black">404</h1><p className="mt-3">This page seems to have been recycled. Let's start again.</p><p className="mt-4"><Link to="/" className="bg-clay text-white px-6 py-3 rounded-full font-bold">Back home</Link></p></div></PageShell>) }
