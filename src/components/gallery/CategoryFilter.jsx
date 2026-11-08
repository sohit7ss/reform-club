import React from 'react'
import { GALLERY_CATEGORIES } from '../../config/constants.js'
export default function CategoryFilter({value,onChange}){ return (<div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by category">{GALLERY_CATEGORIES.map(c=><button key={c.id} onClick={()=>onChange(c.id)} aria-pressed={value===c.id} className={`px-4 py-2 rounded-full font-bold border-2 ${value===c.id?'bg-clay text-white border-clay':'bg-white border-sand'}`}>{c.label}</button>)}</div>) }
