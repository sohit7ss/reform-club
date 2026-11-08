// Generates public/sitemap.xml from the static routes.
import { writeFileSync } from 'fs'
const base = process.env.VITE_SITE_URL || 'https://example.invalid'
const routes = ['/','/about','/team','/gallery','/events','/join','/apply','/contact','/notices','/waste-to-best','/constitution','/legacy','/members','/blog']
const urls = routes.map(r => '  <url><loc>' + base + r + '</loc></url>').join('\n')
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n'
writeFileSync('public/sitemap.xml', xml)
console.log('public/sitemap.xml written')
