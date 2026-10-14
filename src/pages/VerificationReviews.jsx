import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Badge } from '../components/UI';
import { isVerificationDemo, readVerificationDocument, verificationsService } from '../services/verificationsService';
import { requiredSlots } from '../utils/verification';
export default function VerificationReviews() {
  const { user } = useAuth();
  const reviewLock = useRef(false);
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [filter, setFilter] = useState('pending'), [selected, setSelected] = useState(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [preview, setPreview] = useState(null), [version, setVersion] = useState(0);
  useEffect(() => {
    if (user.role !== 'admin') { setLoading(false); return; }
    let active = true; setLoading(true); setError('');
    verificationsService.list({ pageSize: 1000 }).then(result => { if (active) setItems(result.data); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.role, version]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  const openDocument = async doc => {
    setError('');
    try {
      const file = await readVerificationDocument(doc.key || doc.id, selected.id);
      if (!file) throw new Error('This file is no longer available in browser storage. Request a new submission.');
      setPreview({ url: URL.createObjectURL(file), mime: file.type, name: doc.name });
    } catch (e) { setError(e.message); }
  };
  const review = async status => {
    if (reviewLock.current) return;
    if (status === 'rejected' && reason.trim().length < 10) { setError('Give a specific reason of at least 10 characters so the professional can fix their submission.'); return; }
    if (status === 'approved' && !selected.documents?.length) { setError('This legacy record has no uploaded documents. Request a new submission before approving.'); return; }
    if (status === 'approved' && requiredSlots(selected).some(slot => !selected.documents.some(doc => doc.slot === slot.key))) { setError('Required document sides or business proof are missing. Request changes.'); return; }
    reviewLock.current = true; setBusy(true); setError('');
    try {
      const current = await verificationsService.get(selected.id);
      if (current.status !== 'pending') throw new Error('This request has already been reviewed. Refresh the list.');
      await verificationsService.update(selected.id, { status, rejectionReason: status === 'rejected' ? reason.trim() : '', reviewedAt: new Date().toISOString(), reviewedBy: user.id });
      setSelected(null); setPreview(null); setVersion(value => value + 1);
    } catch (e) { setError(e.message); } finally { reviewLock.current = false; setBusy(false); }
  };
  if (user.role !== 'admin') return <section className="card v-review-admin"><h1>Your business verification</h1><p>Manage your documents and check your review status.</p><Link className="btn btn-primary" to="/verify-documents">View verification</Link></section>;
  return <><div className="resource-head"><div><span className="kicker">TRUST & SAFETY</span><h1>Business verifications</h1><p>Review professional details and documents before making a decision.</p></div><Button variant="outline" onClick={() => { setSelected(null); setPreview(null); setVersion(value => value + 1); }}>Refresh</Button></div><section className="card v-review-admin">{error && <p role="alert" className="error">{error}</p>}{selected ? <><div className="v-review-head"><h3>{selected.business}</h3><button disabled={busy} onClick={() => { setSelected(null); setPreview(null); setError(''); }}>Back to requests</button></div><Badge value={selected.status} /><dl className="v-summary">{[['Account type', selected.type], ['Legal name', selected.legalName], ['Email', selected.email], ['Phone', selected.phone], ['Address', [selected.address, selected.city, selected.postalCode, selected.country].filter(Boolean).join(', ')], ['Document type', selected.document], ['Business proof', selected.businessType], ['Reference', selected.id]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided (legacy record)'}</dd></div>)}</dl><h3 style={{ marginTop: 24 }}>Uploaded documents</h3><div className="v-admin-docs">{selected.documents?.length ? selected.documents.map(doc => <Button variant="outline" key={doc.key} onClick={() => openDocument(doc)}>{doc.label || doc.name}</Button>) : <p>No uploaded files on this legacy record.</p>}</div>{preview && <div className="v-preview"><p>{preview.name}</p>{preview.mime === 'application/pdf' ? <iframe title="Verification document preview" src={preview.url} /> : <img src={preview.url} alt="Uploaded verification document" />}<a className="btn btn-outline" href={preview.url} target="_blank" rel="noreferrer">Open document</a></div>}{selected.status === 'pending' ? <><Field label="Feedback for the professional (required when requesting changes)" as="textarea" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /><div className="v-actions"><Button variant="outline" disabled={busy} onClick={() => review('rejected')}>Request changes</Button><Button loading={busy} onClick={() => review('approved')}>Approve verification</Button></div></> : <p>{selected.rejectionReason || 'This request has already been reviewed.'}</p>}</> : <><Field label="Review status" as="select" value={filter} options={[{ value: 'pending', label: 'Pending review' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Changes requested' }, { value: '', label: 'All requests' }]} onChange={e => setFilter(e.target.value)} />{loading ? <p role="status">Loading requests…</p> : items.filter(item => !filter || item.status === filter).length ? items.filter(item => !filter || item.status === filter).map(item => <article className="v-admin-record" key={item.id}><h3>{item.business}</h3><Badge value={item.status} /><p>{item.type} · {item.id} · {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'Date unavailable'}</p><Button variant="outline" onClick={() => { setSelected(item); setReason(''); setError(''); }}>Review request</Button></article>) : <p>No requests with this status.</p>}</>}<p className="v-footnote">{isVerificationDemo() ? 'Demo review changes affect this browser only. Real access control and verification must be enforced by your backend.' : 'Review decisions are sent to the configured verification API.'}</p></section></>;
}
