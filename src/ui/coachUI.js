export function renderCoachUI(root,{enabled,level,ready,advice,onRequest}){
  root.hidden=!enabled;root.replaceChildren();if(!enabled)return;
  if(!advice?.available)return;
  const result=document.createElement('div');result.className='coach-result';result.setAttribute('role','status');
  const label=document.createElement('strong');label.textContent=advice.label;result.append(label);
  const reasons=document.createElement('ul');for(const reason of advice.reasons){const li=document.createElement('li');li.textContent=reason;reasons.append(li);}result.append(reasons);
  for(const [index,line] of (advice.lines??[]).entries()){
    const h=document.createElement('h4');h.textContent=index?'Alternative Linie':'Mögliche Linie';result.append(h);
    const list=document.createElement('ol');for(const step of line.steps){const li=document.createElement('li');li.textContent=step;list.append(li);}result.append(list);
    const remaining=document.createElement('p');remaining.textContent=`Resthand in dieser Variante: ${line.remaining.join(' · ')||'leer'}`;result.append(remaining);
  }
  const caution=document.createElement('p');caution.className='note';caution.textContent='Bedingte Planung, keine Vorhersage: Unbekannte Karten, Nachziehen und weitere Nachwürfe können die Linie ändern.';result.append(caution);
  root.append(result);
}
