import React from 'react'
import { Controller } from 'react-hook-form'
export default function FormField({control,name,label,type,options,placeholder,rows,hint}){
 return (
  <Controller name={name} control={control} render={function renderField(args){
   const field=args.field
   const err=args.fieldState.error
   const cls='w-full border-2 border-sand rounded-xl px-3 py-2 bg-white font-normal'
   let controlNode=null
   if(type==='textarea'){
    controlNode=<textarea rows={rows||4} placeholder={placeholder||''} value={field.value||''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} className={cls} />
   } else if(type==='select'){
    controlNode=<select value={field.value||''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} className={cls}>{options.map(function mapOpt(o){ return <option key={o.value} value={o.value}>{o.label}</option> })}</select>
   } else if(type==='checkbox'){
    controlNode=<input type="checkbox" checked={Boolean(field.value)} onChange={function onCheck(e){ field.onChange(e.target.checked) }} onBlur={field.onBlur} name={field.name} ref={field.ref} className="h-4 w-4" />
   } else if(type==='number'){
    controlNode=<input type="number" placeholder={placeholder||''} value={field.value==null?'':field.value} onChange={function onNum(e){ field.onChange(e.target.value==='' ? undefined : Number(e.target.value)) }} onBlur={field.onBlur} name={field.name} ref={field.ref} className={cls} />
   } else if(type==='commalist'){
    const text=Array.isArray(field.value)?field.value.join(', '):(field.value||'')
    controlNode=<input type="text" placeholder={placeholder||''} value={text} onChange={function onList(e){ field.onChange(e.target.value.split(',').map(function trimItem(s){ return s.trim() }).filter(function keepItem(s){ return s.length>0 })) }} onBlur={field.onBlur} name={field.name} ref={field.ref} className={cls} />
   } else {
    controlNode=<input type={type||'text'} placeholder={placeholder||''} value={field.value==null?'':field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} className={cls} />
   }
   if(type==='checkbox'){
    return <label className="flex gap-2 items-center font-bold text-sm mb-3">{controlNode} {label}{err && <span role="alert" className="text-red-700 text-sm font-normal">{err.message}</span>}</label>
   }
   return <label className="block font-bold text-sm mb-3">{label}{controlNode}{hint && <span className="block font-normal text-xs mt-1">{hint}</span>}{err && <span role="alert" className="text-red-700 text-sm font-normal block">{err.message}</span>}</label>
  }} />
 )
}
