/**
 * Server-rendered HTML for the public NFC tap pages — a premium "foil-and-stock"
 * digital business card. Rendered by Express (not the SPA) so Open Graph and
 * `noindex` work for crawlers. Every interpolated value is HTML-escaped; only
 * whitelisted, public fields are passed in.
 *
 * ADAPTS PER BRAND: the treatment (dark or light stock) is chosen from the
 * company's brand colour so that colour always reads well — a light brand glows
 * on dark stock, a dark brand reads as ink on ivory stock.
 *
 * The unknown/lost/unassigned case renders an identical, information-free 404.
 */

/** HTML-escape text content. */
function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
/** Only HTML-escape for hrefs (URLs are already valid + safe-schemed). */
const attr = h;

const digits = (v) => String(v ?? '').replace(/[^\d]/g, '');
const ensureHttp = (url) => (!url ? '' : /^https?:\/\//i.test(url) ? url : `https://${url}`);
const safeHex = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#1f9e78');

/** Two-letter initials for the monogram fallback. */
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const ICON = {
  phone: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  whatsapp: 'M12 2.25c-5.385 0-9.75 4.365-9.75 9.75 0 1.72.446 3.336 1.228 4.74L2.25 21.75l5.13-1.2A9.7 9.7 0 0012 21.75c5.385 0 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z',
  email: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0-8.57 5.27a2.25 2.25 0 01-2.36 0L2.25 6.75',
  web: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5 0 4-4 4-9s-1.5-9-4-9-4 4-4 9 1.5 9 4 9zM3 12h18',
  linkedin: 'M6.5 8.25A1.75 1.75 0 106.5 4.75a1.75 1.75 0 000 3.5zM5 10.5h3v9H5v-9zm5 0h2.9v1.23h.04c.4-.76 1.38-1.56 2.85-1.56 3.05 0 3.61 2 3.61 4.61v4.72h-3v-4.18c0-1 0-2.28-1.39-2.28s-1.6 1.09-1.6 2.21v4.25h-3v-9z',
  location: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  save: 'M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9',
};
const iconSvg = (path, filled = false) =>
  `<svg viewBox="0 0 24 24" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.7"'} aria-hidden="true">${filled ? `<path d="${path}"/>` : `<path stroke-linecap="round" stroke-linejoin="round" d="${path}"/>`}</svg>`;

/**
 * One tappable row. `track` is the analytics key (see NFC_CLICK_TARGETS); the
 * page script reads it from data-t and beacons it on click. The href stays a
 * real link, so tapping works exactly the same if the beacon never fires.
 */
function action({ icon, label, href, track, filled = false, blank = false }) {
  if (!href) return '';
  const t = blank ? ' target="_blank" rel="noopener"' : '';
  return `<a class="act" href="${attr(href)}" data-t="${attr(track)}"${t}><span class="ic">${iconSvg(icon, filled)}</span><span>${h(label)}</span></a>`;
}

/** Palette tokens for the ultra-premium dark aesthetic. */
function palette(brand) {
  return {
    '--brand': brand,
    '--accent': `color-mix(in oklab, ${brand} 85%, #fff 15%)`,
    '--bg': '#09090b',
    '--card-bg': 'rgba(15, 15, 20, 0.45)',
    '--card-border': 'rgba(255, 255, 255, 0.12)',
    '--text': '#f4f4f5',
    '--muted': '#a1a1aa',
    '--save-fg': '#ffffff',
    '--hair': 'rgba(255, 255, 255, 0.1)',
    '--btn-bg': 'rgba(25, 25, 30, 0.5)',
    '--icon-bg': `color-mix(in oklab, ${brand} 15%, transparent)`,
    '--glow': `color-mix(in oklab, ${brand} 60%, transparent)`,
  };
}

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
:root{--ease:cubic-bezier(.25,1,.3,1)}
html,body{height:100%}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text);background:var(--bg);min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px;position:relative;overflow-x:hidden}

.saudi-art{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0.25;
 background-image:url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='%23ffffff' stroke-width='0.5' fill='none' stroke-opacity='0.6'%3E%3Cpath d='M60 0 L120 60 L60 120 L0 60 Z'/%3E%3Cpath d='M30 30 L90 90 M30 90 L90 30'/%3E%3Ccircle cx='60' cy='60' r='42'/%3E%3Ccircle cx='60' cy='60' r='18'/%3E%3C/g%3E%3C/svg%3E");
 background-size:120px 120px;
 -webkit-mask-image:radial-gradient(circle at 50% 30%, black 10%, transparent 85%);mask-image:radial-gradient(circle at 50% 30%, black 10%, transparent 85%);}
 
