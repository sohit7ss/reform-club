import DOMPurify from 'dompurify'
export function sanitizeHtml(html){ return DOMPurify.sanitize(html||'',{ALLOWED_TAGS:['p','br','strong','em','ul','ol','li','a','h1','h2','h3','h4','blockquote','code','pre'],ALLOWED_ATTR:['href','rel','target']}) }
export function sanitizeText(t){ return DOMPurify.sanitize(String(t||''),{ALLOWED_TAGS:[],ALLOWED_ATTR:[]}) }
export function safeUrl(u){ if(!u) return ''; return /^https?:\/\//i.test(u)?u:'' }
export default sanitizeHtml
