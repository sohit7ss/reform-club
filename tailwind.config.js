export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: { extend: {
    colors: {
      paper:'#FDF8EF', cream:'#FFF9EC', ink:'#2B2118', clay:'#C96F4A', terracotta:'#B4552D',
      sage:'#7A8B6F', mustard:'#E9A13B', teal:'#2F7D7A', blush:'#F2C9B8', sand:'#EAD9B8', kraft:'#D9C7A7'
    },
    fontFamily: { display:['"Fraunces"','Georgia','serif'], body:['"Nunito"','system-ui','sans-serif'] },
    boxShadow: { card:'0 4px 0 rgba(43,33,24,.08), 0 12px 24px -12px rgba(43,33,24,.25)', lift:'0 8px 0 rgba(43,33,24,.08), 0 20px 32px -12px rgba(43,33,24,.3)' }
  } },
  plugins: []
}
