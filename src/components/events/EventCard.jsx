import React from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/formatDate.js'
import Badge from '../ui/Badge.jsx'
export default function EventCard({ev}){ return (<article className="collage-card rounded-2xl overflow-hidden"><img src={ev.posterUrl||'https://picsum.photos/seed/event/800/500'} alt={ev.title} loading="lazy" className="w-full h-44 object-cover" /><div className="p-4"><Badge>{ev.status}</Badge><h3 className="font-display font-bold text-lg mt-2">{ev.title}</h3><p className="text-sm">{formatDate(ev.startDate)} · {ev.venue}</p><Link to={`/events/${ev.id}`} className="text-clay font-bold text-sm">View details →</Link></div></article>) }
