import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], server: { port: 5173 }, build: { rollupOptions: { output: { manualChunks(id){
 if(!id.includes('node_modules')) return undefined
 if(id.includes('node_modules/react/')||id.includes('node_modules/react-dom/')||id.includes('node_modules/react-router-dom/')||id.includes('node_modules/react-router/')||id.includes('node_modules/scheduler/')) return 'react'
 if(id.includes('node_modules/firebase/')||id.includes('node_modules/@firebase/')) return 'firebase'
 if(id.includes('node_modules/framer-motion/')) return 'framer-motion'
 if(id.includes('node_modules/zod/')||id.includes('node_modules/@hookform/resolvers/')) return 'zod'
 return undefined
} } } } })
