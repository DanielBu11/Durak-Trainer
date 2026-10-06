// Preferences never contain a deal. Opening the app always enters setup.
export const SETTINGS_KEY='durak.game.settings.v1';
export const TRAINING_CHOICES=[['1','Level 1 · Hohe Trümpfe'],['2','Level 2 · Alle Trümpfe'],['3a','Level 3A · Eine Karte'],['3b','Level 3B · Zwei Karten'],['4','Level 4 · Farb-Schwächen']];
export const numericLevel=choice=>String(choice).startsWith('3')?3:Number(choice);
export function cleanPreferences(value={}){return {
 difficulty:['beginner','amateur','profi','meister'].includes(value.difficulty)?value.difficulty:'amateur',
 speed:['1000','2000','3000','4000','5000','manual'].includes(value.speed)?value.speed:'1000',
 training:value.training===true,level:TRAINING_CHOICES.some(([id])=>id===value.level)?value.level:'1'};}
export function loadPreferences(storage){try{return cleanPreferences(JSON.parse(storage?.getItem(SETTINGS_KEY))??{});}catch{return cleanPreferences();}}
export function savePreferences(storage,value){try{storage?.setItem(SETTINGS_KEY,JSON.stringify(cleanPreferences(value)));}catch{}}
export function createSession(start){
 let round=null;
 return {get round(){return round;},get isSetup(){return round===null;},start(options){if(round===null)round=start(options);return round;},setup(){round=null;}};
}
