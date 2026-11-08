import Tabs from '../ui/Tabs.jsx'
export default function EventTabs({active,onChange}){ return <Tabs tabs={[{id:'upcoming',label:'Upcoming'},{id:'ongoing',label:'Ongoing'},{id:'completed',label:'Completed'}]} active={active} onChange={onChange} /> }
