'use client';
import {useEffect,useState} from 'react';

// Connectivity is a browser hint; online does not confirm reachability or a save.
export default function ConnectionStatus(){
 const [offline,setOffline]=useState(false);
 useEffect(()=>{const update=()=>setOffline(!navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
 return offline?<div className="portal-message error" role="alert"><strong>الاتصال بالإنترنت منقطع.</strong> احتفظ بهذه الصفحة مفتوحة لحماية المدخلات غير المرسلة. لا يُعد أي تعديل محفوظًا حتى يؤكد الخادم نجاح الحفظ بعد عودة الاتصال.</div>:null;
}
