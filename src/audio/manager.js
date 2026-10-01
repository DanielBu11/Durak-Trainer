import {AUDIO_DEFAULTS,AUDIO_SETTINGS_KEY,SOUNDS,sanitizeSettings} from './config.js';

/** One gesture-unlocked Web Audio context and separate gain buses. Each effect
 * gets a fresh source, so rapid cues overlap. Music has exactly one looping
 * source; neither renders nor new games restart it. No rejected promise escapes. */
export function createAudioManager({
  contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),
  fetcher=(...args)=>fetch(...args),
  storage=null,
  baseURL=new URL('../../assets/audio/',import.meta.url),
  warn=(message)=>console.warn(message),
  onStatus=()=>{},
}={}) {
  let settings={...AUDIO_DEFAULTS};
  try{settings=sanitizeSettings(JSON.parse(storage?.getItem(AUDIO_SETTINGS_KEY)||'{}'));}catch{}
  let context,sfxGain,musicGain,authorized=false,hidden=false,musicSource=null,musicOffset=0,musicStarted=0,musicPending=null;
  const buffers=new Map(),warnings=new Set(),active=new Set();
  function warning(key,error){if(warnings.has(key))return;warnings.add(key);try{warn(`Audio nicht verfügbar (${key}). Das Spiel läuft weiter. ${error?.message??''}`);onStatus('Einige Audiodateien fehlen oder konnten nicht geladen werden. Das Spiel läuft weiter.');}catch{}}
  function applyVolumes(){if(!context)return;sfxGain.gain.value=settings.sfxEnabled?settings.sfxVolume:0;musicGain.gain.value=settings.musicEnabled?settings.musicVolume:0;}
  async function load(file) {
    if(!buffers.has(file))buffers.set(file,(async()=>{
      try{const response=await fetcher(new URL(file,baseURL));if(!response.ok)throw Error(`HTTP ${response.status}`);
        return await context.decodeAudioData(await response.arrayBuffer());
      }catch(error){warning(file,error);return null;}
    })());
    return buffers.get(file);
  }
  function stopMusic(){if(!musicSource)return;musicOffset+=(context.currentTime-musicStarted);try{musicSource.stop();musicSource.disconnect();}catch{}musicSource=null;}
  async function startMusic(){
    if(!authorized||hidden||!context||!settings.musicEnabled||musicSource)return;
    if(musicPending)return musicPending;
    musicPending=(async()=>{
      try{const buffer=await load('music/background.mp3');if(!buffer||hidden||!settings.musicEnabled||context.state!=='running'||musicSource)return;
        musicSource=context.createBufferSource();musicSource.buffer=buffer;musicSource.loop=true;musicSource.connect(musicGain);
        musicOffset%=buffer.duration;musicStarted=context.currentTime;musicSource.start(0,musicOffset);
        if(!warnings.size)onStatus('Audio freigeschaltet · Hintergrundmusik läuft.');
      }catch(error){musicSource=null;warning('Musik',error);}
    })();
    try{await musicPending;}finally{musicPending=null;}
  }
  function unlock(){
    // Called synchronously inside a trusted click/touch/keyboard handler.
    // resume() must happen before any fetch/await on iOS Safari.
    authorized=true;
    try{
      if(!context){context=contextFactory();sfxGain=context.createGain();musicGain=context.createGain();sfxGain.connect(context.destination);musicGain.connect(context.destination);applyVolumes();}
      if(hidden)return Promise.resolve(false);
      const resumed=context.state!=='running'?context.resume():Promise.resolve();
      return Promise.resolve(resumed).then(()=>{if(context.state!=='running')return false;void startMusic();return true;}).catch(error=>{warning('Freischaltung',error);return false;});
    }catch(error){warning('Freischaltung',error);return Promise.resolve(false);}
  }
  function firstSound(buffer){
    const data=buffer.getChannelData(0);let index=0;
    // Skip leading silence in the supplied field recordings.
    while(index<data.length&&Math.abs(data[index])<0.008)index++;
    return Math.max(0,index/buffer.sampleRate-0.008);
  }
  async function play(event){
    const spec=SOUNDS[event];if(!spec||!authorized||!context||hidden||!settings.sfxEnabled)return false;
    try{
      const buffer=await load(spec.file);
      if(!buffer||hidden||!settings.sfxEnabled||context.state!=='running')return false;
      const source=context.createBufferSource(),envelope=context.createGain();
      const offset=firstSound(buffer),duration=Math.min(spec.duration,buffer.duration-offset);
      if(duration<=0)return false;
      source.buffer=buffer;source.connect(envelope);envelope.connect(sfxGain);
      const time=context.currentTime;
      envelope.gain.setValueAtTime(0,time);envelope.gain.linearRampToValueAtTime(1,time+Math.min(0.008,duration/4));
      envelope.gain.setValueAtTime(1,time+Math.max(0.008,duration-0.025));envelope.gain.linearRampToValueAtTime(0,time+duration);
      source.onended=()=>{active.delete(source);source.disconnect();envelope.disconnect();};
      active.add(source);source.start(0,offset,duration);return true;
    }catch(error){warning(event,error);return false;}
  }
  function updateSettings(patch){
    settings=sanitizeSettings({...settings,...patch});
    try{storage?.setItem(AUDIO_SETTINGS_KEY,JSON.stringify(settings));}catch{warning('Einstellungen speichern');}
    try{applyVolumes();if(!settings.musicEnabled){stopMusic();if(!warnings.size)onStatus('Musik ausgeschaltet. Soundeffekte folgen deiner Einstellung.');}else void startMusic();}catch(error){warning('Lautstärke',error);}
    return {...settings};
  }
  function setHidden(value){
    hidden=value;
    try{if(hidden){for(const source of active){try{source.stop();}catch{}}stopMusic();if(context)void Promise.resolve(context.suspend()).catch(()=>{});}}
    catch(error){warning('Audio-Pause',error);}
    // When visible again, a real gesture resumes even an interrupted Safari
    // context. Do not autoplay from visibilitychange on a locked screen.
  }
  return {unlock,play,updateSettings,setHidden,getSettings:()=>({...settings})};
}
