import seed from '../data/seed.json';
const KEY='karivia_mock_db_v1';
const clone=value=>structuredClone(value);
export function getDb(){try{const saved=localStorage.getItem(KEY);return saved?JSON.parse(saved):clone(seed)}catch{return clone(seed)}}
export function saveDb(db){localStorage.setItem(KEY,JSON.stringify(db));window.dispatchEvent(new Event('karivia:changed'))}
export const delay=(ms=140)=>new Promise(resolve=>setTimeout(resolve,ms));
export async function query(collection,{page=1,pageSize=20,search='',filters={}}={}){await delay();const list=getDb()[collection]||[];const term=search.trim().toLowerCase();const filtered=list.filter(item=>(!term||JSON.stringify(item).toLowerCase().includes(term))&&Object.entries(filters).every(([k,v])=>v==null||v===''||item[k]===v));return {data:clone(filtered.slice((page-1)*pageSize,page*pageSize)),total:filtered.length,page,pageSize}}
export async function getOne(collection,id){await delay();const item=(getDb()[collection]||[]).find(a=>String(a.id)===String(id));if(!item)throw new Error('Record not found');return clone(item)}
export async function create(collection,item){await delay();const db=getDb();const record={...item,id:item.id||`${collection.slice(0,3)}_${crypto.randomUUID().slice(0,8)}`,createdAt:new Date().toISOString()};db[collection]=[record,...(db[collection]||[])];saveDb(db);return clone(record)}
export async function update(collection,id,patch){await delay();const db=getDb(),idx=(db[collection]||[]).findIndex(a=>String(a.id)===String(id));if(idx<0)throw new Error('Record not found');db[collection][idx]={...db[collection][idx],...patch,updatedAt:new Date().toISOString()};saveDb(db);return clone(db[collection][idx])}
export async function remove(collection,id){await delay();const db=getDb();db[collection]=(db[collection]||[]).filter(a=>String(a.id)!==String(id));saveDb(db);return {success:true}}
export const resetDemo=()=>{localStorage.removeItem(KEY);window.dispatchEvent(new Event('karivia:changed'))};
