const STORAGE_KEY = 'centrly_locale';

export function getLocale() {
  try { return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar'; }
  catch { return 'ar'; }
}

export function applyLocale(locale = getLocale(), doc = globalThis.document) {
  const next = locale === 'en' ? 'en' : 'ar';
  if (doc?.documentElement) {
    doc.documentElement.lang = next;
    doc.documentElement.dir = next === 'en' ? 'ltr' : 'rtl';
  }
  return next;
}

export function setLocale(locale, doc = globalThis.document) {
  const selected = locale === 'en' ? 'en' : 'ar';
  localStorage.setItem(STORAGE_KEY, selected);
  applyLocale(selected, doc);
  return selected;
}

export function localize(ar, en) {
  return getLocale() === 'en' ? en : ar;
}

export function formatLocale() {
  return localize('ar-EG', 'en-EG');
}

export function renderLanguageButton() {
  const english = getLocale() === 'en';
  return `<button type="button" class="locale-button" data-centrly-language="${english ? 'ar' : 'en'}" aria-label="${english ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}"><span class="locale-button-label ${english ? '' : 'is-active'}" lang="${english ? 'en' : 'ar'}">${english ? 'AR' : 'عربي'}</span><span class="locale-button-label ${english ? 'is-active' : ''}" lang="en">EN</span></button>`;
}

// Remember the HTML defaults so static pages can switch both ways without a reload.
const staticCopies = typeof document !== 'undefined' ? (document.__centrlyStaticCopies ||= new WeakMap()) : new WeakMap();
export function mountStaticLanguage(doc = document) {
  const english=getLocale()==='en';
  for (const [selector,property,dataKey] of [['[data-copy-en]','textContent','copyEn'],['[data-placeholder-en]','placeholder','placeholderEn'],['[data-alt-en]','alt','altEn']]) {
    for (const node of doc.querySelectorAll(selector)) {
      let original=staticCopies.get(node);if(!original){original={};staticCopies.set(node,original);}
      if(!(property in original))original[property]=node[property];
      const translated=node.dataset[dataKey];
      // Do not replace names, progress or other content filled after initial rendering.
      if(node[property]===original[property] || node[property]===translated)node[property]=english?translated:original[property];
    }
  }
  for (const node of doc.querySelectorAll('[data-language-control]')) node.innerHTML = renderLanguageButton();
}

if (typeof document !== 'undefined') applyLocale();
if (typeof document !== 'undefined' && !document.__centrlyLanguageListener) {
  document.__centrlyLanguageListener = true;
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-centrly-language]');
    if (!button) return;
    const lang = button.dataset.centrlyLanguage;
    if (lang !== 'en' && lang !== 'ar') return;
    try { setLocale(lang); } catch { return; }
    const app = window.centrlyApp;
    if (document.querySelector('.app-container') && typeof app?.renderApp === 'function') {
      // Keep drafts, including selected files which browsers cannot assign to a new input.
      const fields = [...document.querySelectorAll('#mainContent input, #mainContent textarea, #mainContent select')];
      const values = fields.map(field => ({node:field,id:field.id,name:field.name,tag:field.tagName,type:field.type,value:field.value,checked:field.checked,
        selected:field.tagName==='SELECT' && field.multiple ? [...field.options].filter(option=>option.selected).map(option=>option.value) : null}));
      const focused=document.activeElement, focusedIndex=fields.indexOf(focused);
      let selection=null;try{if(focusedIndex>=0 && typeof focused.selectionStart==='number')selection=[focused.selectionStart,focused.selectionEnd,focused.selectionDirection];}catch{}
      app.renderApp(true);
      const next=[...document.querySelectorAll('#mainContent input, #mainContent textarea, #mainContent select')];
      for (let index=0;index<values.length;index++) {
        const saved=values[index],field=saved.id ? document.getElementById(saved.id) : next[index];
        if (!field || field.tagName!==saved.tag || field.type!==saved.type || field.name!==saved.name) continue;
        if (saved.type==='file') { if(saved.node.files?.length)field.replaceWith(saved.node); continue; }
        field.value = saved.value;
        if (saved.type === 'checkbox' || saved.type === 'radio') field.checked = saved.checked;
        if (saved.selected) for (const option of field.options) option.selected=saved.selected.includes(option.value);
      }
      if(focusedIndex>=0){const saved=values[focusedIndex],field=saved.id ? document.getElementById(saved.id) : document.querySelectorAll('#mainContent input, #mainContent textarea, #mainContent select')[focusedIndex];
        if(field && field.tagName===saved.tag && field.type===saved.type && field.name===saved.name){field.focus?.({preventScroll:true});if(selection)try{field.setSelectionRange(...selection);}catch{}}}
      const modal=document.querySelector('#centrlyCustomModal .modal-dialog');
      if(modal){modal.dir=lang==='en'?'ltr':'rtl';const close=modal.querySelector('.modal-header button');if(close)close.setAttribute('aria-label',lang==='en'?'Close':'إغلاق');}
      document.dispatchEvent(new CustomEvent('centrly:localechange',{detail:{locale:lang}}));
    } else if (document.querySelector('[data-language-control]')) {
      mountStaticLanguage(document);
      document.dispatchEvent(new CustomEvent('centrly:localechange',{detail:{locale:lang}}));
    } else if (typeof app?._renderLocale === 'function' || typeof app?.renderPortalLogin === 'function') {
      const root=app.getAppEl?.() || document.getElementById('app');
      // A selected file cannot be restored after replacing an input; keep the draft intact.
      if (root?.querySelector('input[type=file]') && [...root.querySelectorAll('input[type=file]')].some(input=>input.files?.length)) {
        button.outerHTML=renderLanguageButton();
        return;
      }
      const values=[...(root?.querySelectorAll('input[id],textarea[id],select[id]') || [])].map(field=>({id:field.id,type:field.type,value:field.value,checked:field.checked}));
      if(typeof app._renderLocale==='function')app._renderLocale();else app.renderPortalLogin();
      for(const saved of values){const field=document.getElementById(saved.id);if(!field || field.type!==saved.type || field.type==='file')continue;field.value=saved.value;if(field.type==='checkbox' || field.type==='radio')field.checked=saved.checked;}
    } else {
      location.reload();
    }
  });
}
