import React from 'react'
export default function StatusSelect({value,options,onChange}){ return <select value={value} onChange={e=>onChange(e.target.value)} aria-label="Change status" className="border-2 border-sand rounded-lg px-2 py-1 bg-white">{options.map(o=><option key={o} value={o}>{o.replaceAll('_',' ')}</option>)}</select> }
