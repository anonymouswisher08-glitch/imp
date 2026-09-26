const nameCloud = document.createElement('div');
nameCloud.className = 'name-cloud';
const names = ['Bhavs', 'Bhavs', 'Bhavs', 'Bhavs', '💗', 'Bhavs', 'Bhavs', '💗'];
for (let index = 0; index < 58; index++) {
  const name = document.createElement('span');
  name.textContent = names[index % names.length];
  name.style.left = `${(index * 37 + 7) % 96}%`;
  name.style.top = `${(index * 53 + 4) % 94}%`;
  name.style.setProperty('--size', `${18 + (index * 11) % 38}px`);
  name.style.setProperty('--duration', `${4.8 + (index % 6) * .8}s`);
  name.style.setProperty('--delay', `${-(index % 7) * .65}s`);
  name.style.setProperty('--tilt', `${-13 + (index * 9) % 26}deg`);
  if (name.textContent === '💗') name.classList.add('heart-name');
  nameCloud.append(name);
}
document.body.prepend(nameCloud);

const memoryModal = document.querySelector('#memoryModal');
const modalNumber = document.querySelector('#modalNumber');
const modalTitle = document.querySelector('#modalTitle');
const modalNote = document.querySelector('#modalNote');
const openNote = document.querySelector('#openNote');
const notePaper = document.querySelector('#notePaper');
const closeNote = document.querySelector('#closeNote');
const mediaStage = document.querySelector('#mediaStage');
const mediaLightbox = document.querySelector('#mediaLightbox');
const lightboxContent = document.querySelector('#lightboxContent');
const closeLightbox = document.querySelector('#closeLightbox');
const downloadMedia = document.querySelector('#downloadMedia');
const mediaByMemory = new Map();
mediaByMemory.set('01', { url: '1MEDIA.png', mimeType: 'image/png' });
mediaByMemory.set('02', { url: '2MEDIA.mp4', mimeType: 'video/mp4' });
mediaByMemory.set('03', { url: '3MEDIA.jpeg', mimeType: 'image/jpeg' });
mediaByMemory.set('04', [
  { url: '4.1media (2).jpeg', mimeType: 'image/jpeg' },
  { url: '4.2media (1).jpeg', mimeType: 'image/jpeg' }
]);
mediaByMemory.set('05', { url: '5media.jpg', mimeType: 'image/jpeg' });
mediaByMemory.set('06', [
  { url: '6.1MEDIA.png', mimeType: 'image/png' },
  { url: '6.2MEDIA.png', mimeType: 'image/png' }
]);
let activeMemory = null;
let memoryOpenedAt = 0;
function setDownloadMedia(url) {
  if (!downloadMedia) return;
  if (!url) { downloadMedia.hidden = true; downloadMedia.removeAttribute('href'); return; }
  downloadMedia.href = url;
  downloadMedia.download = url.split('/').pop() || 'memory';
  downloadMedia.hidden = false;
}
function renderMedia(file) {
  mediaStage.replaceChildren();
  if (!file) { setDownloadMedia(''); mediaStage.innerHTML = '<p>Your photo, video, or voice note will appear here.</p>'; return; }
  const files = Array.isArray(file) ? file : [file];
  let currentSlide = 0;
  const showSlide = () => {
    const selected = files[currentSlide];
    const type = selected.type || selected.mimeType || '';
    const media = document.createElement(type.startsWith('image/') ? 'img' : type.startsWith('video/') ? 'video' : 'audio');
    media.src = selected.url || URL.createObjectURL(selected); media.controls = !type.startsWith('image/');
    setDownloadMedia(selected.url || '');
    if (media.tagName === 'VIDEO') media.playsInline = true;
    media.memoryFiles = files; media.memorySlide = currentSlide;
    if (files.length === 1) { mediaStage.replaceChildren(media); return; }
    const controls = document.createElement('div'); controls.className = 'media-slider-controls';
    const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = '←'; previous.setAttribute('aria-label', 'Previous photo');
    const count = document.createElement('span'); count.textContent = `${currentSlide + 1} / ${files.length}`;
    const next = document.createElement('button'); next.type = 'button'; next.textContent = '→'; next.setAttribute('aria-label', 'Next photo');
    previous.addEventListener('click', (event) => { event.stopPropagation(); currentSlide = (currentSlide - 1 + files.length) % files.length; showSlide(); });
    next.addEventListener('click', (event) => { event.stopPropagation(); currentSlide = (currentSlide + 1) % files.length; showSlide(); });
    controls.append(previous, count, next); mediaStage.replaceChildren(media, controls);
  };
  showSlide();
}
function renderExpandedMedia(files, currentSlide) {
  lightboxContent.querySelector('video')?.pause();
  const selected = files[currentSlide];
  const type = selected.type || selected.mimeType || '';
  const expanded = document.createElement(type.startsWith('image/') ? 'img' : 'video');
  expanded.src = selected.url || URL.createObjectURL(selected);
  if (expanded.tagName === 'VIDEO') { expanded.controls = true; expanded.playsInline = true; }
  if (files.length === 1) { lightboxContent.replaceChildren(expanded); return; }
  const controls = document.createElement('div'); controls.className = 'media-slider-controls lightbox-slider-controls';
  const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = '←'; previous.setAttribute('aria-label', 'Previous media');
  const count = document.createElement('span'); count.textContent = `${currentSlide + 1} / ${files.length}`;
  const next = document.createElement('button'); next.type = 'button'; next.textContent = '→'; next.setAttribute('aria-label', 'Next media');
  previous.addEventListener('click', () => renderExpandedMedia(files, (currentSlide - 1 + files.length) % files.length));
  next.addEventListener('click', () => renderExpandedMedia(files, (currentSlide + 1) % files.length));
  controls.append(previous, count, next); lightboxContent.replaceChildren(expanded, controls);
}
function closeExpandedMedia() {
  lightboxContent.querySelector('video')?.pause();
  if (mediaLightbox.open) mediaLightbox.close();
  lightboxContent.replaceChildren();
}
mediaStage.addEventListener('click', (event) => {
  const media = mediaStage.querySelector('img, video');
  if (!media) return;
  event.preventDefault();
  recordAnalyticsEvent('media_opened', { memory: activeMemory, media: (media.currentSrc || media.src).split('/').pop() });
  media.pause?.();
  const files = media.memoryFiles || [{ url: media.currentSrc || media.src, mimeType: media.tagName === 'VIDEO' ? 'video/mp4' : 'image/*' }];
  renderExpandedMedia(files, media.memorySlide || 0);
  mediaLightbox.showModal();
});
closeLightbox.addEventListener('click', closeExpandedMedia);
mediaLightbox.addEventListener('click', (event) => { if (event.target === mediaLightbox) closeExpandedMedia(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && mediaLightbox.open) closeExpandedMedia(); });
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[download]');
  if (!link) return;
  recordAnalyticsEvent('download_started', {
    memory: link === downloadMedia ? activeMemory : '',
    media: link.getAttribute('download') || link.href.split('/').pop() || ''
  });
});
document.querySelectorAll('.memory').forEach((memory) => memory.addEventListener('click', () => {
  activeMemory = memory.dataset.memory;
  memoryOpenedAt = performance.now();
  recordAnalyticsEvent('memory_opened', { memory: activeMemory });
  modalNumber.textContent = `memory ${activeMemory}`;
  modalTitle.textContent = memory.dataset.title;
  modalNote.textContent = memory.dataset.note; notePaper.hidden = true;
  openNote.hidden = false;
  renderMedia(mediaByMemory.get(activeMemory));
  memoryModal.showModal();
  fetch(`/api/memories/${activeMemory}/media`).then((response) => response.ok ? response.json() : null).then((media) => {
    if (media && activeMemory === memory.dataset.memory) { mediaByMemory.set(activeMemory, media); renderMedia(media); }
  }).catch(() => {});
}));
document.querySelector('#closeMemory').addEventListener('click', () => memoryModal.close());
memoryModal.addEventListener('close', () => {
  if (activeMemory && memoryOpenedAt) recordAnalyticsEvent('memory_closed', { memory: activeMemory, durationMs: Math.round(performance.now() - memoryOpenedAt) });
  activeMemory = null;
  memoryOpenedAt = 0;
  setDownloadMedia('');
});
openNote.addEventListener('click', () => {
  notePaper.hidden = false; openNote.hidden = true;
  notePaper.classList.remove('paper-revealed'); void notePaper.offsetWidth; notePaper.classList.add('paper-revealed');
  for (let index = 0; index < 24; index++) {
    const ribbon = document.createElement('i'); ribbon.className = 'ribbon-drop';
    ribbon.style.left = `${38 + Math.random() * 24}%`; ribbon.style.top = `${10 + Math.random() * 12}%`;
    ribbon.style.setProperty('--ribbon-drift', `${-130 + Math.random() * 260}px`); ribbon.style.setProperty('--ribbon-rotate', `${-25 + Math.random() * 50}deg`);
    ribbon.style.animationDelay = `${Math.random() * .26}s`; memoryModal.append(ribbon);
    ribbon.addEventListener('animationend', () => ribbon.remove());
  }
});
closeNote.addEventListener('click', () => { notePaper.hidden = true; openNote.hidden = false; });
memoryModal.addEventListener('click', (event) => { if (event.target === memoryModal) memoryModal.close(); });

