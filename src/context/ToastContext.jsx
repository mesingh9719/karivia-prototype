import React,{createContext,useContext,useState} from 'react';import {CheckCircle2,X,AlertTriangle} from 'lucide-react';
const Context=createContext(null);
export function ToastProvider({children}){const [message,setMessage]=useState(null);const notify=(text,type='success')=>{setMessage({text,type,id:Date.now()});};return <Context.Provider value={notify}>{children}{message&&<div role="alert" className="toast"><span>{message.type==='error'?<AlertTriangle size={19}/>:<CheckCircle2 size={19}/>}</span><span>{message.text}</span><button aria-label="Close" onClick={()=>setMessage(null)}><X size={16}/></button></div>}</Context.Provider>}
export const useToast=()=>useContext(Context);
