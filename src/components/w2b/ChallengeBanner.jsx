import React from 'react'
import { formatDate } from '../../utils/formatDate.js'
import Badge from '../ui/Badge.jsx'
export default function ChallengeBanner({challenge}){ if(!challenge) return null; return (<div className="tape collage-card rounded-2xl p-6 bg-mustard/20 mb-6"><Badge>{challenge.status}</Badge><h2 className="font-display text-2xl font-bold mt-2">{challenge.title} — {challenge.theme}</h2><p className="mt-1">{challenge.description}</p><p className="text-sm font-bold mt-2">Deadline: {formatDate(challenge.submissionDeadline)} · Category: {challenge.category}</p></div>) }
