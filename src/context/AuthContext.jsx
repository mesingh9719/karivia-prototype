import React,{createContext,useContext,useState} from 'react';
import {usersService} from '../services/usersService';
const AuthContext=createContext(null);
export function AuthProvider({children}){const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('karivia_current_user'))}catch{return null}});
 const login=async(email,role)=>{const res=await usersService.list({pageSize:100});let found=res.data.find(a=>a.email.toLowerCase()===email?.toLowerCase());if(!found&&role)found=res.data.find(a=>a.role===role);if(!found)throw new Error('No demo account found. Use one of the demo accounts below.');localStorage.setItem('karivia_current_user',JSON.stringify(found));setUser(found);return found};
 const logout=()=>{localStorage.removeItem('karivia_current_user');sessionStorage.removeItem('karivia_token');setUser(null)};
 const register=async(data)=>{const u=await usersService.create({...data,role:data.role||'customer'});localStorage.setItem('karivia_current_user',JSON.stringify(u));setUser(u);return u};
 return <AuthContext.Provider value={{user,login,logout,register}}>{children}</AuthContext.Provider>}
export const useAuth=()=>useContext(AuthContext);
