/* Estensioni Gestione Lavori Falegnameria
   Aggiunge: data fine prevista, giorni rimanenti, ordine interno PO, costo orario,
   valore monetario dello scostamento, report mensile ore per addetto,
   lavoro "ATTIVITA EXTRA PER PDR" (ore da fatturare). */
(function(){
/* barra menu fissa in alto */
document.head.insertAdjacentHTML('beforeend','<style>nav{position:sticky;top:0;z-index:900;box-shadow:0 2px 6px rgba(0,0,0,.25)}@media print{nav{position:static;box-shadow:none}}</style>');
const mesi=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const dl=p=>{if(!p.end||p.status==='closed')return null;return Math.round((new Date(p.end+'T00:00:00')-new Date(todayISO()+'T00:00:00'))/864e5);};
const dtxt=p=>{const d=dl(p);if(d===null)return '—';if(d<0)return `<span class="over">in ritardo di ${-d} gg</span>`;if(d===0)return '<b>scade oggi</b>';return d+' gg';};
const mv=v=>v>0.004?`<span class="over">+${fe(v)} ESUBERO</span>`:v<-0.004?`<span class="ok">−${fe(-v)} risparmio</span>`:'<span class="ok">€ 0</span>';
const rateTxt=r=>r?String(r).replace('.',','):'';
const lastRate=()=>{const a=sortedP().filter(p=>p.rate>0);return a.length?a[a.length-1].rate:0;};

/* ---- campi nel modulo "Nuovo lavoro" ---- */
$('#n-btn').parentElement.insertAdjacentHTML('beforebegin',
 '<div><label>Data fine lavoro prevista *</label><input type="date" id="n-end"></div>'+
 '<div><label>Ordine interno PO n.</label><input type="text" id="n-po"></div>'+
 '<div><label>Costo orario (€/h) <span class="muted">per valorizzare lo scostamento ore</span></label><input type="text" inputmode="decimal" id="n-rate" placeholder="es. 35"></div>'+
 '<div><label><input type="checkbox" id="n-extra"> Attività extra da fatturare (ore addetti esterni)</label></div>');

const _rn=renderNew;
renderNew=function(){
 const first=!$('#n-edit').value&&!$('#n-rate').value;
 _rn();
 if(first)$('#n-rate').value=rateTxt(lastRate());
};
const _reset=resetNew;
resetNew=function(){
 _reset();
 $('#n-end').value='';$('#n-po').value='';$('#n-extra').checked=false;$('#n-rate').value=rateTxt(lastRate());
};
const _edit=editProject;
editProject=function(id){
 _edit(id);const p=getP(id);if(!p)return;
 $('#n-end').value=p.end||'';$('#n-po').value=p.po||'';$('#n-rate').value=rateTxt(p.rate);$('#n-extra').checked=!!p.extra;
};
const _save=saveProject;
saveProject=async function(){
 const end=$('#n-end').value,po=$('#n-po').value.trim(),rt=$('#n-rate').value.trim(),rate=num(rt),ext=$('#n-extra').checked;
 const editId=+$('#n-edit').value,before=db.projects.length;
 if(!end&&!ext){notify('Campi mancanti o non validi: data fine lavoro prevista.');return false;}
 if(rt&&(isNaN(rate)||rate<0)){notify('Costo orario non valido.');return false;}
 await _save();
 let p=null;
 if(editId){if($('#n-name').value==='')p=getP(editId);}
 else if(db.projects.length>before)p=getP(manageId);
 if(p){p.end=end;p.po=po;p.rate=isNaN(rate)?0:r2(rate);p.extra=ext;save();}
 return false;
};

/* ---- calcoli ---- */
const _stats=stats;
stats=function(p){
 const s=_stats(p);
 if(p.extra){s.hl=0;s.cl=0;s.hv=0;s.cv=0;}
 else{s.hv=r2((s.hd-s.hp)*(p.rate||0));s.cv=r2(s.cd-s.cp);}
 s.tv=r2(s.hv+s.cv);return s;
};

/* ---- Gestione lavoro ---- */
const _dm=drawManage;
drawManage=function(f){
 _dm(f);const p=getP(manageId);if(!p)return;const s=stats(p);
 const h=$('#g-live h2');
 if(h)h.insertAdjacentHTML('beforeend',`<div class="muted" style="margin-top:4px">${p.po?'Ordine interno PO n. '+esc(p.po)+' · ':''}${p.end?'Fine prevista '+fd(p.end)+' · Giorni rimanenti: '+dtxt(p):''}</div>`);
 if(!p.extra)$('#g-live').insertAdjacentHTML('beforeend',`<p style="margin-top:12px"><b>Scostamento monetario:</b> ore ${mv(s.hv)} · spese ${mv(s.cv)} · <b>totale ${mv(s.tv)}</b>${p.rate?'':' <span class="muted">(imposta il costo orario in «Modifica dati» per valorizzare le ore)</span>'}</p>`);
};

/* ---- Elenco lavori ---- */
const _rl=renderList;
renderList=function(){
 _rl();const t=$('#l-table table');if(!t)return;
 [...t.rows].forEach((tr,i)=>{
  const mk=h=>{const c=document.createElement(i?'td':'th');c.innerHTML=h;return c;};
  const ref=tr.cells[6];
  if(!i){['PO','Fine prevista','Giorni rimanenti'].forEach(x=>tr.insertBefore(mk(x),ref));return;}
  const p=getP(parseInt(tr.cells[0].textContent,10));if(!p)return;
  [esc(p.po),p.end?fd(p.end):'—',dtxt(p)].forEach(x=>tr.insertBefore(mk(x),ref));
 });
};

/* ---- Report sintetico ---- */
const _rs=renderSumReport;
renderSumReport=function(){
 _rs();const t=$('#s-report table');if(!t)return;let tot=0;
 [...t.rows].forEach((tr,i)=>{
  if(!i){tr.insertAdjacentHTML('beforeend','<th class="num">Scostamento € (ore + spese)</th>');return;}
  if(tr.classList.contains('tot')){tr.insertAdjacentHTML('beforeend',`<td class="num">${mv(r2(tot))}</td>`);return;}
  const p=getP(parseInt(tr.cells[0].textContent,10));if(!p)return;
  const s=stats(p);tot+=s.tv;
  tr.insertAdjacentHTML('beforeend',`<td class="num">${mv(s.tv)}</td>`);
  const m=tr.cells[1].querySelector('.muted');
  if(m)m.insertAdjacentHTML('beforeend',(p.po?' · PO '+esc(p.po):'')+(p.end?' · Fine prev. '+fd(p.end)+(dl(p)===null?'':' · giorni rimanenti: '+dtxt(p)):''));
 });
 t.insertAdjacentHTML('afterend','<p class="muted">Scostamento € = (ore lavorate − ore previste) × costo orario del lavoro + (spese sostenute − spese previste). In rosso = esubero.</p>');
};

/* ---- Report dettagliato ---- */
const _rd=renderDetail;
renderDetail=function(){
 _rd();const p=getP(detailId);if(!p)return;
 const s=stats(p),R=$('#d-report'),para=R.querySelector('p');
 if(para)para.insertAdjacentHTML('beforeend',`<br><b>Ordine interno PO n.:</b> ${esc(p.po)||'—'} &nbsp;·&nbsp; <b>Data fine lavoro prevista:</b> ${p.end?fd(p.end):'—'} &nbsp;·&nbsp; <b>Giorni rimanenti:</b> ${dtxt(p)}${p.rate?` &nbsp;·&nbsp; <b>Costo orario:</b> ${fe(p.rate)}/h`:''}`);
 const t=R.querySelector('table');if(!t)return;
 if(p.extra){[1,2].forEach(i=>t.rows[i].cells[3].textContent='Attività fatturabile');return;}
 t.insertAdjacentHTML('afterend',`<h3>Valore monetario dello scostamento</h3>
 <table><tr><th>Voce</th><th>Calcolo</th><th class="num">Valore</th></tr>
 <tr><td>Ore lavorazioni</td><td>${nf.format(r2(s.hd-s.hp))} h × ${fe(p.rate||0)}/h</td><td class="num">${mv(s.hv)}</td></tr>
 <tr><td>Spese materiali</td><td>${fe(s.cd)} − ${fe(s.cp)}</td><td class="num">${mv(s.cv)}</td></tr>
 <tr class="tot"><td colspan="2">SCOSTAMENTO MONETARIO TOTALE</td><td class="num">${mv(s.tv)}</td></tr></table>
 ${p.rate?'':'<p class="muted">Costo orario non impostato: le ore non sono valorizzate. Impostalo da «Modifica dati».</p>'}`);
};

/* ---- Report mensile ore per addetto ---- */
$('#nav button[data-tab=data]').insertAdjacentHTML('beforebegin','<button data-tab="monthly" onclick="showTab(\'monthly\')">Report mensile ore</button>');
$('main').insertAdjacentHTML('beforeend',`<section id="tab-monthly" class="tab"><div class="panel">
 <div class="noprint" style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:14px">
  <div style="min-width:160px"><label>Mese</label><select id="m-mon" onchange="renderMonthly()">${mesi.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select></div>
  <div style="min-width:110px"><label>Anno</label><select id="m-year" onchange="renderMonthly()"></select></div>
  <button class="btn" onclick="window.print()">🖨 Stampa</button>
 </div><div id="m-report"></div></div></section>`);
$('#m-mon').value=+todayISO().slice(5,7);

function renderMonthly(){
 const T=todayISO(),ysel=$('#m-year'),msel=$('#m-mon');
 const ys=new Set([+T.slice(0,4)]);if(ysel.value)ys.add(+ysel.value);
 db.projects.forEach(p=>p.hours.forEach(h=>ys.add(+h.date.slice(0,4))));
 const cur=ysel.value||T.slice(0,4);
 ysel.innerHTML=[...ys].sort().map(y=>`<option value="${y}">${y}</option>`).join('');ysel.value=cur;
 const key=ysel.value+'-'+String(msel.value).padStart(2,'0');
 const W={},D={};
 db.projects.forEach(p=>p.hours.forEach(h=>{
  if(h.date.slice(0,7)!==key)return;
  const w=W[h.worker]=W[h.worker]||{t:0,x:0};w.t=r2(w.t+h.hours);if(p.extra)w.x=r2(w.x+h.hours);
  const k=h.worker+'|'+p.id;D[k]=D[k]||{w:h.worker,p,h:0};D[k].h=r2(D[k].h+h.hours);
 }));
 const names=Object.keys(W).sort((a,b)=>a.localeCompare(b,'it'));
 let tt=0,tx=0;names.forEach(n=>{tt=r2(tt+W[n].t);tx=r2(tx+W[n].x);});
 const ex=db.projects.find(p=>p.extra);
 const det=Object.values(D).sort((a,b)=>a.w.localeCompare(b.w,'it')||a.p.id-b.p.id);
 $('#m-report').innerHTML=`<div class="rep-head"><div><div class="rep-title">Report mensile ore – ${mesi[msel.value-1]} ${ysel.value}</div><div class="muted">Somma delle ore lavorate da ogni addetto su tutti i lavori (in corso e chiusi)</div></div><div class="bigdate">Alla data del ${fd(T)}</div></div>`+
 (ex?'':'<div class="warn noprint edit-only">Non esiste ancora il lavoro per le ore degli addetti esterni da fatturare. <button class="btn sm" onclick="createExtra()">Crea lavoro «ATTIVITA EXTRA PER PDR»</button></div>')+
 (names.length?`<table><tr><th>Addetto</th><th class="num">Ore totali del mese</th><th class="num">di cui ATTIVITÀ EXTRA (da fatturare)</th><th class="num">di cui altri lavori</th></tr>
 ${names.map(n=>`<tr><td>${esc(n)}</td><td class="num">${nf.format(W[n].t)}</td><td class="num">${W[n].x?'<b>'+nf.format(W[n].x)+'</b>':'—'}</td><td class="num">${nf.format(r2(W[n].t-W[n].x))}</td></tr>`).join('')}
 <tr class="tot"><td>TOTALE</td><td class="num">${nf.format(tt)}</td><td class="num">${nf.format(tx)}</td><td class="num">${nf.format(r2(tt-tx))}</td></tr></table>
 ${ex?`<p><b>Ore da fatturare nel mese (attività extra per PDR):</b> ${fh(tx)}</p>`:''}
 <h3>Dettaglio per addetto e lavoro</h3>
 <table><tr><th>Addetto</th><th>Lavoro</th><th class="num">Ore</th></tr>${det.map(d=>`<tr><td>${esc(d.w)}</td><td>${esc(label(d.p))}${d.p.extra?' <span class="badge open">EXTRA</span>':''}</td><td class="num">${nf.format(d.h)}</td></tr>`).join('')}</table>`
 :'<p class="muted">Nessuna ora registrata in questo mese.</p>');
}
async function createExtra(){
 if(db.projects.some(p=>p.extra))return;
 const id=await newId();
 db.projects.push({id,name:'ATTIVITA EXTRA PER PDR',client:'PDR',opp:'',conf:'',po:'',start:todayISO(),end:'',plannedHours:0,plannedCost:0,rate:0,extra:true,status:'open',closedDate:null,hours:[],expenses:[]});
 save();manageId=id;
 notify('Creato il lavoro N. '+pad(id)+' ATTIVITA EXTRA PER PDR. Registra le ore degli addetti esterni da «2. Gestione lavoro».','ok');
 renderMonthly();
}
window.renderMonthly=renderMonthly;window.createExtra=createExtra;

const _st=showTab;
showTab=function(t){_st(t);if(t==='monthly')renderMonthly();};
const _rv=refreshView;
refreshView=function(){const t=document.querySelector('.tab.active');if(t&&t.id==='tab-monthly')renderMonthly();else _rv();};
})();
