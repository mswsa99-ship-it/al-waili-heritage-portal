'use client';
import {useEffect,useState} from 'react';
import {Volume2,Square} from 'lucide-react';
export default function EasyReader({targetId}:{targetId:string}){
 const [supported,setSupported]=useState(false),[speaking,setSpeaking]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{setSupported('speechSynthesis' in window);return()=>{if('speechSynthesis'in window)window.speechSynthesis.cancel();};},[]);
 if(!supported)return <p className="easy-note">يمكنك استخدام قارئ الشاشة في جهازك للاستماع.</p>;
 function read(){if(speaking){window.speechSynthesis.cancel();setSpeaking(false);return;}const text=document.getElementById(targetId)?.innerText;if(!text)return;window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text);speech.lang='ar-SA';speech.rate=.85;const voice=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith('ar'));if(voice)speech.voice=voice;speech.onend=()=>setSpeaking(false);speech.onerror=()=>{setSpeaking(false);setMessage('تعذر تشغيل الصوت. جرّب قارئ الشاشة في جهازك.');};setMessage('');setSpeaking(true);window.speechSynthesis.speak(speech);}
 return <><button type="button" className="easy-audio" onClick={read}>{speaking?<Square aria-hidden="true"/>:<Volume2 aria-hidden="true"/>}{speaking?'إيقاف القراءة':'استمع إلى النص'}</button>{message&&<p role="status">{message}</p>}</>;
}