const moodCheck = document.querySelector('#moodCheck');
const moodLetsGo = document.querySelector('#moodLetsGo');
const moodLater = document.querySelector('#moodLater');
const moodStatus = document.querySelector('#moodStatus');
moodLetsGo?.addEventListener('click', () => {
  moodCheck.classList.add('mood-celebrating');
  moodStatus.textContent = 'Yay! Let’s make this a good one.';
  moodLetsGo.hidden = true; moodLater.hidden = true;
  celebrate();
  setTimeout(() => document.querySelector('#reveal').scrollIntoView({ behavior: 'smooth', block: 'start' }), 700);
});
moodLater?.addEventListener('click', () => {
  moodStatus.textContent = 'Come back when you have good mood and energy. I’ll be right here.';
});

const revealButton = document.querySelector('#revealButton');
const identity = document.querySelector('#identity');
revealButton.addEventListener('click', () => {
  identity.classList.add('shown'); identity.setAttribute('aria-hidden', 'false');
  revealButton.textContent = 'surprise ♥'; celebrate(); recordEvent('name_revealed');
});
function celebrate() {
  for (let i = 0; i < 55; i++) {
    const bit = document.createElement('i'); bit.className = 'confetti';
    bit.style.left = `${Math.random() * 100}%`; bit.style.background = ['#ffcd5a', '#f8f1e9', '#ed806c'][i % 3];
    bit.style.setProperty('--drift', `${(Math.random() - .5) * 240}px`); bit.style.animationDelay = `${Math.random() * .35}s`;
    document.body.append(bit); bit.addEventListener('animationend', () => bit.remove());
  }
}
async function recordEvent(event) {
  recordAnalyticsEvent(event);
}
let analyticsSessionId = sessionStorage.getItem('proposalAnalyticsSession');
if (!analyticsSessionId) {
  analyticsSessionId = crypto.randomUUID().replaceAll('-', '');
  sessionStorage.setItem('proposalAnalyticsSession', analyticsSessionId);
}
let activeSection = null;
let sectionStartedAt = 0;
const visitStartedAt = performance.now();
function recordAnalyticsEvent(event, details = {}, useBeacon = false) {
  const width = window.innerWidth;
  const deviceType = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  const payload = JSON.stringify({ event, sessionId: analyticsSessionId, deviceType, userAgent: navigator.userAgent, screenWidth: window.screen.width, screenHeight: window.screen.height, ...details });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/events', new Blob([payload], { type: 'application/json' }));
    return;
  }
  fetch('/api/analytics/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
}
function sectionName(section) {
  return section.dataset.analyticsSection || section.id || [...section.classList].filter((name) => name !== 'section').join('-') || 'section';
}
function trackSection(section) {
  const nextSection = sectionName(section);
  if (nextSection === activeSection) return;
  const now = performance.now();
  if (activeSection) recordAnalyticsEvent('section_left', { section: activeSection, durationMs: Math.round(now - sectionStartedAt) });
  activeSection = nextSection;
  sectionStartedAt = now;
  recordAnalyticsEvent('section_entered', { section: activeSection });
}
function endVisit() {
  const now = performance.now();
  if (activeSection) recordAnalyticsEvent('section_left', { section: activeSection, durationMs: Math.round(now - sectionStartedAt) }, true);
  recordAnalyticsEvent('visit_ended', { durationMs: Math.round(now - visitStartedAt) }, true);
}
recordAnalyticsEvent('visit_started');
const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (visible) trackSection(visible.target);
}, { threshold: [0, 0.01, 0.55, 0.75] });
document.querySelectorAll('main > section').forEach((section) => sectionObserver.observe(section));
document.addEventListener('play', (event) => {
  if (event.target instanceof HTMLVideoElement) recordAnalyticsEvent('video_played', { memory: activeMemory, media: event.target.currentSrc.split('/').pop() });
}, true);
document.addEventListener('pause', (event) => {
  if (event.target instanceof HTMLVideoElement && !event.target.ended) recordAnalyticsEvent('video_paused', { memory: activeMemory, media: event.target.currentSrc.split('/').pop() });
}, true);
document.addEventListener('ended', (event) => {
  if (event.target instanceof HTMLVideoElement) recordAnalyticsEvent('video_ended', { memory: activeMemory, media: event.target.currentSrc.split('/').pop() });
}, true);
window.addEventListener('pagehide', endVisit, { once: true });

