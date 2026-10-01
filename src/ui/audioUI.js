import {createAudioManager} from '../audio/manager.js';

export function setupAudio(root) {
  let storage;try{storage=window.localStorage;}catch{}
  const audio=createAudioManager({storage,onStatus:text=>{root.querySelector('.audio-status').textContent=text;}});
  const settings=audio.getSettings();
  root.innerHTML=`<summary>Audio</summary><div class="audio-controls"><label><input type="checkbox" id="sfx-enabled"> Sounds AN</label><label><input type="checkbox" id="music-enabled"> Musik AN</label><label for="sfx-volume">Effektlautstärke <output id="sfx-volume-label"></output><input id="sfx-volume" type="range" min="0" max="100" step="1"></label><label for="music-volume">Musiklautstärke <output id="music-volume-label"></output><input id="music-volume" type="range" min="0" max="100" step="1"></label></div><p class="audio-status note" role="status">Audio startet nach deinem ersten Tippen. Bei Rückkehr zur App gegebenenfalls erneut tippen.</p>`;
  for(const [name,key] of [['sfx','sfx'],['music','music']]){
    const toggle=root.querySelector(`#${name}-enabled`),slider=root.querySelector(`#${name}-volume`),output=root.querySelector(`#${name}-volume-label`);
    toggle.checked=settings[`${key}Enabled`];slider.value=Math.round(settings[`${key}Volume`]*100);output.value=`${slider.value} %`;
    toggle.onchange=()=>audio.updateSettings({[`${key}Enabled`]:toggle.checked});
    slider.oninput=()=>{output.value=`${slider.value} %`;audio.updateSettings({[`${key}Volume`]:Number(slider.value)/100});};
  }
  // Persistent listeners also recover Safari after calls/background suspension.
  const unlock=event=>{if(event.isTrusted)void audio.unlock();};
  document.addEventListener('click',unlock,true);
  document.addEventListener('touchend',unlock,{capture:true,passive:true});
  document.addEventListener('keydown',unlock,true);
  document.addEventListener('visibilitychange',()=>audio.setHidden(document.hidden));
  window.addEventListener('pagehide',()=>audio.setHidden(true));
  window.addEventListener('pageshow',()=>audio.setHidden(document.hidden));
  return audio;
}
