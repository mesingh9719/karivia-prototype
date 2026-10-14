import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, ShieldCheck, Store, UploadCloud, UserRound, X, Clock3 } from 'lucide-react';
import { Brand } from '../layouts/PublicLayout';
import { Button, Field } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { deleteVerificationDraft, loadVerificationDraft, saveVerificationDraft, isVerificationDemo, submitVerification, verificationsService } from '../services/verificationsService';
import { BUSINESS_TYPES, ID_TYPES, requiredSlots, validateDetails, validateDocuments, validateFile } from '../utils/verification';

function Upload({ slot, file, error, onChange, onError }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const choose = list => {
    if (list.length !== 1) { onError('Choose one file per document side.'); return; }
    const next = list[0], message = validateFile(next);
    if (message) onError(message); else onChange(next);
  };
  return <div className="v-upload-group"><span className="v-label" id={`${slot.key}-label`}>{slot.label} <span aria-hidden="true">*</span></span>
    <div className={`v-upload ${dragging ? 'dragging' : ''} ${error ? 'invalid' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files); }}>
      <input ref={input} id={`upload-${slot.key}`} type="file" accept="application/pdf,image/jpeg,image/png" aria-labelledby={`${slot.key}-label`} aria-describedby={error ? `${slot.key}-error` : 'v-file-help'} onChange={e => { if (e.target.files.length) choose(e.target.files); e.target.value = ''; }} />
      {file ? <div className="v-file-row">{file.type.startsWith('image/') ? <img src={preview} alt={`${slot.label} preview`} /> : <FileText size={32} />}<div><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to submit</small><a href={preview} target="_blank" rel="noreferrer">Preview document</a></div><button type="button" className="icon-btn" aria-label={`Remove ${slot.label}`} onClick={() => onChange(null)}><X size={19} /></button></div> : <button type="button" className="v-upload-trigger" onClick={() => input.current.click()}><UploadCloud size={27} /><b>Click to upload <span>or drag and drop</span></b><small>PDF, JPG or PNG · Up to 10 MB</small></button>}
    </div>{error && <small className="error" id={`${slot.key}-error`}>{error}</small>}
  </div>;
}

export default function BusinessVerification() {
  const { user } = useAuth();
  const [form, setForm] = useState({ role: user?.role || 'salon', name: user?.name || '', legalName: user?.name || '', email: user?.email || '', phone: user?.phone || '', country: '', address: '', city: '', postalCode: '', idType: 'passport', businessType: 'registration', consent: false });
  const [step, setStep] = useState(0), [files, setFiles] = useState({}), [errors, setErrors] = useState({}), [request, setRequest] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [failure, setFailure] = useState(''), [retry, setRetry] = useState(0), [resubmitting, setResubmitting] = useState(false);
  const heading = useRef(null), lock = useRef(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    if (!user || !['salon', 'freelancer'].includes(user.role)) { setLoading(false); return; }
    setLoading(true); setLoadError('');
    verificationsService.list({ pageSize: 1000, filters: { userId: user.id } }).then(async result => {
      if (!active) return;
      const latest = result.data.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
      setRequest(latest || null);
      if (latest && ['pending', 'approved'].includes(latest.status)) setResubmitting(false);
      if (latest?.status === 'rejected') setForm(current => ({ ...current, ...Object.fromEntries(Object.keys(current).filter(key => key in latest).map(key => [key, latest[key]])), consent: false }));
      if (!latest || latest.status === 'rejected') {
        try {
          const draft = await loadVerificationDraft(user.id);
          if (active && draft?.form?.role === user.role) {
            setForm(current => ({ ...current, ...draft.form, consent: false }));
            setFiles(draft.files || {}); setStep(Math.min(2, Math.max(0, draft.step || 0)));
            setResubmitting(Boolean(latest)); setDraftMessage('Your saved draft has been restored.');
          }
        } catch { if (active) setDraftMessage('Draft storage is unavailable. You can still complete this form.'); }
      }
    }).catch(error => { if (active) setLoadError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, retry]);
  useEffect(() => { heading.current?.focus(); }, [step, request, resubmitting]);
  useEffect(() => {
    const key = Object.keys(errors).find(name => errors[name]);
    if (key) (document.querySelector(`[name="${key}"]`) || document.getElementById(`upload-${key}`))?.focus();
  }, [errors]);
  useEffect(() => {
    if (!Object.values(files).some(Boolean) || request?.status === 'pending' || request?.status === 'approved') return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [files, request]);
  const change = (key, value) => { setForm(current => ({ ...current, [key]: value, consent: key === 'consent' ? value : false })); setErrors(current => ({ ...current, [key]: '' })); };
  const move = next => { setStep(next); setErrors({}); setFailure(''); };
  const submit = async e => {
    e.preventDefault();
    if (lock.current) return;
    const detailErrors = validateDetails(form), documentErrors = validateDocuments(form, files);
    if (step === 0 || Object.keys(detailErrors).length) { setErrors(detailErrors); if (!Object.keys(detailErrors).length) move(1); else setStep(0); return; }
    if (step === 1 || Object.keys(documentErrors).length) { setErrors(documentErrors); if (!Object.keys(documentErrors).length) move(2); else setStep(1); return; }
    if (!form.consent) { setErrors({ consent: 'Please confirm the details before submitting.' }); return; }
    lock.current = true; setBusy(true); setFailure('');
    try { const saved = await submitVerification(user, form, files, request); setRequest(saved); setFiles({}); setResubmitting(false); await deleteVerificationDraft(user.id).catch(() => {}); }
    catch (error) { setFailure(error.message); }
    finally { lock.current = false; setBusy(false); }
  };
  const saveDraft = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFailure('');
    try { await saveVerificationDraft(user.id, { form: { ...form, consent: false }, files, step }); setDraftMessage('Draft saved on this device, including your selected files.'); }
    catch (error) { setFailure(error.message); }
    finally { lock.current = false; setBusy(false); }
  };
  const input = (key, label, extra = {}) => <Field label={`${label} *`} name={key} value={form[key]} maxLength={key === 'address' ? 250 : 100} onChange={e => change(key, e.target.value)} error={errors[key]} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `v-error-${key}` : undefined} {...extra} />;
  const statusView = request && !resubmitting;
  return <div className="verification-page"><header className="v-header"><Brand /><span><ShieldCheck size={16} /> Professional onboarding</span><Link to={user ? `/app/${user.role}` : '/login'}>Workspace <ArrowRight size={15} /></Link></header>
    <div className="v-layout"><aside className="v-aside"><span className="kicker">YOUR NEXT CHAPTER</span><h1>Let’s make your<br />business official<span className="accent-dot">.</span></h1><p>A trusted profile starts with you. Help us get to know the professional behind the beauty.</p>
      <ol className="v-steps">{['Your business', 'Your documents', 'Review & submit'].map((title, i) => <li key={title} className={step === i && !statusView ? 'active' : step > i || statusView ? 'complete' : ''} aria-current={step === i && !statusView ? 'step' : undefined}><span>{step > i || statusView ? <Check size={16} /> : i + 1}</span><div><b>{title}</b><small>{['Tell us who you are', 'Verify your professional identity', 'One final check'][i]}</small></div></li>)}</ol>
      <div className="v-trust"><ShieldCheck size={23} /><div><b>Your documents, handled with care</b><p>{isVerificationDemo() ? 'Demo uploads stay in this browser. They are available to demo reviewers on this device.' : 'Documents are submitted for account verification. Only upload documents you are authorized to share.'}</p></div></div>
      <small className="v-aside-footer">Karivia · Built for your beautiful business</small></aside>
    <main className="v-main">
      {!user || !['salon', 'freelancer'].includes(user.role) ? <section className="v-card"><h2>Start with a professional account</h2><p>Sign in or register as a salon owner or independent freelancer to verify your profile.</p><Link className="btn btn-primary" to="/register">Create an account</Link> <Link className="btn btn-outline" to="/login" state={{ from: '/verify-documents' }}>Sign in</Link></section>
        : loading ? <section className="v-card" role="status">Loading your verification status…</section>
        : loadError ? <section className="v-card"><h2>Couldn’t load verification</h2><p role="alert" className="error">{loadError}</p><Button onClick={() => setRetry(value => value + 1)}>Try again</Button></section>
        : statusView ? <section className="v-card v-status"><div className={`v-status-icon ${request.status}`} >{request.status === 'pending' ? <Clock3 size={32} /> : <ShieldCheck size={32} />}</div><span className="kicker">{request.status === 'pending' ? 'SUBMITTED FOR REVIEW' : request.status === 'approved' ? 'VERIFICATION COMPLETE' : 'ACTION REQUIRED'}</span><h2 ref={heading} tabIndex={-1}>{request.status === 'pending' ? 'You’re one step closer.' : request.status === 'approved' ? 'Your profile is verified.' : 'Let’s update your documents.'}</h2><p>{request.status === 'pending' ? 'Your request has been saved. You can return here to check its status while a reviewer checks your details.' : request.status === 'approved' ? 'Your professional verification has been approved.' : 'Your request needs changes before it can be approved.'}</p>{request.status === 'rejected' && <div className="v-notice"><b>Reviewer feedback</b><p>{request.rejectionReason || 'Please upload clear, valid documents that match your professional details.'}</p></div>}<dl className="v-summary"><div><dt>Business / professional</dt><dd>{request.business}</dd></div><div><dt>Reference</dt><dd>{request.id}</dd></div><div><dt>Submitted</dt><dd>{new Date(request.submittedAt).toLocaleDateString()}</dd></div><div><dt>Status</dt><dd>{request.status}</dd></div></dl><div className="v-actions">{request.status === 'rejected' && <Button onClick={() => { setResubmitting(true); move(0); }}>Update & resubmit</Button>}<Link className="btn btn-outline" to={`/app/${user.role}`}>Go to workspace</Link><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Refresh status</Button></div></section>
        : <form className="v-card" onSubmit={submit} noValidate><span className="kicker">STEP {step + 1} OF 3</span><h2 ref={heading} tabIndex={-1}>{['A little about your business', 'Build trust with the right documents', 'Everything look right?'][step]}</h2><p className="v-intro">{['The details you share help us verify your professional profile. Fields marked * are required.', 'Use clear, complete copies of valid documents. All corners and text should be visible.', 'Check your details and documents before sending them for review.'][step]}</p>
          {step === 0 && <><fieldset className="v-account"><legend>Account type</legend>{[['salon', Store, 'Salon / studio', 'For owners of a beauty business'], ['freelancer', UserRound, 'Independent freelancer', 'For individual beauty professionals']].map(([role, Icon, title, text]) => <div className={`v-choice ${form.role === role ? 'selected' : 'unavailable'}`} key={role}><Icon size={23} /><b>{title}</b><small>{text}</small>{form.role === role && <CheckCircle2 size={17} className="v-choice-check" />}</div>)}</fieldset><p className="v-hint">Account type comes from your registered profile.</p><div className="v-fields">{input('name', form.role === 'salon' ? 'Salon / studio name' : 'Professional display name', { autoComplete: 'organization' })}{input('legalName', form.role === 'salon' ? 'Owner / representative legal name' : 'Full legal name', { autoComplete: 'name' })}{input('email', 'Contact email', { type: 'email', autoComplete: 'email' })}{input('phone', 'Phone number', { type: 'tel', autoComplete: 'tel', placeholder: '+91 98765 43210' })}{input('country', 'Country of operation', { autoComplete: 'country-name', placeholder: 'e.g. India' })}{input('city', 'City', { autoComplete: 'address-level2' })}<div className="v-span">{input('address', form.role === 'salon' ? 'Business address' : 'Professional contact address', { autoComplete: 'street-address' })}</div>{input('postalCode', 'Postal / ZIP code', { autoComplete: 'postal-code' })}</div><p className="v-hint">Your legal name must match your identity document. Contact addresses are collected for verification.</p></>}
          {step === 1 && <><div className="v-notice"><ShieldCheck size={19} /><div><b>{form.role === 'salon' ? 'Two kinds of proof, one trusted business' : 'Your identity is your professional foundation'}</b><p>{form.role === 'salon' ? 'Upload the owner or representative’s government ID and a document showing the registered business name.' : 'Upload a government-issued ID showing your full legal name and photo.'}</p></div></div><Field label="Identity document type *" as="select" options={ID_TYPES} value={form.idType} onChange={e => { change('idType', e.target.value); setFiles(current => ({ business: current.business })); setErrors({}); }} error={errors.idType} /><p className="v-hint" id="v-file-help">PDF, JPG or PNG. Maximum 10 MB per file. No passwords, cropped pages, or expired documents.</p>{form.role === 'salon' && <Field label="Business document type *" as="select" options={BUSINESS_TYPES} value={form.businessType} onChange={e => { change('businessType', e.target.value); setFiles(current => ({ ...current, business: null })); }} error={errors.businessType} />}<div className="v-uploads">{requiredSlots(form).map(slot => <Upload key={`${form.idType}-${slot.key}`} slot={slot} file={files[slot.key]} error={errors[slot.key]} onError={message => setErrors(current => ({ ...current, [slot.key]: message }))} onChange={file => { setFiles(current => ({ ...current, [slot.key]: file })); change('consent', false); setErrors(current => ({ ...current, [slot.key]: '', documents: '' })); }} />)}</div>{errors.documents && <p role="alert" className="error">{errors.documents}</p>}</>}
          {step === 2 && <><div className="v-review-head"><h3>Professional details</h3><button type="button" onClick={() => move(0)}>Edit details</button></div><dl className="v-summary">{[['Account type', form.role === 'salon' ? 'Salon / studio' : 'Freelancer'], ['Business / professional name', form.name], ['Legal name', form.legalName], ['Email', form.email], ['Phone', form.phone], ['Address', `${form.address}, ${form.city}, ${form.postalCode}, ${form.country}`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="v-review-head"><h3>Verification documents</h3><button type="button" onClick={() => move(1)}>Edit documents</button></div><p className="v-hint">{ID_TYPES.find(type => type.value === form.idType)?.label}{form.role === 'salon' ? ` · ${BUSINESS_TYPES.find(type => type.value === form.businessType)?.label}` : ''}</p>{requiredSlots(form).map(slot => <div className="v-review-file" key={slot.key}><FileText size={20} /><div><b>{slot.label}</b><small>{files[slot.key]?.name}</small></div><CheckCircle2 size={18} /></div>)}<label className="v-consent"><input type="checkbox" checked={form.consent} onChange={e => change('consent', e.target.checked)} /><span>I confirm that these details are accurate, that I’m authorized to submit these documents, and that they may be reviewed for professional verification. *</span></label>{errors.consent && <p className="error" role="alert">{errors.consent}</p>}</>}
          {Object.values(errors).some(Boolean) && <p className="error" role="alert">Please check the highlighted fields before continuing.</p>}{failure && <p className="error" role="alert">{failure}</p>}
          <div className="v-actions">{step > 0 ? <Button type="button" variant="outline" disabled={busy} onClick={() => move(step - 1)}><ArrowLeft size={16} /> Back</Button> : <Link to={`/app/${user.role}`} className="v-back"><ArrowLeft size={15} /> Back to workspace</Link>}<Button type="submit" loading={busy}>{busy ? 'Submitting…' : step === 2 ? 'Submit for verification' : 'Continue'} {!busy && <ArrowRight size={16} />}</Button></div>
          <div className="v-draft"><button type="button" disabled={busy} onClick={saveDraft}>Save draft on this device</button>{draftMessage && <small role="status">{draftMessage}</small>}</div>
          <p className="v-footnote">{isVerificationDemo() ? 'Demo mode: submissions and files are saved on this device. No external identity check is performed.' : 'Your request will be submitted to the verification service.'} Save a draft before leaving to retain your details and files. Use sample documents on shared devices.</p>
        </form>}
    </main></div></div>;
}

