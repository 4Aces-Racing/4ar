(function(){
  const CMS=window.CMS, h=window.h, createClass=window.createClass;
  if(!CMS || !h || !createClass) return;
  CMS.registerPreviewStyle('/style.css');
  CMS.registerPreviewStyle('/admin/preview.css?v=4');
  CMS.registerPreviewTemplate('inhalte',createClass({render:function(){
    const d=this.props.entry.get('data').toJS();
    const img=(path,alt)=>{if(!path)return null; let src; try {const asset=this.props.getAsset(path); src=asset && asset.toString();}catch(e){} if(!src || src===path) src=/^(https?:|blob:|data:|\/)/i.test(path)?path:'/'+path; return h('img',{src:src,alt:alt||''});};
    const section=(n,a,b,children)=>h('section',{className:'preview-section'},h('div',{className:'preview-kicker'},n),h('h2',{},a+' ',h('em',{},b)),children);
    const grid=(items,render,id)=>h('div',{className:'editable-grid',id:id},...(items||[]).map(render),...(!(items||[]).length?[h('p',{className:'empty-panel'},'Noch keine Einträge')]:[]));
    return h('main',{className:'team-preview'},
      h('header',{className:'preview-header'},h('img',{src:'/assets/logo.png',alt:'4Aces Racing'}),h('span',{},'LIVE-VORSCHAU')),
      h('div',{className:'preview-hero'},h('div',{className:'preview-kicker'},'WILLKOMMEN BEI 4ACES-RACING'),h('h1',{},h('em',{},'4'),'ACES ',h('em',{},'RACING')),h('p',{},'SIMRACING TEAM'),h('img',{src:'/assets/bmw-m6-gt3.png',alt:'BMW M6 GT3'}),h('strong',{},d.tagline)),
      section('01 / DAS TEAM','ÜBER','UNS',h('div',{},h('strong',{},d.about_lead),h('p',{},d.about_text))),
      section('02 / DAS COCKPIT','UNSERE','FAHRER',grid(d.drivers,(x,i)=>h('article',{className:'cms-card',key:i},h('div',{className:'driver-photo'},img(x.image,x.name)||h('span',{className:'driver-placeholder'},'4ACES-RACING')),x.number!=null&&x.number!==''?h('div',{className:'driver-number'},'#'+x.number):null,h('h3',{},x.name),h('p',{},x.description)),'drivers-list')),
      section('03 / AUF DER STRECKE','RENN','KALENDER',grid(d.races,(x,i)=>h('article',{className:'cms-card',key:i},h('p',{},x.date),h('h3',{},x.title),h('p',{},x.track),h('p',{},x.result)))),
      section('04 / RENNMOMENTE','UNSERE','GALERIE',grid(d.gallery,(x,i)=>h('article',{className:'cms-card',key:i},img(x.image,x.title),h('h3',{},x.title),h('p',{},x.description)))),
      section('05 / PARTNER','UNSERE','SPONSOREN',grid(d.sponsors,(x,i)=>h('article',{className:'cms-card',key:i},img(x.image,x.name),h('h3',{},x.name),h('p',{},x.url)))));
  }}));
})();