.glow{position:fixed;inset:-50%;background:radial-gradient(circle at 50% 30%, var(--glow) 0%, transparent 60%);z-index:0;opacity:0.6;animation:pulse 8s infinite alternate ease-in-out;}
@keyframes pulse{0%{opacity:0.4;transform:scale(0.95);}100%{opacity:0.7;transform:scale(1.05);}}

.noise{position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0.04;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");}

.load{position:fixed;inset:0;z-index:30;display:grid;place-items:center;background:var(--bg);animation:loadout 0.8s var(--ease) 0.6s forwards}
.load .ring{width:60px;height:60px;border-radius:50%;border:3px solid var(--hair);border-top-color:var(--brand);animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes loadout{to{opacity:0;visibility:hidden;transform:scale(1.05)}}

.card{position:relative;z-index:10;width:min(420px,100%);border-radius:32px;padding:32px 24px 28px;
 background:var(--card-bg);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);
 border:1px solid var(--card-border);
 box-shadow:0 30px 60px -15px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15);
 overflow:hidden;animation:rise 1s var(--ease) 0.8s both;transform-style:preserve-3d;will-change:transform;
 --x: 0px; --y: 0px;}
@keyframes rise{0%{opacity:0;transform:translateY(30px) scale(0.95)}100%{opacity:1;transform:translateY(0) scale(1)}}

/* Holographic sheen driven by mouse */
.card::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:radial-gradient(800px circle at var(--x) var(--y), rgba(255,255,255,0.06), transparent 40%);
 mix-blend-mode:overlay;transition:opacity 0.2s;}

.logo{display:block;max-height:60px;max-width:70%;margin:0 auto 14px;object-fit:contain;animation:pop 0.6s var(--ease) 1.2s both;filter:drop-shadow(0 4px 16px rgba(0,0,0,0.4)) drop-shadow(0 0 20px rgba(255,255,255,0.15));}
.logo-hero{max-height:90px;max-width:75%;margin:0 auto 20px;}

.ava{width:96px;height:96px;border-radius:50%;margin:0 auto 16px;display:grid;place-items:center;overflow:hidden;
 font-family:ui-serif,Georgia,serif;font-size:36px;font-weight:600;color:#fff;
 background:var(--brand);
 box-shadow:0 0 30px -10px var(--brand), inset 0 2px 4px rgba(255,255,255,0.4);animation:floaty 6s ease-in-out 2s infinite;position:relative;z-index:2;border:3px solid rgba(255,255,255,0.15);}
.ava img{width:100%;height:100%;object-fit:cover}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

.name{font-weight:700;font-size:28px;line-height:1.1;text-align:center;letter-spacing:-0.02em;text-wrap:balance;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,0.3);}
.role{text-align:center;color:var(--muted);font-size:14px;margin-top:5px;font-weight:500;}
.org{text-align:center;color:var(--brand);font-size:13px;letter-spacing:0.08em;text-transform:uppercase;margin-top:6px;font-weight:700;filter:brightness(1.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;}
.org-ar{text-align:center;color:var(--brand);font-size:14px;margin-top:4px;font-weight:600;filter:brightness(1.3);direction:rtl;font-family:'Noto Sans Arabic','Segoe UI',Tahoma,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;}
.rule{height:1px;margin:18px 16px;background:linear-gradient(90deg,transparent,var(--hair),transparent)}

.save{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;border-radius:20px;text-decoration:none;font-weight:600;font-size:16px;color:#fff;
 background:linear-gradient(135deg, var(--brand), var(--accent));
 box-shadow:0 12px 32px -8px var(--glow), inset 0 2px 0 rgba(255,255,255,0.3);animation:pop 0.6s var(--ease) 1.5s both;transition:all 0.3s var(--ease);position:relative;overflow:hidden;}
.save::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom, rgba(255,255,255,0.15), transparent);pointer-events:none;}
.save:hover{transform:translateY(-3px) scale(1.02);box-shadow:0 20px 40px -10px var(--glow), inset 0 2px 0 rgba(255,255,255,0.4);}
.save:active{transform:scale(0.97)}
.save svg{width:22px;height:22px}

.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
.act{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 4px;border-radius:20px;text-decoration:none;color:var(--text);
 background:var(--btn-bg);border:1px solid var(--hair);box-shadow:0 8px 24px rgba(0,0,0,0.2);transition:all 0.25s var(--ease);animation:pop 0.5s var(--ease) both;}
