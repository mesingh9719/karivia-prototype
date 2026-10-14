export const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n)||0);
export const nice=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export const dateDisplay=d=>d?new Date(`${d}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
export const today=()=>new Date().toISOString().slice(0,10);
