export function formatDate(v){ if(!v) return ''; const d=v?.toDate?v.toDate():new Date(v); return isNaN(d)?'':d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) }
export function formatDateTime(v){ if(!v) return ''; const d=v?.toDate?v.toDate():new Date(v); return isNaN(d)?'':d.toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}) }
export function daysUntil(v){ if(!v) return null; const d=v?.toDate?v.toDate():new Date(v); return Math.ceil((d-Date.now())/86400000) }
export function deriveEventStatus(ev){ if(ev.status && ev.status!=='auto') return ev.status; const now=Date.now(); const s=ev.startDate?.toDate?ev.startDate.toDate():new Date(ev.startDate); const e=ev.endDate?.toDate?ev.endDate.toDate():s; if(now<s) return 'upcoming'; if(now>e) return 'completed'; return 'ongoing' }
export default formatDate
