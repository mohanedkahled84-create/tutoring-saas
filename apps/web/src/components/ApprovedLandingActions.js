import {request} from '../services/api.js?v=9.99.6';
import {escapeHtml as escape} from '../utils/escapeHtml.js?v=9.99.6';
import {cyclePrice} from '../utils/subscriptionPricing.js?v=9.99.6';

const ASSETS='/assets/home/v1/';
const features={
  parent:{title:'وليّ الأمر شايف الصورة كاملة.',description:'الحضور والغياب والدرجات وحالة تسليم الواجبات، في بوابة مخصصة لمتابعة ابنه.',more:'متابعة الحضور والدرجات والواجبات من مساحة وليّ الأمر، مع تفاصيل حالة التسليم ومواعيده.',caption:'بوابة وليّ الأمر · الحضور والنتائج',image:'parent.webp'},
  brand:{title:'منصتك، باسمك وطابعك.',description:'اسم المدرس وعنوان المنصة وألوان الهوية، في واجهة تخصّه وتستقبل طلابه.',more:'خصّص اسم المنصة وألوانها وصورة المدرس من إعدادات منصتك التعليمية.',caption:'واجهة منصة المدرس · صورة توضيحية',image:'brand.webp'},
  student:{title:'مساحة تجمع تعلّمه ومتابعته.',description:'واجبات واختبارات ومحاضرات ومذكرات، مع متابعة للحضور والنتائج من داخل مساحة الطالب.',more:'الطالب يلاقي واجباته ونتائجه والمحاضرات المنشورة له، من مساحته في المنصة.',caption:'بوابة الطالب · الرئيسية والمتابعة',image:'student.webp'},
  media:{title:'من الشرح للتطبيق، في نفس المنصة.',description:'خلّي الطالب يرجع لفيديوهات الشرح، ويعرف واجباته ويرفع الحل من مساحته التعليمية.',more:'فيديوهات الشرح بروابط خارجية داخل منصة المدرس. الطالب يقدر يرفع صور الحل أو ملف PDF، ويتابع حالة تسليم الواجب.',caption:'المحاضرات وفيديوهات الشرح',image:'lessons.webp'},
  manage:{title:'طلابك ومجموعاتك قدامك.',description:'دليل الطلاب وكروتهم وروابط المتابعة، مع البحث وإدارة بيانات كل طالب من نفس الشاشة.',more:'استيراد الطلاب من Excel، وكروت الطلاب، والبحث والتصفية وإدارة البيانات من دليل الطلاب.',caption:'إدارة الطلاب · دليل الطلاب وقاعدة البيانات',image:'manage.webp'},
};

