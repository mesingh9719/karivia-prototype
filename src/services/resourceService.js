import {api} from '../api/client';import * as mock from './mockStore';
const isMock=()=>import.meta.env.VITE_DATA_PROVIDER!=='api';
export const resource=collection=>({
 list:params=>isMock()?mock.query(collection,params):api.get(`/${collection}`,{params}),
 get:id=>isMock()?mock.getOne(collection,id):api.get(`/${collection}/${id}`),
 create:data=>isMock()?mock.create(collection,data):api.post(`/${collection}`,data),
 update:(id,data)=>isMock()?mock.update(collection,id,data):api.patch(`/${collection}/${id}`,data),
 remove:id=>isMock()?mock.remove(collection,id):api.delete(`/${collection}/${id}`)
});

