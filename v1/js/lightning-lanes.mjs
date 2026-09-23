export const time = n => Number.isInteger(n) ? `${Math.floor(n / 60) % 12 || 12}:${String(n % 60).padStart(2, '0')} ${n >= 720 ? 'PM' : 'AM'}` : 'Time unavailable';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const windowText = b => `${time(b.startMinute)}${b.endMinute != null ? ' – ' + time(b.endMinute) : ''}`;
export function returnDestination(search) {
  const from = new URLSearchParams(search).get('from');
  return from === 'shortcuts' ? { href: 'index.html?view=shortcuts', label: 'Shortcuts' } : { href: 'index.html?view=home', label: 'Home' };
}
export function freshness(b, now = Date.now()) { if (b.refreshRequired || Date.parse(b.expiresAt) <= now) return 'Last known — refresh required'; const age = Math.floor((now - Date.parse(b.observedAt)) / 60000); return !Number.isFinite(age) || age >= 5 ? 'Last known — refresh required' : age < 1 ? 'Just now' : `${age} min ago`; }
export function criterionText(c) { return ({ EARLIEST_AVAILABLE: 'Earliest available', AFTER_TIME: `At or after ${time(c.startMinute)}`, BEFORE_TIME: `At or before ${time(c.endMinute)}`, BETWEEN_TIMES: `${time(c.startMinute)} – ${time(c.endMinute)}` })[c.type]; }
export const visibleSearches = rows => rows.filter(s => !['CANCELLED', 'SUCCESS'].includes(s.status));
export const uniquePlans = rows => [...new Map(rows.map(b => [b.id, b])).values()];
export const searchablePlans = rows => rows.filter(b => !b.displayOnly);
export const eligibleExperiences = (rows, parkId, productType) => rows.filter(x => x.parkId === parkId && x.productTypes?.includes(productType));
export async function refreshPlannerState({ local, request, reload }) {
  await request(local ? '/demo/refresh' : '/planner/refresh', 'POST', {});
  await reload();
}
export function searchTypeLabel(s, current) {
  if (s.searchType === 'NEW_BOOKING') return 'Watch for a new selection';
  if (s.searchType === 'MODIFY_UNTIL_STOPPED') return 'Keep looking for a better time';
  return current && s.experienceId !== current.experienceId ? 'Change to another experience' : 'Improve a held booking';
}
const statuses = { CONFIRMED_AWAITING_EXECUTION: 'Confirmed — awaiting execution', ACTIVE: 'Searching', PAUSED: 'Paused', READY_FOR_CONFIRMATION: 'Confirmation required', CANDIDATE_FOUND: 'Candidate found', EXECUTING: 'Preparing dry run', VERIFYING: 'Verifying dry run', SUCCESS: 'Dry run successful', STALE: 'Refresh required', EXPIRED: 'Expired', FAILED: 'Failed', REPLAN_REQUIRED: 'Plan changed — search again', CANCELLED: 'Cancelled', NO_MATCH: 'No matching option observed' };
export function candidateCard(w, now = Date.now()) {
  if (w.result) return `<div class="result"><strong>${w.status === 'CONFIRMED_AWAITING_EXECUTION' ? 'Confirmed — awaiting execution' : 'Dry run successful'}</strong><p>${esc(w.result.message)}</p></div>`;
  if (w.status === 'EXPIRED') return `<section class="candidate"><p class="eyebrow">LIGHTNING LANE UPDATE</p><h3>${esc(w.proposed?.experienceName || 'Previous candidate')}</h3><p class="muted">This option expired and needs refreshing. It cannot be confirmed.</p></section>`;
  if (w.status !== 'READY_FOR_CONFIRMATION') return `<p class="muted">${esc(w.status === 'CANCELLED' ? 'Previous proposal closed.' : statuses[w.status] || 'Status unavailable')}</p>`;
  const expired = Date.parse(w.expiresAt) <= now;
  const delta = w.current.startMinute - w.proposed.startMinute;
  return `<section class="candidate"><p class="eyebrow">BETTER LIGHTNING LANE FOUND</p><h3>${esc(w.proposed.experienceName)}</h3><div class="comparison"><div><span>Current · ${esc(w.current.experienceName)}</span><strong>${esc(windowText(w.current))}</strong></div><div><span>${esc(w.availabilityLabel)}</span><strong>${esc(windowText(w.proposed))}</strong></div></div>${delta > 0 ? `<p class="earlier">${delta} minutes earlier</p>` : ''}<p class="muted">${esc(w.evidenceLabel)}</p><p class="muted">${expired ? 'Expired — search again' : 'Confirmation expires at ' + esc(new Date(w.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }))}</p><div class="actions"><button class="primary" data-confirm="${esc(w.id)}" ${expired ? 'disabled' : ''}>Confirm ${time(w.proposed.startMinute)}</button><button data-ignore="${esc(w.id)}">Ignore</button></div></section>`;
}

