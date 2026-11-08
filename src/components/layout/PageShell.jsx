import React from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
export default function PageShell({title,description,children}){ return (<><Helmet><title>{title?`${title} | RE:FORM Art & Craft Club`:'RE:FORM Art & Craft Club'}</title>{description && <meta name="description" content={description} />}</Helmet><Navbar /><main id="main" className="max-w-7xl mx-auto px-4 py-8 min-h-[60vh]">{children}</main><Footer /></>) }