.act:hover{transform:translateY(-5px) scale(1.05);background:rgba(255,255,255,0.05);border-color:color-mix(in oklab,var(--brand) 40%,transparent);box-shadow:0 12px 32px rgba(0,0,0,0.3), 0 0 20px var(--icon-bg);}
.act:active{transform:scale(0.95)}
.act .ic{width:40px;height:40px;border-radius:14px;display:grid;place-items:center;color:var(--accent);background:var(--icon-bg);transition:transform 0.3s var(--ease);box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);}
.act:hover .ic{transform:rotate(5deg) scale(1.1);color:#fff;}
.act .ic svg{width:20px;height:20px}
.act span:last-child{font-size:12px;font-weight:500;}

.actions .act:nth-child(1){animation-delay:1.6s}.actions .act:nth-child(2){animation-delay:1.68s}.actions .act:nth-child(3){animation-delay:1.76s}
.actions .act:nth-child(4){animation-delay:1.84s}.actions .act:nth-child(5){animation-delay:1.92s}.actions .act:nth-child(6){animation-delay:2s}

@keyframes pop{0%{opacity:0;transform:translateY(16px) scale(0.92)}100%{opacity:1;transform:translateY(0) scale(1)}}

.bio{margin-top:16px;padding:16px;border-radius:20px;font-size:14px;line-height:1.6;color:var(--text);background:var(--btn-bg);border:1px solid var(--hair);animation:pop 0.6s var(--ease) 2.1s both;box-shadow:inset 0 2px 10px rgba(0,0,0,0.1);}
.foot{margin-top:18px;text-align:center;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:var(--muted);font-weight:600;}

@media (prefers-reduced-motion:reduce){*{animation:none !important}.load{display:none}.card::after{display:none}}

@media (max-width:480px){
  body{padding:24px 10px}
  .card{padding:24px 16px 22px;border-radius:24px}
  .name{font-size:24px}
  .org{font-size:11px;letter-spacing:0.05em}
  .ava{width:80px;height:80px;font-size:30px;margin-bottom:12px}
  .logo{max-height:48px;margin-bottom:10px}
  .actions{gap:8px;margin-top:12px}
  .act{padding:12px 3px;border-radius:16px}
  .act .ic{width:36px;height:36px;border-radius:12px}
  .act .ic svg{width:18px;height:18px}
  .act span:last-child{font-size:11px}
  .save{padding:12px;font-size:14px;border-radius:16px}
  .rule{margin:12px 16px}
  .foot{margin-top:12px}
}

@media (max-width:360px){
  body{padding:16px 8px}
  .card{padding:20px 12px 18px;border-radius:20px}
  .name{font-size:20px}
  .org{font-size:10px;letter-spacing:0.03em}
  .ava{width:70px;height:70px;font-size:26px;margin-bottom:10px}
  .logo{max-height:40px;margin-bottom:8px}
  .actions{grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}
  .act{padding:10px 2px;border-radius:14px}
  .act .ic{width:32px;height:32px}
  .act span:last-child{font-size:10px}
  .save{padding:10px;font-size:13px}
  .rule{margin:10px 12px}
  .foot{margin-top:10px}
}
`;

/**
 * The full profile page.
 * data = { employee, company, cardUrl, vcardUrl, logoUrl, photoUrl, token, nonce }
 * `nonce` is the per-response CSP nonce (see nfc.public.routes.js) — without it
 * the browser refuses to run the page script at all.
 */
export function renderProfilePage({ employee, company, cardUrl, vcardUrl, logoUrl, photoUrl, token, nonce }) {
  const brand = safeHex(company?.brandColour);
  const vars = palette(brand);
  const styleVars = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');

  const title = employee.name;
  const description = [employee.jobTitle, company?.companyName].filter(Boolean).join(' · ');
  const ogImage = photoUrl || logoUrl || '';

  const website = ensureHttp(company?.website);
  const linkedin = ensureHttp(employee.linkedin);
  const mapHref =
    ensureHttp(company?.mapLink) ||
    (company?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}` : '');
  const telHref = employee.phone ? `tel:${employee.phone.replace(/[^\d+]/g, '')}` : '';
  const waNumber = employee.whatsapp || employee.phone;

  const rows =
    action({ icon: ICON.phone, label: 'Call', href: telHref, track: 'call' }) +
    action({ icon: ICON.whatsapp, label: 'WhatsApp', href: waNumber ? `https://wa.me/${digits(waNumber)}` : '', track: 'whatsapp' }) +
    action({ icon: ICON.email, label: 'Email', href: employee.email ? `mailto:${employee.email}` : '', track: 'email' }) +
    action({ icon: ICON.web, label: 'Website', href: website, track: 'website', blank: true }) +
    action({ icon: ICON.linkedin, label: 'LinkedIn', href: linkedin, track: 'linkedin', filled: true, blank: true }) +
    action({ icon: ICON.location, label: 'Location', href: mapHref, track: 'location', blank: true });

  const avatar = photoUrl
    ? `<div class="ava"><img src="${attr(photoUrl)}" alt="${h(employee.name)}"></div>`
    : '';

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${h(title)}</title>
<meta name="description" content="${h(description)}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${h(title)}">
<meta property="og:description" content="${h(description)}">
${cardUrl ? `<meta property="og:url" content="${h(cardUrl)}">` : ''}
${ogImage ? `<meta property="og:image" content="${h(ogImage)}">` : ''}
<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
<meta name="theme-color" content="${h(vars['--bg'])}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>${STYLE}</style></head>
<body style="${styleVars}">
<div class="glow"></div>
<div class="saudi-art"></div>
<div class="noise"></div>
<div class="load"><div class="ring"></div></div>
<h2 class="sr-only">Digital contact card for ${h(employee.name)}${company?.companyName ? `, ${h(company.companyName)}` : ''}.</h2>
<main class="card" id="card">
  ${logoUrl ? `<img class="logo${!photoUrl ? ' logo-hero' : ''}" src="${attr(logoUrl)}" alt="${h(company?.companyName || 'Logo')}">` : ''}
  ${avatar}
  <h1 class="name">${h(employee.name)}</h1>
  ${employee.jobTitle ? `<p class="role">${h(employee.jobTitle)}</p>` : ''}
  ${company?.companyName ? `<p class="org">${h(company.companyName)}</p>` : ''}
  ${company?.companyNameAr ? `<p class="org-ar" dir="rtl" lang="ar">${h(company.companyNameAr)}</p>` : ''}
  <div class="rule"></div>
  <a class="save" href="${attr(vcardUrl)}">${iconSvg(ICON.save)} Save Contact</a>
  <div class="actions">${rows}</div>
  ${employee.bio ? `<p class="bio">${h(employee.bio)}</p>` : ''}
  <p class="foot">Tap &middot; Connect</p>