document.querySelectorAll('.blank-page').forEach((page) => {
  const lines = page.textContent.split(/\r?\n/);
  const content = document.createDocumentFragment();
  let paragraphLines = [];

  const addParagraph = () => {
    if (!paragraphLines.length) return;
    const paragraph = document.createElement('p');
    paragraph.className = 'blank-page-copy';
    paragraph.textContent = paragraphLines.join('\n');
    content.append(paragraph);
    paragraphLines = [];
  };

  lines.forEach((line) => {
    if (line.startsWith('$')) {
      addParagraph();
      const subheading = document.createElement('h3');
      subheading.className = 'blank-page-subheading';
      subheading.textContent = line.slice(1).trim();
      content.append(subheading);
    } else {
      paragraphLines.push(line);
    }
  });
  addParagraph();
  page.replaceChildren(content);
});

const form = document.querySelector('#expenseForm');
const list = document.querySelector('#expenseList');
const total = document.querySelector('#total');
const format = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
let entries = [];
function renderExpenses() {
  total.textContent = format.format(entries.reduce((sum, item) => sum + item.amount, 0));
  list.innerHTML = entries.length ? entries.map(item => `<li><div><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.category)} · ${escapeHtml(item.paidBy || 'Us')} · ${escapeHtml(item.spentOn || '')}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</span></div><strong>${format.format(item.amount)}</strong></li>`).join('') : '<li class="empty">No shared moments logged yet.</li>';
}
function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value; return el.innerHTML; }
async function loadExpenses() {
  if (!form) return;
  try { const response = await fetch('/api/expenses'); if (!response.ok) return; entries = await response.json(); renderExpenses(); } catch (_) { /* story site works without the database */ }
}
form?.addEventListener('submit', async (event) => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(form)); data.amount = Number(data.amount);
  try {
    const response = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const added = await response.json(); if (!response.ok) throw new Error(added.message);
    entries.unshift(added); renderExpenses(); form.reset(); recordEvent('expense_added');
  } catch (error) { alert(error.message || 'Could not add the expense. Add MONGODB_URI in .env first.'); }
});
loadExpenses();