export function mountApprovedLandingView(app,root){
  if(!root)return ()=>{};
  const controller=new AbortController(),options={signal:controller.signal};
  const q=selector=>root.querySelector(selector);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let observer,plans=null,months=1,current='parent';
  const animate=(element,frames,duration=300)=>{
    if(reduced||!element?.animate)return null;
    element.getAnimations().forEach(animation=>animation.cancel());
    return element.animate(frames,{duration,easing:'cubic-bezier(.16,1,.3,1)'});
  };
  const listen=(element,event,handler)=>element?.addEventListener(event,handler,options);
  const mainVideo=q('#real-video'),largeVideo=q('#premium-video'),cinema=q('#premium-cinema');
  function dispose(){
    controller.abort();observer?.disconnect();
    mainVideo.pause();largeVideo.pause();
    root.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  }
  function openAuth(tab){
    dispose();app._landingCleanup=null;
    const url=new URL(location.href);url.searchParams.set('view',tab);url.hash='';
    history.replaceState(null,'',url.pathname+url.search);
    app.renderAuth(tab);
  }
  root.querySelectorAll('[data-entry]').forEach(button=>{
    const login=button.dataset.entry==='تسجيل الدخول';
    const link=document.createElement('a');link.className=button.className;
    link.href='/?view='+(login?'login':'signup');link.dataset.auth=login?'login':'signup';
    link.textContent=login?'تسجيل الدخول':'ابدأ تجربتك المجانية لمدة ٧ أيام';
    button.replaceWith(link);
  });
  listen(root,'click',event=>{
    const target=event.target.closest('[data-auth],[data-legal],[data-accept-cookies]');
    if(!target)return;
    if(target.dataset.auth){
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();openAuth(target.dataset.auth);
    }else if(target.dataset.legal){event.preventDefault();app.openPolicyModal(target.dataset.legal);}
    else if(target.hasAttribute('data-accept-cookies'))app.acceptCookies();
  });

  function selectFeature(key){
    if(!Object.hasOwn(features,key))return;
    current=key;const item=features[key];
    q('#real-feature-title').textContent=item.title;q('#real-feature-desc').textContent=item.description;
    q('#real-feature-more').textContent=item.more;q('#real-details').open=false;
    q('#real-image').src=ASSETS+item.image;q('#real-image').alt=item.caption;
    q('#real-image-caption').textContent=item.caption;
    q('#real-feature').setAttribute('aria-labelledby','real-tab-'+key);
    q('#media-views').hidden=key!=='media';
    root.querySelectorAll('[data-screen]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.screen===key)));
    root.querySelectorAll('[data-media-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mediaView==='media')));
    animate(q('#real-feature'),[{opacity:.4,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],380);
  }
  root.querySelectorAll('[data-screen]').forEach(button=>{
    listen(button,'click',()=>selectFeature(button.dataset.screen));
    listen(button,'keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const tabs=[...root.querySelectorAll('[data-screen]')];
      const index=tabs.indexOf(button),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?1:-1)+tabs.length)%tabs.length;
      tabs[next].focus();selectFeature(tabs[next].dataset.screen);
    });
  });
  root.querySelectorAll('[data-media-view]').forEach(button=>listen(button,'click',()=>{
    if(current!=='media')return;
    const homework=button.dataset.mediaView==='homework';
    q('#real-image').src=ASSETS+(homework?'homework.webp':'lessons.webp');
    q('#real-image').alt=homework?'الواجبات والتسليم':'المحاضرات وفيديوهات الشرح';
    q('#real-image-caption').textContent=q('#real-image').alt;
    root.querySelectorAll('[data-media-view]').forEach(control=>control.setAttribute('aria-pressed',String(control===button)));
    animate(q('#real-image'),[{opacity:.45},{opacity:1}],220);
  }));
  const imageDialog=q('#real-dialog');
  listen(q('#real-zoom'),'click',()=>{
    q('#real-dialog-title').textContent=q('#real-image').alt;
    q('#real-dialog-copy').hidden=true;q('#real-large-image').hidden=false;
    q('#real-large-image').src=q('#real-image').src;q('#real-large-image').alt=q('#real-image').alt;
    imageDialog.showModal();
  });
  listen(q('#real-close'),'click',()=>imageDialog.close());
  listen(q('#real-play'),'click',()=>{
    mainVideo.pause();cinema.showModal();
    if(!largeVideo.getAttribute('src'))largeVideo.src=ASSETS+'product-film.webm';
    largeVideo.currentTime=0;void largeVideo.play().catch(()=>{q('#real-video-error').classList.add('visible');});
  });
  q('#real-play').textContent='شوف سنترلي بتشتغل';q('#real-play').className='hero-video-link';
  mainVideo.src=ASSETS+'product-film.webm';
  listen(q('#premium-close'),'click',()=>cinema.close());
  listen(cinema,'close',()=>largeVideo.pause());
  for(const video of [mainVideo,largeVideo]){
    listen(video,'play',()=>{video.dataset.playRequested='true';});
    listen(video,'error',()=>{
      if(!video.dataset.fallback){
        const resume=video.dataset.playRequested==='true'||(video===largeVideo&&cinema.open);
        video.dataset.fallback='true';video.src=ASSETS+'product-film.mp4';video.load();
        if(resume)void video.play().catch(()=>q('#real-video-error').classList.add('visible'));
      }
      else q('#real-video-error').classList.add('visible');
    });
    listen(video,'loadeddata',()=>q('#real-video-error').classList.remove('visible'));
  }
  listen(mainVideo,'timeupdate',()=>{
    const captions=['منصتك باسمك وصورتك','سكرول وتنقّل داخل مساحة الطالب','متابعة وليّ الأمر من الهاتف','سنترلي · اكتشف منصتك'];
    q('#real-video-caption').textContent=captions[mainVideo.currentTime<6.8?0:mainVideo.currentTime<14.8?1:mainVideo.currentTime<25?2:3];
  });

  const planDialog=q('#home-plans'),planHost=q('#home-plan-cards');
  const number=value=>Number(value).toLocaleString('ar-EG',{maximumFractionDigits:2});
  const line=text=>'<li>'+escape(text)+'</li>';
  function renderPlans(){
    if(!plans||!root.isConnected)return;
    planHost.setAttribute('aria-busy','false');
    planHost.innerHTML=plans.map(plan=>{
      const price=cyclePrice(plan.price_piasters,months,plan.id),teaching=Boolean(plan.teaching_platform);
      const details=[number(plan.students)+' طالب نشط',number(plan.assistants)+' مساعدين بصلاحيات',number(plan.storage_bytes/1e9)+' جيجا للملفات','الحضور والتحصيل والماليات','متابعة الطالب ووليّ الأمر',teaching?'منصة باسمك وهويتك ورابط فرعي':'بوابة متابعة سنترلي',...(teaching?['مذكرات وواجبات واختبارات أونلاين']:[]),...(plan.initial_gift_piasters?[number(plan.initial_gift_piasters/100)+' ج.م رصيد إعلانات عند أول اشتراك']:[])];
      const tag=plan.id==='basic_v1'?'لإدارة شغلك ومتابعة طلابك':plan.id==='pro_v1'?'لمنصتك التعليمية بهويتك':'مساحة أكبر لفريقك وطلابك';
      const description=plan.id==='basic_v1'?'أدوات الإدارة وبوابات المتابعة.':plan.id==='pro_v1'?'الإدارة والمتابعة مع منصة بهويتك.':'مميزات المنصة بسعة وفريق أكبر.';
      return `<article class="plan-card ${plan.id==='pro_v1'?'plan-brand':''}"><span class="plan-kicker">${tag}</span><h3>${escape(plan.name)}</h3><p class="plan-description">${description}</p><div class="plan-price">${number(price.total/100)} <small>ج.م</small></div><p class="plan-billing-note">${months===1?'كل ٣٠ يومًا':months===6?'كل ٦ شهور':'كل سنة'}${price.discount?' · خصم '+number(price.discount)+'٪':''}</p><ul class="plan-features">${details.map(line).join('')}</ul><a class="site-button" href="/?view=signup" data-auth="signup">ابدأ تجربة ٧ أيام</a></article>`;
    }).join('');
    q('#plans-status').textContent=months===1?'الأسعار المعروضة للاشتراك الشهري.':'السعر المعروض هو إجمالي الفترة، بخصم من مجموع السعر الشهري الحالي.';
    animate(planHost,[{opacity:.5,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],280);
  }
  async function loadPlans(){
    if(plans)return renderPlans();
    planHost.setAttribute('aria-busy','true');q('#plans-status').textContent='جار تحميل الباقات الحالية…';
    planHost.innerHTML=Array.from({length:3},()=>'<div class="plan-skeleton" aria-hidden="true"><div class="skeleton-line skeleton-short"></div><div class="skeleton-line skeleton-price"></div>'+Array.from({length:5},()=>'<div class="skeleton-line"></div>').join('')+'</div>').join('');
    try{
      const data=await request('/public/plans',{credentials:'omit'});
      if(!Array.isArray(data.plans)||data.plans.length!==3||data.plans.some(plan=>!['basic_v1','pro_v1','max_v1'].includes(plan.id)||!Number.isSafeInteger(plan.price_piasters)||plan.price_piasters<=0||![plan.students,plan.assistants,plan.storage_bytes].every(value=>Number.isSafeInteger(value)&&value>=0)))throw Error('Invalid plans');
      plans=data.plans;renderPlans();
    }catch{
      if(!root.isConnected)return;
      planHost.setAttribute('aria-busy','false');q('#plans-status').textContent='تعذر تحديث الباقات الآن.';
      planHost.innerHTML='<div class="plans-load" role="status">تأكد من الاتصال وحاول مرة أخرى. <button type="button" class="site-button" data-retry-plans>إعادة المحاولة</button></div>';
    }
  }
  root.querySelectorAll('[data-open-plans]').forEach(button=>listen(button,'click',()=>{
    planDialog.showModal();planDialog.scrollTop=0;
    animate(planDialog,[{opacity:0,transform:'translateY(16px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],320);
    void loadPlans();
  }));
  listen(planHost,'click',event=>{if(event.target.closest('[data-retry-plans]'))void loadPlans();});
  listen(q('#close-home-plans'),'click',()=>planDialog.close());
  root.querySelectorAll('[data-plan-cycle]').forEach(button=>listen(button,'click',()=>{
    const value=Number(button.dataset.planCycle);if(![1,6,12].includes(value))return;
    months=value;root.querySelectorAll('[data-plan-cycle]').forEach(control=>control.setAttribute('aria-pressed',String(control===button)));renderPlans();
  }));
  for(const dialog of [planDialog,imageDialog,cinema])listen(dialog,'click',event=>{
    if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
  root.querySelectorAll('.home-faq details').forEach(details=>listen(details,'toggle',()=>{if(details.open)animate(details.querySelector('p'),[{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}],200);}));
  if(!reduced&&'IntersectionObserver'in window){
    root.classList.add('motion-ready');observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.1});
    root.querySelectorAll('.reveal').forEach(element=>observer.observe(element));q('.site-film').classList.add('hero-art-in');
  }
  const updateHeader=()=>{if(!root.isConnected){dispose();return;}q('.site-header').classList.toggle('is-scrolled',scrollY>12);};
  listen(window,'scroll',updateHeader);listen(window,'pagehide',dispose);listen(document,'visibilitychange',()=>{if(document.hidden){mainVideo.pause();largeVideo.pause();}});
  updateHeader();
  return dispose;
}
