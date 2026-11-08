export const ROLES=['coordinator','co_coordinator','mentor','staff']
export const PERMISSIONS=['gallery','events','notices','team','membership','applications','waste2best','constitution','comments','legacy','blog','contact']
export const PERMISSION_LABELS={gallery:'Gallery',events:'Events',notices:'Notices',team:'Team',membership:'Membership',applications:'Applications',waste2best:'Waste to Best',constitution:'Constitution',comments:'Comments',legacy:'Legacy',blog:'Blog',contact:'Contact Messages'}
export function canPermission(adminProfile,perm){ if(!adminProfile||!adminProfile.active) return false; if(adminProfile.role==='coordinator') return true; return Boolean(adminProfile.permissions && adminProfile.permissions[perm]) }
export function isCoordinator(p){ return p && p.role==='coordinator' && p.active }
