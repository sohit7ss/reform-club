import React from 'react'
export default function Button({children,...p}){ return <button {...p} className={`bg-clay hover:bg-terracotta text-white font-bold px-5 py-2.5 rounded-full disabled:opacity-50 ${p.className||''}`}>{children}</button> }
