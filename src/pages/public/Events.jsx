import React,{useEffect,useState} from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import EventCard from '../../components/events/EventCard.jsx'
import EventTabs from '../../components/events/EventTabs.jsx'
import { eventService } from '../../services/eventService.js'
import { deriveEventStatus } from '../../utils/formatDate.js'
export default function Events(){ const [tab,setTab]=useState('upcoming'); const [events,setEvents]=useState([]); useEffect(()=>{ (async()=>setEvents(await eventService.listPublished()))() },[]); const shown=events.filter(e=>(deriveEventStatus(e))===tab); return (<PageShell title="Events" description="RE:FORM events — upcoming, ongoing and completed."><h1 className="font-display text-3xl font-black mb-4">Events</h1><EventTabs active={tab} onChange={setTab} /><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{shown.map(e=><EventCard key={e.id} ev={e} />)}</div>{!shown.length && <p className="py-10 text-center">No {tab} events right now.</p>}</PageShell>) }
