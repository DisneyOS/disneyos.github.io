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
const validServiceDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const inactiveSearchStatuses = new Set(['CANCELLED', 'SUCCESS', 'EXPIRED', 'PAUSED', 'STALE', 'FAILED']);
export const parkToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export const serviceDateLabel = date => validServiceDate(date)
  ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
export function groupLaneDates(plans, searches, today = parkToday()) {
  const groups = new Map();
  const group = date => { const key = validServiceDate(date) ? date : ''; if (!groups.has(key)) groups.set(key, { date: key, plans: [], watches: [], history: [], historical: !key || key < today }); return groups.get(key); };
  // Booking identity is scoped to its service date, even when a source reuses IDs.
  for (const b of [...new Map(plans.map(b => [JSON.stringify([b.serviceDate,b.id]),b])).values()]) group(b.serviceDate).plans.push(b);
  for (const s of searches) {
    const g = group(s.serviceDate);
    (g.historical || inactiveSearchStatuses.has(s.status) || s.workflows?.some(w => w.result?.dryRun === true) ? g.history : g.watches).push(s);
  }
  const ordered = [...groups.values()].sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999'));
  for (const g of ordered) g.plans.sort((a,b) => (a.startMinute ?? 1440) - (b.startMinute ?? 1440));
  const expanded = ordered.find(g => !g.historical && (g.plans.length || g.watches.length));
  return ordered.map(g => ({ ...g, defaultOpen: g === expanded }));
}
export const broadAvailabilityText = 'Earliest known availability — other times may exist. This time is not reserved.';
export const searchablePlans = rows => rows.filter(b => !b.displayOnly);
export const eligibleExperiences = (rows, parkId, productType) => rows.filter(x => x.parkId === parkId && x.productTypes?.includes(productType));
export function watchPartyInput({ isNew, partyId, profileIds, booking }) {
  if (!isNew) return { currentBookingId: booking?.id ?? '' };
  if (!Array.isArray(profileIds) || !profileIds.length || new Set(profileIds).size !== profileIds.length) throw new Error('Select the people for this Watch.');
  return { ...(partyId ? { partyId } : {}), profileIds: [...profileIds] };
}
export function partyEligibilityText(evidence) {
  return ({ WAITING_FOR_PARTY_ELIGIBILITY: 'Your Watch is waiting until the full selected party is eligible. Everyone remains in the party.',
    PARTICIPANT_AUTHORIZATION_LOST: 'Access to someone in your selected party has changed. Restore access or update your Watch before it can act.',
    PARTICIPANT_IDENTITY_UNRESOLVED: 'Someone in your selected party could not be matched to Disney’s current guest records. Your party has not changed.',
    PARTICIPANT_IDENTITY_AMBIGUOUS: 'Disney’s current guest records do not uniquely identify everyone in your selected party. Your Watch cannot act yet.',
    ELIGIBILITY_INCONCLUSIVE: 'Eligibility for the full selected party has not been confirmed yet.',
    EXACT_PARTY_ELIGIBLE: 'The full selected party was eligible at the last check. Availability is not reserved.',
    WATCH_CONTEXT_CHANGED: 'Your Watch or current booking has changed. Review the full party before continuing.' })[evidence?.reason] || '';
}
export async function refreshPlannerState({ local, request, reload }) {
  await request(local ? '/demo/refresh' : '/planner/refresh', 'POST', {});
  await reload();
}
export const fetchCurrentState = request => Promise.all([request('/lightning-lane/current-plans'), request('/lightning-lane/searches')]);
export const evaluateSelectedSearch = (request, id) => request(`/lightning-lane/searches/${id}/evaluate`, 'POST', {});
export function confirmCriterionBoundAttempt(dialog, workflow) {
  const source = workflow?.current?.experienceName, target = workflow?.proposed?.experienceName;
  if (!dialog?.showModal || !source || !target) return Promise.resolve(false);
  const description = dialog.querySelector('#execution-consent-description');
  const accept = dialog.querySelector('#accept-execution-consent');
  const cancel = dialog.querySelector('#cancel-execution-consent');
  if (!description || !accept || !cancel) return Promise.resolve(false);
  description.textContent = `Authorize one attempt to change ${source} to ${target}? Disney may stage a different time. DisneyOS will submit at most once, and only if the actual staged offer meets your Watch criterion.`;
  return new Promise(resolve => {
    let settled = false;
    const finish = approved => {
      if (settled) return;
      settled = true;
      accept.onclick = cancel.onclick = dialog.oncancel = dialog.onclose = null;
      if (dialog.open) dialog.close();
      resolve(approved);
    };
    accept.onclick = () => finish(true);
    cancel.onclick = () => finish(false);
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
    dialog.onclose = () => finish(false);
    dialog.showModal();
  });
}
export function installResumeRefresh(doc, win, refresh) {
  let pending = false;
  const onResume = () => {
    if (doc.hidden || pending) return;
    pending = true;
    Promise.resolve().then(refresh).finally(() => { pending = false; });
  };
  doc.addEventListener('visibilitychange', onResume);
  win.addEventListener('focus', onResume);
}
export function searchTypeLabel(s, current) {
  if (s.searchType === 'NEW_BOOKING') return 'Watch for a new selection';
  if (s.searchType === 'MODIFY_UNTIL_STOPPED') return 'Keep looking for a better time';
  return current && s.experienceId !== current.experienceId ? 'Change to another experience' : 'Improve a held booking';
}
const statuses = { CONFIRMED_AWAITING_EXECUTION: 'Confirmed — awaiting execution', ACTIVE: 'Searching', PAUSED: 'Paused', READY_FOR_CONFIRMATION: 'Confirmation required', ELIGIBILITY_BLOCKED: 'Guest/day eligibility blocks this option', AUTO_READY_BUT_DISABLED: 'Automatic change unavailable', AUTO_AUTHORIZATION_REQUIRED: 'Automatic authorization required', CANDIDATE_FOUND: 'Candidate found', EXECUTING: 'Preparing change', VERIFYING: 'Verifying booking', SUCCESS: 'Change verified', STALE: 'Refresh required', EXPIRED: 'Expired', FAILED: 'Change not completed', AMBIGUOUS_OUTCOME: 'Outcome needs review', NO_LONGER_AVAILABLE: 'No longer available', REPLAN_REQUIRED: 'Plan changed — search again', CANCELLED: 'Cancelled', NO_MATCH: 'No matching option observed' };
export function executionResultPresentation(w) {
  const status = w.result?.status || w.status;
  const known = {
    CONFIRMED_AWAITING_EXECUTION: ['Confirmed — awaiting execution', 'DisneyOS is preparing the approved change. Your booking has not changed yet.'],
    EXECUTING: ['Change in progress', 'DisneyOS is checking the exact approved option. Do not submit the change again.'],
    NO_LONGER_AVAILABLE: ['No longer available', 'That Lightning Lane was no longer available when DisneyOS attempted the change. Your booking was not changed and your Watch is still searching.'],
    TARGET_NO_LONGER_AVAILABLE: ['No longer available', 'That Lightning Lane was no longer available when DisneyOS attempted the change. Your booking was not changed and your Watch is still searching.'],
    REVIEW_MISMATCH: ['Change not submitted', 'The Disney review screen did not match the exact approved change. Your booking was not changed and your Watch is still searching.'],
    NO_IMPROVEMENT: ['Change not submitted', 'Disney staged a time that did not improve your current booking. Your booking was not changed and your Watch is still searching.'],
    STAGED_CRITERION_NOT_MET: ['Change not submitted', 'Disney staged a time outside your Watch criterion. Your booking was not changed and your Watch is still searching.'],
    STAGED_OFFER_UNVERIFIED: ['Change not submitted', 'DisneyOS could not safely verify the staged Lightning Lane offer. Your booking was not changed.'],
    EXECUTION_FAILED: ['Change not completed', 'DisneyOS could not complete the approved change. Your booking was not changed and your Watch is still searching.'],
    VERIFIED_SUCCESS: ['Change verified', 'DisneyOS independently verified the updated Lightning Lane booking.'],
    VERIFIED_NOT_CHANGED: ['Booking unchanged', 'DisneyOS independently verified that the original booking remains in place.'],
    AMBIGUOUS_OUTCOME: ['Outcome needs review', 'DisneyOS could not safely verify the final booking state. Review your current plans before taking another action.'],
    SUCCESS: ['Dry run successful', 'The dry run completed without changing your booking.']
  };
  const [title, fallback] = known[status] || ['Execution update', 'Review the current booking and workflow status before taking another action.'];
  return { title, message: w.result?.message || fallback };
}
export function candidateCard(w, now = Date.now()) {
  if (w.result) { const result = executionResultPresentation(w); return `<div class="result"><strong>${esc(result.title)}</strong><p>${esc(result.message)}</p></div>`; }
  if (w.status === 'AUTO_READY_BUT_DISABLED') return '<p class="muted">A matching option was observed, but automatic modification is not currently enabled. No booking change was attempted.</p>';
  if (w.status === 'EXPIRED') return `<section class="candidate"><p class="eyebrow">LIGHTNING LANE UPDATE</p><h3>${esc(w.proposed?.experienceName || 'Previous candidate')}</h3><p class="muted">This option expired and needs refreshing. It cannot be confirmed.</p></section>`;
  if (w.status !== 'READY_FOR_CONFIRMATION') return `<p class="muted">${esc(w.status === 'CANCELLED' ? 'Previous proposal closed.' : statuses[w.status] || 'Status unavailable')}</p>`;
  const expired = Date.parse(w.expiresAt) <= now;
  const delta = w.current.startMinute - w.proposed.startMinute;
  const consentReady = w.consent?.version === 2 && /^sha256:[a-f0-9]{64}$/.test(w.consent.intentFingerprint ?? '');
  return `<section class="candidate"><p class="eyebrow">BETTER LIGHTNING LANE FOUND</p><h3>${esc(w.proposed.experienceName)}</h3><div class="comparison"><div><span>Booked · ${esc(w.current.experienceName)}</span><strong>${esc(windowText(w.current))}</strong></div><div><span>Earliest known availability</span><strong>${esc(windowText(w.proposed))}</strong></div></div>${delta > 0 ? `<p class="earlier">${delta} minutes earlier</p>` : ''}<p class="muted">${broadAvailabilityText}</p><p class="muted">${esc(w.evidenceLabel)} Disney may stage a different time; it must still satisfy your Watch before any change is submitted.</p><p class="muted">${expired ? 'Expired — search again' : 'Confirmation expires at ' + esc(new Date(w.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }))}</p><div class="actions"><button class="primary" data-confirm="${esc(w.id)}" ${expired || !consentReady ? 'disabled' : ''}>Authorize change if it meets my Watch</button><button data-ignore="${esc(w.id)}">Ignore</button></div></section>`;
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
    if (!response.ok || !result.success) throw new Error(({ UNAUTHORIZED: 'Please sign in again.', FORBIDDEN: 'You no longer have access to this profile or party.', PARTY_UNAUTHORIZED: 'Everyone selected for this Watch must have current DisneyOS access.', BOOKING_PARTICIPANT_UNAUTHORIZED: 'The full booking party is not currently authorized in DisneyOS. No one was removed. Restore access before creating this Watch.', BOOKING_UNAVAILABLE: 'The full current booking party could not be resolved. Review your current plans before continuing.', CURRENT_BOOKING_STALE_OR_INCONSISTENT: 'Refresh your current planner before creating a Watch for this booking.', DUPLICATE_PARTICIPANT: 'Select each person only once.', ADMIN_REQUIRED: 'Only a DisneyOS administrator can refresh planner data.', CONCURRENT_CHANGE: 'This search changed. Refresh and review the latest option.', WORKFLOW_NOT_ACTIVE: 'This proposal is no longer active.', SERVICE_UNAVAILABLE: 'Lightning Lanes is temporarily unavailable.', NOT_FOUND: 'Lightning Lanes is not enabled in this environment.' })[result.error?.code] || 'The request could not be completed. Refresh and try again.');
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
  const disclosureState = new Map();
  $('lane-dates').addEventListener('toggle', event => { const key = event.target.dataset?.disclosure; if (key) disclosureState.set(key,event.target.open); },true);
  function render() {
    const renderBooking = b => `<article class="card booked-plan"><div class="card-top"><h4>${esc(b.experienceName)}</h4><span class="badge ${freshness(b).startsWith('Last') ? 'warning' : 'good'}">${freshness(b)}</span></div><p class="plan-time"><span class="time-label">Booked return window</span>${windowText(b)}</p><p class="muted">${esc(b.partySummary)} · ${b.productType === 'MULTI_PASS' ? 'Multi Pass' : 'Single Pass'}</p>${b.displayOnly ? '<p class="form-note muted">Booked plan from your planner. Search setup for this experience is not available yet.</p>' : `<div class="actions"><button class="primary" data-improve="${esc(b.id)}" ${freshness(b).startsWith('Last') ? 'disabled' : ''}>Improve Time</button><button data-change="${esc(b.id)}" ${freshness(b).startsWith('Last') ? 'disabled' : ''}>Change Experience</button></div>`}</article>`;
    const renderSearch = (s, historical = false) => {
      const latest = s.workflows.at(-1), context = data.parties.find(p => p.id === s.partyContextId);
      const party = context?.profileIds?.map(id => data.profiles.find(p => p.id === id)?.name).filter(Boolean).join(', ') || 'Your selected party';
      const current = data.plans.find(b => b.id === s.currentBookingId);
      const terminal = historical && (s.serviceDate < parkToday() || s.status !== 'PAUSED') || ['CANCELLED', 'SUCCESS', 'CONFIRMED_AWAITING_EXECUTION'].includes(s.status);
      const waiting = !historical && ['AVAILABILITY_REFRESH_REQUIRED', 'WAITING_FOR_AVAILABILITY', 'NO_QUALIFYING_BROAD_OPTION'].includes(s.reason);
      return `<article class="card"><div class="card-top"><h3>${esc(s.experienceName)}</h3><span class="badge">${esc(statuses[s.status] || s.status)}</span></div><p class="muted">${esc(searchTypeLabel(s, current))} · ${esc(party)} · ${s.actionMode === 'AUTO_MODIFY' ? 'Automatically modify' : 'Ask before changing'}</p><p>Goal: ${esc(criterionText(s.criterion))}</p>${current ? `<p class="muted">Current: ${windowText(current)}</p>` : ''}${waiting ? '<p class="muted">Searching — waiting for availability.</p>' : ''}${partyEligibilityText(s.partyEligibility) ? `<p class="muted">${esc(partyEligibilityText(s.partyEligibility))}</p>` : ''}${s.reason === 'GUEST_DAY_INELIGIBLE' && !partyEligibilityText(s.partyEligibility) ? '<p class="muted">Broad availability exists, but current guest/day eligibility blocks this option. Your Watch remains active.</p>' : ''}${s.reason === 'TARGETED_DETAIL_REQUIRED' ? '<p class="muted">A possible match was observed. Detailed availability is required before any candidate can be offered.</p>' : ''}${s.reason === 'INCONCLUSIVE' ? '<p class="muted">No matching option observed yet. Availability coverage is incomplete.</p>' : ''}${historical ? '<p class="muted">Inactive or historical Watch. Booked Lightning Lanes are shown separately.</p>' : latest ? candidateCard(latest) : ''}${!terminal ? `<div class="actions"><button data-pause="${esc(s.id)}">${s.status === 'PAUSED' ? 'Resume' : 'Pause'}</button><button data-edit="${esc(s.id)}">Edit</button><button data-evaluate="${esc(s.id)}" ${s.status === 'PAUSED' ? 'disabled' : ''}>Search again</button><button class="danger" data-cancel="${esc(s.id)}">Cancel</button></div>` : ''}</article>`;
    };
    const disclosure = (key, title, content, defaultOpen = false) => `<details class="date-group" data-disclosure="${esc(key)}" ${disclosureState.get(key) ?? defaultOpen ? 'open' : ''}><summary>${title}</summary><div class="date-content">${content}</div></details>`;
    const renderDate = g => disclosure(`date:${g.date}`, esc(serviceDateLabel(g.date)),
      `<section class="booked-section"><h3>Booked Lightning Lanes</h3>${g.plans.length ? g.plans.map(renderBooking).join('') : '<p class="muted">No booked Lightning Lanes for this date.</p>'}</section>`
      + `<section class="watch-section"><h3>Active Watches</h3>${g.watches.length ? g.watches.map(s => renderSearch(s)).join('') : '<p class="muted">No active Watches for this date.</p>'}</section>`
      + (g.history.length ? disclosure(`history:${g.date}`, `Search History (${g.history.length})`, g.history.map(s => renderSearch(s,true)).join('')) : ''),g.defaultOpen);
    const groups = groupLaneDates(data.plans,searches), upcoming = groups.filter(g => !g.historical), historical = groups.filter(g => g.historical);
    $('lane-dates').innerHTML = upcoming.map(renderDate).join('') + (historical.length ? disclosure('past','Past / Historical',historical.map(renderDate).join('')) : '') || '<div class="empty">No Lightning Lane plans or Watches to show.</div>';
  }
  async function load() {
    try {
    [data, searches] = await fetchCurrentState(api);
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
  const partySources = () => data.savedParties
    ? [...data.savedParties, { id: '', name: 'All authorized people', profileIds: data.profiles.map(p => p.id) }]
    : data.parties;
  const selectedPeople = () => [...$('watch-party-people').querySelectorAll('input:checked')].map(x => x.value);
  function showPartyPeople() {
    const party = partySources().find(p => p.id === field('partyId').value);
    $('watch-party-people').innerHTML = (party?.profileIds ?? []).map(id => {
      const person = data.profiles.find(p => p.id === id);
      return person ? `<label class="consent-field"><input type="checkbox" value="${esc(id)}" checked> ${esc(person.name)}</label>` : '';
    }).join('');
  }
  function syncForm() {
    const type = field('criterionType').value;
    $('start-field').hidden = !['AFTER_TIME', 'BETWEEN_TIMES'].includes(type); $('end-field').hidden = !['BEFORE_TIME', 'BETWEEN_TIMES'].includes(type);
    field('startTime').required = !$('start-field').hidden; field('endTime').required = !$('end-field').hidden;
    const isNew = field('searchType').value === 'NEW_BOOKING'; field('currentBookingId').disabled = isNew;
    $('party-source-field').hidden = !isNew; $('watch-party-field').hidden = !isNew;
    $('booking-party').hidden = isNew;
    $('booking-party').textContent = `Party: ${data.plans.find(x => x.id === field('currentBookingId').value)?.partySummary || 'Current booking participants'} (from current booking)`;
    const autoSupported = ['MODIFY_BOOKING', 'SWAP_BOOKING'].includes(field('searchType').value) && field('productType').value === 'MULTI_PASS';
    field('actionMode').querySelector('[value="AUTO_MODIFY"]').disabled = !autoSupported;
    if (!autoSupported) field('actionMode').value = 'ASK_BEFORE_CHANGING';
    $('auto-consent-field').hidden = field('actionMode').value !== 'AUTO_MODIFY';
    $('auto-mode-note').hidden = $('auto-consent-field').hidden;
    const swap = field('searchType').value === 'SWAP_BOOKING';
    $('search-note').textContent = isNew ? 'This Watch remains active even when no time is currently available. It does not book or purchase anything.'
      : field('actionMode').value === 'AUTO_MODIFY' ? 'This Watch can be authorized for automatic changes, but automatic execution is currently disabled.'
      : swap ? 'Choose another experience to replace this held booking. Each option needs your review.'
      : 'Look for a better time for this experience. Each option needs your review.';
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
    $('save-search').disabled = !editing && (!catalogRows.length || isNew && (!selectedPeople().length || !data.parkDays.length) || !isNew && !searchablePlans(data.plans).some(b => b.id === field('currentBookingId').value && !freshness(b).startsWith('Last')));
  }
  function openForm(bookingId = null, edit = null, change = false) {
    editing = edit; form.reset(); $('form-error').textContent = '';
    field('currentBookingId').innerHTML = options(uniquePlans(searchablePlans(data.plans)).map(b => ({ id: b.id, name: `${b.experienceName} · ${time(b.startMinute)}` })));
    field('partyId').innerHTML = options(partySources()); showPartyPeople();
    field('serviceDate').innerHTML = options(data.parkDays.map(x => ({ id: x.date, name: new Date(`${x.date}T12:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) })));
    field('parkId').innerHTML = options(data.parks);
    $('identity-fields').hidden = Boolean(edit); $('form-title').textContent = edit ? 'Edit Search' : 'Create Search'; $('save-search').textContent = edit ? 'Save Search' : 'Start Search';
    if (bookingId || edit?.currentBookingId) field('currentBookingId').value = bookingId || edit.currentBookingId;
    const b = data.plans.find(x => x.id === field('currentBookingId').value);
    if (b) { const exp = data.experiences.find(x => x.id === b.experienceId); if (exp) field('parkId').value = exp.parkId; field('productType').value = b.productType; field('serviceDate').value = b.serviceDate; }
    field('searchType').value = change ? 'SWAP_BOOKING' : edit?.searchType || 'MODIFY_BOOKING';
    field('actionMode').value = edit?.actionMode || 'ASK_BEFORE_CHANGING';
    field('autoModifyConsent').checked = false;
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
  form.addEventListener('change', event => { if (event.target === field('partyId')) showPartyPeople(); syncForm(); }); $('close-form').onclick = () => $('search-dialog').close(); $('create').onclick = () => openForm();
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; busy = true; $('save-search').disabled = true;
    try {
      const criterion = { type: field('criterionType').value }, minute = v => Number(v.split(':')[0]) * 60 + Number(v.split(':')[1]);
      if (!$('start-field').hidden) criterion.startMinute = minute(field('startTime').value);
      if (!$('end-field').hidden) criterion.endMinute = minute(field('endTime').value);
      if (criterion.startMinute > criterion.endMinute) throw new Error('The end time must be at or after the start time.');
      if (field('searchType').value.startsWith('PURCHASE_')) throw new Error('This search goal is coming soon.');
      if (!editing && field('searchType').value === 'SWAP_BOOKING' && field('experienceId').value === data.plans.find(b => b.id === field('currentBookingId').value)?.experienceId) throw new Error('Choose a different experience, or select Improve a held booking.');
      if (field('actionMode').value === 'AUTO_MODIFY' && !field('autoModifyConsent').checked) throw new Error('Confirm automatic modification authorization for this Watch.');
      if (editing) await api(`/lightning-lane/searches/${editing.id}`, 'PATCH', { action: 'EDIT', criterion, experienceId: field('experienceId').value, actionMode: field('actionMode').value, ...(field('actionMode').value === 'AUTO_MODIFY' ? { autoModifyConsent: true } : {}) });
      else {
        const input = Object.fromEntries(['searchType', 'serviceDate', 'productType', 'experienceId', 'actionMode'].map(k => [k, field(k).value]));
        const isNew = input.searchType === 'NEW_BOOKING';
        Object.assign(input, watchPartyInput({ isNew, partyId: field('partyId').value, profileIds: selectedPeople(), booking: data.plans.find(b => b.id === field('currentBookingId').value) }));
        // The synthetic demo still uses its existing prebuilt context contract.
        if (local && !data.savedParties) {
          const context = data.parties[0];
          if (isNew && JSON.stringify([...selectedPeople()].sort()) !== JSON.stringify([...(context?.profileIds ?? [])].sort())) throw new Error('This demo cannot change the selected party.');
          delete input.partyId; delete input.profileIds; input.profileId = data.profiles[0]?.id; input.partyContextId = context?.id;
        }
        input.criterion = criterion; if (input.actionMode === 'AUTO_MODIFY') input.autoModifyConsent = true;
        if (input.searchType === 'SWAP_BOOKING') input.searchType = 'MODIFY_BOOKING';
        await api('/lightning-lane/searches', 'POST', input);
      }
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
      if (a.confirm || a.ignore) {
        const id = a.confirm || a.ignore;
        const current = a.confirm ? await api(`/lightning-lane/workflows/${id}`) : null;
        if (a.confirm && (current.status !== 'READY_FOR_CONFIRMATION' || current.consent?.version !== 2)) throw new Error('This option needs a fresh authorization. Refresh and review it again.');
        if (a.confirm && !await confirmCriterionBoundAttempt($('execution-consent-dialog'), current)) return;
        const result = await api(`/lightning-lane/workflows/${id}/${a.confirm ? 'confirm' : 'cancel'}`, 'POST',
          a.confirm ? { action: 'CONFIRM', authorizationVersion: 2, intentFingerprint: current.consent.intentFingerprint } : { action: 'CANCEL' });
        feedback(a.ignore ? 'Proposal ignored. Search continues.' : result.result?.message || statuses[result.status]);
      }
      if (a.pause) await api(`/lightning-lane/searches/${a.pause}`, 'PATCH', { action: searches.find(s => s.id === a.pause).status === 'PAUSED' ? 'RESUME' : 'PAUSE' });
      if (a.cancel) await api(`/lightning-lane/searches/${a.cancel}`, 'DELETE');
      if (a.evaluate) await evaluateSelectedSearch(api, a.evaluate);
      if (button.id === 'refresh') {
        await refreshPlannerState({ local, request: api, reload: () => load() });
        feedback('Planner refreshed.');
      } else await load();
      await refreshWorkflowReview();
    } catch (e) { feedback(e.message, true); } finally {
      if (button.id === 'refresh') { button.textContent = originalLabel; button.removeAttribute('aria-busy'); }
      busy = false; button.disabled = false;
    }
  });
  load().then(refreshWorkflowReview).catch(e => { feedback(e.message, true); $('lane-dates').innerHTML = '<div class="empty">Plans unavailable — refresh required.</div>'; $('create').disabled = true; });
  installResumeRefresh(document, window, () => {
    if (!busy && !$('search-dialog').open) return load().then(refreshWorkflowReview).catch(e => { feedback(e.message, true); document.querySelectorAll('[data-confirm]').forEach(b => { b.disabled = true; }); });
  });
}


