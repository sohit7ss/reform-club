const store={}; export function canSubmit(key,cooldownMs=30000){ const now=Date.now(); if(store[key] && now-store[key]<cooldownMs) return false; store[key]=now; return true }
export function secondsLeft(key,cooldownMs=30000){ const now=Date.now(); return store[key]?Math.max(0,Math.ceil((cooldownMs-(now-store[key]))/1000)):0 }
export default canSubmit