if (typeof document !== 'undefined') {
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const apiBase = local ? '/v1' : 'https://disneyos-api-dev.disneyosplanner.workers.dev/v1';
  const $ = id => document.getElementById(id), form = $('search-form');
  const destination = returnDestination(location.search);
  const workflowId = new URLSearchParams(location.search).get('workflow');
  $('lane-back').href = destination.href;
  $('lane-back-label').textContent = destination.label;
  let data = { plans: [], profiles: [], parties: [], parks: [], parkDays: [], experiences: [] }, searches = [], editing = null, busy = false;
  const field = name => form.elements.namedItem(name);
  if (local) { $('demo-notice').hidden = false; $('demo-notice').textContent = 'Local synthetic demo · No real booking will change.'; }
  $('ai-launcher').onclick = () => feedback('AI Booking Assistant is coming soon. For now, use Create Search to set up a search.');
  async function api(path, method = 'GET', body) {
    const headers = { Accept: 'application/json' };
    if (!local) { const token = localStorage.getItem('disneyos-member-device-token'); if (!token) throw new Error('Sign in to DisneyOS to view Lightning Lanes.'); headers.Authorization = `Bearer ${token}`; }
    if (body != null) headers['Content-Type'] = 'application/json';
    const response = await fetch(apiBase + path, { method, cache: 'no-store', headers, ...(body != null ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(({ UNAUTHORIZED: 'Please sign in again.', FORBIDDEN: 'You no longer have access to this profile or party.', ADMIN_REQUIRED: 'Only a DisneyOS administrator can refresh planner data.', CONCURRENT_CHANGE: 'This search changed. Refresh and review the latest option.', WORKFLOW_NOT_ACTIVE: 'This proposal is no longer active.', SERVICE_UNAVAILABLE: 'Lightning Lanes is temporarily unavailable.', NOT_FOUND: 'Lightning Lanes is not enabled in this environment.' })[result.error?.code] || 'The request could not be completed. Refresh and try again.');
    return result.data;
  }
  function feedback(message, error = false) { $('feedback').textContent = message; $('feedback').className = error ? 'error' : ''; }
  async function refreshWorkflowReview() {
    if (!workflowId) return;
    let content;
    if (!/^workflow_[A-Za-z0-9-]{8,160}$/.test(workflowId)) content = '<p class="muted">This Lightning Lane option is unavailable and cannot be confirmed.</p>';
    else try { content = candidateCard(await api(`/lightning-lane/workflows/${encodeURIComponent(workflowId)}`)); }
    catch { content = '<p class="muted">This Lightning Lane option is unavailable and cannot be confirmed.</p>'; }
    $('workflow-review-content').innerHTML = content;
    $('workflow-review').hidden = false;
    $('workflow-review').scrollIntoView({ block: 'start' });
  }
  function render() {
    $('plans').innerHTML = data.plans.length ? uniquePlans(data.plans).map(b => `<article class="card"><div class="card-top"><h3>${esc(b.experienceName)}</h3><span class="badge ${freshness(b).startsWith('Last') ? 'warning' : 'good'}">${freshness(b)}</span></div><p class="plan-time">${windowText(b)}</p><p class="muted">${esc(b.partySummary)} · ${b.productType === 'MULTI_PASS' ? 'Multi Pass' : 'Single Pass'} · ${esc(b.serviceDate)}</p>${b.displayOnly ? '<p class="form-note muted">Booked plan from your planner. Search setup for this experience is not available yet.</p>' : `<div class="actions"><button class="primary" data-improve="${esc(b.id)}" ${freshness(b).startsWith('Last') ? 'disabled' : ''}>Improve Time</button><button data-change="${esc(b.id)}" ${freshness(b).startsWith('Last') ? 'disabled' : ''}>Change Experience</button></div>`}</article>`).join('') : '<div class="empty">No current plans to show.<br>Your Lightning Lane plans will appear here when available.</div>';
    const activeSearches = visibleSearches(searches);
    const renderSearch = s => {
      const latest = s.workflows.at(-1), party = data.parties.find(p => p.id === s.partyContextId)?.name || 'Your party';
      const current = data.plans.find(b => b.id === s.currentBookingId);
      const terminal = ['CANCELLED', 'SUCCESS', 'CONFIRMED_AWAITING_EXECUTION'].includes(s.status);
      const waiting = ['AVAILABILITY_REFRESH_REQUIRED', 'WAITING_FOR_AVAILABILITY', 'NO_QUALIFYING_BROAD_OPTION'].includes(s.reason);
      return `<article class="card"><div class="card-top"><h3>${esc(s.experienceName)}</h3><span class="badge">${esc(statuses[s.status])}</span></div><p class="muted">${esc(searchTypeLabel(s, current))} · ${esc(party)}</p><p>Goal: ${esc(criterionText(s.criterion))}</p>${current ? `<p class="muted">Current: ${windowText(current)}</p>` : ''}${waiting ? '<p class="muted">Searching — waiting for availability.</p>' : ''}${s.reason === 'TARGETED_DETAIL_REQUIRED' ? '<p class="muted">A possible match was observed. Detailed availability is required before any candidate can be offered.</p>' : ''}${s.reason === 'INCONCLUSIVE' ? '<p class="muted">No matching option observed yet. Availability coverage is incomplete.</p>' : ''}${latest ? candidateCard(latest) : ''}${!terminal ? `<div class="actions"><button data-pause="${esc(s.id)}">${s.status === 'PAUSED' ? 'Resume' : 'Pause'}</button><button data-edit="${esc(s.id)}">Edit</button><button data-evaluate="${esc(s.id)}" ${s.status === 'PAUSED' ? 'disabled' : ''}>Search again</button><button class="danger" data-cancel="${esc(s.id)}">Cancel</button></div>` : ''}</article>`;
    };
    $('searches').innerHTML = activeSearches.length ? activeSearches.map(renderSearch).join('') : '<div class="empty">No active searches.<br>Improve a current plan or create a search.</div>';
    const completed = searches.filter(s => s.status === 'SUCCESS');
    $('search-history').hidden = !completed.length;
    $('history-items').innerHTML = completed.map(renderSearch).join('');
  }
  async function load(evaluate = false) {
    try {
    [data, searches] = await Promise.all([api('/lightning-lane/current-plans'), api('/lightning-lane/searches')]);
    if (evaluate) { for (const s of searches.filter(s => !['PAUSED', 'CANCELLED', 'SUCCESS', 'CONFIRMED_AWAITING_EXECUTION'].includes(s.status))) await api(`/lightning-lane/searches/${encodeURIComponent(s.id)}/evaluate`, 'POST', {}); searches = await api('/lightning-lane/searches'); }
    render(); $('create').disabled = false;
    } catch (e) {
      data.plans = data.plans.map(b => ({ ...b, refreshRequired: true })); render();
      document.querySelectorAll('[data-confirm]').forEach(b => { b.disabled = true; }); $('create').disabled = true;
      throw e;
    }
  }
  const options = rows => rows.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  function syncExperienceOptions(preferred) {
    const rows = eligibleExperiences(data.experiences, field('parkId').value, field('productType').value);
    const selected = preferred || field('experienceId').value;
    field('experienceId').innerHTML = options(rows);
    if (rows.some(x => x.id === selected)) field('experienceId').value = selected;
    return rows;
  }
  function syncForm() {
    const type = field('criterionType').value;
    $('start-field').hidden = !['AFTER_TIME', 'BETWEEN_TIMES'].includes(type); $('end-field').hidden = !['BEFORE_TIME', 'BETWEEN_TIMES'].includes(type);
    field('startTime').required = !$('start-field').hidden; field('endTime').required = !$('end-field').hidden;
    const isNew = field('searchType').value === 'NEW_BOOKING'; field('currentBookingId').disabled = isNew;
    const swap = field('searchType').value === 'SWAP_BOOKING';
    $('search-note').textContent = isNew ? 'This Watch remains active even when no time is currently available. It does not book or purchase anything.' : swap ? 'Choose another experience to replace this held booking. Booking changes are not enabled; each option needs your review.' : 'Look for a better time for this experience. Booking changes are not enabled; each option needs your review.';
    const held = data.plans.find(x => x.id === field('currentBookingId').value);
    field('experienceId').disabled = !editing && !swap && !isNew;
    if (held && !editing && !isNew) {
      const heldExperience = data.experiences.find(x => x.id === held.experienceId);
      if (heldExperience && !swap) field('parkId').value = heldExperience.parkId;
      field('productType').value = held.productType; field('serviceDate').value = held.serviceDate;
    }
    const catalogRows = syncExperienceOptions(held && !swap && !isNew ? held.experienceId : editing?.experienceId);
    if (editing && !isNew) $('search-note').textContent = 'Update the time preference or choose another experience for this held booking. Booking changes remain disabled.';
    if (!editing && !isNew) {
      const b = data.plans.find(x => x.id === field('currentBookingId').value);
      if (b) for (const k of ['profileId', 'partyContextId', 'serviceDate', 'productType']) field(k).value = b[k];
    }
    for (const k of ['profileId', 'partyContextId', 'serviceDate', 'productType']) field(k).disabled = !isNew;
    field('parkId').disabled = !isNew && !swap;
    $('save-search').disabled = !editing && (!catalogRows.length || !data.parties.length || isNew && !data.parkDays.length || !isNew && !searchablePlans(data.plans).some(b => b.id === field('currentBookingId').value && !freshness(b).startsWith('Last')));
  }
  function openForm(bookingId = null, edit = null, change = false) {
    editing = edit; form.reset(); $('form-error').textContent = '';
    field('currentBookingId').innerHTML = options(uniquePlans(searchablePlans(data.plans)).map(b => ({ id: b.id, name: `${b.experienceName} · ${time(b.startMinute)}` })));
    field('profileId').innerHTML = options(data.profiles); field('partyContextId').innerHTML = options(data.parties);
    field('serviceDate').innerHTML = options(data.parkDays.map(x => ({ id: x.date, name: new Date(`${x.date}T12:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) })));
    field('parkId').innerHTML = options(data.parks);
    $('identity-fields').hidden = Boolean(edit); $('form-title').textContent = edit ? 'Edit Search' : 'Create Search'; $('save-search').textContent = edit ? 'Save Search' : 'Start Search';
    if (bookingId || edit?.currentBookingId) field('currentBookingId').value = bookingId || edit.currentBookingId;
    const b = data.plans.find(x => x.id === field('currentBookingId').value);
    if (b) { const exp = data.experiences.find(x => x.id === b.experienceId); if (exp) field('parkId').value = exp.parkId; field('productType').value = b.productType; field('serviceDate').value = b.serviceDate; }
    field('searchType').value = change ? 'SWAP_BOOKING' : edit?.searchType || 'MODIFY_BOOKING';
    if (edit && edit.searchType === 'MODIFY_BOOKING' && b && edit.experienceId !== b.experienceId) field('searchType').value = 'SWAP_BOOKING';
    if (edit) {
      const exp = data.experiences.find(x => x.id === edit.experienceId);
      if (exp) field('parkId').value = exp.parkId;
      field('productType').value = edit.productType; field('serviceDate').value = edit.serviceDate;
      field('criterionType').value = edit.criterion.type;
      for (const [key, f] of [['startMinute', 'startTime'], ['endMinute', 'endTime']]) if (edit.criterion[key] != null) field(f).value = `${String(Math.floor(edit.criterion[key] / 60)).padStart(2, '0')}:${String(edit.criterion[key] % 60).padStart(2, '0')}`;
    }
    syncForm(); $('search-dialog').showModal(); if (change) field('experienceId').focus();
  }
  form.addEventListener('change', syncForm); $('close-form').onclick = () => $('search-dialog').close(); $('create').onclick = () => openForm();
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; busy = true; $('save-search').disabled = true;
    try {
      const criterion = { type: field('criterionType').value }, minute = v => Number(v.split(':')[0]) * 60 + Number(v.split(':')[1]);
      if (!$('start-field').hidden) criterion.startMinute = minute(field('startTime').value);
      if (!$('end-field').hidden) criterion.endMinute = minute(field('endTime').value);
      if (criterion.startMinute > criterion.endMinute) throw new Error('The end time must be at or after the start time.');
      if (field('searchType').value.startsWith('PURCHASE_')) throw new Error('This search goal is coming soon.');
      if (!editing && field('searchType').value === 'SWAP_BOOKING' && field('experienceId').value === data.plans.find(b => b.id === field('currentBookingId').value)?.experienceId) throw new Error('Choose a different experience, or select Improve a held booking.');
      if (editing) await api(`/lightning-lane/searches/${editing.id}`, 'PATCH', { action: 'EDIT', criterion, experienceId: field('experienceId').value });
      else { const input = Object.fromEntries(['searchType', 'currentBookingId', 'profileId', 'partyContextId', 'serviceDate', 'productType', 'experienceId', 'actionMode'].map(k => [k, field(k).value])); input.criterion = criterion; if (input.searchType === 'SWAP_BOOKING') input.searchType = 'MODIFY_BOOKING'; await api('/lightning-lane/searches', 'POST', input); }
      $('search-dialog').close(); await load(); feedback('Search saved.');
    } catch (e) { $('form-error').textContent = e.message; } finally { busy = false; syncForm(); }
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || busy) return;
    const a = button.dataset;
    if (a.improve || a.change) { openForm(a.improve || a.change, null, Boolean(a.change)); return; }
    if (a.edit) { openForm(null, searches.find(s => s.id === a.edit)); return; }
    if (!Object.keys(a).length && button.id !== 'refresh') return;
    busy = true; button.disabled = true;
    const originalLabel = button.textContent;
    if (button.id === 'refresh') { button.textContent = 'Refreshing…'; button.setAttribute('aria-busy', 'true'); feedback('Refreshing your planner…'); }
    try {
      if (a.confirm || a.ignore) { const id = a.confirm || a.ignore; const result = await api(`/lightning-lane/workflows/${id}/${a.confirm ? 'confirm' : 'cancel'}`, 'POST', { action: a.confirm ? 'CONFIRM' : 'CANCEL' }); feedback(a.ignore ? 'Proposal ignored. Search continues.' : result.result?.message || statuses[result.status]); }
      if (a.pause) await api(`/lightning-lane/searches/${a.pause}`, 'PATCH', { action: searches.find(s => s.id === a.pause).status === 'PAUSED' ? 'RESUME' : 'PAUSE' });
      if (a.cancel) await api(`/lightning-lane/searches/${a.cancel}`, 'DELETE');
      if (a.evaluate) await api(`/lightning-lane/searches/${a.evaluate}/evaluate`, 'POST', {});
      if (button.id === 'refresh') {
        await refreshPlannerState({ local, request: api, reload: () => load(false) });
        feedback('Planner refreshed.');
      } else await load(false);
      await refreshWorkflowReview();
    } catch (e) { feedback(e.message, true); } finally {
      if (button.id === 'refresh') { button.textContent = originalLabel; button.removeAttribute('aria-busy'); }
      busy = false; button.disabled = false;
    }
  });
  load(true).then(refreshWorkflowReview).catch(e => { feedback(e.message, true); $('plans').innerHTML = '<div class="empty">Plans unavailable — refresh required.</div>'; $('create').disabled = true; });
  setInterval(() => { if (!busy && !$('search-dialog').open && !document.hidden) load(true).then(refreshWorkflowReview).catch(e => { feedback(e.message, true); document.querySelectorAll('[data-confirm]').forEach(b => { b.disabled = true; }); }); }, 15000);
}
