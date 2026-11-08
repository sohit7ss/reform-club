import React from 'react'
export default function EmptyState({title='Nothing here yet',body}){ return <div className="text-center py-12 stitch bg-cream"><p className="font-display text-xl font-bold">{title}</p>{body && <p className="text-sm mt-2">{body}</p>}</div> }
