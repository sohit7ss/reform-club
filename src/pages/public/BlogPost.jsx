import React,{useEffect,useState} from 'react'
import { useParams, Link } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import { blogService } from '../../services/blogService.js'
import { sanitizeHtml } from '../../utils/sanitize.js'
function mdToHtml(md){ let h=(md||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); h=h.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/^- (.*)$/gm,'<li>$1</li>'); h=h.split(/\n\n+/).map(b=>b.startsWith('<')?b:`<p>${b.replace(/\n/g,'<br/>')}</p>`).join(''); return h }
export default function BlogPost(){ const {slug}=useParams(); const [post,setPost]=useState(null); useEffect(()=>{ (async()=>{ setPost(await blogService.getBySlug(slug)) })() },[slug]); if(!post) return <PageShell title="Blog post"><p>Post not found.</p></PageShell>; return (<PageShell title={post.title}><p><Link to="/blog" className="text-clay font-bold">← Blog</Link></p><h1 className="font-display text-3xl font-black mt-3">{post.title}</h1><p className="text-sm">by {post.authorName} · {post.category}</p>{post.coverUrl && <img src={post.coverUrl} alt={post.title} className="w-full max-w-2xl rounded-2xl my-4" />}<article dangerouslySetInnerHTML={{__html: sanitizeHtml(mdToHtml(post.content))}} /></PageShell>) }
