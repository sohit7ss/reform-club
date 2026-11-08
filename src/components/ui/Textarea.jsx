import React from 'react'
export default function Textarea({label,id,error,...p}){ return (<div className="mb-3"><label htmlFor={id} className="block font-bold text-sm mb-1">{label}</label><textarea id={id} {...p} className="w-full border-2 border-sand rounded-xl px-3 py-2 bg-white" />{error && <p role="alert" className="text-red-700 text-sm">{error}</p>}</div>) }
