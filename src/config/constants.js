export const SITE_NAME=import.meta.env.VITE_SITE_NAME || 'RE:FORM Art & Craft Club'
export const SITE_URL=import.meta.env.VITE_SITE_URL || ''
export const CLUB_EMAIL=import.meta.env.VITE_CLUB_EMAIL || 'contact@example.invalid'
export const LOGO_SRC='/logo-placeholder.svg'
export const MAX_IMAGE_MB=Number(import.meta.env.VITE_MAX_IMAGE_MB || 5)
export const MAX_DOC_MB=Number(import.meta.env.VITE_MAX_DOC_MB || 10)
export const TEAMS=[
 {id:'art',slug:'art',name:'Art',responsibility:'Painting, sketching, drawing, and visual art activities.',order:1},
 {id:'craft',slug:'craft',name:'Craft',responsibility:'Handmade crafts, upcycling, and creative reuse of waste materials.',order:2},
 {id:'design_media',slug:'design_media',name:'Design & Media',responsibility:'Posters, graphics, branding, photography, and digital media.',order:3},
 {id:'pr',slug:'pr',name:'PR',responsibility:'Public relations, communication, and maintaining the club\'s public image.',order:4},
 {id:'outreach',slug:'outreach',name:'Outreach',responsibility:'Connecting with students, other clubs, and external communities.',order:5},
 {id:'content',slug:'content',name:'Content',responsibility:'Captions, descriptions, documentation, and creative writing.',order:6},
 {id:'events',slug:'events',name:'Events',responsibility:'Planning, organising, and managing club events and workshops.',order:7},
 {id:'treasurer',slug:'treasurer',name:'Treasurer',responsibility:'Budget records, expense tracking, and financial management.',order:8}]
export const GALLERY_CATEGORIES=[{id:'all',label:'All'},{id:'painting',label:'Painting'},{id:'sketching',label:'Sketching'},{id:'craft',label:'Craft'},{id:'waste_to_best',label:'Waste to Best'}]
export const NOTICE_TYPES=['recruitment','event','workshop','competition','deadline','general']
export const BLOG_CATEGORIES=['tutorial','craft_idea','diy','tip','experience','process']
export const PLACEHOLDER_CONTACT={email:'[club email — to be filled by the club]',phone:'[phone — only if approved for publication]',institution:'[Institution name — to be filled by the club]',address:'[Campus address — to be filled by the club]'}
