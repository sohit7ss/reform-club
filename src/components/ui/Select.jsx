import React from 'react'
export default function Select({label,id,children,error,...p}){ return (<div className="mb-3"><label htmlFor={id} className="block font-bold text-sm mb-1">{label}</label><select id={id} {...p} className="w-full border-2 border-sand rounded-xl px-3 py-2 bg-white">{children}</select>{error && <p role="alert" className="text-red-700 text-sm">{error}</p>}</div>) }
