import React from 'react'
export default function Badge({children,tone='clay'}){ const m={clay:'bg-blush text-terracotta',sage:'bg-sage/20 text-teal-800',mustard:'bg-mustard/30 text-ink',teal:'bg-teal-100 text-teal-800'}; return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${m[tone]||m.clay}`}>{children}</span> }