</main>
<script nonce="${attr(nonce)}">
(function(){
  var card=document.getElementById('card');
  var reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(card&&!reduce&&matchMedia('(pointer:fine)').matches){
    document.body.addEventListener('pointermove',function(e){
      var r=card.getBoundingClientRect();var x=(e.clientX-r.left)/r.width-.5;var y=(e.clientY-r.top)/r.height-.5;
      card.style.transform='perspective(1200px) rotateY('+(x*6)+'deg) rotateX('+(-y*6)+'deg)';
      card.style.setProperty('--x', e.clientX - r.left + 'px');
      card.style.setProperty('--y', e.clientY - r.top + 'px');
    });
    document.body.addEventListener('pointerleave',function(){card.style.transform='';});
  }

  /* Click tracking. A RELATIVE url on purpose: the page may be reached on a LAN
     IP or a tunnel host that differs from the configured public base url, and a
     relative path always posts back to wherever the page actually came from.
     sendBeacon survives the page being unloaded by the outgoing tel:/https link;
     fetch(keepalive) is the fallback. Failure is silent — it must never get in
     the way of the tap. */
  var endpoint='/c/'+${JSON.stringify(String(token ?? ''))}+'/e';
  Array.prototype.forEach.call(document.querySelectorAll('[data-t]'),function(a){
    a.addEventListener('click',function(){
      var body=JSON.stringify({target:a.getAttribute('data-t')});
      try{
        if(navigator.sendBeacon){navigator.sendBeacon(endpoint,new Blob([body],{type:'application/json'}));}
        else{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true});}
      }catch(e){}
    });
  });
})();
</script>
</body></html>`;
}

/** Identical, information-free 404 for unknown / lost / disabled / unassigned. */
export function renderNotFoundPage() {
  const vars = palette('#1f9e78');
  const styleVars = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Not found</title>
<style>${STYLE}</style></head>
<body style="${styleVars}">
<div class="glow"></div>
<div class="saudi-art"></div>
<div class="noise"></div>
<main class="card" style="text-align:center;padding:56px 26px;animation:none">
  <div style="font-size:48px;margin-bottom:12px;filter:drop-shadow(0 0 10px rgba(255,255,255,0.2))">🔗</div>
  <h1 class="name" style="font-size:24px">This card isn't available</h1>
  <p class="role" style="color:var(--muted);margin-top:12px">The link may be inactive or no longer exists.</p>
</main></body></html>`;
}
