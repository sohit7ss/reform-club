import React from 'react'
export default function WinnerBanner({winner}){ if(!winner) return null; return (<div className="bg-mustard/30 border-2 border-mustard rounded-2xl p-6 text-center mb-6"><p className="font-display text-2xl font-bold">🏆 Winner: {winner.projectTitle}</p><p>by {winner.participantName}</p></div>) }
