import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_BASE_URL||'/api/v1',timeout:15000,headers:{'Content-Type':'application/json'}});
api.interceptors.request.use(config=>{const token=sessionStorage.getItem('karivia_token');if(token)config.headers.Authorization=`Bearer ${token}`;return config});
api.interceptors.response.use(response=>response.data,error=>{const message=error.response?.data?.message||error.message||'Something went wrong';return Promise.reject(new Error(message))});
