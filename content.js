(async function () {
  const root = document;
  const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  try {
    const response = await fetch('content/site.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Inhalte nicht geladen');
    const data = await response.json();
    for (const [id, value] of [['editable-tagline',data.tagline],['editable-about-lead',data.about_lead],['editable-about-text',data.about_text]]) {
      const element = root.getElementById(id); if (element && typeof value === 'string') element.textContent = value;
    }
    const drivers = root.getElementById('drivers-list');
    if (drivers && data.drivers?.length) drivers.innerHTML = data.drivers.map(d => `<article class="cms-card"><div class="driver-photo">${d.image ? `<img src="${escapeHTML(d.image)}" alt="Fahrzeug von ${escapeHTML(d.name)}" loading="lazy">` : '<span class="driver-placeholder">4ACES-RACING</span>'}</div>${d.number != null && d.number !== '' ? `<div class="driver-number" aria-label="Startnummer ${escapeHTML(d.number)}">#${escapeHTML(d.number)}</div>` : ''}<h3>${escapeHTML(d.name)}</h3>${d.description ? `<p>${escapeHTML(d.description)}</p>` : ''}</article>`).join('');
    const races = root.getElementById('races-list');
    if (races && data.races?.length) races.innerHTML = data.races.map(r => `<article class="cms-card"><p>${escapeHTML(r.date)}</p><h3>${escapeHTML(r.title)}</h3><p>${escapeHTML(r.track)}</p><p>${escapeHTML(r.result)}</p></article>`).join('');
    const gallery = root.getElementById('gallery-list');
    if (gallery && data.gallery?.length) gallery.innerHTML = data.gallery.map(g => `<div class="gallery-card"><img src="${escapeHTML(g.image)}" alt="${escapeHTML(g.title)}"><div><span>4ACES-RACING</span><h3>${escapeHTML(g.title)}</h3><p>${escapeHTML(g.description)}</p></div></div>`).join('');
    const sponsors = root.getElementById('sponsors-list');
    if (sponsors && data.sponsors?.length) {
      root.getElementById('sponsoren').hidden = false;
      for (const s of data.sponsors) {
        const card = document.createElement('article'); card.className='cms-card';
        const title=document.createElement('h3'); title.textContent=s.name; card.append(title);
        if(s.image){const img=document.createElement('img');img.src=s.image;img.alt=s.name;card.append(img);}
        if(/^https?:\/\//i.test(s.url||'')){const a=document.createElement('a');a.href=s.url;a.textContent='Website besuchen';a.rel='noopener noreferrer';a.target='_blank';card.append(a);}
        sponsors.append(card);
      }
    }
  } catch(e) { console.warn('Standardinhalte werden angezeigt:',e.message); }
})();
