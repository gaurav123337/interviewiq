const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./Landing-CpcNc9r4.js","./vendor-redux-_mUL87Rl.js","./Upgrade-ria4pWnd.js","./coupons-Der-8HAb.js","./analytics-C4TCHyGX.js","./vendor-react-D2Xel5Cr.js","./Onboarding-DncEqXt3.js","./Seg-C7x2Rtig.js","./Switch-hEDuh0vz.js","./Difficulty-BZtdTFDI.js","./Interview-BTcL342N.js","./ProgressBar-C--y9zgX.js","./Results-DQD0EZhv.js","./ShareView-LQGCYjhH.js","./KpNeutral-BTdlp0zO.js","./Planner-Cxo_0sbq.js","./Roadmap-CZNbzkXv.js","./systemDesignTutor-BcA-2xK6.js","./pdf-BGgnOBlj.js","./Drill-BodQ-KYb.js","./Bank-BGr7Bla_.js","./questionBank-BIvS1KS0.js","./History-DSwLr_ml.js","./EmptyState-hcmjFwSO.js","./Progress-DMa9BiEz.js","./Settings-DvoGgrIS.js","./subscriptions-B6G3uGKO.js","./Account-DSR4Ervg.js","./Playground-DToABiZY.js","./Admin-CZLihlns.js","./Team-CQ1oxguz.js","./Jobs-BdfEN--S.js","./Resources-qui8hUS-.js","./resources-CnU3linJ.js","./Counselor-0isoF4qe.js","./trendSignals-DDJ8Z-BR.js","./SkillExplorer-DCw-ZAp0.js","./skillRoadmapService-Be1yuVEG.js","./SkillDetail-CBz1W9OT.js","./SystemDesign-CwINey14.js","./systemDesignBank-DcEELOYM.js","./Legal-odqFs7-s.js"])))=>i.map(i=>d[i]);
var N0=Object.defineProperty;var wg=n=>{throw TypeError(n)};var I0=(n,i,r)=>i in n?N0(n,i,{enumerable:!0,configurable:!0,writable:!0,value:r}):n[i]=r;var en=(n,i,r)=>I0(n,typeof i!="symbol"?i+"":i,r),Qu=(n,i,r)=>i.has(n)||wg("Cannot "+r);var j=(n,i,r)=>(Qu(n,i,"read from private field"),r?r.call(n):i.get(n)),be=(n,i,r)=>i.has(n)?wg("Cannot add the same private member more than once"):i instanceof WeakSet?i.add(n):i.set(n,r),se=(n,i,r,o)=>(Qu(n,i,"write to private field"),o?o.call(n,r):i.set(n,r),r),ut=(n,i,r)=>(Qu(n,i,"access private method"),r);var Wo=(n,i,r,o)=>({set _(u){se(n,i,u,r)},get _(){return j(n,i,o)}});import{r as B0,a as B,c as Ry,b as U0,P as H0}from"./vendor-redux-_mUL87Rl.js";import{r as _y}from"./vendor-react-D2Xel5Cr.js";(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const u of document.querySelectorAll('link[rel="modulepreload"]'))o(u);new MutationObserver(u=>{for(const d of u)if(d.type==="childList")for(const p of d.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&o(p)}).observe(document,{childList:!0,subtree:!0});function r(u){const d={};return u.integrity&&(d.integrity=u.integrity),u.referrerPolicy&&(d.referrerPolicy=u.referrerPolicy),u.crossOrigin==="use-credentials"?d.credentials="include":u.crossOrigin==="anonymous"?d.credentials="omit":d.credentials="same-origin",d}function o(u){if(u.ep)return;u.ep=!0;const d=r(u);fetch(u.href,d)}})();var Ku={exports:{}},ir={};/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var kg;function P0(){if(kg)return ir;kg=1;var n=Symbol.for("react.transitional.element"),i=Symbol.for("react.fragment");function r(o,u,d){var p=null;if(d!==void 0&&(p=""+d),u.key!==void 0&&(p=""+u.key),"key"in u){d={};for(var f in u)f!=="key"&&(d[f]=u[f])}else d=u;return u=d.ref,{$$typeof:n,type:o,key:p,ref:u!==void 0?u:null,props:d}}return ir.Fragment=i,ir.jsx=r,ir.jsxs=r,ir}var xg;function G0(){return xg||(xg=1,Ku.exports=P0()),Ku.exports}var b=G0(),Fu={exports:{}},sr={},Vu={exports:{}},Ju={};/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Sg;function Y0(){return Sg||(Sg=1,(function(n){function i(A,U){var W=A.length;A.push(U);e:for(;0<W;){var me=W-1>>>1,pe=A[me];if(0<u(pe,U))A[me]=U,A[W]=pe,W=me;else break e}}function r(A){return A.length===0?null:A[0]}function o(A){if(A.length===0)return null;var U=A[0],W=A.pop();if(W!==U){A[0]=W;e:for(var me=0,pe=A.length,je=pe>>>1;me<je;){var _e=2*(me+1)-1,Se=A[_e],tt=_e+1,cn=A[tt];if(0>u(Se,W))tt<pe&&0>u(cn,Se)?(A[me]=cn,A[tt]=W,me=tt):(A[me]=Se,A[_e]=W,me=_e);else if(tt<pe&&0>u(cn,W))A[me]=cn,A[tt]=W,me=tt;else break e}}return U}function u(A,U){var W=A.sortIndex-U.sortIndex;return W!==0?W:A.id-U.id}if(n.unstable_now=void 0,typeof performance=="object"&&typeof performance.now=="function"){var d=performance;n.unstable_now=function(){return d.now()}}else{var p=Date,f=p.now();n.unstable_now=function(){return p.now()-f}}var m=[],y=[],x=1,k=null,L=3,O=!1,_=!1,T=!1,G=!1,N=typeof setTimeout=="function"?setTimeout:null,I=typeof clearTimeout=="function"?clearTimeout:null,Y=typeof setImmediate<"u"?setImmediate:null;function F(A){for(var U=r(y);U!==null;){if(U.callback===null)o(y);else if(U.startTime<=A)o(y),U.sortIndex=U.expirationTime,i(m,U);else break;U=r(y)}}function K(A){if(T=!1,F(A),!_)if(r(m)!==null)_=!0,P||(P=!0,Z());else{var U=r(y);U!==null&&Q(K,U.startTime-A)}}var P=!1,ue=-1,ae=5,ce=-1;function de(){return G?!0:!(n.unstable_now()-ce<ae)}function J(){if(G=!1,P){var A=n.unstable_now();ce=A;var U=!0;try{e:{_=!1,T&&(T=!1,I(ue),ue=-1),O=!0;var W=L;try{t:{for(F(A),k=r(m);k!==null&&!(k.expirationTime>A&&de());){var me=k.callback;if(typeof me=="function"){k.callback=null,L=k.priorityLevel;var pe=me(k.expirationTime<=A);if(A=n.unstable_now(),typeof pe=="function"){k.callback=pe,F(A),U=!0;break t}k===r(m)&&o(m),F(A)}else o(m);k=r(m)}if(k!==null)U=!0;else{var je=r(y);je!==null&&Q(K,je.startTime-A),U=!1}}break e}finally{k=null,L=W,O=!1}U=void 0}}finally{U?Z():P=!1}}}var Z;if(typeof Y=="function")Z=function(){Y(J)};else if(typeof MessageChannel<"u"){var Ne=new MessageChannel,V=Ne.port2;Ne.port1.onmessage=J,Z=function(){V.postMessage(null)}}else Z=function(){N(J,0)};function Q(A,U){ue=N(function(){A(n.unstable_now())},U)}n.unstable_IdlePriority=5,n.unstable_ImmediatePriority=1,n.unstable_LowPriority=4,n.unstable_NormalPriority=3,n.unstable_Profiling=null,n.unstable_UserBlockingPriority=2,n.unstable_cancelCallback=function(A){A.callback=null},n.unstable_forceFrameRate=function(A){0>A||125<A?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):ae=0<A?Math.floor(1e3/A):5},n.unstable_getCurrentPriorityLevel=function(){return L},n.unstable_next=function(A){switch(L){case 1:case 2:case 3:var U=3;break;default:U=L}var W=L;L=U;try{return A()}finally{L=W}},n.unstable_requestPaint=function(){G=!0},n.unstable_runWithPriority=function(A,U){switch(A){case 1:case 2:case 3:case 4:case 5:break;default:A=3}var W=L;L=A;try{return U()}finally{L=W}},n.unstable_scheduleCallback=function(A,U,W){var me=n.unstable_now();switch(typeof W=="object"&&W!==null?(W=W.delay,W=typeof W=="number"&&0<W?me+W:me):W=me,A){case 1:var pe=-1;break;case 2:pe=250;break;case 5:pe=1073741823;break;case 4:pe=1e4;break;default:pe=5e3}return pe=W+pe,A={id:x++,callback:U,priorityLevel:A,startTime:W,expirationTime:pe,sortIndex:-1},W>me?(A.sortIndex=W,i(y,A),r(m)===null&&A===r(y)&&(T?(I(ue),ue=-1):T=!0,Q(K,W-me))):(A.sortIndex=pe,i(m,A),_||O||(_=!0,P||(P=!0,Z()))),A},n.unstable_shouldYield=de,n.unstable_wrapCallback=function(A){var U=L;return function(){var W=L;L=U;try{return A.apply(this,arguments)}finally{L=W}}}})(Ju)),Ju}var Tg;function Q0(){return Tg||(Tg=1,Vu.exports=Y0()),Vu.exports}/**
 * @license React
 * react-dom-client.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Ag;function K0(){if(Ag)return sr;Ag=1;var n=Q0(),i=B0(),r=_y();function o(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var a=2;a<arguments.length;a++)t+="&args[]="+encodeURIComponent(arguments[a])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function u(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function d(e){var t=e,a=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(a=t.return),e=t.return;while(e)}return t.tag===3?a:null}function p(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function f(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function m(e){if(d(e)!==e)throw Error(o(188))}function y(e){var t=e.alternate;if(!t){if(t=d(e),t===null)throw Error(o(188));return t!==e?null:e}for(var a=e,s=t;;){var l=a.return;if(l===null)break;var c=l.alternate;if(c===null){if(s=l.return,s!==null){a=s;continue}break}if(l.child===c.child){for(c=l.child;c;){if(c===a)return m(l),e;if(c===s)return m(l),t;c=c.sibling}throw Error(o(188))}if(a.return!==s.return)a=l,s=c;else{for(var h=!1,g=l.child;g;){if(g===a){h=!0,a=l,s=c;break}if(g===s){h=!0,s=l,a=c;break}g=g.sibling}if(!h){for(g=c.child;g;){if(g===a){h=!0,a=c,s=l;break}if(g===s){h=!0,s=c,a=l;break}g=g.sibling}if(!h)throw Error(o(189))}}if(a.alternate!==s)throw Error(o(190))}if(a.tag!==3)throw Error(o(188));return a.stateNode.current===a?e:t}function x(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=x(e),t!==null)return t;e=e.sibling}return null}var k=Object.assign,L=Symbol.for("react.element"),O=Symbol.for("react.transitional.element"),_=Symbol.for("react.portal"),T=Symbol.for("react.fragment"),G=Symbol.for("react.strict_mode"),N=Symbol.for("react.profiler"),I=Symbol.for("react.consumer"),Y=Symbol.for("react.context"),F=Symbol.for("react.forward_ref"),K=Symbol.for("react.suspense"),P=Symbol.for("react.suspense_list"),ue=Symbol.for("react.memo"),ae=Symbol.for("react.lazy"),ce=Symbol.for("react.activity"),de=Symbol.for("react.memo_cache_sentinel"),J=Symbol.iterator;function Z(e){return e===null||typeof e!="object"?null:(e=J&&e[J]||e["@@iterator"],typeof e=="function"?e:null)}var Ne=Symbol.for("react.client.reference");function V(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===Ne?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case T:return"Fragment";case N:return"Profiler";case G:return"StrictMode";case K:return"Suspense";case P:return"SuspenseList";case ce:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case _:return"Portal";case Y:return e.displayName||"Context";case I:return(e._context.displayName||"Context")+".Consumer";case F:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case ue:return t=e.displayName||null,t!==null?t:V(e.type)||"Memo";case ae:t=e._payload,e=e._init;try{return V(e(t))}catch{}}return null}var Q=Array.isArray,A=i.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,U=r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,W={pending:!1,data:null,method:null,action:null},me=[],pe=-1;function je(e){return{current:e}}function _e(e){0>pe||(e.current=me[pe],me[pe]=null,pe--)}function Se(e,t){pe++,me[pe]=e.current,e.current=t}var tt=je(null),cn=je(null),Gn=je(null),Lr=je(null);function Dr(e,t){switch(Se(Gn,t),Se(cn,e),Se(tt,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?Gm(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=Gm(t),e=Ym(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}_e(tt),Se(tt,e)}function ii(){_e(tt),_e(cn),_e(Gn)}function ql(e){e.memoizedState!==null&&Se(Lr,e);var t=tt.current,a=Ym(t,e.type);t!==a&&(Se(cn,e),Se(tt,a))}function Or(e){cn.current===e&&(_e(tt),_e(cn)),Lr.current===e&&(_e(Lr),er._currentValue=W)}var El,bp;function Aa(e){if(El===void 0)try{throw Error()}catch(a){var t=a.stack.trim().match(/\n( *(at )?)/);El=t&&t[1]||"",bp=-1<a.stack.indexOf(`
    at`)?" (<anonymous>)":-1<a.stack.indexOf("@")?"@unknown:0:0":""}return`
`+El+e+bp}var Cl=!1;function Ll(e,t){if(!e||Cl)return"";Cl=!0;var a=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var s={DetermineComponentFrameRoot:function(){try{if(t){var R=function(){throw Error()};if(Object.defineProperty(R.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(R,[])}catch(D){var C=D}Reflect.construct(e,[],R)}else{try{R.call()}catch(D){C=D}e.call(R.prototype)}}else{try{throw Error()}catch(D){C=D}(R=e())&&typeof R.catch=="function"&&R.catch(function(){})}}catch(D){if(D&&C&&typeof D.stack=="string")return[D.stack,C.stack]}return[null,null]}};s.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var l=Object.getOwnPropertyDescriptor(s.DetermineComponentFrameRoot,"name");l&&l.configurable&&Object.defineProperty(s.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var c=s.DetermineComponentFrameRoot(),h=c[0],g=c[1];if(h&&g){var v=h.split(`
`),E=g.split(`
`);for(l=s=0;s<v.length&&!v[s].includes("DetermineComponentFrameRoot");)s++;for(;l<E.length&&!E[l].includes("DetermineComponentFrameRoot");)l++;if(s===v.length||l===E.length)for(s=v.length-1,l=E.length-1;1<=s&&0<=l&&v[s]!==E[l];)l--;for(;1<=s&&0<=l;s--,l--)if(v[s]!==E[l]){if(s!==1||l!==1)do if(s--,l--,0>l||v[s]!==E[l]){var z=`
`+v[s].replace(" at new "," at ");return e.displayName&&z.includes("<anonymous>")&&(z=z.replace("<anonymous>",e.displayName)),z}while(1<=s&&0<=l);break}}}finally{Cl=!1,Error.prepareStackTrace=a}return(a=e?e.displayName||e.name:"")?Aa(a):""}function fv(e,t){switch(e.tag){case 26:case 27:case 5:return Aa(e.type);case 16:return Aa("Lazy");case 13:return e.child!==t&&t!==null?Aa("Suspense Fallback"):Aa("Suspense");case 19:return Aa("SuspenseList");case 0:case 15:return Ll(e.type,!1);case 11:return Ll(e.type.render,!1);case 1:return Ll(e.type,!0);case 31:return Aa("Activity");default:return""}}function vp(e){try{var t="",a=null;do t+=fv(e,a),a=e,e=e.return;while(e);return t}catch(s){return`
Error generating stack: `+s.message+`
`+s.stack}}var Dl=Object.prototype.hasOwnProperty,Ol=n.unstable_scheduleCallback,zl=n.unstable_cancelCallback,mv=n.unstable_shouldYield,gv=n.unstable_requestPaint,qt=n.unstable_now,yv=n.unstable_getCurrentPriorityLevel,wp=n.unstable_ImmediatePriority,kp=n.unstable_UserBlockingPriority,zr=n.unstable_NormalPriority,bv=n.unstable_LowPriority,xp=n.unstable_IdlePriority,vv=n.log,wv=n.unstable_setDisableYieldValue,ps=null,Et=null;function Yn(e){if(typeof vv=="function"&&wv(e),Et&&typeof Et.setStrictMode=="function")try{Et.setStrictMode(ps,e)}catch{}}var Ct=Math.clz32?Math.clz32:Sv,kv=Math.log,xv=Math.LN2;function Sv(e){return e>>>=0,e===0?32:31-(kv(e)/xv|0)|0}var jr=256,Mr=262144,Rr=4194304;function qa(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function _r(e,t,a){var s=e.pendingLanes;if(s===0)return 0;var l=0,c=e.suspendedLanes,h=e.pingedLanes;e=e.warmLanes;var g=s&134217727;return g!==0?(s=g&~c,s!==0?l=qa(s):(h&=g,h!==0?l=qa(h):a||(a=g&~e,a!==0&&(l=qa(a))))):(g=s&~c,g!==0?l=qa(g):h!==0?l=qa(h):a||(a=s&~e,a!==0&&(l=qa(a)))),l===0?0:t!==0&&t!==l&&(t&c)===0&&(c=l&-l,a=t&-t,c>=a||c===32&&(a&4194048)!==0)?t:l}function hs(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function Tv(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Sp(){var e=Rr;return Rr<<=1,(Rr&62914560)===0&&(Rr=4194304),e}function jl(e){for(var t=[],a=0;31>a;a++)t.push(e);return t}function fs(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function Av(e,t,a,s,l,c){var h=e.pendingLanes;e.pendingLanes=a,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=a,e.entangledLanes&=a,e.errorRecoveryDisabledLanes&=a,e.shellSuspendCounter=0;var g=e.entanglements,v=e.expirationTimes,E=e.hiddenUpdates;for(a=h&~a;0<a;){var z=31-Ct(a),R=1<<z;g[z]=0,v[z]=-1;var C=E[z];if(C!==null)for(E[z]=null,z=0;z<C.length;z++){var D=C[z];D!==null&&(D.lane&=-536870913)}a&=~R}s!==0&&Tp(e,s,0),c!==0&&l===0&&e.tag!==0&&(e.suspendedLanes|=c&~(h&~t))}function Tp(e,t,a){e.pendingLanes|=t,e.suspendedLanes&=~t;var s=31-Ct(t);e.entangledLanes|=t,e.entanglements[s]=e.entanglements[s]|1073741824|a&261930}function Ap(e,t){var a=e.entangledLanes|=t;for(e=e.entanglements;a;){var s=31-Ct(a),l=1<<s;l&t|e[s]&t&&(e[s]|=t),a&=~l}}function qp(e,t){var a=t&-t;return a=(a&42)!==0?1:Ml(a),(a&(e.suspendedLanes|t))!==0?0:a}function Ml(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function Rl(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function Ep(){var e=U.p;return e!==0?e:(e=window.event,e===void 0?32:hg(e.type))}function Cp(e,t){var a=U.p;try{return U.p=e,t()}finally{U.p=a}}var Qn=Math.random().toString(36).slice(2),st="__reactFiber$"+Qn,gt="__reactProps$"+Qn,si="__reactContainer$"+Qn,_l="__reactEvents$"+Qn,qv="__reactListeners$"+Qn,Ev="__reactHandles$"+Qn,Lp="__reactResources$"+Qn,ms="__reactMarker$"+Qn;function Nl(e){delete e[st],delete e[gt],delete e[_l],delete e[qv],delete e[Ev]}function ri(e){var t=e[st];if(t)return t;for(var a=e.parentNode;a;){if(t=a[si]||a[st]){if(a=t.alternate,t.child!==null||a!==null&&a.child!==null)for(e=$m(e);e!==null;){if(a=e[st])return a;e=$m(e)}return t}e=a,a=e.parentNode}return null}function oi(e){if(e=e[st]||e[si]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function gs(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(o(33))}function li(e){var t=e[Lp];return t||(t=e[Lp]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function nt(e){e[ms]=!0}var Dp=new Set,Op={};function Ea(e,t){ci(e,t),ci(e+"Capture",t)}function ci(e,t){for(Op[e]=t,e=0;e<t.length;e++)Dp.add(t[e])}var Cv=RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"),zp={},jp={};function Lv(e){return Dl.call(jp,e)?!0:Dl.call(zp,e)?!1:Cv.test(e)?jp[e]=!0:(zp[e]=!0,!1)}function Nr(e,t,a){if(Lv(t))if(a===null)e.removeAttribute(t);else{switch(typeof a){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var s=t.toLowerCase().slice(0,5);if(s!=="data-"&&s!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+a)}}function Ir(e,t,a){if(a===null)e.removeAttribute(t);else{switch(typeof a){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+a)}}function wn(e,t,a,s){if(s===null)e.removeAttribute(a);else{switch(typeof s){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(a);return}e.setAttributeNS(t,a,""+s)}}function Bt(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function Mp(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function Dv(e,t,a){var s=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof s<"u"&&typeof s.get=="function"&&typeof s.set=="function"){var l=s.get,c=s.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return l.call(this)},set:function(h){a=""+h,c.call(this,h)}}),Object.defineProperty(e,t,{enumerable:s.enumerable}),{getValue:function(){return a},setValue:function(h){a=""+h},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Il(e){if(!e._valueTracker){var t=Mp(e)?"checked":"value";e._valueTracker=Dv(e,t,""+e[t])}}function Rp(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var a=t.getValue(),s="";return e&&(s=Mp(e)?e.checked?"true":"false":e.value),e=s,e!==a?(t.setValue(e),!0):!1}function Br(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var Ov=/[\n"\\]/g;function Ut(e){return e.replace(Ov,function(t){return"\\"+t.charCodeAt(0).toString(16)+" "})}function Bl(e,t,a,s,l,c,h,g){e.name="",h!=null&&typeof h!="function"&&typeof h!="symbol"&&typeof h!="boolean"?e.type=h:e.removeAttribute("type"),t!=null?h==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+Bt(t)):e.value!==""+Bt(t)&&(e.value=""+Bt(t)):h!=="submit"&&h!=="reset"||e.removeAttribute("value"),t!=null?Ul(e,h,Bt(t)):a!=null?Ul(e,h,Bt(a)):s!=null&&e.removeAttribute("value"),l==null&&c!=null&&(e.defaultChecked=!!c),l!=null&&(e.checked=l&&typeof l!="function"&&typeof l!="symbol"),g!=null&&typeof g!="function"&&typeof g!="symbol"&&typeof g!="boolean"?e.name=""+Bt(g):e.removeAttribute("name")}function _p(e,t,a,s,l,c,h,g){if(c!=null&&typeof c!="function"&&typeof c!="symbol"&&typeof c!="boolean"&&(e.type=c),t!=null||a!=null){if(!(c!=="submit"&&c!=="reset"||t!=null)){Il(e);return}a=a!=null?""+Bt(a):"",t=t!=null?""+Bt(t):a,g||t===e.value||(e.value=t),e.defaultValue=t}s=s??l,s=typeof s!="function"&&typeof s!="symbol"&&!!s,e.checked=g?e.checked:!!s,e.defaultChecked=!!s,h!=null&&typeof h!="function"&&typeof h!="symbol"&&typeof h!="boolean"&&(e.name=h),Il(e)}function Ul(e,t,a){t==="number"&&Br(e.ownerDocument)===e||e.defaultValue===""+a||(e.defaultValue=""+a)}function ui(e,t,a,s){if(e=e.options,t){t={};for(var l=0;l<a.length;l++)t["$"+a[l]]=!0;for(a=0;a<e.length;a++)l=t.hasOwnProperty("$"+e[a].value),e[a].selected!==l&&(e[a].selected=l),l&&s&&(e[a].defaultSelected=!0)}else{for(a=""+Bt(a),t=null,l=0;l<e.length;l++){if(e[l].value===a){e[l].selected=!0,s&&(e[l].defaultSelected=!0);return}t!==null||e[l].disabled||(t=e[l])}t!==null&&(t.selected=!0)}}function Np(e,t,a){if(t!=null&&(t=""+Bt(t),t!==e.value&&(e.value=t),a==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=a!=null?""+Bt(a):""}function Ip(e,t,a,s){if(t==null){if(s!=null){if(a!=null)throw Error(o(92));if(Q(s)){if(1<s.length)throw Error(o(93));s=s[0]}a=s}a==null&&(a=""),t=a}a=Bt(t),e.defaultValue=a,s=e.textContent,s===a&&s!==""&&s!==null&&(e.value=s),Il(e)}function di(e,t){if(t){var a=e.firstChild;if(a&&a===e.lastChild&&a.nodeType===3){a.nodeValue=t;return}}e.textContent=t}var zv=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function Bp(e,t,a){var s=t.indexOf("--")===0;a==null||typeof a=="boolean"||a===""?s?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":s?e.setProperty(t,a):typeof a!="number"||a===0||zv.has(t)?t==="float"?e.cssFloat=a:e[t]=(""+a).trim():e[t]=a+"px"}function Up(e,t,a){if(t!=null&&typeof t!="object")throw Error(o(62));if(e=e.style,a!=null){for(var s in a)!a.hasOwnProperty(s)||t!=null&&t.hasOwnProperty(s)||(s.indexOf("--")===0?e.setProperty(s,""):s==="float"?e.cssFloat="":e[s]="");for(var l in t)s=t[l],t.hasOwnProperty(l)&&a[l]!==s&&Bp(e,l,s)}else for(var c in t)t.hasOwnProperty(c)&&Bp(e,c,t[c])}function Hl(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var jv=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),Mv=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function Ur(e){return Mv.test(""+e)?"javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')":e}function kn(){}var Pl=null;function Gl(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var pi=null,hi=null;function Hp(e){var t=oi(e);if(t&&(e=t.stateNode)){var a=e[gt]||null;e:switch(e=t.stateNode,t.type){case"input":if(Bl(e,a.value,a.defaultValue,a.defaultValue,a.checked,a.defaultChecked,a.type,a.name),t=a.name,a.type==="radio"&&t!=null){for(a=e;a.parentNode;)a=a.parentNode;for(a=a.querySelectorAll('input[name="'+Ut(""+t)+'"][type="radio"]'),t=0;t<a.length;t++){var s=a[t];if(s!==e&&s.form===e.form){var l=s[gt]||null;if(!l)throw Error(o(90));Bl(s,l.value,l.defaultValue,l.defaultValue,l.checked,l.defaultChecked,l.type,l.name)}}for(t=0;t<a.length;t++)s=a[t],s.form===e.form&&Rp(s)}break e;case"textarea":Np(e,a.value,a.defaultValue);break e;case"select":t=a.value,t!=null&&ui(e,!!a.multiple,t,!1)}}}var Yl=!1;function Pp(e,t,a){if(Yl)return e(t,a);Yl=!0;try{var s=e(t);return s}finally{if(Yl=!1,(pi!==null||hi!==null)&&(Co(),pi&&(t=pi,e=hi,hi=pi=null,Hp(t),e)))for(t=0;t<e.length;t++)Hp(e[t])}}function ys(e,t){var a=e.stateNode;if(a===null)return null;var s=a[gt]||null;if(s===null)return null;a=s[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(s=!s.disabled)||(e=e.type,s=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!s;break e;default:e=!1}if(e)return null;if(a&&typeof a!="function")throw Error(o(231,t,typeof a));return a}var xn=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Ql=!1;if(xn)try{var bs={};Object.defineProperty(bs,"passive",{get:function(){Ql=!0}}),window.addEventListener("test",bs,bs),window.removeEventListener("test",bs,bs)}catch{Ql=!1}var Kn=null,Kl=null,Hr=null;function Gp(){if(Hr)return Hr;var e,t=Kl,a=t.length,s,l="value"in Kn?Kn.value:Kn.textContent,c=l.length;for(e=0;e<a&&t[e]===l[e];e++);var h=a-e;for(s=1;s<=h&&t[a-s]===l[c-s];s++);return Hr=l.slice(e,1<s?1-s:void 0)}function Pr(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Gr(){return!0}function Yp(){return!1}function yt(e){function t(a,s,l,c,h){this._reactName=a,this._targetInst=l,this.type=s,this.nativeEvent=c,this.target=h,this.currentTarget=null;for(var g in e)e.hasOwnProperty(g)&&(a=e[g],this[g]=a?a(c):c[g]);return this.isDefaultPrevented=(c.defaultPrevented!=null?c.defaultPrevented:c.returnValue===!1)?Gr:Yp,this.isPropagationStopped=Yp,this}return k(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var a=this.nativeEvent;a&&(a.preventDefault?a.preventDefault():typeof a.returnValue!="unknown"&&(a.returnValue=!1),this.isDefaultPrevented=Gr)},stopPropagation:function(){var a=this.nativeEvent;a&&(a.stopPropagation?a.stopPropagation():typeof a.cancelBubble!="unknown"&&(a.cancelBubble=!0),this.isPropagationStopped=Gr)},persist:function(){},isPersistent:Gr}),t}var Ca={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Yr=yt(Ca),vs=k({},Ca,{view:0,detail:0}),Rv=yt(vs),Fl,Vl,ws,Qr=k({},vs,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Wl,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==ws&&(ws&&e.type==="mousemove"?(Fl=e.screenX-ws.screenX,Vl=e.screenY-ws.screenY):Vl=Fl=0,ws=e),Fl)},movementY:function(e){return"movementY"in e?e.movementY:Vl}}),Qp=yt(Qr),_v=k({},Qr,{dataTransfer:0}),Nv=yt(_v),Iv=k({},vs,{relatedTarget:0}),Jl=yt(Iv),Bv=k({},Ca,{animationName:0,elapsedTime:0,pseudoElement:0}),Uv=yt(Bv),Hv=k({},Ca,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),Pv=yt(Hv),Gv=k({},Ca,{data:0}),Kp=yt(Gv),Yv={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Qv={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},Kv={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Fv(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=Kv[e])?!!t[e]:!1}function Wl(){return Fv}var Vv=k({},vs,{key:function(e){if(e.key){var t=Yv[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=Pr(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?Qv[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Wl,charCode:function(e){return e.type==="keypress"?Pr(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Pr(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),Jv=yt(Vv),Wv=k({},Qr,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),Fp=yt(Wv),$v=k({},vs,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Wl}),Xv=yt($v),Zv=k({},Ca,{propertyName:0,elapsedTime:0,pseudoElement:0}),ew=yt(Zv),tw=k({},Qr,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),nw=yt(tw),aw=k({},Ca,{newState:0,oldState:0}),iw=yt(aw),sw=[9,13,27,32],$l=xn&&"CompositionEvent"in window,ks=null;xn&&"documentMode"in document&&(ks=document.documentMode);var rw=xn&&"TextEvent"in window&&!ks,Vp=xn&&(!$l||ks&&8<ks&&11>=ks),Jp=" ",Wp=!1;function $p(e,t){switch(e){case"keyup":return sw.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function Xp(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var fi=!1;function ow(e,t){switch(e){case"compositionend":return Xp(t);case"keypress":return t.which!==32?null:(Wp=!0,Jp);case"textInput":return e=t.data,e===Jp&&Wp?null:e;default:return null}}function lw(e,t){if(fi)return e==="compositionend"||!$l&&$p(e,t)?(e=Gp(),Hr=Kl=Kn=null,fi=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return Vp&&t.locale!=="ko"?null:t.data;default:return null}}var cw={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Zp(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!cw[e.type]:t==="textarea"}function eh(e,t,a,s){pi?hi?hi.push(s):hi=[s]:pi=s,t=Ro(t,"onChange"),0<t.length&&(a=new Yr("onChange","change",null,a,s),e.push({event:a,listeners:t}))}var xs=null,Ss=null;function uw(e){Nm(e,0)}function Kr(e){var t=gs(e);if(Rp(t))return e}function th(e,t){if(e==="change")return t}var nh=!1;if(xn){var Xl;if(xn){var Zl="oninput"in document;if(!Zl){var ah=document.createElement("div");ah.setAttribute("oninput","return;"),Zl=typeof ah.oninput=="function"}Xl=Zl}else Xl=!1;nh=Xl&&(!document.documentMode||9<document.documentMode)}function ih(){xs&&(xs.detachEvent("onpropertychange",sh),Ss=xs=null)}function sh(e){if(e.propertyName==="value"&&Kr(Ss)){var t=[];eh(t,Ss,e,Gl(e)),Pp(uw,t)}}function dw(e,t,a){e==="focusin"?(ih(),xs=t,Ss=a,xs.attachEvent("onpropertychange",sh)):e==="focusout"&&ih()}function pw(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return Kr(Ss)}function hw(e,t){if(e==="click")return Kr(t)}function fw(e,t){if(e==="input"||e==="change")return Kr(t)}function mw(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Lt=typeof Object.is=="function"?Object.is:mw;function Ts(e,t){if(Lt(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var a=Object.keys(e),s=Object.keys(t);if(a.length!==s.length)return!1;for(s=0;s<a.length;s++){var l=a[s];if(!Dl.call(t,l)||!Lt(e[l],t[l]))return!1}return!0}function rh(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function oh(e,t){var a=rh(e);e=0;for(var s;a;){if(a.nodeType===3){if(s=e+a.textContent.length,e<=t&&s>=t)return{node:a,offset:t-e};e=s}e:{for(;a;){if(a.nextSibling){a=a.nextSibling;break e}a=a.parentNode}a=void 0}a=rh(a)}}function lh(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?lh(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function ch(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=Br(e.document);t instanceof e.HTMLIFrameElement;){try{var a=typeof t.contentWindow.location.href=="string"}catch{a=!1}if(a)e=t.contentWindow;else break;t=Br(e.document)}return t}function ec(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var gw=xn&&"documentMode"in document&&11>=document.documentMode,mi=null,tc=null,As=null,nc=!1;function uh(e,t,a){var s=a.window===a?a.document:a.nodeType===9?a:a.ownerDocument;nc||mi==null||mi!==Br(s)||(s=mi,"selectionStart"in s&&ec(s)?s={start:s.selectionStart,end:s.selectionEnd}:(s=(s.ownerDocument&&s.ownerDocument.defaultView||window).getSelection(),s={anchorNode:s.anchorNode,anchorOffset:s.anchorOffset,focusNode:s.focusNode,focusOffset:s.focusOffset}),As&&Ts(As,s)||(As=s,s=Ro(tc,"onSelect"),0<s.length&&(t=new Yr("onSelect","select",null,t,a),e.push({event:t,listeners:s}),t.target=mi)))}function La(e,t){var a={};return a[e.toLowerCase()]=t.toLowerCase(),a["Webkit"+e]="webkit"+t,a["Moz"+e]="moz"+t,a}var gi={animationend:La("Animation","AnimationEnd"),animationiteration:La("Animation","AnimationIteration"),animationstart:La("Animation","AnimationStart"),transitionrun:La("Transition","TransitionRun"),transitionstart:La("Transition","TransitionStart"),transitioncancel:La("Transition","TransitionCancel"),transitionend:La("Transition","TransitionEnd")},ac={},dh={};xn&&(dh=document.createElement("div").style,"AnimationEvent"in window||(delete gi.animationend.animation,delete gi.animationiteration.animation,delete gi.animationstart.animation),"TransitionEvent"in window||delete gi.transitionend.transition);function Da(e){if(ac[e])return ac[e];if(!gi[e])return e;var t=gi[e],a;for(a in t)if(t.hasOwnProperty(a)&&a in dh)return ac[e]=t[a];return e}var ph=Da("animationend"),hh=Da("animationiteration"),fh=Da("animationstart"),yw=Da("transitionrun"),bw=Da("transitionstart"),vw=Da("transitioncancel"),mh=Da("transitionend"),gh=new Map,ic="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");ic.push("scrollEnd");function $t(e,t){gh.set(e,t),Ea(t,[e])}var Fr=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},Ht=[],yi=0,sc=0;function Vr(){for(var e=yi,t=sc=yi=0;t<e;){var a=Ht[t];Ht[t++]=null;var s=Ht[t];Ht[t++]=null;var l=Ht[t];Ht[t++]=null;var c=Ht[t];if(Ht[t++]=null,s!==null&&l!==null){var h=s.pending;h===null?l.next=l:(l.next=h.next,h.next=l),s.pending=l}c!==0&&yh(a,l,c)}}function Jr(e,t,a,s){Ht[yi++]=e,Ht[yi++]=t,Ht[yi++]=a,Ht[yi++]=s,sc|=s,e.lanes|=s,e=e.alternate,e!==null&&(e.lanes|=s)}function rc(e,t,a,s){return Jr(e,t,a,s),Wr(e)}function Oa(e,t){return Jr(e,null,null,t),Wr(e)}function yh(e,t,a){e.lanes|=a;var s=e.alternate;s!==null&&(s.lanes|=a);for(var l=!1,c=e.return;c!==null;)c.childLanes|=a,s=c.alternate,s!==null&&(s.childLanes|=a),c.tag===22&&(e=c.stateNode,e===null||e._visibility&1||(l=!0)),e=c,c=c.return;return e.tag===3?(c=e.stateNode,l&&t!==null&&(l=31-Ct(a),e=c.hiddenUpdates,s=e[l],s===null?e[l]=[t]:s.push(t),t.lane=a|536870912),c):null}function Wr(e){if(50<Fs)throw Fs=0,mu=null,Error(o(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var bi={};function ww(e,t,a,s){this.tag=e,this.key=a,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=s,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Dt(e,t,a,s){return new ww(e,t,a,s)}function oc(e){return e=e.prototype,!(!e||!e.isReactComponent)}function Sn(e,t){var a=e.alternate;return a===null?(a=Dt(e.tag,t,e.key,e.mode),a.elementType=e.elementType,a.type=e.type,a.stateNode=e.stateNode,a.alternate=e,e.alternate=a):(a.pendingProps=t,a.type=e.type,a.flags=0,a.subtreeFlags=0,a.deletions=null),a.flags=e.flags&65011712,a.childLanes=e.childLanes,a.lanes=e.lanes,a.child=e.child,a.memoizedProps=e.memoizedProps,a.memoizedState=e.memoizedState,a.updateQueue=e.updateQueue,t=e.dependencies,a.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},a.sibling=e.sibling,a.index=e.index,a.ref=e.ref,a.refCleanup=e.refCleanup,a}function bh(e,t){e.flags&=65011714;var a=e.alternate;return a===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=a.childLanes,e.lanes=a.lanes,e.child=a.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=a.memoizedProps,e.memoizedState=a.memoizedState,e.updateQueue=a.updateQueue,e.type=a.type,t=a.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function $r(e,t,a,s,l,c){var h=0;if(s=e,typeof e=="function")oc(e)&&(h=1);else if(typeof e=="string")h=A0(e,a,tt.current)?26:e==="html"||e==="head"||e==="body"?27:5;else e:switch(e){case ce:return e=Dt(31,a,t,l),e.elementType=ce,e.lanes=c,e;case T:return za(a.children,l,c,t);case G:h=8,l|=24;break;case N:return e=Dt(12,a,t,l|2),e.elementType=N,e.lanes=c,e;case K:return e=Dt(13,a,t,l),e.elementType=K,e.lanes=c,e;case P:return e=Dt(19,a,t,l),e.elementType=P,e.lanes=c,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case Y:h=10;break e;case I:h=9;break e;case F:h=11;break e;case ue:h=14;break e;case ae:h=16,s=null;break e}h=29,a=Error(o(130,e===null?"null":typeof e,"")),s=null}return t=Dt(h,a,t,l),t.elementType=e,t.type=s,t.lanes=c,t}function za(e,t,a,s){return e=Dt(7,e,s,t),e.lanes=a,e}function lc(e,t,a){return e=Dt(6,e,null,t),e.lanes=a,e}function vh(e){var t=Dt(18,null,null,0);return t.stateNode=e,t}function cc(e,t,a){return t=Dt(4,e.children!==null?e.children:[],e.key,t),t.lanes=a,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var wh=new WeakMap;function Pt(e,t){if(typeof e=="object"&&e!==null){var a=wh.get(e);return a!==void 0?a:(t={value:e,source:t,stack:vp(t)},wh.set(e,t),t)}return{value:e,source:t,stack:vp(t)}}var vi=[],wi=0,Xr=null,qs=0,Gt=[],Yt=0,Fn=null,un=1,dn="";function Tn(e,t){vi[wi++]=qs,vi[wi++]=Xr,Xr=e,qs=t}function kh(e,t,a){Gt[Yt++]=un,Gt[Yt++]=dn,Gt[Yt++]=Fn,Fn=e;var s=un;e=dn;var l=32-Ct(s)-1;s&=~(1<<l),a+=1;var c=32-Ct(t)+l;if(30<c){var h=l-l%5;c=(s&(1<<h)-1).toString(32),s>>=h,l-=h,un=1<<32-Ct(t)+l|a<<l|s,dn=c+e}else un=1<<c|a<<l|s,dn=e}function uc(e){e.return!==null&&(Tn(e,1),kh(e,1,0))}function dc(e){for(;e===Xr;)Xr=vi[--wi],vi[wi]=null,qs=vi[--wi],vi[wi]=null;for(;e===Fn;)Fn=Gt[--Yt],Gt[Yt]=null,dn=Gt[--Yt],Gt[Yt]=null,un=Gt[--Yt],Gt[Yt]=null}function xh(e,t){Gt[Yt++]=un,Gt[Yt++]=dn,Gt[Yt++]=Fn,un=t.id,dn=t.overflow,Fn=e}var rt=null,De=null,ve=!1,Vn=null,Qt=!1,pc=Error(o(519));function Jn(e){var t=Error(o(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw Es(Pt(t,e)),pc}function Sh(e){var t=e.stateNode,a=e.type,s=e.memoizedProps;switch(t[st]=e,t[gt]=s,a){case"dialog":fe("cancel",t),fe("close",t);break;case"iframe":case"object":case"embed":fe("load",t);break;case"video":case"audio":for(a=0;a<Js.length;a++)fe(Js[a],t);break;case"source":fe("error",t);break;case"img":case"image":case"link":fe("error",t),fe("load",t);break;case"details":fe("toggle",t);break;case"input":fe("invalid",t),_p(t,s.value,s.defaultValue,s.checked,s.defaultChecked,s.type,s.name,!0);break;case"select":fe("invalid",t);break;case"textarea":fe("invalid",t),Ip(t,s.value,s.defaultValue,s.children)}a=s.children,typeof a!="string"&&typeof a!="number"&&typeof a!="bigint"||t.textContent===""+a||s.suppressHydrationWarning===!0||Hm(t.textContent,a)?(s.popover!=null&&(fe("beforetoggle",t),fe("toggle",t)),s.onScroll!=null&&fe("scroll",t),s.onScrollEnd!=null&&fe("scrollend",t),s.onClick!=null&&(t.onclick=kn),t=!0):t=!1,t||Jn(e,!0)}function Th(e){for(rt=e.return;rt;)switch(rt.tag){case 5:case 31:case 13:Qt=!1;return;case 27:case 3:Qt=!0;return;default:rt=rt.return}}function ki(e){if(e!==rt)return!1;if(!ve)return Th(e),ve=!0,!1;var t=e.tag,a;if((a=t!==3&&t!==27)&&((a=t===5)&&(a=e.type,a=!(a!=="form"&&a!=="button")||Du(e.type,e.memoizedProps)),a=!a),a&&De&&Jn(e),Th(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(o(317));De=Wm(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(o(317));De=Wm(e)}else t===27?(t=De,ca(e.type)?(e=Ru,Ru=null,De=e):De=t):De=rt?Ft(e.stateNode.nextSibling):null;return!0}function ja(){De=rt=null,ve=!1}function hc(){var e=Vn;return e!==null&&(kt===null?kt=e:kt.push.apply(kt,e),Vn=null),e}function Es(e){Vn===null?Vn=[e]:Vn.push(e)}var fc=je(null),Ma=null,An=null;function Wn(e,t,a){Se(fc,t._currentValue),t._currentValue=a}function qn(e){e._currentValue=fc.current,_e(fc)}function mc(e,t,a){for(;e!==null;){var s=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,s!==null&&(s.childLanes|=t)):s!==null&&(s.childLanes&t)!==t&&(s.childLanes|=t),e===a)break;e=e.return}}function gc(e,t,a,s){var l=e.child;for(l!==null&&(l.return=e);l!==null;){var c=l.dependencies;if(c!==null){var h=l.child;c=c.firstContext;e:for(;c!==null;){var g=c;c=l;for(var v=0;v<t.length;v++)if(g.context===t[v]){c.lanes|=a,g=c.alternate,g!==null&&(g.lanes|=a),mc(c.return,a,e),s||(h=null);break e}c=g.next}}else if(l.tag===18){if(h=l.return,h===null)throw Error(o(341));h.lanes|=a,c=h.alternate,c!==null&&(c.lanes|=a),mc(h,a,e),h=null}else h=l.child;if(h!==null)h.return=l;else for(h=l;h!==null;){if(h===e){h=null;break}if(l=h.sibling,l!==null){l.return=h.return,h=l;break}h=h.return}l=h}}function xi(e,t,a,s){e=null;for(var l=t,c=!1;l!==null;){if(!c){if((l.flags&524288)!==0)c=!0;else if((l.flags&262144)!==0)break}if(l.tag===10){var h=l.alternate;if(h===null)throw Error(o(387));if(h=h.memoizedProps,h!==null){var g=l.type;Lt(l.pendingProps.value,h.value)||(e!==null?e.push(g):e=[g])}}else if(l===Lr.current){if(h=l.alternate,h===null)throw Error(o(387));h.memoizedState.memoizedState!==l.memoizedState.memoizedState&&(e!==null?e.push(er):e=[er])}l=l.return}e!==null&&gc(t,e,a,s),t.flags|=262144}function Zr(e){for(e=e.firstContext;e!==null;){if(!Lt(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function Ra(e){Ma=e,An=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function ot(e){return Ah(Ma,e)}function eo(e,t){return Ma===null&&Ra(e),Ah(e,t)}function Ah(e,t){var a=t._currentValue;if(t={context:t,memoizedValue:a,next:null},An===null){if(e===null)throw Error(o(308));An=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else An=An.next=t;return a}var kw=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(a,s){e.push(s)}};this.abort=function(){t.aborted=!0,e.forEach(function(a){return a()})}},xw=n.unstable_scheduleCallback,Sw=n.unstable_NormalPriority,Ge={$$typeof:Y,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function yc(){return{controller:new kw,data:new Map,refCount:0}}function Cs(e){e.refCount--,e.refCount===0&&xw(Sw,function(){e.controller.abort()})}var Ls=null,bc=0,Si=0,Ti=null;function Tw(e,t){if(Ls===null){var a=Ls=[];bc=0,Si=ku(),Ti={status:"pending",value:void 0,then:function(s){a.push(s)}}}return bc++,t.then(qh,qh),t}function qh(){if(--bc===0&&Ls!==null){Ti!==null&&(Ti.status="fulfilled");var e=Ls;Ls=null,Si=0,Ti=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function Aw(e,t){var a=[],s={status:"pending",value:null,reason:null,then:function(l){a.push(l)}};return e.then(function(){s.status="fulfilled",s.value=t;for(var l=0;l<a.length;l++)(0,a[l])(t)},function(l){for(s.status="rejected",s.reason=l,l=0;l<a.length;l++)(0,a[l])(void 0)}),s}var Eh=A.S;A.S=function(e,t){dm=qt(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&Tw(e,t),Eh!==null&&Eh(e,t)};var _a=je(null);function vc(){var e=_a.current;return e!==null?e:Le.pooledCache}function to(e,t){t===null?Se(_a,_a.current):Se(_a,t.pool)}function Ch(){var e=vc();return e===null?null:{parent:Ge._currentValue,pool:e}}var Ai=Error(o(460)),wc=Error(o(474)),no=Error(o(542)),ao={then:function(){}};function Lh(e){return e=e.status,e==="fulfilled"||e==="rejected"}function Dh(e,t,a){switch(a=e[a],a===void 0?e.push(t):a!==t&&(t.then(kn,kn),t=a),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,zh(e),e;default:if(typeof t.status=="string")t.then(kn,kn);else{if(e=Le,e!==null&&100<e.shellSuspendCounter)throw Error(o(482));e=t,e.status="pending",e.then(function(s){if(t.status==="pending"){var l=t;l.status="fulfilled",l.value=s}},function(s){if(t.status==="pending"){var l=t;l.status="rejected",l.reason=s}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,zh(e),e}throw Ia=t,Ai}}function Na(e){try{var t=e._init;return t(e._payload)}catch(a){throw a!==null&&typeof a=="object"&&typeof a.then=="function"?(Ia=a,Ai):a}}var Ia=null;function Oh(){if(Ia===null)throw Error(o(459));var e=Ia;return Ia=null,e}function zh(e){if(e===Ai||e===no)throw Error(o(483))}var qi=null,Ds=0;function io(e){var t=Ds;return Ds+=1,qi===null&&(qi=[]),Dh(qi,e,t)}function Os(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function so(e,t){throw t.$$typeof===L?Error(o(525)):(e=Object.prototype.toString.call(t),Error(o(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function jh(e){function t(S,w){if(e){var q=S.deletions;q===null?(S.deletions=[w],S.flags|=16):q.push(w)}}function a(S,w){if(!e)return null;for(;w!==null;)t(S,w),w=w.sibling;return null}function s(S){for(var w=new Map;S!==null;)S.key!==null?w.set(S.key,S):w.set(S.index,S),S=S.sibling;return w}function l(S,w){return S=Sn(S,w),S.index=0,S.sibling=null,S}function c(S,w,q){return S.index=q,e?(q=S.alternate,q!==null?(q=q.index,q<w?(S.flags|=67108866,w):q):(S.flags|=67108866,w)):(S.flags|=1048576,w)}function h(S){return e&&S.alternate===null&&(S.flags|=67108866),S}function g(S,w,q,M){return w===null||w.tag!==6?(w=lc(q,S.mode,M),w.return=S,w):(w=l(w,q),w.return=S,w)}function v(S,w,q,M){var ee=q.type;return ee===T?z(S,w,q.props.children,M,q.key):w!==null&&(w.elementType===ee||typeof ee=="object"&&ee!==null&&ee.$$typeof===ae&&Na(ee)===w.type)?(w=l(w,q.props),Os(w,q),w.return=S,w):(w=$r(q.type,q.key,q.props,null,S.mode,M),Os(w,q),w.return=S,w)}function E(S,w,q,M){return w===null||w.tag!==4||w.stateNode.containerInfo!==q.containerInfo||w.stateNode.implementation!==q.implementation?(w=cc(q,S.mode,M),w.return=S,w):(w=l(w,q.children||[]),w.return=S,w)}function z(S,w,q,M,ee){return w===null||w.tag!==7?(w=za(q,S.mode,M,ee),w.return=S,w):(w=l(w,q),w.return=S,w)}function R(S,w,q){if(typeof w=="string"&&w!==""||typeof w=="number"||typeof w=="bigint")return w=lc(""+w,S.mode,q),w.return=S,w;if(typeof w=="object"&&w!==null){switch(w.$$typeof){case O:return q=$r(w.type,w.key,w.props,null,S.mode,q),Os(q,w),q.return=S,q;case _:return w=cc(w,S.mode,q),w.return=S,w;case ae:return w=Na(w),R(S,w,q)}if(Q(w)||Z(w))return w=za(w,S.mode,q,null),w.return=S,w;if(typeof w.then=="function")return R(S,io(w),q);if(w.$$typeof===Y)return R(S,eo(S,w),q);so(S,w)}return null}function C(S,w,q,M){var ee=w!==null?w.key:null;if(typeof q=="string"&&q!==""||typeof q=="number"||typeof q=="bigint")return ee!==null?null:g(S,w,""+q,M);if(typeof q=="object"&&q!==null){switch(q.$$typeof){case O:return q.key===ee?v(S,w,q,M):null;case _:return q.key===ee?E(S,w,q,M):null;case ae:return q=Na(q),C(S,w,q,M)}if(Q(q)||Z(q))return ee!==null?null:z(S,w,q,M,null);if(typeof q.then=="function")return C(S,w,io(q),M);if(q.$$typeof===Y)return C(S,w,eo(S,q),M);so(S,q)}return null}function D(S,w,q,M,ee){if(typeof M=="string"&&M!==""||typeof M=="number"||typeof M=="bigint")return S=S.get(q)||null,g(w,S,""+M,ee);if(typeof M=="object"&&M!==null){switch(M.$$typeof){case O:return S=S.get(M.key===null?q:M.key)||null,v(w,S,M,ee);case _:return S=S.get(M.key===null?q:M.key)||null,E(w,S,M,ee);case ae:return M=Na(M),D(S,w,q,M,ee)}if(Q(M)||Z(M))return S=S.get(q)||null,z(w,S,M,ee,null);if(typeof M.then=="function")return D(S,w,q,io(M),ee);if(M.$$typeof===Y)return D(S,w,q,eo(w,M),ee);so(w,M)}return null}function $(S,w,q,M){for(var ee=null,we=null,X=w,le=w=0,ye=null;X!==null&&le<q.length;le++){X.index>le?(ye=X,X=null):ye=X.sibling;var ke=C(S,X,q[le],M);if(ke===null){X===null&&(X=ye);break}e&&X&&ke.alternate===null&&t(S,X),w=c(ke,w,le),we===null?ee=ke:we.sibling=ke,we=ke,X=ye}if(le===q.length)return a(S,X),ve&&Tn(S,le),ee;if(X===null){for(;le<q.length;le++)X=R(S,q[le],M),X!==null&&(w=c(X,w,le),we===null?ee=X:we.sibling=X,we=X);return ve&&Tn(S,le),ee}for(X=s(X);le<q.length;le++)ye=D(X,S,le,q[le],M),ye!==null&&(e&&ye.alternate!==null&&X.delete(ye.key===null?le:ye.key),w=c(ye,w,le),we===null?ee=ye:we.sibling=ye,we=ye);return e&&X.forEach(function(fa){return t(S,fa)}),ve&&Tn(S,le),ee}function te(S,w,q,M){if(q==null)throw Error(o(151));for(var ee=null,we=null,X=w,le=w=0,ye=null,ke=q.next();X!==null&&!ke.done;le++,ke=q.next()){X.index>le?(ye=X,X=null):ye=X.sibling;var fa=C(S,X,ke.value,M);if(fa===null){X===null&&(X=ye);break}e&&X&&fa.alternate===null&&t(S,X),w=c(fa,w,le),we===null?ee=fa:we.sibling=fa,we=fa,X=ye}if(ke.done)return a(S,X),ve&&Tn(S,le),ee;if(X===null){for(;!ke.done;le++,ke=q.next())ke=R(S,ke.value,M),ke!==null&&(w=c(ke,w,le),we===null?ee=ke:we.sibling=ke,we=ke);return ve&&Tn(S,le),ee}for(X=s(X);!ke.done;le++,ke=q.next())ke=D(X,S,le,ke.value,M),ke!==null&&(e&&ke.alternate!==null&&X.delete(ke.key===null?le:ke.key),w=c(ke,w,le),we===null?ee=ke:we.sibling=ke,we=ke);return e&&X.forEach(function(_0){return t(S,_0)}),ve&&Tn(S,le),ee}function Ce(S,w,q,M){if(typeof q=="object"&&q!==null&&q.type===T&&q.key===null&&(q=q.props.children),typeof q=="object"&&q!==null){switch(q.$$typeof){case O:e:{for(var ee=q.key;w!==null;){if(w.key===ee){if(ee=q.type,ee===T){if(w.tag===7){a(S,w.sibling),M=l(w,q.props.children),M.return=S,S=M;break e}}else if(w.elementType===ee||typeof ee=="object"&&ee!==null&&ee.$$typeof===ae&&Na(ee)===w.type){a(S,w.sibling),M=l(w,q.props),Os(M,q),M.return=S,S=M;break e}a(S,w);break}else t(S,w);w=w.sibling}q.type===T?(M=za(q.props.children,S.mode,M,q.key),M.return=S,S=M):(M=$r(q.type,q.key,q.props,null,S.mode,M),Os(M,q),M.return=S,S=M)}return h(S);case _:e:{for(ee=q.key;w!==null;){if(w.key===ee)if(w.tag===4&&w.stateNode.containerInfo===q.containerInfo&&w.stateNode.implementation===q.implementation){a(S,w.sibling),M=l(w,q.children||[]),M.return=S,S=M;break e}else{a(S,w);break}else t(S,w);w=w.sibling}M=cc(q,S.mode,M),M.return=S,S=M}return h(S);case ae:return q=Na(q),Ce(S,w,q,M)}if(Q(q))return $(S,w,q,M);if(Z(q)){if(ee=Z(q),typeof ee!="function")throw Error(o(150));return q=ee.call(q),te(S,w,q,M)}if(typeof q.then=="function")return Ce(S,w,io(q),M);if(q.$$typeof===Y)return Ce(S,w,eo(S,q),M);so(S,q)}return typeof q=="string"&&q!==""||typeof q=="number"||typeof q=="bigint"?(q=""+q,w!==null&&w.tag===6?(a(S,w.sibling),M=l(w,q),M.return=S,S=M):(a(S,w),M=lc(q,S.mode,M),M.return=S,S=M),h(S)):a(S,w)}return function(S,w,q,M){try{Ds=0;var ee=Ce(S,w,q,M);return qi=null,ee}catch(X){if(X===Ai||X===no)throw X;var we=Dt(29,X,null,S.mode);return we.lanes=M,we.return=S,we}finally{}}}var Ba=jh(!0),Mh=jh(!1),$n=!1;function kc(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function xc(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function Xn(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Zn(e,t,a){var s=e.updateQueue;if(s===null)return null;if(s=s.shared,(xe&2)!==0){var l=s.pending;return l===null?t.next=t:(t.next=l.next,l.next=t),s.pending=t,t=Wr(e),yh(e,null,a),t}return Jr(e,s,t,a),Wr(e)}function zs(e,t,a){if(t=t.updateQueue,t!==null&&(t=t.shared,(a&4194048)!==0)){var s=t.lanes;s&=e.pendingLanes,a|=s,t.lanes=a,Ap(e,a)}}function Sc(e,t){var a=e.updateQueue,s=e.alternate;if(s!==null&&(s=s.updateQueue,a===s)){var l=null,c=null;if(a=a.firstBaseUpdate,a!==null){do{var h={lane:a.lane,tag:a.tag,payload:a.payload,callback:null,next:null};c===null?l=c=h:c=c.next=h,a=a.next}while(a!==null);c===null?l=c=t:c=c.next=t}else l=c=t;a={baseState:s.baseState,firstBaseUpdate:l,lastBaseUpdate:c,shared:s.shared,callbacks:s.callbacks},e.updateQueue=a;return}e=a.lastBaseUpdate,e===null?a.firstBaseUpdate=t:e.next=t,a.lastBaseUpdate=t}var Tc=!1;function js(){if(Tc){var e=Ti;if(e!==null)throw e}}function Ms(e,t,a,s){Tc=!1;var l=e.updateQueue;$n=!1;var c=l.firstBaseUpdate,h=l.lastBaseUpdate,g=l.shared.pending;if(g!==null){l.shared.pending=null;var v=g,E=v.next;v.next=null,h===null?c=E:h.next=E,h=v;var z=e.alternate;z!==null&&(z=z.updateQueue,g=z.lastBaseUpdate,g!==h&&(g===null?z.firstBaseUpdate=E:g.next=E,z.lastBaseUpdate=v))}if(c!==null){var R=l.baseState;h=0,z=E=v=null,g=c;do{var C=g.lane&-536870913,D=C!==g.lane;if(D?(ge&C)===C:(s&C)===C){C!==0&&C===Si&&(Tc=!0),z!==null&&(z=z.next={lane:0,tag:g.tag,payload:g.payload,callback:null,next:null});e:{var $=e,te=g;C=t;var Ce=a;switch(te.tag){case 1:if($=te.payload,typeof $=="function"){R=$.call(Ce,R,C);break e}R=$;break e;case 3:$.flags=$.flags&-65537|128;case 0:if($=te.payload,C=typeof $=="function"?$.call(Ce,R,C):$,C==null)break e;R=k({},R,C);break e;case 2:$n=!0}}C=g.callback,C!==null&&(e.flags|=64,D&&(e.flags|=8192),D=l.callbacks,D===null?l.callbacks=[C]:D.push(C))}else D={lane:C,tag:g.tag,payload:g.payload,callback:g.callback,next:null},z===null?(E=z=D,v=R):z=z.next=D,h|=C;if(g=g.next,g===null){if(g=l.shared.pending,g===null)break;D=g,g=D.next,D.next=null,l.lastBaseUpdate=D,l.shared.pending=null}}while(!0);z===null&&(v=R),l.baseState=v,l.firstBaseUpdate=E,l.lastBaseUpdate=z,c===null&&(l.shared.lanes=0),ia|=h,e.lanes=h,e.memoizedState=R}}function Rh(e,t){if(typeof e!="function")throw Error(o(191,e));e.call(t)}function _h(e,t){var a=e.callbacks;if(a!==null)for(e.callbacks=null,e=0;e<a.length;e++)Rh(a[e],t)}var Ei=je(null),ro=je(0);function Nh(e,t){e=Rn,Se(ro,e),Se(Ei,t),Rn=e|t.baseLanes}function Ac(){Se(ro,Rn),Se(Ei,Ei.current)}function qc(){Rn=ro.current,_e(Ei),_e(ro)}var Ot=je(null),Kt=null;function ea(e){var t=e.alternate;Se(He,He.current&1),Se(Ot,e),Kt===null&&(t===null||Ei.current!==null||t.memoizedState!==null)&&(Kt=e)}function Ec(e){Se(He,He.current),Se(Ot,e),Kt===null&&(Kt=e)}function Ih(e){e.tag===22?(Se(He,He.current),Se(Ot,e),Kt===null&&(Kt=e)):ta()}function ta(){Se(He,He.current),Se(Ot,Ot.current)}function zt(e){_e(Ot),Kt===e&&(Kt=null),_e(He)}var He=je(0);function oo(e){for(var t=e;t!==null;){if(t.tag===13){var a=t.memoizedState;if(a!==null&&(a=a.dehydrated,a===null||ju(a)||Mu(a)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var En=0,re=null,qe=null,Ye=null,lo=!1,Ci=!1,Ua=!1,co=0,Rs=0,Li=null,qw=0;function Ie(){throw Error(o(321))}function Cc(e,t){if(t===null)return!1;for(var a=0;a<t.length&&a<e.length;a++)if(!Lt(e[a],t[a]))return!1;return!0}function Lc(e,t,a,s,l,c){return En=c,re=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,A.H=e===null||e.memoizedState===null?xf:Yc,Ua=!1,c=a(s,l),Ua=!1,Ci&&(c=Uh(t,a,s,l)),Bh(e),c}function Bh(e){A.H=Is;var t=qe!==null&&qe.next!==null;if(En=0,Ye=qe=re=null,lo=!1,Rs=0,Li=null,t)throw Error(o(300));e===null||Qe||(e=e.dependencies,e!==null&&Zr(e)&&(Qe=!0))}function Uh(e,t,a,s){re=e;var l=0;do{if(Ci&&(Li=null),Rs=0,Ci=!1,25<=l)throw Error(o(301));if(l+=1,Ye=qe=null,e.updateQueue!=null){var c=e.updateQueue;c.lastEffect=null,c.events=null,c.stores=null,c.memoCache!=null&&(c.memoCache.index=0)}A.H=Sf,c=t(a,s)}while(Ci);return c}function Ew(){var e=A.H,t=e.useState()[0];return t=typeof t.then=="function"?_s(t):t,e=e.useState()[0],(qe!==null?qe.memoizedState:null)!==e&&(re.flags|=1024),t}function Dc(){var e=co!==0;return co=0,e}function Oc(e,t,a){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~a}function zc(e){if(lo){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}lo=!1}En=0,Ye=qe=re=null,Ci=!1,Rs=co=0,Li=null}function ht(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return Ye===null?re.memoizedState=Ye=e:Ye=Ye.next=e,Ye}function Pe(){if(qe===null){var e=re.alternate;e=e!==null?e.memoizedState:null}else e=qe.next;var t=Ye===null?re.memoizedState:Ye.next;if(t!==null)Ye=t,qe=e;else{if(e===null)throw re.alternate===null?Error(o(467)):Error(o(310));qe=e,e={memoizedState:qe.memoizedState,baseState:qe.baseState,baseQueue:qe.baseQueue,queue:qe.queue,next:null},Ye===null?re.memoizedState=Ye=e:Ye=Ye.next=e}return Ye}function uo(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function _s(e){var t=Rs;return Rs+=1,Li===null&&(Li=[]),e=Dh(Li,e,t),t=re,(Ye===null?t.memoizedState:Ye.next)===null&&(t=t.alternate,A.H=t===null||t.memoizedState===null?xf:Yc),e}function po(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return _s(e);if(e.$$typeof===Y)return ot(e)}throw Error(o(438,String(e)))}function jc(e){var t=null,a=re.updateQueue;if(a!==null&&(t=a.memoCache),t==null){var s=re.alternate;s!==null&&(s=s.updateQueue,s!==null&&(s=s.memoCache,s!=null&&(t={data:s.data.map(function(l){return l.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),a===null&&(a=uo(),re.updateQueue=a),a.memoCache=t,a=t.data[t.index],a===void 0)for(a=t.data[t.index]=Array(e),s=0;s<e;s++)a[s]=de;return t.index++,a}function Cn(e,t){return typeof t=="function"?t(e):t}function ho(e){var t=Pe();return Mc(t,qe,e)}function Mc(e,t,a){var s=e.queue;if(s===null)throw Error(o(311));s.lastRenderedReducer=a;var l=e.baseQueue,c=s.pending;if(c!==null){if(l!==null){var h=l.next;l.next=c.next,c.next=h}t.baseQueue=l=c,s.pending=null}if(c=e.baseState,l===null)e.memoizedState=c;else{t=l.next;var g=h=null,v=null,E=t,z=!1;do{var R=E.lane&-536870913;if(R!==E.lane?(ge&R)===R:(En&R)===R){var C=E.revertLane;if(C===0)v!==null&&(v=v.next={lane:0,revertLane:0,gesture:null,action:E.action,hasEagerState:E.hasEagerState,eagerState:E.eagerState,next:null}),R===Si&&(z=!0);else if((En&C)===C){E=E.next,C===Si&&(z=!0);continue}else R={lane:0,revertLane:E.revertLane,gesture:null,action:E.action,hasEagerState:E.hasEagerState,eagerState:E.eagerState,next:null},v===null?(g=v=R,h=c):v=v.next=R,re.lanes|=C,ia|=C;R=E.action,Ua&&a(c,R),c=E.hasEagerState?E.eagerState:a(c,R)}else C={lane:R,revertLane:E.revertLane,gesture:E.gesture,action:E.action,hasEagerState:E.hasEagerState,eagerState:E.eagerState,next:null},v===null?(g=v=C,h=c):v=v.next=C,re.lanes|=R,ia|=R;E=E.next}while(E!==null&&E!==t);if(v===null?h=c:v.next=g,!Lt(c,e.memoizedState)&&(Qe=!0,z&&(a=Ti,a!==null)))throw a;e.memoizedState=c,e.baseState=h,e.baseQueue=v,s.lastRenderedState=c}return l===null&&(s.lanes=0),[e.memoizedState,s.dispatch]}function Rc(e){var t=Pe(),a=t.queue;if(a===null)throw Error(o(311));a.lastRenderedReducer=e;var s=a.dispatch,l=a.pending,c=t.memoizedState;if(l!==null){a.pending=null;var h=l=l.next;do c=e(c,h.action),h=h.next;while(h!==l);Lt(c,t.memoizedState)||(Qe=!0),t.memoizedState=c,t.baseQueue===null&&(t.baseState=c),a.lastRenderedState=c}return[c,s]}function Hh(e,t,a){var s=re,l=Pe(),c=ve;if(c){if(a===void 0)throw Error(o(407));a=a()}else a=t();var h=!Lt((qe||l).memoizedState,a);if(h&&(l.memoizedState=a,Qe=!0),l=l.queue,Ic(Yh.bind(null,s,l,e),[e]),l.getSnapshot!==t||h||Ye!==null&&Ye.memoizedState.tag&1){if(s.flags|=2048,Di(9,{destroy:void 0},Gh.bind(null,s,l,a,t),null),Le===null)throw Error(o(349));c||(En&127)!==0||Ph(s,t,a)}return a}function Ph(e,t,a){e.flags|=16384,e={getSnapshot:t,value:a},t=re.updateQueue,t===null?(t=uo(),re.updateQueue=t,t.stores=[e]):(a=t.stores,a===null?t.stores=[e]:a.push(e))}function Gh(e,t,a,s){t.value=a,t.getSnapshot=s,Qh(t)&&Kh(e)}function Yh(e,t,a){return a(function(){Qh(t)&&Kh(e)})}function Qh(e){var t=e.getSnapshot;e=e.value;try{var a=t();return!Lt(e,a)}catch{return!0}}function Kh(e){var t=Oa(e,2);t!==null&&xt(t,e,2)}function _c(e){var t=ht();if(typeof e=="function"){var a=e;if(e=a(),Ua){Yn(!0);try{a()}finally{Yn(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Cn,lastRenderedState:e},t}function Fh(e,t,a,s){return e.baseState=a,Mc(e,qe,typeof s=="function"?s:Cn)}function Cw(e,t,a,s,l){if(go(e))throw Error(o(485));if(e=t.action,e!==null){var c={payload:l,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(h){c.listeners.push(h)}};A.T!==null?a(!0):c.isTransition=!1,s(c),a=t.pending,a===null?(c.next=t.pending=c,Vh(t,c)):(c.next=a.next,t.pending=a.next=c)}}function Vh(e,t){var a=t.action,s=t.payload,l=e.state;if(t.isTransition){var c=A.T,h={};A.T=h;try{var g=a(l,s),v=A.S;v!==null&&v(h,g),Jh(e,t,g)}catch(E){Nc(e,t,E)}finally{c!==null&&h.types!==null&&(c.types=h.types),A.T=c}}else try{c=a(l,s),Jh(e,t,c)}catch(E){Nc(e,t,E)}}function Jh(e,t,a){a!==null&&typeof a=="object"&&typeof a.then=="function"?a.then(function(s){Wh(e,t,s)},function(s){return Nc(e,t,s)}):Wh(e,t,a)}function Wh(e,t,a){t.status="fulfilled",t.value=a,$h(t),e.state=a,t=e.pending,t!==null&&(a=t.next,a===t?e.pending=null:(a=a.next,t.next=a,Vh(e,a)))}function Nc(e,t,a){var s=e.pending;if(e.pending=null,s!==null){s=s.next;do t.status="rejected",t.reason=a,$h(t),t=t.next;while(t!==s)}e.action=null}function $h(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function Xh(e,t){return t}function Zh(e,t){if(ve){var a=Le.formState;if(a!==null){e:{var s=re;if(ve){if(De){t:{for(var l=De,c=Qt;l.nodeType!==8;){if(!c){l=null;break t}if(l=Ft(l.nextSibling),l===null){l=null;break t}}c=l.data,l=c==="F!"||c==="F"?l:null}if(l){De=Ft(l.nextSibling),s=l.data==="F!";break e}}Jn(s)}s=!1}s&&(t=a[0])}}return a=ht(),a.memoizedState=a.baseState=t,s={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Xh,lastRenderedState:t},a.queue=s,a=vf.bind(null,re,s),s.dispatch=a,s=_c(!1),c=Gc.bind(null,re,!1,s.queue),s=ht(),l={state:t,dispatch:null,action:e,pending:null},s.queue=l,a=Cw.bind(null,re,l,c,a),l.dispatch=a,s.memoizedState=e,[t,a,!1]}function ef(e){var t=Pe();return tf(t,qe,e)}function tf(e,t,a){if(t=Mc(e,t,Xh)[0],e=ho(Cn)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var s=_s(t)}catch(h){throw h===Ai?no:h}else s=t;t=Pe();var l=t.queue,c=l.dispatch;return a!==t.memoizedState&&(re.flags|=2048,Di(9,{destroy:void 0},Lw.bind(null,l,a),null)),[s,c,e]}function Lw(e,t){e.action=t}function nf(e){var t=Pe(),a=qe;if(a!==null)return tf(t,a,e);Pe(),t=t.memoizedState,a=Pe();var s=a.queue.dispatch;return a.memoizedState=e,[t,s,!1]}function Di(e,t,a,s){return e={tag:e,create:a,deps:s,inst:t,next:null},t=re.updateQueue,t===null&&(t=uo(),re.updateQueue=t),a=t.lastEffect,a===null?t.lastEffect=e.next=e:(s=a.next,a.next=e,e.next=s,t.lastEffect=e),e}function af(){return Pe().memoizedState}function fo(e,t,a,s){var l=ht();re.flags|=e,l.memoizedState=Di(1|t,{destroy:void 0},a,s===void 0?null:s)}function mo(e,t,a,s){var l=Pe();s=s===void 0?null:s;var c=l.memoizedState.inst;qe!==null&&s!==null&&Cc(s,qe.memoizedState.deps)?l.memoizedState=Di(t,c,a,s):(re.flags|=e,l.memoizedState=Di(1|t,c,a,s))}function sf(e,t){fo(8390656,8,e,t)}function Ic(e,t){mo(2048,8,e,t)}function Dw(e){re.flags|=4;var t=re.updateQueue;if(t===null)t=uo(),re.updateQueue=t,t.events=[e];else{var a=t.events;a===null?t.events=[e]:a.push(e)}}function rf(e){var t=Pe().memoizedState;return Dw({ref:t,nextImpl:e}),function(){if((xe&2)!==0)throw Error(o(440));return t.impl.apply(void 0,arguments)}}function of(e,t){return mo(4,2,e,t)}function lf(e,t){return mo(4,4,e,t)}function cf(e,t){if(typeof t=="function"){e=e();var a=t(e);return function(){typeof a=="function"?a():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function uf(e,t,a){a=a!=null?a.concat([e]):null,mo(4,4,cf.bind(null,t,e),a)}function Bc(){}function df(e,t){var a=Pe();t=t===void 0?null:t;var s=a.memoizedState;return t!==null&&Cc(t,s[1])?s[0]:(a.memoizedState=[e,t],e)}function pf(e,t){var a=Pe();t=t===void 0?null:t;var s=a.memoizedState;if(t!==null&&Cc(t,s[1]))return s[0];if(s=e(),Ua){Yn(!0);try{e()}finally{Yn(!1)}}return a.memoizedState=[s,t],s}function Uc(e,t,a){return a===void 0||(En&1073741824)!==0&&(ge&261930)===0?e.memoizedState=t:(e.memoizedState=a,e=hm(),re.lanes|=e,ia|=e,a)}function hf(e,t,a,s){return Lt(a,t)?a:Ei.current!==null?(e=Uc(e,a,s),Lt(e,t)||(Qe=!0),e):(En&42)===0||(En&1073741824)!==0&&(ge&261930)===0?(Qe=!0,e.memoizedState=a):(e=hm(),re.lanes|=e,ia|=e,t)}function ff(e,t,a,s,l){var c=U.p;U.p=c!==0&&8>c?c:8;var h=A.T,g={};A.T=g,Gc(e,!1,t,a);try{var v=l(),E=A.S;if(E!==null&&E(g,v),v!==null&&typeof v=="object"&&typeof v.then=="function"){var z=Aw(v,s);Ns(e,t,z,Rt(e))}else Ns(e,t,s,Rt(e))}catch(R){Ns(e,t,{then:function(){},status:"rejected",reason:R},Rt())}finally{U.p=c,h!==null&&g.types!==null&&(h.types=g.types),A.T=h}}function Ow(){}function Hc(e,t,a,s){if(e.tag!==5)throw Error(o(476));var l=mf(e).queue;ff(e,l,t,W,a===null?Ow:function(){return gf(e),a(s)})}function mf(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:W,baseState:W,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Cn,lastRenderedState:W},next:null};var a={};return t.next={memoizedState:a,baseState:a,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Cn,lastRenderedState:a},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function gf(e){var t=mf(e);t.next===null&&(t=e.alternate.memoizedState),Ns(e,t.next.queue,{},Rt())}function Pc(){return ot(er)}function yf(){return Pe().memoizedState}function bf(){return Pe().memoizedState}function zw(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var a=Rt();e=Xn(a);var s=Zn(t,e,a);s!==null&&(xt(s,t,a),zs(s,t,a)),t={cache:yc()},e.payload=t;return}t=t.return}}function jw(e,t,a){var s=Rt();a={lane:s,revertLane:0,gesture:null,action:a,hasEagerState:!1,eagerState:null,next:null},go(e)?wf(t,a):(a=rc(e,t,a,s),a!==null&&(xt(a,e,s),kf(a,t,s)))}function vf(e,t,a){var s=Rt();Ns(e,t,a,s)}function Ns(e,t,a,s){var l={lane:s,revertLane:0,gesture:null,action:a,hasEagerState:!1,eagerState:null,next:null};if(go(e))wf(t,l);else{var c=e.alternate;if(e.lanes===0&&(c===null||c.lanes===0)&&(c=t.lastRenderedReducer,c!==null))try{var h=t.lastRenderedState,g=c(h,a);if(l.hasEagerState=!0,l.eagerState=g,Lt(g,h))return Jr(e,t,l,0),Le===null&&Vr(),!1}catch{}finally{}if(a=rc(e,t,l,s),a!==null)return xt(a,e,s),kf(a,t,s),!0}return!1}function Gc(e,t,a,s){if(s={lane:2,revertLane:ku(),gesture:null,action:s,hasEagerState:!1,eagerState:null,next:null},go(e)){if(t)throw Error(o(479))}else t=rc(e,a,s,2),t!==null&&xt(t,e,2)}function go(e){var t=e.alternate;return e===re||t!==null&&t===re}function wf(e,t){Ci=lo=!0;var a=e.pending;a===null?t.next=t:(t.next=a.next,a.next=t),e.pending=t}function kf(e,t,a){if((a&4194048)!==0){var s=t.lanes;s&=e.pendingLanes,a|=s,t.lanes=a,Ap(e,a)}}var Is={readContext:ot,use:po,useCallback:Ie,useContext:Ie,useEffect:Ie,useImperativeHandle:Ie,useLayoutEffect:Ie,useInsertionEffect:Ie,useMemo:Ie,useReducer:Ie,useRef:Ie,useState:Ie,useDebugValue:Ie,useDeferredValue:Ie,useTransition:Ie,useSyncExternalStore:Ie,useId:Ie,useHostTransitionStatus:Ie,useFormState:Ie,useActionState:Ie,useOptimistic:Ie,useMemoCache:Ie,useCacheRefresh:Ie};Is.useEffectEvent=Ie;var xf={readContext:ot,use:po,useCallback:function(e,t){return ht().memoizedState=[e,t===void 0?null:t],e},useContext:ot,useEffect:sf,useImperativeHandle:function(e,t,a){a=a!=null?a.concat([e]):null,fo(4194308,4,cf.bind(null,t,e),a)},useLayoutEffect:function(e,t){return fo(4194308,4,e,t)},useInsertionEffect:function(e,t){fo(4,2,e,t)},useMemo:function(e,t){var a=ht();t=t===void 0?null:t;var s=e();if(Ua){Yn(!0);try{e()}finally{Yn(!1)}}return a.memoizedState=[s,t],s},useReducer:function(e,t,a){var s=ht();if(a!==void 0){var l=a(t);if(Ua){Yn(!0);try{a(t)}finally{Yn(!1)}}}else l=t;return s.memoizedState=s.baseState=l,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:l},s.queue=e,e=e.dispatch=jw.bind(null,re,e),[s.memoizedState,e]},useRef:function(e){var t=ht();return e={current:e},t.memoizedState=e},useState:function(e){e=_c(e);var t=e.queue,a=vf.bind(null,re,t);return t.dispatch=a,[e.memoizedState,a]},useDebugValue:Bc,useDeferredValue:function(e,t){var a=ht();return Uc(a,e,t)},useTransition:function(){var e=_c(!1);return e=ff.bind(null,re,e.queue,!0,!1),ht().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,a){var s=re,l=ht();if(ve){if(a===void 0)throw Error(o(407));a=a()}else{if(a=t(),Le===null)throw Error(o(349));(ge&127)!==0||Ph(s,t,a)}l.memoizedState=a;var c={value:a,getSnapshot:t};return l.queue=c,sf(Yh.bind(null,s,c,e),[e]),s.flags|=2048,Di(9,{destroy:void 0},Gh.bind(null,s,c,a,t),null),a},useId:function(){var e=ht(),t=Le.identifierPrefix;if(ve){var a=dn,s=un;a=(s&~(1<<32-Ct(s)-1)).toString(32)+a,t="_"+t+"R_"+a,a=co++,0<a&&(t+="H"+a.toString(32)),t+="_"}else a=qw++,t="_"+t+"r_"+a.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:Pc,useFormState:Zh,useActionState:Zh,useOptimistic:function(e){var t=ht();t.memoizedState=t.baseState=e;var a={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=a,t=Gc.bind(null,re,!0,a),a.dispatch=t,[e,t]},useMemoCache:jc,useCacheRefresh:function(){return ht().memoizedState=zw.bind(null,re)},useEffectEvent:function(e){var t=ht(),a={impl:e};return t.memoizedState=a,function(){if((xe&2)!==0)throw Error(o(440));return a.impl.apply(void 0,arguments)}}},Yc={readContext:ot,use:po,useCallback:df,useContext:ot,useEffect:Ic,useImperativeHandle:uf,useInsertionEffect:of,useLayoutEffect:lf,useMemo:pf,useReducer:ho,useRef:af,useState:function(){return ho(Cn)},useDebugValue:Bc,useDeferredValue:function(e,t){var a=Pe();return hf(a,qe.memoizedState,e,t)},useTransition:function(){var e=ho(Cn)[0],t=Pe().memoizedState;return[typeof e=="boolean"?e:_s(e),t]},useSyncExternalStore:Hh,useId:yf,useHostTransitionStatus:Pc,useFormState:ef,useActionState:ef,useOptimistic:function(e,t){var a=Pe();return Fh(a,qe,e,t)},useMemoCache:jc,useCacheRefresh:bf};Yc.useEffectEvent=rf;var Sf={readContext:ot,use:po,useCallback:df,useContext:ot,useEffect:Ic,useImperativeHandle:uf,useInsertionEffect:of,useLayoutEffect:lf,useMemo:pf,useReducer:Rc,useRef:af,useState:function(){return Rc(Cn)},useDebugValue:Bc,useDeferredValue:function(e,t){var a=Pe();return qe===null?Uc(a,e,t):hf(a,qe.memoizedState,e,t)},useTransition:function(){var e=Rc(Cn)[0],t=Pe().memoizedState;return[typeof e=="boolean"?e:_s(e),t]},useSyncExternalStore:Hh,useId:yf,useHostTransitionStatus:Pc,useFormState:nf,useActionState:nf,useOptimistic:function(e,t){var a=Pe();return qe!==null?Fh(a,qe,e,t):(a.baseState=e,[e,a.queue.dispatch])},useMemoCache:jc,useCacheRefresh:bf};Sf.useEffectEvent=rf;function Qc(e,t,a,s){t=e.memoizedState,a=a(s,t),a=a==null?t:k({},t,a),e.memoizedState=a,e.lanes===0&&(e.updateQueue.baseState=a)}var Kc={enqueueSetState:function(e,t,a){e=e._reactInternals;var s=Rt(),l=Xn(s);l.payload=t,a!=null&&(l.callback=a),t=Zn(e,l,s),t!==null&&(xt(t,e,s),zs(t,e,s))},enqueueReplaceState:function(e,t,a){e=e._reactInternals;var s=Rt(),l=Xn(s);l.tag=1,l.payload=t,a!=null&&(l.callback=a),t=Zn(e,l,s),t!==null&&(xt(t,e,s),zs(t,e,s))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var a=Rt(),s=Xn(a);s.tag=2,t!=null&&(s.callback=t),t=Zn(e,s,a),t!==null&&(xt(t,e,a),zs(t,e,a))}};function Tf(e,t,a,s,l,c,h){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(s,c,h):t.prototype&&t.prototype.isPureReactComponent?!Ts(a,s)||!Ts(l,c):!0}function Af(e,t,a,s){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(a,s),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(a,s),t.state!==e&&Kc.enqueueReplaceState(t,t.state,null)}function Ha(e,t){var a=t;if("ref"in t){a={};for(var s in t)s!=="ref"&&(a[s]=t[s])}if(e=e.defaultProps){a===t&&(a=k({},a));for(var l in e)a[l]===void 0&&(a[l]=e[l])}return a}function qf(e){Fr(e)}function Ef(e){console.error(e)}function Cf(e){Fr(e)}function yo(e,t){try{var a=e.onUncaughtError;a(t.value,{componentStack:t.stack})}catch(s){setTimeout(function(){throw s})}}function Lf(e,t,a){try{var s=e.onCaughtError;s(a.value,{componentStack:a.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(l){setTimeout(function(){throw l})}}function Fc(e,t,a){return a=Xn(a),a.tag=3,a.payload={element:null},a.callback=function(){yo(e,t)},a}function Df(e){return e=Xn(e),e.tag=3,e}function Of(e,t,a,s){var l=a.type.getDerivedStateFromError;if(typeof l=="function"){var c=s.value;e.payload=function(){return l(c)},e.callback=function(){Lf(t,a,s)}}var h=a.stateNode;h!==null&&typeof h.componentDidCatch=="function"&&(e.callback=function(){Lf(t,a,s),typeof l!="function"&&(sa===null?sa=new Set([this]):sa.add(this));var g=s.stack;this.componentDidCatch(s.value,{componentStack:g!==null?g:""})})}function Mw(e,t,a,s,l){if(a.flags|=32768,s!==null&&typeof s=="object"&&typeof s.then=="function"){if(t=a.alternate,t!==null&&xi(t,a,l,!0),a=Ot.current,a!==null){switch(a.tag){case 31:case 13:return Kt===null?Lo():a.alternate===null&&Be===0&&(Be=3),a.flags&=-257,a.flags|=65536,a.lanes=l,s===ao?a.flags|=16384:(t=a.updateQueue,t===null?a.updateQueue=new Set([s]):t.add(s),bu(e,s,l)),!1;case 22:return a.flags|=65536,s===ao?a.flags|=16384:(t=a.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([s])},a.updateQueue=t):(a=t.retryQueue,a===null?t.retryQueue=new Set([s]):a.add(s)),bu(e,s,l)),!1}throw Error(o(435,a.tag))}return bu(e,s,l),Lo(),!1}if(ve)return t=Ot.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=l,s!==pc&&(e=Error(o(422),{cause:s}),Es(Pt(e,a)))):(s!==pc&&(t=Error(o(423),{cause:s}),Es(Pt(t,a))),e=e.current.alternate,e.flags|=65536,l&=-l,e.lanes|=l,s=Pt(s,a),l=Fc(e.stateNode,s,l),Sc(e,l),Be!==4&&(Be=2)),!1;var c=Error(o(520),{cause:s});if(c=Pt(c,a),Ks===null?Ks=[c]:Ks.push(c),Be!==4&&(Be=2),t===null)return!0;s=Pt(s,a),a=t;do{switch(a.tag){case 3:return a.flags|=65536,e=l&-l,a.lanes|=e,e=Fc(a.stateNode,s,e),Sc(a,e),!1;case 1:if(t=a.type,c=a.stateNode,(a.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||c!==null&&typeof c.componentDidCatch=="function"&&(sa===null||!sa.has(c))))return a.flags|=65536,l&=-l,a.lanes|=l,l=Df(l),Of(l,e,a,s),Sc(a,l),!1}a=a.return}while(a!==null);return!1}var Vc=Error(o(461)),Qe=!1;function lt(e,t,a,s){t.child=e===null?Mh(t,null,a,s):Ba(t,e.child,a,s)}function zf(e,t,a,s,l){a=a.render;var c=t.ref;if("ref"in s){var h={};for(var g in s)g!=="ref"&&(h[g]=s[g])}else h=s;return Ra(t),s=Lc(e,t,a,h,c,l),g=Dc(),e!==null&&!Qe?(Oc(e,t,l),Ln(e,t,l)):(ve&&g&&uc(t),t.flags|=1,lt(e,t,s,l),t.child)}function jf(e,t,a,s,l){if(e===null){var c=a.type;return typeof c=="function"&&!oc(c)&&c.defaultProps===void 0&&a.compare===null?(t.tag=15,t.type=c,Mf(e,t,c,s,l)):(e=$r(a.type,null,s,t,t.mode,l),e.ref=t.ref,e.return=t,t.child=e)}if(c=e.child,!nu(e,l)){var h=c.memoizedProps;if(a=a.compare,a=a!==null?a:Ts,a(h,s)&&e.ref===t.ref)return Ln(e,t,l)}return t.flags|=1,e=Sn(c,s),e.ref=t.ref,e.return=t,t.child=e}function Mf(e,t,a,s,l){if(e!==null){var c=e.memoizedProps;if(Ts(c,s)&&e.ref===t.ref)if(Qe=!1,t.pendingProps=s=c,nu(e,l))(e.flags&131072)!==0&&(Qe=!0);else return t.lanes=e.lanes,Ln(e,t,l)}return Jc(e,t,a,s,l)}function Rf(e,t,a,s){var l=s.children,c=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),s.mode==="hidden"){if((t.flags&128)!==0){if(c=c!==null?c.baseLanes|a:a,e!==null){for(s=t.child=e.child,l=0;s!==null;)l=l|s.lanes|s.childLanes,s=s.sibling;s=l&~c}else s=0,t.child=null;return _f(e,t,c,a,s)}if((a&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&to(t,c!==null?c.cachePool:null),c!==null?Nh(t,c):Ac(),Ih(t);else return s=t.lanes=536870912,_f(e,t,c!==null?c.baseLanes|a:a,a,s)}else c!==null?(to(t,c.cachePool),Nh(t,c),ta(),t.memoizedState=null):(e!==null&&to(t,null),Ac(),ta());return lt(e,t,l,a),t.child}function Bs(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function _f(e,t,a,s,l){var c=vc();return c=c===null?null:{parent:Ge._currentValue,pool:c},t.memoizedState={baseLanes:a,cachePool:c},e!==null&&to(t,null),Ac(),Ih(t),e!==null&&xi(e,t,s,!0),t.childLanes=l,null}function bo(e,t){return t=wo({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function Nf(e,t,a){return Ba(t,e.child,null,a),e=bo(t,t.pendingProps),e.flags|=2,zt(t),t.memoizedState=null,e}function Rw(e,t,a){var s=t.pendingProps,l=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(ve){if(s.mode==="hidden")return e=bo(t,s),t.lanes=536870912,Bs(null,e);if(Ec(t),(e=De)?(e=Jm(e,Qt),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Fn!==null?{id:un,overflow:dn}:null,retryLane:536870912,hydrationErrors:null},a=vh(e),a.return=t,t.child=a,rt=t,De=null)):e=null,e===null)throw Jn(t);return t.lanes=536870912,null}return bo(t,s)}var c=e.memoizedState;if(c!==null){var h=c.dehydrated;if(Ec(t),l)if(t.flags&256)t.flags&=-257,t=Nf(e,t,a);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(o(558));else if(Qe||xi(e,t,a,!1),l=(a&e.childLanes)!==0,Qe||l){if(s=Le,s!==null&&(h=qp(s,a),h!==0&&h!==c.retryLane))throw c.retryLane=h,Oa(e,h),xt(s,e,h),Vc;Lo(),t=Nf(e,t,a)}else e=c.treeContext,De=Ft(h.nextSibling),rt=t,ve=!0,Vn=null,Qt=!1,e!==null&&xh(t,e),t=bo(t,s),t.flags|=4096;return t}return e=Sn(e.child,{mode:s.mode,children:s.children}),e.ref=t.ref,t.child=e,e.return=t,e}function vo(e,t){var a=t.ref;if(a===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof a!="function"&&typeof a!="object")throw Error(o(284));(e===null||e.ref!==a)&&(t.flags|=4194816)}}function Jc(e,t,a,s,l){return Ra(t),a=Lc(e,t,a,s,void 0,l),s=Dc(),e!==null&&!Qe?(Oc(e,t,l),Ln(e,t,l)):(ve&&s&&uc(t),t.flags|=1,lt(e,t,a,l),t.child)}function If(e,t,a,s,l,c){return Ra(t),t.updateQueue=null,a=Uh(t,s,a,l),Bh(e),s=Dc(),e!==null&&!Qe?(Oc(e,t,c),Ln(e,t,c)):(ve&&s&&uc(t),t.flags|=1,lt(e,t,a,c),t.child)}function Bf(e,t,a,s,l){if(Ra(t),t.stateNode===null){var c=bi,h=a.contextType;typeof h=="object"&&h!==null&&(c=ot(h)),c=new a(s,c),t.memoizedState=c.state!==null&&c.state!==void 0?c.state:null,c.updater=Kc,t.stateNode=c,c._reactInternals=t,c=t.stateNode,c.props=s,c.state=t.memoizedState,c.refs={},kc(t),h=a.contextType,c.context=typeof h=="object"&&h!==null?ot(h):bi,c.state=t.memoizedState,h=a.getDerivedStateFromProps,typeof h=="function"&&(Qc(t,a,h,s),c.state=t.memoizedState),typeof a.getDerivedStateFromProps=="function"||typeof c.getSnapshotBeforeUpdate=="function"||typeof c.UNSAFE_componentWillMount!="function"&&typeof c.componentWillMount!="function"||(h=c.state,typeof c.componentWillMount=="function"&&c.componentWillMount(),typeof c.UNSAFE_componentWillMount=="function"&&c.UNSAFE_componentWillMount(),h!==c.state&&Kc.enqueueReplaceState(c,c.state,null),Ms(t,s,c,l),js(),c.state=t.memoizedState),typeof c.componentDidMount=="function"&&(t.flags|=4194308),s=!0}else if(e===null){c=t.stateNode;var g=t.memoizedProps,v=Ha(a,g);c.props=v;var E=c.context,z=a.contextType;h=bi,typeof z=="object"&&z!==null&&(h=ot(z));var R=a.getDerivedStateFromProps;z=typeof R=="function"||typeof c.getSnapshotBeforeUpdate=="function",g=t.pendingProps!==g,z||typeof c.UNSAFE_componentWillReceiveProps!="function"&&typeof c.componentWillReceiveProps!="function"||(g||E!==h)&&Af(t,c,s,h),$n=!1;var C=t.memoizedState;c.state=C,Ms(t,s,c,l),js(),E=t.memoizedState,g||C!==E||$n?(typeof R=="function"&&(Qc(t,a,R,s),E=t.memoizedState),(v=$n||Tf(t,a,v,s,C,E,h))?(z||typeof c.UNSAFE_componentWillMount!="function"&&typeof c.componentWillMount!="function"||(typeof c.componentWillMount=="function"&&c.componentWillMount(),typeof c.UNSAFE_componentWillMount=="function"&&c.UNSAFE_componentWillMount()),typeof c.componentDidMount=="function"&&(t.flags|=4194308)):(typeof c.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=s,t.memoizedState=E),c.props=s,c.state=E,c.context=h,s=v):(typeof c.componentDidMount=="function"&&(t.flags|=4194308),s=!1)}else{c=t.stateNode,xc(e,t),h=t.memoizedProps,z=Ha(a,h),c.props=z,R=t.pendingProps,C=c.context,E=a.contextType,v=bi,typeof E=="object"&&E!==null&&(v=ot(E)),g=a.getDerivedStateFromProps,(E=typeof g=="function"||typeof c.getSnapshotBeforeUpdate=="function")||typeof c.UNSAFE_componentWillReceiveProps!="function"&&typeof c.componentWillReceiveProps!="function"||(h!==R||C!==v)&&Af(t,c,s,v),$n=!1,C=t.memoizedState,c.state=C,Ms(t,s,c,l),js();var D=t.memoizedState;h!==R||C!==D||$n||e!==null&&e.dependencies!==null&&Zr(e.dependencies)?(typeof g=="function"&&(Qc(t,a,g,s),D=t.memoizedState),(z=$n||Tf(t,a,z,s,C,D,v)||e!==null&&e.dependencies!==null&&Zr(e.dependencies))?(E||typeof c.UNSAFE_componentWillUpdate!="function"&&typeof c.componentWillUpdate!="function"||(typeof c.componentWillUpdate=="function"&&c.componentWillUpdate(s,D,v),typeof c.UNSAFE_componentWillUpdate=="function"&&c.UNSAFE_componentWillUpdate(s,D,v)),typeof c.componentDidUpdate=="function"&&(t.flags|=4),typeof c.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof c.componentDidUpdate!="function"||h===e.memoizedProps&&C===e.memoizedState||(t.flags|=4),typeof c.getSnapshotBeforeUpdate!="function"||h===e.memoizedProps&&C===e.memoizedState||(t.flags|=1024),t.memoizedProps=s,t.memoizedState=D),c.props=s,c.state=D,c.context=v,s=z):(typeof c.componentDidUpdate!="function"||h===e.memoizedProps&&C===e.memoizedState||(t.flags|=4),typeof c.getSnapshotBeforeUpdate!="function"||h===e.memoizedProps&&C===e.memoizedState||(t.flags|=1024),s=!1)}return c=s,vo(e,t),s=(t.flags&128)!==0,c||s?(c=t.stateNode,a=s&&typeof a.getDerivedStateFromError!="function"?null:c.render(),t.flags|=1,e!==null&&s?(t.child=Ba(t,e.child,null,l),t.child=Ba(t,null,a,l)):lt(e,t,a,l),t.memoizedState=c.state,e=t.child):e=Ln(e,t,l),e}function Uf(e,t,a,s){return ja(),t.flags|=256,lt(e,t,a,s),t.child}var Wc={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function $c(e){return{baseLanes:e,cachePool:Ch()}}function Xc(e,t,a){return e=e!==null?e.childLanes&~a:0,t&&(e|=Mt),e}function Hf(e,t,a){var s=t.pendingProps,l=!1,c=(t.flags&128)!==0,h;if((h=c)||(h=e!==null&&e.memoizedState===null?!1:(He.current&2)!==0),h&&(l=!0,t.flags&=-129),h=(t.flags&32)!==0,t.flags&=-33,e===null){if(ve){if(l?ea(t):ta(),(e=De)?(e=Jm(e,Qt),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Fn!==null?{id:un,overflow:dn}:null,retryLane:536870912,hydrationErrors:null},a=vh(e),a.return=t,t.child=a,rt=t,De=null)):e=null,e===null)throw Jn(t);return Mu(e)?t.lanes=32:t.lanes=536870912,null}var g=s.children;return s=s.fallback,l?(ta(),l=t.mode,g=wo({mode:"hidden",children:g},l),s=za(s,l,a,null),g.return=t,s.return=t,g.sibling=s,t.child=g,s=t.child,s.memoizedState=$c(a),s.childLanes=Xc(e,h,a),t.memoizedState=Wc,Bs(null,s)):(ea(t),Zc(t,g))}var v=e.memoizedState;if(v!==null&&(g=v.dehydrated,g!==null)){if(c)t.flags&256?(ea(t),t.flags&=-257,t=eu(e,t,a)):t.memoizedState!==null?(ta(),t.child=e.child,t.flags|=128,t=null):(ta(),g=s.fallback,l=t.mode,s=wo({mode:"visible",children:s.children},l),g=za(g,l,a,null),g.flags|=2,s.return=t,g.return=t,s.sibling=g,t.child=s,Ba(t,e.child,null,a),s=t.child,s.memoizedState=$c(a),s.childLanes=Xc(e,h,a),t.memoizedState=Wc,t=Bs(null,s));else if(ea(t),Mu(g)){if(h=g.nextSibling&&g.nextSibling.dataset,h)var E=h.dgst;h=E,s=Error(o(419)),s.stack="",s.digest=h,Es({value:s,source:null,stack:null}),t=eu(e,t,a)}else if(Qe||xi(e,t,a,!1),h=(a&e.childLanes)!==0,Qe||h){if(h=Le,h!==null&&(s=qp(h,a),s!==0&&s!==v.retryLane))throw v.retryLane=s,Oa(e,s),xt(h,e,s),Vc;ju(g)||Lo(),t=eu(e,t,a)}else ju(g)?(t.flags|=192,t.child=e.child,t=null):(e=v.treeContext,De=Ft(g.nextSibling),rt=t,ve=!0,Vn=null,Qt=!1,e!==null&&xh(t,e),t=Zc(t,s.children),t.flags|=4096);return t}return l?(ta(),g=s.fallback,l=t.mode,v=e.child,E=v.sibling,s=Sn(v,{mode:"hidden",children:s.children}),s.subtreeFlags=v.subtreeFlags&65011712,E!==null?g=Sn(E,g):(g=za(g,l,a,null),g.flags|=2),g.return=t,s.return=t,s.sibling=g,t.child=s,Bs(null,s),s=t.child,g=e.child.memoizedState,g===null?g=$c(a):(l=g.cachePool,l!==null?(v=Ge._currentValue,l=l.parent!==v?{parent:v,pool:v}:l):l=Ch(),g={baseLanes:g.baseLanes|a,cachePool:l}),s.memoizedState=g,s.childLanes=Xc(e,h,a),t.memoizedState=Wc,Bs(e.child,s)):(ea(t),a=e.child,e=a.sibling,a=Sn(a,{mode:"visible",children:s.children}),a.return=t,a.sibling=null,e!==null&&(h=t.deletions,h===null?(t.deletions=[e],t.flags|=16):h.push(e)),t.child=a,t.memoizedState=null,a)}function Zc(e,t){return t=wo({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function wo(e,t){return e=Dt(22,e,null,t),e.lanes=0,e}function eu(e,t,a){return Ba(t,e.child,null,a),e=Zc(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function Pf(e,t,a){e.lanes|=t;var s=e.alternate;s!==null&&(s.lanes|=t),mc(e.return,t,a)}function tu(e,t,a,s,l,c){var h=e.memoizedState;h===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:s,tail:a,tailMode:l,treeForkCount:c}:(h.isBackwards=t,h.rendering=null,h.renderingStartTime=0,h.last=s,h.tail=a,h.tailMode=l,h.treeForkCount=c)}function Gf(e,t,a){var s=t.pendingProps,l=s.revealOrder,c=s.tail;s=s.children;var h=He.current,g=(h&2)!==0;if(g?(h=h&1|2,t.flags|=128):h&=1,Se(He,h),lt(e,t,s,a),s=ve?qs:0,!g&&e!==null&&(e.flags&128)!==0)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&Pf(e,a,t);else if(e.tag===19)Pf(e,a,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(l){case"forwards":for(a=t.child,l=null;a!==null;)e=a.alternate,e!==null&&oo(e)===null&&(l=a),a=a.sibling;a=l,a===null?(l=t.child,t.child=null):(l=a.sibling,a.sibling=null),tu(t,!1,l,a,c,s);break;case"backwards":case"unstable_legacy-backwards":for(a=null,l=t.child,t.child=null;l!==null;){if(e=l.alternate,e!==null&&oo(e)===null){t.child=l;break}e=l.sibling,l.sibling=a,a=l,l=e}tu(t,!0,a,null,c,s);break;case"together":tu(t,!1,null,null,void 0,s);break;default:t.memoizedState=null}return t.child}function Ln(e,t,a){if(e!==null&&(t.dependencies=e.dependencies),ia|=t.lanes,(a&t.childLanes)===0)if(e!==null){if(xi(e,t,a,!1),(a&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(o(153));if(t.child!==null){for(e=t.child,a=Sn(e,e.pendingProps),t.child=a,a.return=t;e.sibling!==null;)e=e.sibling,a=a.sibling=Sn(e,e.pendingProps),a.return=t;a.sibling=null}return t.child}function nu(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&Zr(e)))}function _w(e,t,a){switch(t.tag){case 3:Dr(t,t.stateNode.containerInfo),Wn(t,Ge,e.memoizedState.cache),ja();break;case 27:case 5:ql(t);break;case 4:Dr(t,t.stateNode.containerInfo);break;case 10:Wn(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,Ec(t),null;break;case 13:var s=t.memoizedState;if(s!==null)return s.dehydrated!==null?(ea(t),t.flags|=128,null):(a&t.child.childLanes)!==0?Hf(e,t,a):(ea(t),e=Ln(e,t,a),e!==null?e.sibling:null);ea(t);break;case 19:var l=(e.flags&128)!==0;if(s=(a&t.childLanes)!==0,s||(xi(e,t,a,!1),s=(a&t.childLanes)!==0),l){if(s)return Gf(e,t,a);t.flags|=128}if(l=t.memoizedState,l!==null&&(l.rendering=null,l.tail=null,l.lastEffect=null),Se(He,He.current),s)break;return null;case 22:return t.lanes=0,Rf(e,t,a,t.pendingProps);case 24:Wn(t,Ge,e.memoizedState.cache)}return Ln(e,t,a)}function Yf(e,t,a){if(e!==null)if(e.memoizedProps!==t.pendingProps)Qe=!0;else{if(!nu(e,a)&&(t.flags&128)===0)return Qe=!1,_w(e,t,a);Qe=(e.flags&131072)!==0}else Qe=!1,ve&&(t.flags&1048576)!==0&&kh(t,qs,t.index);switch(t.lanes=0,t.tag){case 16:e:{var s=t.pendingProps;if(e=Na(t.elementType),t.type=e,typeof e=="function")oc(e)?(s=Ha(e,s),t.tag=1,t=Bf(null,t,e,s,a)):(t.tag=0,t=Jc(null,t,e,s,a));else{if(e!=null){var l=e.$$typeof;if(l===F){t.tag=11,t=zf(null,t,e,s,a);break e}else if(l===ue){t.tag=14,t=jf(null,t,e,s,a);break e}}throw t=V(e)||e,Error(o(306,t,""))}}return t;case 0:return Jc(e,t,t.type,t.pendingProps,a);case 1:return s=t.type,l=Ha(s,t.pendingProps),Bf(e,t,s,l,a);case 3:e:{if(Dr(t,t.stateNode.containerInfo),e===null)throw Error(o(387));s=t.pendingProps;var c=t.memoizedState;l=c.element,xc(e,t),Ms(t,s,null,a);var h=t.memoizedState;if(s=h.cache,Wn(t,Ge,s),s!==c.cache&&gc(t,[Ge],a,!0),js(),s=h.element,c.isDehydrated)if(c={element:s,isDehydrated:!1,cache:h.cache},t.updateQueue.baseState=c,t.memoizedState=c,t.flags&256){t=Uf(e,t,s,a);break e}else if(s!==l){l=Pt(Error(o(424)),t),Es(l),t=Uf(e,t,s,a);break e}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for(De=Ft(e.firstChild),rt=t,ve=!0,Vn=null,Qt=!0,a=Mh(t,null,s,a),t.child=a;a;)a.flags=a.flags&-3|4096,a=a.sibling}else{if(ja(),s===l){t=Ln(e,t,a);break e}lt(e,t,s,a)}t=t.child}return t;case 26:return vo(e,t),e===null?(a=tg(t.type,null,t.pendingProps,null))?t.memoizedState=a:ve||(a=t.type,e=t.pendingProps,s=_o(Gn.current).createElement(a),s[st]=t,s[gt]=e,ct(s,a,e),nt(s),t.stateNode=s):t.memoizedState=tg(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return ql(t),e===null&&ve&&(s=t.stateNode=Xm(t.type,t.pendingProps,Gn.current),rt=t,Qt=!0,l=De,ca(t.type)?(Ru=l,De=Ft(s.firstChild)):De=l),lt(e,t,t.pendingProps.children,a),vo(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&ve&&((l=s=De)&&(s=p0(s,t.type,t.pendingProps,Qt),s!==null?(t.stateNode=s,rt=t,De=Ft(s.firstChild),Qt=!1,l=!0):l=!1),l||Jn(t)),ql(t),l=t.type,c=t.pendingProps,h=e!==null?e.memoizedProps:null,s=c.children,Du(l,c)?s=null:h!==null&&Du(l,h)&&(t.flags|=32),t.memoizedState!==null&&(l=Lc(e,t,Ew,null,null,a),er._currentValue=l),vo(e,t),lt(e,t,s,a),t.child;case 6:return e===null&&ve&&((e=a=De)&&(a=h0(a,t.pendingProps,Qt),a!==null?(t.stateNode=a,rt=t,De=null,e=!0):e=!1),e||Jn(t)),null;case 13:return Hf(e,t,a);case 4:return Dr(t,t.stateNode.containerInfo),s=t.pendingProps,e===null?t.child=Ba(t,null,s,a):lt(e,t,s,a),t.child;case 11:return zf(e,t,t.type,t.pendingProps,a);case 7:return lt(e,t,t.pendingProps,a),t.child;case 8:return lt(e,t,t.pendingProps.children,a),t.child;case 12:return lt(e,t,t.pendingProps.children,a),t.child;case 10:return s=t.pendingProps,Wn(t,t.type,s.value),lt(e,t,s.children,a),t.child;case 9:return l=t.type._context,s=t.pendingProps.children,Ra(t),l=ot(l),s=s(l),t.flags|=1,lt(e,t,s,a),t.child;case 14:return jf(e,t,t.type,t.pendingProps,a);case 15:return Mf(e,t,t.type,t.pendingProps,a);case 19:return Gf(e,t,a);case 31:return Rw(e,t,a);case 22:return Rf(e,t,a,t.pendingProps);case 24:return Ra(t),s=ot(Ge),e===null?(l=vc(),l===null&&(l=Le,c=yc(),l.pooledCache=c,c.refCount++,c!==null&&(l.pooledCacheLanes|=a),l=c),t.memoizedState={parent:s,cache:l},kc(t),Wn(t,Ge,l)):((e.lanes&a)!==0&&(xc(e,t),Ms(t,null,null,a),js()),l=e.memoizedState,c=t.memoizedState,l.parent!==s?(l={parent:s,cache:s},t.memoizedState=l,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=l),Wn(t,Ge,s)):(s=c.cache,Wn(t,Ge,s),s!==l.cache&&gc(t,[Ge],a,!0))),lt(e,t,t.pendingProps.children,a),t.child;case 29:throw t.pendingProps}throw Error(o(156,t.tag))}function Dn(e){e.flags|=4}function au(e,t,a,s,l){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(l&335544128)===l)if(e.stateNode.complete)e.flags|=8192;else if(ym())e.flags|=8192;else throw Ia=ao,wc}else e.flags&=-16777217}function Qf(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!rg(t))if(ym())e.flags|=8192;else throw Ia=ao,wc}function ko(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?Sp():536870912,e.lanes|=t,Mi|=t)}function Us(e,t){if(!ve)switch(e.tailMode){case"hidden":t=e.tail;for(var a=null;t!==null;)t.alternate!==null&&(a=t),t=t.sibling;a===null?e.tail=null:a.sibling=null;break;case"collapsed":a=e.tail;for(var s=null;a!==null;)a.alternate!==null&&(s=a),a=a.sibling;s===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:s.sibling=null}}function Oe(e){var t=e.alternate!==null&&e.alternate.child===e.child,a=0,s=0;if(t)for(var l=e.child;l!==null;)a|=l.lanes|l.childLanes,s|=l.subtreeFlags&65011712,s|=l.flags&65011712,l.return=e,l=l.sibling;else for(l=e.child;l!==null;)a|=l.lanes|l.childLanes,s|=l.subtreeFlags,s|=l.flags,l.return=e,l=l.sibling;return e.subtreeFlags|=s,e.childLanes=a,t}function Nw(e,t,a){var s=t.pendingProps;switch(dc(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Oe(t),null;case 1:return Oe(t),null;case 3:return a=t.stateNode,s=null,e!==null&&(s=e.memoizedState.cache),t.memoizedState.cache!==s&&(t.flags|=2048),qn(Ge),ii(),a.pendingContext&&(a.context=a.pendingContext,a.pendingContext=null),(e===null||e.child===null)&&(ki(t)?Dn(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,hc())),Oe(t),null;case 26:var l=t.type,c=t.memoizedState;return e===null?(Dn(t),c!==null?(Oe(t),Qf(t,c)):(Oe(t),au(t,l,null,s,a))):c?c!==e.memoizedState?(Dn(t),Oe(t),Qf(t,c)):(Oe(t),t.flags&=-16777217):(e=e.memoizedProps,e!==s&&Dn(t),Oe(t),au(t,l,e,s,a)),null;case 27:if(Or(t),a=Gn.current,l=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==s&&Dn(t);else{if(!s){if(t.stateNode===null)throw Error(o(166));return Oe(t),null}e=tt.current,ki(t)?Sh(t):(e=Xm(l,s,a),t.stateNode=e,Dn(t))}return Oe(t),null;case 5:if(Or(t),l=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==s&&Dn(t);else{if(!s){if(t.stateNode===null)throw Error(o(166));return Oe(t),null}if(c=tt.current,ki(t))Sh(t);else{var h=_o(Gn.current);switch(c){case 1:c=h.createElementNS("http://www.w3.org/2000/svg",l);break;case 2:c=h.createElementNS("http://www.w3.org/1998/Math/MathML",l);break;default:switch(l){case"svg":c=h.createElementNS("http://www.w3.org/2000/svg",l);break;case"math":c=h.createElementNS("http://www.w3.org/1998/Math/MathML",l);break;case"script":c=h.createElement("div"),c.innerHTML="<script><\/script>",c=c.removeChild(c.firstChild);break;case"select":c=typeof s.is=="string"?h.createElement("select",{is:s.is}):h.createElement("select"),s.multiple?c.multiple=!0:s.size&&(c.size=s.size);break;default:c=typeof s.is=="string"?h.createElement(l,{is:s.is}):h.createElement(l)}}c[st]=t,c[gt]=s;e:for(h=t.child;h!==null;){if(h.tag===5||h.tag===6)c.appendChild(h.stateNode);else if(h.tag!==4&&h.tag!==27&&h.child!==null){h.child.return=h,h=h.child;continue}if(h===t)break e;for(;h.sibling===null;){if(h.return===null||h.return===t)break e;h=h.return}h.sibling.return=h.return,h=h.sibling}t.stateNode=c;e:switch(ct(c,l,s),l){case"button":case"input":case"select":case"textarea":s=!!s.autoFocus;break e;case"img":s=!0;break e;default:s=!1}s&&Dn(t)}}return Oe(t),au(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,a),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==s&&Dn(t);else{if(typeof s!="string"&&t.stateNode===null)throw Error(o(166));if(e=Gn.current,ki(t)){if(e=t.stateNode,a=t.memoizedProps,s=null,l=rt,l!==null)switch(l.tag){case 27:case 5:s=l.memoizedProps}e[st]=t,e=!!(e.nodeValue===a||s!==null&&s.suppressHydrationWarning===!0||Hm(e.nodeValue,a)),e||Jn(t,!0)}else e=_o(e).createTextNode(s),e[st]=t,t.stateNode=e}return Oe(t),null;case 31:if(a=t.memoizedState,e===null||e.memoizedState!==null){if(s=ki(t),a!==null){if(e===null){if(!s)throw Error(o(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(o(557));e[st]=t}else ja(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Oe(t),e=!1}else a=hc(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=a),e=!0;if(!e)return t.flags&256?(zt(t),t):(zt(t),null);if((t.flags&128)!==0)throw Error(o(558))}return Oe(t),null;case 13:if(s=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(l=ki(t),s!==null&&s.dehydrated!==null){if(e===null){if(!l)throw Error(o(318));if(l=t.memoizedState,l=l!==null?l.dehydrated:null,!l)throw Error(o(317));l[st]=t}else ja(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Oe(t),l=!1}else l=hc(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=l),l=!0;if(!l)return t.flags&256?(zt(t),t):(zt(t),null)}return zt(t),(t.flags&128)!==0?(t.lanes=a,t):(a=s!==null,e=e!==null&&e.memoizedState!==null,a&&(s=t.child,l=null,s.alternate!==null&&s.alternate.memoizedState!==null&&s.alternate.memoizedState.cachePool!==null&&(l=s.alternate.memoizedState.cachePool.pool),c=null,s.memoizedState!==null&&s.memoizedState.cachePool!==null&&(c=s.memoizedState.cachePool.pool),c!==l&&(s.flags|=2048)),a!==e&&a&&(t.child.flags|=8192),ko(t,t.updateQueue),Oe(t),null);case 4:return ii(),e===null&&Au(t.stateNode.containerInfo),Oe(t),null;case 10:return qn(t.type),Oe(t),null;case 19:if(_e(He),s=t.memoizedState,s===null)return Oe(t),null;if(l=(t.flags&128)!==0,c=s.rendering,c===null)if(l)Us(s,!1);else{if(Be!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(c=oo(e),c!==null){for(t.flags|=128,Us(s,!1),e=c.updateQueue,t.updateQueue=e,ko(t,e),t.subtreeFlags=0,e=a,a=t.child;a!==null;)bh(a,e),a=a.sibling;return Se(He,He.current&1|2),ve&&Tn(t,s.treeForkCount),t.child}e=e.sibling}s.tail!==null&&qt()>qo&&(t.flags|=128,l=!0,Us(s,!1),t.lanes=4194304)}else{if(!l)if(e=oo(c),e!==null){if(t.flags|=128,l=!0,e=e.updateQueue,t.updateQueue=e,ko(t,e),Us(s,!0),s.tail===null&&s.tailMode==="hidden"&&!c.alternate&&!ve)return Oe(t),null}else 2*qt()-s.renderingStartTime>qo&&a!==536870912&&(t.flags|=128,l=!0,Us(s,!1),t.lanes=4194304);s.isBackwards?(c.sibling=t.child,t.child=c):(e=s.last,e!==null?e.sibling=c:t.child=c,s.last=c)}return s.tail!==null?(e=s.tail,s.rendering=e,s.tail=e.sibling,s.renderingStartTime=qt(),e.sibling=null,a=He.current,Se(He,l?a&1|2:a&1),ve&&Tn(t,s.treeForkCount),e):(Oe(t),null);case 22:case 23:return zt(t),qc(),s=t.memoizedState!==null,e!==null?e.memoizedState!==null!==s&&(t.flags|=8192):s&&(t.flags|=8192),s?(a&536870912)!==0&&(t.flags&128)===0&&(Oe(t),t.subtreeFlags&6&&(t.flags|=8192)):Oe(t),a=t.updateQueue,a!==null&&ko(t,a.retryQueue),a=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(a=e.memoizedState.cachePool.pool),s=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(s=t.memoizedState.cachePool.pool),s!==a&&(t.flags|=2048),e!==null&&_e(_a),null;case 24:return a=null,e!==null&&(a=e.memoizedState.cache),t.memoizedState.cache!==a&&(t.flags|=2048),qn(Ge),Oe(t),null;case 25:return null;case 30:return null}throw Error(o(156,t.tag))}function Iw(e,t){switch(dc(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return qn(Ge),ii(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return Or(t),null;case 31:if(t.memoizedState!==null){if(zt(t),t.alternate===null)throw Error(o(340));ja()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(zt(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(o(340));ja()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return _e(He),null;case 4:return ii(),null;case 10:return qn(t.type),null;case 22:case 23:return zt(t),qc(),e!==null&&_e(_a),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return qn(Ge),null;case 25:return null;default:return null}}function Kf(e,t){switch(dc(t),t.tag){case 3:qn(Ge),ii();break;case 26:case 27:case 5:Or(t);break;case 4:ii();break;case 31:t.memoizedState!==null&&zt(t);break;case 13:zt(t);break;case 19:_e(He);break;case 10:qn(t.type);break;case 22:case 23:zt(t),qc(),e!==null&&_e(_a);break;case 24:qn(Ge)}}function Hs(e,t){try{var a=t.updateQueue,s=a!==null?a.lastEffect:null;if(s!==null){var l=s.next;a=l;do{if((a.tag&e)===e){s=void 0;var c=a.create,h=a.inst;s=c(),h.destroy=s}a=a.next}while(a!==l)}}catch(g){Ae(t,t.return,g)}}function na(e,t,a){try{var s=t.updateQueue,l=s!==null?s.lastEffect:null;if(l!==null){var c=l.next;s=c;do{if((s.tag&e)===e){var h=s.inst,g=h.destroy;if(g!==void 0){h.destroy=void 0,l=t;var v=a,E=g;try{E()}catch(z){Ae(l,v,z)}}}s=s.next}while(s!==c)}}catch(z){Ae(t,t.return,z)}}function Ff(e){var t=e.updateQueue;if(t!==null){var a=e.stateNode;try{_h(t,a)}catch(s){Ae(e,e.return,s)}}}function Vf(e,t,a){a.props=Ha(e.type,e.memoizedProps),a.state=e.memoizedState;try{a.componentWillUnmount()}catch(s){Ae(e,t,s)}}function Ps(e,t){try{var a=e.ref;if(a!==null){switch(e.tag){case 26:case 27:case 5:var s=e.stateNode;break;case 30:s=e.stateNode;break;default:s=e.stateNode}typeof a=="function"?e.refCleanup=a(s):a.current=s}}catch(l){Ae(e,t,l)}}function pn(e,t){var a=e.ref,s=e.refCleanup;if(a!==null)if(typeof s=="function")try{s()}catch(l){Ae(e,t,l)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof a=="function")try{a(null)}catch(l){Ae(e,t,l)}else a.current=null}function Jf(e){var t=e.type,a=e.memoizedProps,s=e.stateNode;try{e:switch(t){case"button":case"input":case"select":case"textarea":a.autoFocus&&s.focus();break e;case"img":a.src?s.src=a.src:a.srcSet&&(s.srcset=a.srcSet)}}catch(l){Ae(e,e.return,l)}}function iu(e,t,a){try{var s=e.stateNode;r0(s,e.type,a,t),s[gt]=t}catch(l){Ae(e,e.return,l)}}function Wf(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&ca(e.type)||e.tag===4}function su(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||Wf(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&ca(e.type)||e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function ru(e,t,a){var s=e.tag;if(s===5||s===6)e=e.stateNode,t?(a.nodeType===9?a.body:a.nodeName==="HTML"?a.ownerDocument.body:a).insertBefore(e,t):(t=a.nodeType===9?a.body:a.nodeName==="HTML"?a.ownerDocument.body:a,t.appendChild(e),a=a._reactRootContainer,a!=null||t.onclick!==null||(t.onclick=kn));else if(s!==4&&(s===27&&ca(e.type)&&(a=e.stateNode,t=null),e=e.child,e!==null))for(ru(e,t,a),e=e.sibling;e!==null;)ru(e,t,a),e=e.sibling}function xo(e,t,a){var s=e.tag;if(s===5||s===6)e=e.stateNode,t?a.insertBefore(e,t):a.appendChild(e);else if(s!==4&&(s===27&&ca(e.type)&&(a=e.stateNode),e=e.child,e!==null))for(xo(e,t,a),e=e.sibling;e!==null;)xo(e,t,a),e=e.sibling}function $f(e){var t=e.stateNode,a=e.memoizedProps;try{for(var s=e.type,l=t.attributes;l.length;)t.removeAttributeNode(l[0]);ct(t,s,a),t[st]=e,t[gt]=a}catch(c){Ae(e,e.return,c)}}var On=!1,Ke=!1,ou=!1,Xf=typeof WeakSet=="function"?WeakSet:Set,at=null;function Bw(e,t){if(e=e.containerInfo,Cu=Go,e=ch(e),ec(e)){if("selectionStart"in e)var a={start:e.selectionStart,end:e.selectionEnd};else e:{a=(a=e.ownerDocument)&&a.defaultView||window;var s=a.getSelection&&a.getSelection();if(s&&s.rangeCount!==0){a=s.anchorNode;var l=s.anchorOffset,c=s.focusNode;s=s.focusOffset;try{a.nodeType,c.nodeType}catch{a=null;break e}var h=0,g=-1,v=-1,E=0,z=0,R=e,C=null;t:for(;;){for(var D;R!==a||l!==0&&R.nodeType!==3||(g=h+l),R!==c||s!==0&&R.nodeType!==3||(v=h+s),R.nodeType===3&&(h+=R.nodeValue.length),(D=R.firstChild)!==null;)C=R,R=D;for(;;){if(R===e)break t;if(C===a&&++E===l&&(g=h),C===c&&++z===s&&(v=h),(D=R.nextSibling)!==null)break;R=C,C=R.parentNode}R=D}a=g===-1||v===-1?null:{start:g,end:v}}else a=null}a=a||{start:0,end:0}}else a=null;for(Lu={focusedElem:e,selectionRange:a},Go=!1,at=t;at!==null;)if(t=at,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,at=e;else for(;at!==null;){switch(t=at,c=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(a=0;a<e.length;a++)l=e[a],l.ref.impl=l.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&c!==null){e=void 0,a=t,l=c.memoizedProps,c=c.memoizedState,s=a.stateNode;try{var $=Ha(a.type,l);e=s.getSnapshotBeforeUpdate($,c),s.__reactInternalSnapshotBeforeUpdate=e}catch(te){Ae(a,a.return,te)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,a=e.nodeType,a===9)zu(e);else if(a===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":zu(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(o(163))}if(e=t.sibling,e!==null){e.return=t.return,at=e;break}at=t.return}}function Zf(e,t,a){var s=a.flags;switch(a.tag){case 0:case 11:case 15:jn(e,a),s&4&&Hs(5,a);break;case 1:if(jn(e,a),s&4)if(e=a.stateNode,t===null)try{e.componentDidMount()}catch(h){Ae(a,a.return,h)}else{var l=Ha(a.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(l,t,e.__reactInternalSnapshotBeforeUpdate)}catch(h){Ae(a,a.return,h)}}s&64&&Ff(a),s&512&&Ps(a,a.return);break;case 3:if(jn(e,a),s&64&&(e=a.updateQueue,e!==null)){if(t=null,a.child!==null)switch(a.child.tag){case 27:case 5:t=a.child.stateNode;break;case 1:t=a.child.stateNode}try{_h(e,t)}catch(h){Ae(a,a.return,h)}}break;case 27:t===null&&s&4&&$f(a);case 26:case 5:jn(e,a),t===null&&s&4&&Jf(a),s&512&&Ps(a,a.return);break;case 12:jn(e,a);break;case 31:jn(e,a),s&4&&nm(e,a);break;case 13:jn(e,a),s&4&&am(e,a),s&64&&(e=a.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(a=Vw.bind(null,a),f0(e,a))));break;case 22:if(s=a.memoizedState!==null||On,!s){t=t!==null&&t.memoizedState!==null||Ke,l=On;var c=Ke;On=s,(Ke=t)&&!c?Mn(e,a,(a.subtreeFlags&8772)!==0):jn(e,a),On=l,Ke=c}break;case 30:break;default:jn(e,a)}}function em(e){var t=e.alternate;t!==null&&(e.alternate=null,em(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&Nl(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var Me=null,bt=!1;function zn(e,t,a){for(a=a.child;a!==null;)tm(e,t,a),a=a.sibling}function tm(e,t,a){if(Et&&typeof Et.onCommitFiberUnmount=="function")try{Et.onCommitFiberUnmount(ps,a)}catch{}switch(a.tag){case 26:Ke||pn(a,t),zn(e,t,a),a.memoizedState?a.memoizedState.count--:a.stateNode&&(a=a.stateNode,a.parentNode.removeChild(a));break;case 27:Ke||pn(a,t);var s=Me,l=bt;ca(a.type)&&(Me=a.stateNode,bt=!1),zn(e,t,a),$s(a.stateNode),Me=s,bt=l;break;case 5:Ke||pn(a,t);case 6:if(s=Me,l=bt,Me=null,zn(e,t,a),Me=s,bt=l,Me!==null)if(bt)try{(Me.nodeType===9?Me.body:Me.nodeName==="HTML"?Me.ownerDocument.body:Me).removeChild(a.stateNode)}catch(c){Ae(a,t,c)}else try{Me.removeChild(a.stateNode)}catch(c){Ae(a,t,c)}break;case 18:Me!==null&&(bt?(e=Me,Fm(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,a.stateNode),Pi(e)):Fm(Me,a.stateNode));break;case 4:s=Me,l=bt,Me=a.stateNode.containerInfo,bt=!0,zn(e,t,a),Me=s,bt=l;break;case 0:case 11:case 14:case 15:na(2,a,t),Ke||na(4,a,t),zn(e,t,a);break;case 1:Ke||(pn(a,t),s=a.stateNode,typeof s.componentWillUnmount=="function"&&Vf(a,t,s)),zn(e,t,a);break;case 21:zn(e,t,a);break;case 22:Ke=(s=Ke)||a.memoizedState!==null,zn(e,t,a),Ke=s;break;default:zn(e,t,a)}}function nm(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Pi(e)}catch(a){Ae(t,t.return,a)}}}function am(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Pi(e)}catch(a){Ae(t,t.return,a)}}function Uw(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new Xf),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new Xf),t;default:throw Error(o(435,e.tag))}}function So(e,t){var a=Uw(e);t.forEach(function(s){if(!a.has(s)){a.add(s);var l=Jw.bind(null,e,s);s.then(l,l)}})}function vt(e,t){var a=t.deletions;if(a!==null)for(var s=0;s<a.length;s++){var l=a[s],c=e,h=t,g=h;e:for(;g!==null;){switch(g.tag){case 27:if(ca(g.type)){Me=g.stateNode,bt=!1;break e}break;case 5:Me=g.stateNode,bt=!1;break e;case 3:case 4:Me=g.stateNode.containerInfo,bt=!0;break e}g=g.return}if(Me===null)throw Error(o(160));tm(c,h,l),Me=null,bt=!1,c=l.alternate,c!==null&&(c.return=null),l.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)im(t,e),t=t.sibling}var Xt=null;function im(e,t){var a=e.alternate,s=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:vt(t,e),wt(e),s&4&&(na(3,e,e.return),Hs(3,e),na(5,e,e.return));break;case 1:vt(t,e),wt(e),s&512&&(Ke||a===null||pn(a,a.return)),s&64&&On&&(e=e.updateQueue,e!==null&&(s=e.callbacks,s!==null&&(a=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=a===null?s:a.concat(s))));break;case 26:var l=Xt;if(vt(t,e),wt(e),s&512&&(Ke||a===null||pn(a,a.return)),s&4){var c=a!==null?a.memoizedState:null;if(s=e.memoizedState,a===null)if(s===null)if(e.stateNode===null){e:{s=e.type,a=e.memoizedProps,l=l.ownerDocument||l;t:switch(s){case"title":c=l.getElementsByTagName("title")[0],(!c||c[ms]||c[st]||c.namespaceURI==="http://www.w3.org/2000/svg"||c.hasAttribute("itemprop"))&&(c=l.createElement(s),l.head.insertBefore(c,l.querySelector("head > title"))),ct(c,s,a),c[st]=e,nt(c),s=c;break e;case"link":var h=ig("link","href",l).get(s+(a.href||""));if(h){for(var g=0;g<h.length;g++)if(c=h[g],c.getAttribute("href")===(a.href==null||a.href===""?null:a.href)&&c.getAttribute("rel")===(a.rel==null?null:a.rel)&&c.getAttribute("title")===(a.title==null?null:a.title)&&c.getAttribute("crossorigin")===(a.crossOrigin==null?null:a.crossOrigin)){h.splice(g,1);break t}}c=l.createElement(s),ct(c,s,a),l.head.appendChild(c);break;case"meta":if(h=ig("meta","content",l).get(s+(a.content||""))){for(g=0;g<h.length;g++)if(c=h[g],c.getAttribute("content")===(a.content==null?null:""+a.content)&&c.getAttribute("name")===(a.name==null?null:a.name)&&c.getAttribute("property")===(a.property==null?null:a.property)&&c.getAttribute("http-equiv")===(a.httpEquiv==null?null:a.httpEquiv)&&c.getAttribute("charset")===(a.charSet==null?null:a.charSet)){h.splice(g,1);break t}}c=l.createElement(s),ct(c,s,a),l.head.appendChild(c);break;default:throw Error(o(468,s))}c[st]=e,nt(c),s=c}e.stateNode=s}else sg(l,e.type,e.stateNode);else e.stateNode=ag(l,s,e.memoizedProps);else c!==s?(c===null?a.stateNode!==null&&(a=a.stateNode,a.parentNode.removeChild(a)):c.count--,s===null?sg(l,e.type,e.stateNode):ag(l,s,e.memoizedProps)):s===null&&e.stateNode!==null&&iu(e,e.memoizedProps,a.memoizedProps)}break;case 27:vt(t,e),wt(e),s&512&&(Ke||a===null||pn(a,a.return)),a!==null&&s&4&&iu(e,e.memoizedProps,a.memoizedProps);break;case 5:if(vt(t,e),wt(e),s&512&&(Ke||a===null||pn(a,a.return)),e.flags&32){l=e.stateNode;try{di(l,"")}catch($){Ae(e,e.return,$)}}s&4&&e.stateNode!=null&&(l=e.memoizedProps,iu(e,l,a!==null?a.memoizedProps:l)),s&1024&&(ou=!0);break;case 6:if(vt(t,e),wt(e),s&4){if(e.stateNode===null)throw Error(o(162));s=e.memoizedProps,a=e.stateNode;try{a.nodeValue=s}catch($){Ae(e,e.return,$)}}break;case 3:if(Bo=null,l=Xt,Xt=No(t.containerInfo),vt(t,e),Xt=l,wt(e),s&4&&a!==null&&a.memoizedState.isDehydrated)try{Pi(t.containerInfo)}catch($){Ae(e,e.return,$)}ou&&(ou=!1,sm(e));break;case 4:s=Xt,Xt=No(e.stateNode.containerInfo),vt(t,e),wt(e),Xt=s;break;case 12:vt(t,e),wt(e);break;case 31:vt(t,e),wt(e),s&4&&(s=e.updateQueue,s!==null&&(e.updateQueue=null,So(e,s)));break;case 13:vt(t,e),wt(e),e.child.flags&8192&&e.memoizedState!==null!=(a!==null&&a.memoizedState!==null)&&(Ao=qt()),s&4&&(s=e.updateQueue,s!==null&&(e.updateQueue=null,So(e,s)));break;case 22:l=e.memoizedState!==null;var v=a!==null&&a.memoizedState!==null,E=On,z=Ke;if(On=E||l,Ke=z||v,vt(t,e),Ke=z,On=E,wt(e),s&8192)e:for(t=e.stateNode,t._visibility=l?t._visibility&-2:t._visibility|1,l&&(a===null||v||On||Ke||Pa(e)),a=null,t=e;;){if(t.tag===5||t.tag===26){if(a===null){v=a=t;try{if(c=v.stateNode,l)h=c.style,typeof h.setProperty=="function"?h.setProperty("display","none","important"):h.display="none";else{g=v.stateNode;var R=v.memoizedProps.style,C=R!=null&&R.hasOwnProperty("display")?R.display:null;g.style.display=C==null||typeof C=="boolean"?"":(""+C).trim()}}catch($){Ae(v,v.return,$)}}}else if(t.tag===6){if(a===null){v=t;try{v.stateNode.nodeValue=l?"":v.memoizedProps}catch($){Ae(v,v.return,$)}}}else if(t.tag===18){if(a===null){v=t;try{var D=v.stateNode;l?Vm(D,!0):Vm(v.stateNode,!1)}catch($){Ae(v,v.return,$)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break e;for(;t.sibling===null;){if(t.return===null||t.return===e)break e;a===t&&(a=null),t=t.return}a===t&&(a=null),t.sibling.return=t.return,t=t.sibling}s&4&&(s=e.updateQueue,s!==null&&(a=s.retryQueue,a!==null&&(s.retryQueue=null,So(e,a))));break;case 19:vt(t,e),wt(e),s&4&&(s=e.updateQueue,s!==null&&(e.updateQueue=null,So(e,s)));break;case 30:break;case 21:break;default:vt(t,e),wt(e)}}function wt(e){var t=e.flags;if(t&2){try{for(var a,s=e.return;s!==null;){if(Wf(s)){a=s;break}s=s.return}if(a==null)throw Error(o(160));switch(a.tag){case 27:var l=a.stateNode,c=su(e);xo(e,c,l);break;case 5:var h=a.stateNode;a.flags&32&&(di(h,""),a.flags&=-33);var g=su(e);xo(e,g,h);break;case 3:case 4:var v=a.stateNode.containerInfo,E=su(e);ru(e,E,v);break;default:throw Error(o(161))}}catch(z){Ae(e,e.return,z)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function sm(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;sm(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function jn(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)Zf(e,t.alternate,t),t=t.sibling}function Pa(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:na(4,t,t.return),Pa(t);break;case 1:pn(t,t.return);var a=t.stateNode;typeof a.componentWillUnmount=="function"&&Vf(t,t.return,a),Pa(t);break;case 27:$s(t.stateNode);case 26:case 5:pn(t,t.return),Pa(t);break;case 22:t.memoizedState===null&&Pa(t);break;case 30:Pa(t);break;default:Pa(t)}e=e.sibling}}function Mn(e,t,a){for(a=a&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var s=t.alternate,l=e,c=t,h=c.flags;switch(c.tag){case 0:case 11:case 15:Mn(l,c,a),Hs(4,c);break;case 1:if(Mn(l,c,a),s=c,l=s.stateNode,typeof l.componentDidMount=="function")try{l.componentDidMount()}catch(E){Ae(s,s.return,E)}if(s=c,l=s.updateQueue,l!==null){var g=s.stateNode;try{var v=l.shared.hiddenCallbacks;if(v!==null)for(l.shared.hiddenCallbacks=null,l=0;l<v.length;l++)Rh(v[l],g)}catch(E){Ae(s,s.return,E)}}a&&h&64&&Ff(c),Ps(c,c.return);break;case 27:$f(c);case 26:case 5:Mn(l,c,a),a&&s===null&&h&4&&Jf(c),Ps(c,c.return);break;case 12:Mn(l,c,a);break;case 31:Mn(l,c,a),a&&h&4&&nm(l,c);break;case 13:Mn(l,c,a),a&&h&4&&am(l,c);break;case 22:c.memoizedState===null&&Mn(l,c,a),Ps(c,c.return);break;case 30:break;default:Mn(l,c,a)}t=t.sibling}}function lu(e,t){var a=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(a=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==a&&(e!=null&&e.refCount++,a!=null&&Cs(a))}function cu(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Cs(e))}function Zt(e,t,a,s){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)rm(e,t,a,s),t=t.sibling}function rm(e,t,a,s){var l=t.flags;switch(t.tag){case 0:case 11:case 15:Zt(e,t,a,s),l&2048&&Hs(9,t);break;case 1:Zt(e,t,a,s);break;case 3:Zt(e,t,a,s),l&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Cs(e)));break;case 12:if(l&2048){Zt(e,t,a,s),e=t.stateNode;try{var c=t.memoizedProps,h=c.id,g=c.onPostCommit;typeof g=="function"&&g(h,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(v){Ae(t,t.return,v)}}else Zt(e,t,a,s);break;case 31:Zt(e,t,a,s);break;case 13:Zt(e,t,a,s);break;case 23:break;case 22:c=t.stateNode,h=t.alternate,t.memoizedState!==null?c._visibility&2?Zt(e,t,a,s):Gs(e,t):c._visibility&2?Zt(e,t,a,s):(c._visibility|=2,Oi(e,t,a,s,(t.subtreeFlags&10256)!==0||!1)),l&2048&&lu(h,t);break;case 24:Zt(e,t,a,s),l&2048&&cu(t.alternate,t);break;default:Zt(e,t,a,s)}}function Oi(e,t,a,s,l){for(l=l&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var c=e,h=t,g=a,v=s,E=h.flags;switch(h.tag){case 0:case 11:case 15:Oi(c,h,g,v,l),Hs(8,h);break;case 23:break;case 22:var z=h.stateNode;h.memoizedState!==null?z._visibility&2?Oi(c,h,g,v,l):Gs(c,h):(z._visibility|=2,Oi(c,h,g,v,l)),l&&E&2048&&lu(h.alternate,h);break;case 24:Oi(c,h,g,v,l),l&&E&2048&&cu(h.alternate,h);break;default:Oi(c,h,g,v,l)}t=t.sibling}}function Gs(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var a=e,s=t,l=s.flags;switch(s.tag){case 22:Gs(a,s),l&2048&&lu(s.alternate,s);break;case 24:Gs(a,s),l&2048&&cu(s.alternate,s);break;default:Gs(a,s)}t=t.sibling}}var Ys=8192;function zi(e,t,a){if(e.subtreeFlags&Ys)for(e=e.child;e!==null;)om(e,t,a),e=e.sibling}function om(e,t,a){switch(e.tag){case 26:zi(e,t,a),e.flags&Ys&&e.memoizedState!==null&&q0(a,Xt,e.memoizedState,e.memoizedProps);break;case 5:zi(e,t,a);break;case 3:case 4:var s=Xt;Xt=No(e.stateNode.containerInfo),zi(e,t,a),Xt=s;break;case 22:e.memoizedState===null&&(s=e.alternate,s!==null&&s.memoizedState!==null?(s=Ys,Ys=16777216,zi(e,t,a),Ys=s):zi(e,t,a));break;default:zi(e,t,a)}}function lm(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function Qs(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var a=0;a<t.length;a++){var s=t[a];at=s,um(s,e)}lm(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)cm(e),e=e.sibling}function cm(e){switch(e.tag){case 0:case 11:case 15:Qs(e),e.flags&2048&&na(9,e,e.return);break;case 3:Qs(e);break;case 12:Qs(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,To(e)):Qs(e);break;default:Qs(e)}}function To(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var a=0;a<t.length;a++){var s=t[a];at=s,um(s,e)}lm(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:na(8,t,t.return),To(t);break;case 22:a=t.stateNode,a._visibility&2&&(a._visibility&=-3,To(t));break;default:To(t)}e=e.sibling}}function um(e,t){for(;at!==null;){var a=at;switch(a.tag){case 0:case 11:case 15:na(8,a,t);break;case 23:case 22:if(a.memoizedState!==null&&a.memoizedState.cachePool!==null){var s=a.memoizedState.cachePool.pool;s!=null&&s.refCount++}break;case 24:Cs(a.memoizedState.cache)}if(s=a.child,s!==null)s.return=a,at=s;else e:for(a=e;at!==null;){s=at;var l=s.sibling,c=s.return;if(em(s),s===a){at=null;break e}if(l!==null){l.return=c,at=l;break e}at=c}}}var Hw={getCacheForType:function(e){var t=ot(Ge),a=t.data.get(e);return a===void 0&&(a=e(),t.data.set(e,a)),a},cacheSignal:function(){return ot(Ge).controller.signal}},Pw=typeof WeakMap=="function"?WeakMap:Map,xe=0,Le=null,he=null,ge=0,Te=0,jt=null,aa=!1,ji=!1,uu=!1,Rn=0,Be=0,ia=0,Ga=0,du=0,Mt=0,Mi=0,Ks=null,kt=null,pu=!1,Ao=0,dm=0,qo=1/0,Eo=null,sa=null,Ze=0,ra=null,Ri=null,_n=0,hu=0,fu=null,pm=null,Fs=0,mu=null;function Rt(){return(xe&2)!==0&&ge!==0?ge&-ge:A.T!==null?ku():Ep()}function hm(){if(Mt===0)if((ge&536870912)===0||ve){var e=Mr;Mr<<=1,(Mr&3932160)===0&&(Mr=262144),Mt=e}else Mt=536870912;return e=Ot.current,e!==null&&(e.flags|=32),Mt}function xt(e,t,a){(e===Le&&(Te===2||Te===9)||e.cancelPendingCommit!==null)&&(_i(e,0),oa(e,ge,Mt,!1)),fs(e,a),((xe&2)===0||e!==Le)&&(e===Le&&((xe&2)===0&&(Ga|=a),Be===4&&oa(e,ge,Mt,!1)),hn(e))}function fm(e,t,a){if((xe&6)!==0)throw Error(o(327));var s=!a&&(t&127)===0&&(t&e.expiredLanes)===0||hs(e,t),l=s?Qw(e,t):yu(e,t,!0),c=s;do{if(l===0){ji&&!s&&oa(e,t,0,!1);break}else{if(a=e.current.alternate,c&&!Gw(a)){l=yu(e,t,!1),c=!1;continue}if(l===2){if(c=t,e.errorRecoveryDisabledLanes&c)var h=0;else h=e.pendingLanes&-536870913,h=h!==0?h:h&536870912?536870912:0;if(h!==0){t=h;e:{var g=e;l=Ks;var v=g.current.memoizedState.isDehydrated;if(v&&(_i(g,h).flags|=256),h=yu(g,h,!1),h!==2){if(uu&&!v){g.errorRecoveryDisabledLanes|=c,Ga|=c,l=4;break e}c=kt,kt=l,c!==null&&(kt===null?kt=c:kt.push.apply(kt,c))}l=h}if(c=!1,l!==2)continue}}if(l===1){_i(e,0),oa(e,t,0,!0);break}e:{switch(s=e,c=l,c){case 0:case 1:throw Error(o(345));case 4:if((t&4194048)!==t)break;case 6:oa(s,t,Mt,!aa);break e;case 2:kt=null;break;case 3:case 5:break;default:throw Error(o(329))}if((t&62914560)===t&&(l=Ao+300-qt(),10<l)){if(oa(s,t,Mt,!aa),_r(s,0,!0)!==0)break e;_n=t,s.timeoutHandle=Qm(mm.bind(null,s,a,kt,Eo,pu,t,Mt,Ga,Mi,aa,c,"Throttled",-0,0),l);break e}mm(s,a,kt,Eo,pu,t,Mt,Ga,Mi,aa,c,null,-0,0)}}break}while(!0);hn(e)}function mm(e,t,a,s,l,c,h,g,v,E,z,R,C,D){if(e.timeoutHandle=-1,R=t.subtreeFlags,R&8192||(R&16785408)===16785408){R={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:kn},om(t,c,R);var $=(c&62914560)===c?Ao-qt():(c&4194048)===c?dm-qt():0;if($=E0(R,$),$!==null){_n=c,e.cancelPendingCommit=$(Sm.bind(null,e,t,c,a,s,l,h,g,v,z,R,null,C,D)),oa(e,c,h,!E);return}}Sm(e,t,c,a,s,l,h,g,v)}function Gw(e){for(var t=e;;){var a=t.tag;if((a===0||a===11||a===15)&&t.flags&16384&&(a=t.updateQueue,a!==null&&(a=a.stores,a!==null)))for(var s=0;s<a.length;s++){var l=a[s],c=l.getSnapshot;l=l.value;try{if(!Lt(c(),l))return!1}catch{return!1}}if(a=t.child,t.subtreeFlags&16384&&a!==null)a.return=t,t=a;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function oa(e,t,a,s){t&=~du,t&=~Ga,e.suspendedLanes|=t,e.pingedLanes&=~t,s&&(e.warmLanes|=t),s=e.expirationTimes;for(var l=t;0<l;){var c=31-Ct(l),h=1<<c;s[c]=-1,l&=~h}a!==0&&Tp(e,a,t)}function Co(){return(xe&6)===0?(Vs(0),!1):!0}function gu(){if(he!==null){if(Te===0)var e=he.return;else e=he,An=Ma=null,zc(e),qi=null,Ds=0,e=he;for(;e!==null;)Kf(e.alternate,e),e=e.return;he=null}}function _i(e,t){var a=e.timeoutHandle;a!==-1&&(e.timeoutHandle=-1,c0(a)),a=e.cancelPendingCommit,a!==null&&(e.cancelPendingCommit=null,a()),_n=0,gu(),Le=e,he=a=Sn(e.current,null),ge=t,Te=0,jt=null,aa=!1,ji=hs(e,t),uu=!1,Mi=Mt=du=Ga=ia=Be=0,kt=Ks=null,pu=!1,(t&8)!==0&&(t|=t&32);var s=e.entangledLanes;if(s!==0)for(e=e.entanglements,s&=t;0<s;){var l=31-Ct(s),c=1<<l;t|=e[l],s&=~c}return Rn=t,Vr(),a}function gm(e,t){re=null,A.H=Is,t===Ai||t===no?(t=Oh(),Te=3):t===wc?(t=Oh(),Te=4):Te=t===Vc?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,jt=t,he===null&&(Be=1,yo(e,Pt(t,e.current)))}function ym(){var e=Ot.current;return e===null?!0:(ge&4194048)===ge?Kt===null:(ge&62914560)===ge||(ge&536870912)!==0?e===Kt:!1}function bm(){var e=A.H;return A.H=Is,e===null?Is:e}function vm(){var e=A.A;return A.A=Hw,e}function Lo(){Be=4,aa||(ge&4194048)!==ge&&Ot.current!==null||(ji=!0),(ia&134217727)===0&&(Ga&134217727)===0||Le===null||oa(Le,ge,Mt,!1)}function yu(e,t,a){var s=xe;xe|=2;var l=bm(),c=vm();(Le!==e||ge!==t)&&(Eo=null,_i(e,t)),t=!1;var h=Be;e:do try{if(Te!==0&&he!==null){var g=he,v=jt;switch(Te){case 8:gu(),h=6;break e;case 3:case 2:case 9:case 6:Ot.current===null&&(t=!0);var E=Te;if(Te=0,jt=null,Ni(e,g,v,E),a&&ji){h=0;break e}break;default:E=Te,Te=0,jt=null,Ni(e,g,v,E)}}Yw(),h=Be;break}catch(z){gm(e,z)}while(!0);return t&&e.shellSuspendCounter++,An=Ma=null,xe=s,A.H=l,A.A=c,he===null&&(Le=null,ge=0,Vr()),h}function Yw(){for(;he!==null;)wm(he)}function Qw(e,t){var a=xe;xe|=2;var s=bm(),l=vm();Le!==e||ge!==t?(Eo=null,qo=qt()+500,_i(e,t)):ji=hs(e,t);e:do try{if(Te!==0&&he!==null){t=he;var c=jt;t:switch(Te){case 1:Te=0,jt=null,Ni(e,t,c,1);break;case 2:case 9:if(Lh(c)){Te=0,jt=null,km(t);break}t=function(){Te!==2&&Te!==9||Le!==e||(Te=7),hn(e)},c.then(t,t);break e;case 3:Te=7;break e;case 4:Te=5;break e;case 7:Lh(c)?(Te=0,jt=null,km(t)):(Te=0,jt=null,Ni(e,t,c,7));break;case 5:var h=null;switch(he.tag){case 26:h=he.memoizedState;case 5:case 27:var g=he;if(h?rg(h):g.stateNode.complete){Te=0,jt=null;var v=g.sibling;if(v!==null)he=v;else{var E=g.return;E!==null?(he=E,Do(E)):he=null}break t}}Te=0,jt=null,Ni(e,t,c,5);break;case 6:Te=0,jt=null,Ni(e,t,c,6);break;case 8:gu(),Be=6;break e;default:throw Error(o(462))}}Kw();break}catch(z){gm(e,z)}while(!0);return An=Ma=null,A.H=s,A.A=l,xe=a,he!==null?0:(Le=null,ge=0,Vr(),Be)}function Kw(){for(;he!==null&&!mv();)wm(he)}function wm(e){var t=Yf(e.alternate,e,Rn);e.memoizedProps=e.pendingProps,t===null?Do(e):he=t}function km(e){var t=e,a=t.alternate;switch(t.tag){case 15:case 0:t=If(a,t,t.pendingProps,t.type,void 0,ge);break;case 11:t=If(a,t,t.pendingProps,t.type.render,t.ref,ge);break;case 5:zc(t);default:Kf(a,t),t=he=bh(t,Rn),t=Yf(a,t,Rn)}e.memoizedProps=e.pendingProps,t===null?Do(e):he=t}function Ni(e,t,a,s){An=Ma=null,zc(t),qi=null,Ds=0;var l=t.return;try{if(Mw(e,l,t,a,ge)){Be=1,yo(e,Pt(a,e.current)),he=null;return}}catch(c){if(l!==null)throw he=l,c;Be=1,yo(e,Pt(a,e.current)),he=null;return}t.flags&32768?(ve||s===1?e=!0:ji||(ge&536870912)!==0?e=!1:(aa=e=!0,(s===2||s===9||s===3||s===6)&&(s=Ot.current,s!==null&&s.tag===13&&(s.flags|=16384))),xm(t,e)):Do(t)}function Do(e){var t=e;do{if((t.flags&32768)!==0){xm(t,aa);return}e=t.return;var a=Nw(t.alternate,t,Rn);if(a!==null){he=a;return}if(t=t.sibling,t!==null){he=t;return}he=t=e}while(t!==null);Be===0&&(Be=5)}function xm(e,t){do{var a=Iw(e.alternate,e);if(a!==null){a.flags&=32767,he=a;return}if(a=e.return,a!==null&&(a.flags|=32768,a.subtreeFlags=0,a.deletions=null),!t&&(e=e.sibling,e!==null)){he=e;return}he=e=a}while(e!==null);Be=6,he=null}function Sm(e,t,a,s,l,c,h,g,v){e.cancelPendingCommit=null;do Oo();while(Ze!==0);if((xe&6)!==0)throw Error(o(327));if(t!==null){if(t===e.current)throw Error(o(177));if(c=t.lanes|t.childLanes,c|=sc,Av(e,a,c,h,g,v),e===Le&&(he=Le=null,ge=0),Ri=t,ra=e,_n=a,hu=c,fu=l,pm=s,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,Ww(zr,function(){return Cm(),null})):(e.callbackNode=null,e.callbackPriority=0),s=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||s){s=A.T,A.T=null,l=U.p,U.p=2,h=xe,xe|=4;try{Bw(e,t,a)}finally{xe=h,U.p=l,A.T=s}}Ze=1,Tm(),Am(),qm()}}function Tm(){if(Ze===1){Ze=0;var e=ra,t=Ri,a=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||a){a=A.T,A.T=null;var s=U.p;U.p=2;var l=xe;xe|=4;try{im(t,e);var c=Lu,h=ch(e.containerInfo),g=c.focusedElem,v=c.selectionRange;if(h!==g&&g&&g.ownerDocument&&lh(g.ownerDocument.documentElement,g)){if(v!==null&&ec(g)){var E=v.start,z=v.end;if(z===void 0&&(z=E),"selectionStart"in g)g.selectionStart=E,g.selectionEnd=Math.min(z,g.value.length);else{var R=g.ownerDocument||document,C=R&&R.defaultView||window;if(C.getSelection){var D=C.getSelection(),$=g.textContent.length,te=Math.min(v.start,$),Ce=v.end===void 0?te:Math.min(v.end,$);!D.extend&&te>Ce&&(h=Ce,Ce=te,te=h);var S=oh(g,te),w=oh(g,Ce);if(S&&w&&(D.rangeCount!==1||D.anchorNode!==S.node||D.anchorOffset!==S.offset||D.focusNode!==w.node||D.focusOffset!==w.offset)){var q=R.createRange();q.setStart(S.node,S.offset),D.removeAllRanges(),te>Ce?(D.addRange(q),D.extend(w.node,w.offset)):(q.setEnd(w.node,w.offset),D.addRange(q))}}}}for(R=[],D=g;D=D.parentNode;)D.nodeType===1&&R.push({element:D,left:D.scrollLeft,top:D.scrollTop});for(typeof g.focus=="function"&&g.focus(),g=0;g<R.length;g++){var M=R[g];M.element.scrollLeft=M.left,M.element.scrollTop=M.top}}Go=!!Cu,Lu=Cu=null}finally{xe=l,U.p=s,A.T=a}}e.current=t,Ze=2}}function Am(){if(Ze===2){Ze=0;var e=ra,t=Ri,a=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||a){a=A.T,A.T=null;var s=U.p;U.p=2;var l=xe;xe|=4;try{Zf(e,t.alternate,t)}finally{xe=l,U.p=s,A.T=a}}Ze=3}}function qm(){if(Ze===4||Ze===3){Ze=0,gv();var e=ra,t=Ri,a=_n,s=pm;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?Ze=5:(Ze=0,Ri=ra=null,Em(e,e.pendingLanes));var l=e.pendingLanes;if(l===0&&(sa=null),Rl(a),t=t.stateNode,Et&&typeof Et.onCommitFiberRoot=="function")try{Et.onCommitFiberRoot(ps,t,void 0,(t.current.flags&128)===128)}catch{}if(s!==null){t=A.T,l=U.p,U.p=2,A.T=null;try{for(var c=e.onRecoverableError,h=0;h<s.length;h++){var g=s[h];c(g.value,{componentStack:g.stack})}}finally{A.T=t,U.p=l}}(_n&3)!==0&&Oo(),hn(e),l=e.pendingLanes,(a&261930)!==0&&(l&42)!==0?e===mu?Fs++:(Fs=0,mu=e):Fs=0,Vs(0)}}function Em(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,Cs(t)))}function Oo(){return Tm(),Am(),qm(),Cm()}function Cm(){if(Ze!==5)return!1;var e=ra,t=hu;hu=0;var a=Rl(_n),s=A.T,l=U.p;try{U.p=32>a?32:a,A.T=null,a=fu,fu=null;var c=ra,h=_n;if(Ze=0,Ri=ra=null,_n=0,(xe&6)!==0)throw Error(o(331));var g=xe;if(xe|=4,cm(c.current),rm(c,c.current,h,a),xe=g,Vs(0,!1),Et&&typeof Et.onPostCommitFiberRoot=="function")try{Et.onPostCommitFiberRoot(ps,c)}catch{}return!0}finally{U.p=l,A.T=s,Em(e,t)}}function Lm(e,t,a){t=Pt(a,t),t=Fc(e.stateNode,t,2),e=Zn(e,t,2),e!==null&&(fs(e,2),hn(e))}function Ae(e,t,a){if(e.tag===3)Lm(e,e,a);else for(;t!==null;){if(t.tag===3){Lm(t,e,a);break}else if(t.tag===1){var s=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof s.componentDidCatch=="function"&&(sa===null||!sa.has(s))){e=Pt(a,e),a=Df(2),s=Zn(t,a,2),s!==null&&(Of(a,s,t,e),fs(s,2),hn(s));break}}t=t.return}}function bu(e,t,a){var s=e.pingCache;if(s===null){s=e.pingCache=new Pw;var l=new Set;s.set(t,l)}else l=s.get(t),l===void 0&&(l=new Set,s.set(t,l));l.has(a)||(uu=!0,l.add(a),e=Fw.bind(null,e,t,a),t.then(e,e))}function Fw(e,t,a){var s=e.pingCache;s!==null&&s.delete(t),e.pingedLanes|=e.suspendedLanes&a,e.warmLanes&=~a,Le===e&&(ge&a)===a&&(Be===4||Be===3&&(ge&62914560)===ge&&300>qt()-Ao?(xe&2)===0&&_i(e,0):du|=a,Mi===ge&&(Mi=0)),hn(e)}function Dm(e,t){t===0&&(t=Sp()),e=Oa(e,t),e!==null&&(fs(e,t),hn(e))}function Vw(e){var t=e.memoizedState,a=0;t!==null&&(a=t.retryLane),Dm(e,a)}function Jw(e,t){var a=0;switch(e.tag){case 31:case 13:var s=e.stateNode,l=e.memoizedState;l!==null&&(a=l.retryLane);break;case 19:s=e.stateNode;break;case 22:s=e.stateNode._retryCache;break;default:throw Error(o(314))}s!==null&&s.delete(t),Dm(e,a)}function Ww(e,t){return Ol(e,t)}var zo=null,Ii=null,vu=!1,jo=!1,wu=!1,la=0;function hn(e){e!==Ii&&e.next===null&&(Ii===null?zo=Ii=e:Ii=Ii.next=e),jo=!0,vu||(vu=!0,Xw())}function Vs(e,t){if(!wu&&jo){wu=!0;do for(var a=!1,s=zo;s!==null;){if(e!==0){var l=s.pendingLanes;if(l===0)var c=0;else{var h=s.suspendedLanes,g=s.pingedLanes;c=(1<<31-Ct(42|e)+1)-1,c&=l&~(h&~g),c=c&201326741?c&201326741|1:c?c|2:0}c!==0&&(a=!0,Mm(s,c))}else c=ge,c=_r(s,s===Le?c:0,s.cancelPendingCommit!==null||s.timeoutHandle!==-1),(c&3)===0||hs(s,c)||(a=!0,Mm(s,c));s=s.next}while(a);wu=!1}}function $w(){Om()}function Om(){jo=vu=!1;var e=0;la!==0&&l0()&&(e=la);for(var t=qt(),a=null,s=zo;s!==null;){var l=s.next,c=zm(s,t);c===0?(s.next=null,a===null?zo=l:a.next=l,l===null&&(Ii=a)):(a=s,(e!==0||(c&3)!==0)&&(jo=!0)),s=l}Ze!==0&&Ze!==5||Vs(e),la!==0&&(la=0)}function zm(e,t){for(var a=e.suspendedLanes,s=e.pingedLanes,l=e.expirationTimes,c=e.pendingLanes&-62914561;0<c;){var h=31-Ct(c),g=1<<h,v=l[h];v===-1?((g&a)===0||(g&s)!==0)&&(l[h]=Tv(g,t)):v<=t&&(e.expiredLanes|=g),c&=~g}if(t=Le,a=ge,a=_r(e,e===t?a:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),s=e.callbackNode,a===0||e===t&&(Te===2||Te===9)||e.cancelPendingCommit!==null)return s!==null&&s!==null&&zl(s),e.callbackNode=null,e.callbackPriority=0;if((a&3)===0||hs(e,a)){if(t=a&-a,t===e.callbackPriority)return t;switch(s!==null&&zl(s),Rl(a)){case 2:case 8:a=kp;break;case 32:a=zr;break;case 268435456:a=xp;break;default:a=zr}return s=jm.bind(null,e),a=Ol(a,s),e.callbackPriority=t,e.callbackNode=a,t}return s!==null&&s!==null&&zl(s),e.callbackPriority=2,e.callbackNode=null,2}function jm(e,t){if(Ze!==0&&Ze!==5)return e.callbackNode=null,e.callbackPriority=0,null;var a=e.callbackNode;if(Oo()&&e.callbackNode!==a)return null;var s=ge;return s=_r(e,e===Le?s:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),s===0?null:(fm(e,s,t),zm(e,qt()),e.callbackNode!=null&&e.callbackNode===a?jm.bind(null,e):null)}function Mm(e,t){if(Oo())return null;fm(e,t,!0)}function Xw(){u0(function(){(xe&6)!==0?Ol(wp,$w):Om()})}function ku(){if(la===0){var e=Si;e===0&&(e=jr,jr<<=1,(jr&261888)===0&&(jr=256)),la=e}return la}function Rm(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:Ur(""+e)}function _m(e,t){var a=t.ownerDocument.createElement("input");return a.name=t.name,a.value=t.value,e.id&&a.setAttribute("form",e.id),t.parentNode.insertBefore(a,t),e=new FormData(e),a.parentNode.removeChild(a),e}function Zw(e,t,a,s,l){if(t==="submit"&&a&&a.stateNode===l){var c=Rm((l[gt]||null).action),h=s.submitter;h&&(t=(t=h[gt]||null)?Rm(t.formAction):h.getAttribute("formAction"),t!==null&&(c=t,h=null));var g=new Yr("action","action",null,s,l);e.push({event:g,listeners:[{instance:null,listener:function(){if(s.defaultPrevented){if(la!==0){var v=h?_m(l,h):new FormData(l);Hc(a,{pending:!0,data:v,method:l.method,action:c},null,v)}}else typeof c=="function"&&(g.preventDefault(),v=h?_m(l,h):new FormData(l),Hc(a,{pending:!0,data:v,method:l.method,action:c},c,v))},currentTarget:l}]})}}for(var xu=0;xu<ic.length;xu++){var Su=ic[xu],e0=Su.toLowerCase(),t0=Su[0].toUpperCase()+Su.slice(1);$t(e0,"on"+t0)}$t(ph,"onAnimationEnd"),$t(hh,"onAnimationIteration"),$t(fh,"onAnimationStart"),$t("dblclick","onDoubleClick"),$t("focusin","onFocus"),$t("focusout","onBlur"),$t(yw,"onTransitionRun"),$t(bw,"onTransitionStart"),$t(vw,"onTransitionCancel"),$t(mh,"onTransitionEnd"),ci("onMouseEnter",["mouseout","mouseover"]),ci("onMouseLeave",["mouseout","mouseover"]),ci("onPointerEnter",["pointerout","pointerover"]),ci("onPointerLeave",["pointerout","pointerover"]),Ea("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),Ea("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),Ea("onBeforeInput",["compositionend","keypress","textInput","paste"]),Ea("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),Ea("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),Ea("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Js="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),n0=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Js));function Nm(e,t){t=(t&4)!==0;for(var a=0;a<e.length;a++){var s=e[a],l=s.event;s=s.listeners;e:{var c=void 0;if(t)for(var h=s.length-1;0<=h;h--){var g=s[h],v=g.instance,E=g.currentTarget;if(g=g.listener,v!==c&&l.isPropagationStopped())break e;c=g,l.currentTarget=E;try{c(l)}catch(z){Fr(z)}l.currentTarget=null,c=v}else for(h=0;h<s.length;h++){if(g=s[h],v=g.instance,E=g.currentTarget,g=g.listener,v!==c&&l.isPropagationStopped())break e;c=g,l.currentTarget=E;try{c(l)}catch(z){Fr(z)}l.currentTarget=null,c=v}}}}function fe(e,t){var a=t[_l];a===void 0&&(a=t[_l]=new Set);var s=e+"__bubble";a.has(s)||(Im(t,e,2,!1),a.add(s))}function Tu(e,t,a){var s=0;t&&(s|=4),Im(a,e,s,t)}var Mo="_reactListening"+Math.random().toString(36).slice(2);function Au(e){if(!e[Mo]){e[Mo]=!0,Dp.forEach(function(a){a!=="selectionchange"&&(n0.has(a)||Tu(a,!1,e),Tu(a,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[Mo]||(t[Mo]=!0,Tu("selectionchange",!1,t))}}function Im(e,t,a,s){switch(hg(t)){case 2:var l=D0;break;case 8:l=O0;break;default:l=Uu}a=l.bind(null,t,a,e),l=void 0,!Ql||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(l=!0),s?l!==void 0?e.addEventListener(t,a,{capture:!0,passive:l}):e.addEventListener(t,a,!0):l!==void 0?e.addEventListener(t,a,{passive:l}):e.addEventListener(t,a,!1)}function qu(e,t,a,s,l){var c=s;if((t&1)===0&&(t&2)===0&&s!==null)e:for(;;){if(s===null)return;var h=s.tag;if(h===3||h===4){var g=s.stateNode.containerInfo;if(g===l)break;if(h===4)for(h=s.return;h!==null;){var v=h.tag;if((v===3||v===4)&&h.stateNode.containerInfo===l)return;h=h.return}for(;g!==null;){if(h=ri(g),h===null)return;if(v=h.tag,v===5||v===6||v===26||v===27){s=c=h;continue e}g=g.parentNode}}s=s.return}Pp(function(){var E=c,z=Gl(a),R=[];e:{var C=gh.get(e);if(C!==void 0){var D=Yr,$=e;switch(e){case"keypress":if(Pr(a)===0)break e;case"keydown":case"keyup":D=Jv;break;case"focusin":$="focus",D=Jl;break;case"focusout":$="blur",D=Jl;break;case"beforeblur":case"afterblur":D=Jl;break;case"click":if(a.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":D=Qp;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":D=Nv;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":D=Xv;break;case ph:case hh:case fh:D=Uv;break;case mh:D=ew;break;case"scroll":case"scrollend":D=Rv;break;case"wheel":D=nw;break;case"copy":case"cut":case"paste":D=Pv;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":D=Fp;break;case"toggle":case"beforetoggle":D=iw}var te=(t&4)!==0,Ce=!te&&(e==="scroll"||e==="scrollend"),S=te?C!==null?C+"Capture":null:C;te=[];for(var w=E,q;w!==null;){var M=w;if(q=M.stateNode,M=M.tag,M!==5&&M!==26&&M!==27||q===null||S===null||(M=ys(w,S),M!=null&&te.push(Ws(w,M,q))),Ce)break;w=w.return}0<te.length&&(C=new D(C,$,null,a,z),R.push({event:C,listeners:te}))}}if((t&7)===0){e:{if(C=e==="mouseover"||e==="pointerover",D=e==="mouseout"||e==="pointerout",C&&a!==Pl&&($=a.relatedTarget||a.fromElement)&&(ri($)||$[si]))break e;if((D||C)&&(C=z.window===z?z:(C=z.ownerDocument)?C.defaultView||C.parentWindow:window,D?($=a.relatedTarget||a.toElement,D=E,$=$?ri($):null,$!==null&&(Ce=d($),te=$.tag,$!==Ce||te!==5&&te!==27&&te!==6)&&($=null)):(D=null,$=E),D!==$)){if(te=Qp,M="onMouseLeave",S="onMouseEnter",w="mouse",(e==="pointerout"||e==="pointerover")&&(te=Fp,M="onPointerLeave",S="onPointerEnter",w="pointer"),Ce=D==null?C:gs(D),q=$==null?C:gs($),C=new te(M,w+"leave",D,a,z),C.target=Ce,C.relatedTarget=q,M=null,ri(z)===E&&(te=new te(S,w+"enter",$,a,z),te.target=q,te.relatedTarget=Ce,M=te),Ce=M,D&&$)t:{for(te=a0,S=D,w=$,q=0,M=S;M;M=te(M))q++;M=0;for(var ee=w;ee;ee=te(ee))M++;for(;0<q-M;)S=te(S),q--;for(;0<M-q;)w=te(w),M--;for(;q--;){if(S===w||w!==null&&S===w.alternate){te=S;break t}S=te(S),w=te(w)}te=null}else te=null;D!==null&&Bm(R,C,D,te,!1),$!==null&&Ce!==null&&Bm(R,Ce,$,te,!0)}}e:{if(C=E?gs(E):window,D=C.nodeName&&C.nodeName.toLowerCase(),D==="select"||D==="input"&&C.type==="file")var we=th;else if(Zp(C))if(nh)we=fw;else{we=pw;var X=dw}else D=C.nodeName,!D||D.toLowerCase()!=="input"||C.type!=="checkbox"&&C.type!=="radio"?E&&Hl(E.elementType)&&(we=th):we=hw;if(we&&(we=we(e,E))){eh(R,we,a,z);break e}X&&X(e,C,E),e==="focusout"&&E&&C.type==="number"&&E.memoizedProps.value!=null&&Ul(C,"number",C.value)}switch(X=E?gs(E):window,e){case"focusin":(Zp(X)||X.contentEditable==="true")&&(mi=X,tc=E,As=null);break;case"focusout":As=tc=mi=null;break;case"mousedown":nc=!0;break;case"contextmenu":case"mouseup":case"dragend":nc=!1,uh(R,a,z);break;case"selectionchange":if(gw)break;case"keydown":case"keyup":uh(R,a,z)}var le;if($l)e:{switch(e){case"compositionstart":var ye="onCompositionStart";break e;case"compositionend":ye="onCompositionEnd";break e;case"compositionupdate":ye="onCompositionUpdate";break e}ye=void 0}else fi?$p(e,a)&&(ye="onCompositionEnd"):e==="keydown"&&a.keyCode===229&&(ye="onCompositionStart");ye&&(Vp&&a.locale!=="ko"&&(fi||ye!=="onCompositionStart"?ye==="onCompositionEnd"&&fi&&(le=Gp()):(Kn=z,Kl="value"in Kn?Kn.value:Kn.textContent,fi=!0)),X=Ro(E,ye),0<X.length&&(ye=new Kp(ye,e,null,a,z),R.push({event:ye,listeners:X}),le?ye.data=le:(le=Xp(a),le!==null&&(ye.data=le)))),(le=rw?ow(e,a):lw(e,a))&&(ye=Ro(E,"onBeforeInput"),0<ye.length&&(X=new Kp("onBeforeInput","beforeinput",null,a,z),R.push({event:X,listeners:ye}),X.data=le)),Zw(R,e,E,a,z)}Nm(R,t)})}function Ws(e,t,a){return{instance:e,listener:t,currentTarget:a}}function Ro(e,t){for(var a=t+"Capture",s=[];e!==null;){var l=e,c=l.stateNode;if(l=l.tag,l!==5&&l!==26&&l!==27||c===null||(l=ys(e,a),l!=null&&s.unshift(Ws(e,l,c)),l=ys(e,t),l!=null&&s.push(Ws(e,l,c))),e.tag===3)return s;e=e.return}return[]}function a0(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function Bm(e,t,a,s,l){for(var c=t._reactName,h=[];a!==null&&a!==s;){var g=a,v=g.alternate,E=g.stateNode;if(g=g.tag,v!==null&&v===s)break;g!==5&&g!==26&&g!==27||E===null||(v=E,l?(E=ys(a,c),E!=null&&h.unshift(Ws(a,E,v))):l||(E=ys(a,c),E!=null&&h.push(Ws(a,E,v)))),a=a.return}h.length!==0&&e.push({event:t,listeners:h})}var i0=/\r\n?/g,s0=/\u0000|\uFFFD/g;function Um(e){return(typeof e=="string"?e:""+e).replace(i0,`
`).replace(s0,"")}function Hm(e,t){return t=Um(t),Um(e)===t}function Ee(e,t,a,s,l,c){switch(a){case"children":typeof s=="string"?t==="body"||t==="textarea"&&s===""||di(e,s):(typeof s=="number"||typeof s=="bigint")&&t!=="body"&&di(e,""+s);break;case"className":Ir(e,"class",s);break;case"tabIndex":Ir(e,"tabindex",s);break;case"dir":case"role":case"viewBox":case"width":case"height":Ir(e,a,s);break;case"style":Up(e,s,c);break;case"data":if(t!=="object"){Ir(e,"data",s);break}case"src":case"href":if(s===""&&(t!=="a"||a!=="href")){e.removeAttribute(a);break}if(s==null||typeof s=="function"||typeof s=="symbol"||typeof s=="boolean"){e.removeAttribute(a);break}s=Ur(""+s),e.setAttribute(a,s);break;case"action":case"formAction":if(typeof s=="function"){e.setAttribute(a,"javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");break}else typeof c=="function"&&(a==="formAction"?(t!=="input"&&Ee(e,t,"name",l.name,l,null),Ee(e,t,"formEncType",l.formEncType,l,null),Ee(e,t,"formMethod",l.formMethod,l,null),Ee(e,t,"formTarget",l.formTarget,l,null)):(Ee(e,t,"encType",l.encType,l,null),Ee(e,t,"method",l.method,l,null),Ee(e,t,"target",l.target,l,null)));if(s==null||typeof s=="symbol"||typeof s=="boolean"){e.removeAttribute(a);break}s=Ur(""+s),e.setAttribute(a,s);break;case"onClick":s!=null&&(e.onclick=kn);break;case"onScroll":s!=null&&fe("scroll",e);break;case"onScrollEnd":s!=null&&fe("scrollend",e);break;case"dangerouslySetInnerHTML":if(s!=null){if(typeof s!="object"||!("__html"in s))throw Error(o(61));if(a=s.__html,a!=null){if(l.children!=null)throw Error(o(60));e.innerHTML=a}}break;case"multiple":e.multiple=s&&typeof s!="function"&&typeof s!="symbol";break;case"muted":e.muted=s&&typeof s!="function"&&typeof s!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(s==null||typeof s=="function"||typeof s=="boolean"||typeof s=="symbol"){e.removeAttribute("xlink:href");break}a=Ur(""+s),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",a);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":s!=null&&typeof s!="function"&&typeof s!="symbol"?e.setAttribute(a,""+s):e.removeAttribute(a);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":s&&typeof s!="function"&&typeof s!="symbol"?e.setAttribute(a,""):e.removeAttribute(a);break;case"capture":case"download":s===!0?e.setAttribute(a,""):s!==!1&&s!=null&&typeof s!="function"&&typeof s!="symbol"?e.setAttribute(a,s):e.removeAttribute(a);break;case"cols":case"rows":case"size":case"span":s!=null&&typeof s!="function"&&typeof s!="symbol"&&!isNaN(s)&&1<=s?e.setAttribute(a,s):e.removeAttribute(a);break;case"rowSpan":case"start":s==null||typeof s=="function"||typeof s=="symbol"||isNaN(s)?e.removeAttribute(a):e.setAttribute(a,s);break;case"popover":fe("beforetoggle",e),fe("toggle",e),Nr(e,"popover",s);break;case"xlinkActuate":wn(e,"http://www.w3.org/1999/xlink","xlink:actuate",s);break;case"xlinkArcrole":wn(e,"http://www.w3.org/1999/xlink","xlink:arcrole",s);break;case"xlinkRole":wn(e,"http://www.w3.org/1999/xlink","xlink:role",s);break;case"xlinkShow":wn(e,"http://www.w3.org/1999/xlink","xlink:show",s);break;case"xlinkTitle":wn(e,"http://www.w3.org/1999/xlink","xlink:title",s);break;case"xlinkType":wn(e,"http://www.w3.org/1999/xlink","xlink:type",s);break;case"xmlBase":wn(e,"http://www.w3.org/XML/1998/namespace","xml:base",s);break;case"xmlLang":wn(e,"http://www.w3.org/XML/1998/namespace","xml:lang",s);break;case"xmlSpace":wn(e,"http://www.w3.org/XML/1998/namespace","xml:space",s);break;case"is":Nr(e,"is",s);break;case"innerText":case"textContent":break;default:(!(2<a.length)||a[0]!=="o"&&a[0]!=="O"||a[1]!=="n"&&a[1]!=="N")&&(a=jv.get(a)||a,Nr(e,a,s))}}function Eu(e,t,a,s,l,c){switch(a){case"style":Up(e,s,c);break;case"dangerouslySetInnerHTML":if(s!=null){if(typeof s!="object"||!("__html"in s))throw Error(o(61));if(a=s.__html,a!=null){if(l.children!=null)throw Error(o(60));e.innerHTML=a}}break;case"children":typeof s=="string"?di(e,s):(typeof s=="number"||typeof s=="bigint")&&di(e,""+s);break;case"onScroll":s!=null&&fe("scroll",e);break;case"onScrollEnd":s!=null&&fe("scrollend",e);break;case"onClick":s!=null&&(e.onclick=kn);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!Op.hasOwnProperty(a))e:{if(a[0]==="o"&&a[1]==="n"&&(l=a.endsWith("Capture"),t=a.slice(2,l?a.length-7:void 0),c=e[gt]||null,c=c!=null?c[a]:null,typeof c=="function"&&e.removeEventListener(t,c,l),typeof s=="function")){typeof c!="function"&&c!==null&&(a in e?e[a]=null:e.hasAttribute(a)&&e.removeAttribute(a)),e.addEventListener(t,s,l);break e}a in e?e[a]=s:s===!0?e.setAttribute(a,""):Nr(e,a,s)}}}function ct(e,t,a){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":fe("error",e),fe("load",e);var s=!1,l=!1,c;for(c in a)if(a.hasOwnProperty(c)){var h=a[c];if(h!=null)switch(c){case"src":s=!0;break;case"srcSet":l=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(o(137,t));default:Ee(e,t,c,h,a,null)}}l&&Ee(e,t,"srcSet",a.srcSet,a,null),s&&Ee(e,t,"src",a.src,a,null);return;case"input":fe("invalid",e);var g=c=h=l=null,v=null,E=null;for(s in a)if(a.hasOwnProperty(s)){var z=a[s];if(z!=null)switch(s){case"name":l=z;break;case"type":h=z;break;case"checked":v=z;break;case"defaultChecked":E=z;break;case"value":c=z;break;case"defaultValue":g=z;break;case"children":case"dangerouslySetInnerHTML":if(z!=null)throw Error(o(137,t));break;default:Ee(e,t,s,z,a,null)}}_p(e,c,g,v,E,h,l,!1);return;case"select":fe("invalid",e),s=h=c=null;for(l in a)if(a.hasOwnProperty(l)&&(g=a[l],g!=null))switch(l){case"value":c=g;break;case"defaultValue":h=g;break;case"multiple":s=g;default:Ee(e,t,l,g,a,null)}t=c,a=h,e.multiple=!!s,t!=null?ui(e,!!s,t,!1):a!=null&&ui(e,!!s,a,!0);return;case"textarea":fe("invalid",e),c=l=s=null;for(h in a)if(a.hasOwnProperty(h)&&(g=a[h],g!=null))switch(h){case"value":s=g;break;case"defaultValue":l=g;break;case"children":c=g;break;case"dangerouslySetInnerHTML":if(g!=null)throw Error(o(91));break;default:Ee(e,t,h,g,a,null)}Ip(e,s,l,c);return;case"option":for(v in a)if(a.hasOwnProperty(v)&&(s=a[v],s!=null))switch(v){case"selected":e.selected=s&&typeof s!="function"&&typeof s!="symbol";break;default:Ee(e,t,v,s,a,null)}return;case"dialog":fe("beforetoggle",e),fe("toggle",e),fe("cancel",e),fe("close",e);break;case"iframe":case"object":fe("load",e);break;case"video":case"audio":for(s=0;s<Js.length;s++)fe(Js[s],e);break;case"image":fe("error",e),fe("load",e);break;case"details":fe("toggle",e);break;case"embed":case"source":case"link":fe("error",e),fe("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(E in a)if(a.hasOwnProperty(E)&&(s=a[E],s!=null))switch(E){case"children":case"dangerouslySetInnerHTML":throw Error(o(137,t));default:Ee(e,t,E,s,a,null)}return;default:if(Hl(t)){for(z in a)a.hasOwnProperty(z)&&(s=a[z],s!==void 0&&Eu(e,t,z,s,a,void 0));return}}for(g in a)a.hasOwnProperty(g)&&(s=a[g],s!=null&&Ee(e,t,g,s,a,null))}function r0(e,t,a,s){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var l=null,c=null,h=null,g=null,v=null,E=null,z=null;for(D in a){var R=a[D];if(a.hasOwnProperty(D)&&R!=null)switch(D){case"checked":break;case"value":break;case"defaultValue":v=R;default:s.hasOwnProperty(D)||Ee(e,t,D,null,s,R)}}for(var C in s){var D=s[C];if(R=a[C],s.hasOwnProperty(C)&&(D!=null||R!=null))switch(C){case"type":c=D;break;case"name":l=D;break;case"checked":E=D;break;case"defaultChecked":z=D;break;case"value":h=D;break;case"defaultValue":g=D;break;case"children":case"dangerouslySetInnerHTML":if(D!=null)throw Error(o(137,t));break;default:D!==R&&Ee(e,t,C,D,s,R)}}Bl(e,h,g,v,E,z,c,l);return;case"select":D=h=g=C=null;for(c in a)if(v=a[c],a.hasOwnProperty(c)&&v!=null)switch(c){case"value":break;case"multiple":D=v;default:s.hasOwnProperty(c)||Ee(e,t,c,null,s,v)}for(l in s)if(c=s[l],v=a[l],s.hasOwnProperty(l)&&(c!=null||v!=null))switch(l){case"value":C=c;break;case"defaultValue":g=c;break;case"multiple":h=c;default:c!==v&&Ee(e,t,l,c,s,v)}t=g,a=h,s=D,C!=null?ui(e,!!a,C,!1):!!s!=!!a&&(t!=null?ui(e,!!a,t,!0):ui(e,!!a,a?[]:"",!1));return;case"textarea":D=C=null;for(g in a)if(l=a[g],a.hasOwnProperty(g)&&l!=null&&!s.hasOwnProperty(g))switch(g){case"value":break;case"children":break;default:Ee(e,t,g,null,s,l)}for(h in s)if(l=s[h],c=a[h],s.hasOwnProperty(h)&&(l!=null||c!=null))switch(h){case"value":C=l;break;case"defaultValue":D=l;break;case"children":break;case"dangerouslySetInnerHTML":if(l!=null)throw Error(o(91));break;default:l!==c&&Ee(e,t,h,l,s,c)}Np(e,C,D);return;case"option":for(var $ in a)if(C=a[$],a.hasOwnProperty($)&&C!=null&&!s.hasOwnProperty($))switch($){case"selected":e.selected=!1;break;default:Ee(e,t,$,null,s,C)}for(v in s)if(C=s[v],D=a[v],s.hasOwnProperty(v)&&C!==D&&(C!=null||D!=null))switch(v){case"selected":e.selected=C&&typeof C!="function"&&typeof C!="symbol";break;default:Ee(e,t,v,C,s,D)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var te in a)C=a[te],a.hasOwnProperty(te)&&C!=null&&!s.hasOwnProperty(te)&&Ee(e,t,te,null,s,C);for(E in s)if(C=s[E],D=a[E],s.hasOwnProperty(E)&&C!==D&&(C!=null||D!=null))switch(E){case"children":case"dangerouslySetInnerHTML":if(C!=null)throw Error(o(137,t));break;default:Ee(e,t,E,C,s,D)}return;default:if(Hl(t)){for(var Ce in a)C=a[Ce],a.hasOwnProperty(Ce)&&C!==void 0&&!s.hasOwnProperty(Ce)&&Eu(e,t,Ce,void 0,s,C);for(z in s)C=s[z],D=a[z],!s.hasOwnProperty(z)||C===D||C===void 0&&D===void 0||Eu(e,t,z,C,s,D);return}}for(var S in a)C=a[S],a.hasOwnProperty(S)&&C!=null&&!s.hasOwnProperty(S)&&Ee(e,t,S,null,s,C);for(R in s)C=s[R],D=a[R],!s.hasOwnProperty(R)||C===D||C==null&&D==null||Ee(e,t,R,C,s,D)}function Pm(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function o0(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,a=performance.getEntriesByType("resource"),s=0;s<a.length;s++){var l=a[s],c=l.transferSize,h=l.initiatorType,g=l.duration;if(c&&g&&Pm(h)){for(h=0,g=l.responseEnd,s+=1;s<a.length;s++){var v=a[s],E=v.startTime;if(E>g)break;var z=v.transferSize,R=v.initiatorType;z&&Pm(R)&&(v=v.responseEnd,h+=z*(v<g?1:(g-E)/(v-E)))}if(--s,t+=8*(c+h)/(l.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var Cu=null,Lu=null;function _o(e){return e.nodeType===9?e:e.ownerDocument}function Gm(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function Ym(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function Du(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var Ou=null;function l0(){var e=window.event;return e&&e.type==="popstate"?e===Ou?!1:(Ou=e,!0):(Ou=null,!1)}var Qm=typeof setTimeout=="function"?setTimeout:void 0,c0=typeof clearTimeout=="function"?clearTimeout:void 0,Km=typeof Promise=="function"?Promise:void 0,u0=typeof queueMicrotask=="function"?queueMicrotask:typeof Km<"u"?function(e){return Km.resolve(null).then(e).catch(d0)}:Qm;function d0(e){setTimeout(function(){throw e})}function ca(e){return e==="head"}function Fm(e,t){var a=t,s=0;do{var l=a.nextSibling;if(e.removeChild(a),l&&l.nodeType===8)if(a=l.data,a==="/$"||a==="/&"){if(s===0){e.removeChild(l),Pi(t);return}s--}else if(a==="$"||a==="$?"||a==="$~"||a==="$!"||a==="&")s++;else if(a==="html")$s(e.ownerDocument.documentElement);else if(a==="head"){a=e.ownerDocument.head,$s(a);for(var c=a.firstChild;c;){var h=c.nextSibling,g=c.nodeName;c[ms]||g==="SCRIPT"||g==="STYLE"||g==="LINK"&&c.rel.toLowerCase()==="stylesheet"||a.removeChild(c),c=h}}else a==="body"&&$s(e.ownerDocument.body);a=l}while(a);Pi(t)}function Vm(e,t){var a=e;e=0;do{var s=a.nextSibling;if(a.nodeType===1?t?(a._stashedDisplay=a.style.display,a.style.display="none"):(a.style.display=a._stashedDisplay||"",a.getAttribute("style")===""&&a.removeAttribute("style")):a.nodeType===3&&(t?(a._stashedText=a.nodeValue,a.nodeValue=""):a.nodeValue=a._stashedText||""),s&&s.nodeType===8)if(a=s.data,a==="/$"){if(e===0)break;e--}else a!=="$"&&a!=="$?"&&a!=="$~"&&a!=="$!"||e++;a=s}while(a)}function zu(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var a=t;switch(t=t.nextSibling,a.nodeName){case"HTML":case"HEAD":case"BODY":zu(a),Nl(a);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(a.rel.toLowerCase()==="stylesheet")continue}e.removeChild(a)}}function p0(e,t,a,s){for(;e.nodeType===1;){var l=a;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!s&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(s){if(!e[ms])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(c=e.getAttribute("rel"),c==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(c!==l.rel||e.getAttribute("href")!==(l.href==null||l.href===""?null:l.href)||e.getAttribute("crossorigin")!==(l.crossOrigin==null?null:l.crossOrigin)||e.getAttribute("title")!==(l.title==null?null:l.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(c=e.getAttribute("src"),(c!==(l.src==null?null:l.src)||e.getAttribute("type")!==(l.type==null?null:l.type)||e.getAttribute("crossorigin")!==(l.crossOrigin==null?null:l.crossOrigin))&&c&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var c=l.name==null?null:""+l.name;if(l.type==="hidden"&&e.getAttribute("name")===c)return e}else return e;if(e=Ft(e.nextSibling),e===null)break}return null}function h0(e,t,a){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!a||(e=Ft(e.nextSibling),e===null))return null;return e}function Jm(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=Ft(e.nextSibling),e===null))return null;return e}function ju(e){return e.data==="$?"||e.data==="$~"}function Mu(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function f0(e,t){var a=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||a.readyState!=="loading")t();else{var s=function(){t(),a.removeEventListener("DOMContentLoaded",s)};a.addEventListener("DOMContentLoaded",s),e._reactRetry=s}}function Ft(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var Ru=null;function Wm(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var a=e.data;if(a==="/$"||a==="/&"){if(t===0)return Ft(e.nextSibling);t--}else a!=="$"&&a!=="$!"&&a!=="$?"&&a!=="$~"&&a!=="&"||t++}e=e.nextSibling}return null}function $m(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var a=e.data;if(a==="$"||a==="$!"||a==="$?"||a==="$~"||a==="&"){if(t===0)return e;t--}else a!=="/$"&&a!=="/&"||t++}e=e.previousSibling}return null}function Xm(e,t,a){switch(t=_o(a),e){case"html":if(e=t.documentElement,!e)throw Error(o(452));return e;case"head":if(e=t.head,!e)throw Error(o(453));return e;case"body":if(e=t.body,!e)throw Error(o(454));return e;default:throw Error(o(451))}}function $s(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);Nl(e)}var Vt=new Map,Zm=new Set;function No(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var Nn=U.d;U.d={f:m0,r:g0,D:y0,C:b0,L:v0,m:w0,X:x0,S:k0,M:S0};function m0(){var e=Nn.f(),t=Co();return e||t}function g0(e){var t=oi(e);t!==null&&t.tag===5&&t.type==="form"?gf(t):Nn.r(e)}var Bi=typeof document>"u"?null:document;function eg(e,t,a){var s=Bi;if(s&&typeof t=="string"&&t){var l=Ut(t);l='link[rel="'+e+'"][href="'+l+'"]',typeof a=="string"&&(l+='[crossorigin="'+a+'"]'),Zm.has(l)||(Zm.add(l),e={rel:e,crossOrigin:a,href:t},s.querySelector(l)===null&&(t=s.createElement("link"),ct(t,"link",e),nt(t),s.head.appendChild(t)))}}function y0(e){Nn.D(e),eg("dns-prefetch",e,null)}function b0(e,t){Nn.C(e,t),eg("preconnect",e,t)}function v0(e,t,a){Nn.L(e,t,a);var s=Bi;if(s&&e&&t){var l='link[rel="preload"][as="'+Ut(t)+'"]';t==="image"&&a&&a.imageSrcSet?(l+='[imagesrcset="'+Ut(a.imageSrcSet)+'"]',typeof a.imageSizes=="string"&&(l+='[imagesizes="'+Ut(a.imageSizes)+'"]')):l+='[href="'+Ut(e)+'"]';var c=l;switch(t){case"style":c=Ui(e);break;case"script":c=Hi(e)}Vt.has(c)||(e=k({rel:"preload",href:t==="image"&&a&&a.imageSrcSet?void 0:e,as:t},a),Vt.set(c,e),s.querySelector(l)!==null||t==="style"&&s.querySelector(Xs(c))||t==="script"&&s.querySelector(Zs(c))||(t=s.createElement("link"),ct(t,"link",e),nt(t),s.head.appendChild(t)))}}function w0(e,t){Nn.m(e,t);var a=Bi;if(a&&e){var s=t&&typeof t.as=="string"?t.as:"script",l='link[rel="modulepreload"][as="'+Ut(s)+'"][href="'+Ut(e)+'"]',c=l;switch(s){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":c=Hi(e)}if(!Vt.has(c)&&(e=k({rel:"modulepreload",href:e},t),Vt.set(c,e),a.querySelector(l)===null)){switch(s){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(a.querySelector(Zs(c)))return}s=a.createElement("link"),ct(s,"link",e),nt(s),a.head.appendChild(s)}}}function k0(e,t,a){Nn.S(e,t,a);var s=Bi;if(s&&e){var l=li(s).hoistableStyles,c=Ui(e);t=t||"default";var h=l.get(c);if(!h){var g={loading:0,preload:null};if(h=s.querySelector(Xs(c)))g.loading=5;else{e=k({rel:"stylesheet",href:e,"data-precedence":t},a),(a=Vt.get(c))&&_u(e,a);var v=h=s.createElement("link");nt(v),ct(v,"link",e),v._p=new Promise(function(E,z){v.onload=E,v.onerror=z}),v.addEventListener("load",function(){g.loading|=1}),v.addEventListener("error",function(){g.loading|=2}),g.loading|=4,Io(h,t,s)}h={type:"stylesheet",instance:h,count:1,state:g},l.set(c,h)}}}function x0(e,t){Nn.X(e,t);var a=Bi;if(a&&e){var s=li(a).hoistableScripts,l=Hi(e),c=s.get(l);c||(c=a.querySelector(Zs(l)),c||(e=k({src:e,async:!0},t),(t=Vt.get(l))&&Nu(e,t),c=a.createElement("script"),nt(c),ct(c,"link",e),a.head.appendChild(c)),c={type:"script",instance:c,count:1,state:null},s.set(l,c))}}function S0(e,t){Nn.M(e,t);var a=Bi;if(a&&e){var s=li(a).hoistableScripts,l=Hi(e),c=s.get(l);c||(c=a.querySelector(Zs(l)),c||(e=k({src:e,async:!0,type:"module"},t),(t=Vt.get(l))&&Nu(e,t),c=a.createElement("script"),nt(c),ct(c,"link",e),a.head.appendChild(c)),c={type:"script",instance:c,count:1,state:null},s.set(l,c))}}function tg(e,t,a,s){var l=(l=Gn.current)?No(l):null;if(!l)throw Error(o(446));switch(e){case"meta":case"title":return null;case"style":return typeof a.precedence=="string"&&typeof a.href=="string"?(t=Ui(a.href),a=li(l).hoistableStyles,s=a.get(t),s||(s={type:"style",instance:null,count:0,state:null},a.set(t,s)),s):{type:"void",instance:null,count:0,state:null};case"link":if(a.rel==="stylesheet"&&typeof a.href=="string"&&typeof a.precedence=="string"){e=Ui(a.href);var c=li(l).hoistableStyles,h=c.get(e);if(h||(l=l.ownerDocument||l,h={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},c.set(e,h),(c=l.querySelector(Xs(e)))&&!c._p&&(h.instance=c,h.state.loading=5),Vt.has(e)||(a={rel:"preload",as:"style",href:a.href,crossOrigin:a.crossOrigin,integrity:a.integrity,media:a.media,hrefLang:a.hrefLang,referrerPolicy:a.referrerPolicy},Vt.set(e,a),c||T0(l,e,a,h.state))),t&&s===null)throw Error(o(528,""));return h}if(t&&s!==null)throw Error(o(529,""));return null;case"script":return t=a.async,a=a.src,typeof a=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=Hi(a),a=li(l).hoistableScripts,s=a.get(t),s||(s={type:"script",instance:null,count:0,state:null},a.set(t,s)),s):{type:"void",instance:null,count:0,state:null};default:throw Error(o(444,e))}}function Ui(e){return'href="'+Ut(e)+'"'}function Xs(e){return'link[rel="stylesheet"]['+e+"]"}function ng(e){return k({},e,{"data-precedence":e.precedence,precedence:null})}function T0(e,t,a,s){e.querySelector('link[rel="preload"][as="style"]['+t+"]")?s.loading=1:(t=e.createElement("link"),s.preload=t,t.addEventListener("load",function(){return s.loading|=1}),t.addEventListener("error",function(){return s.loading|=2}),ct(t,"link",a),nt(t),e.head.appendChild(t))}function Hi(e){return'[src="'+Ut(e)+'"]'}function Zs(e){return"script[async]"+e}function ag(e,t,a){if(t.count++,t.instance===null)switch(t.type){case"style":var s=e.querySelector('style[data-href~="'+Ut(a.href)+'"]');if(s)return t.instance=s,nt(s),s;var l=k({},a,{"data-href":a.href,"data-precedence":a.precedence,href:null,precedence:null});return s=(e.ownerDocument||e).createElement("style"),nt(s),ct(s,"style",l),Io(s,a.precedence,e),t.instance=s;case"stylesheet":l=Ui(a.href);var c=e.querySelector(Xs(l));if(c)return t.state.loading|=4,t.instance=c,nt(c),c;s=ng(a),(l=Vt.get(l))&&_u(s,l),c=(e.ownerDocument||e).createElement("link"),nt(c);var h=c;return h._p=new Promise(function(g,v){h.onload=g,h.onerror=v}),ct(c,"link",s),t.state.loading|=4,Io(c,a.precedence,e),t.instance=c;case"script":return c=Hi(a.src),(l=e.querySelector(Zs(c)))?(t.instance=l,nt(l),l):(s=a,(l=Vt.get(c))&&(s=k({},a),Nu(s,l)),e=e.ownerDocument||e,l=e.createElement("script"),nt(l),ct(l,"link",s),e.head.appendChild(l),t.instance=l);case"void":return null;default:throw Error(o(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(s=t.instance,t.state.loading|=4,Io(s,a.precedence,e));return t.instance}function Io(e,t,a){for(var s=a.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'),l=s.length?s[s.length-1]:null,c=l,h=0;h<s.length;h++){var g=s[h];if(g.dataset.precedence===t)c=g;else if(c!==l)break}c?c.parentNode.insertBefore(e,c.nextSibling):(t=a.nodeType===9?a.head:a,t.insertBefore(e,t.firstChild))}function _u(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function Nu(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var Bo=null;function ig(e,t,a){if(Bo===null){var s=new Map,l=Bo=new Map;l.set(a,s)}else l=Bo,s=l.get(a),s||(s=new Map,l.set(a,s));if(s.has(e))return s;for(s.set(e,null),a=a.getElementsByTagName(e),l=0;l<a.length;l++){var c=a[l];if(!(c[ms]||c[st]||e==="link"&&c.getAttribute("rel")==="stylesheet")&&c.namespaceURI!=="http://www.w3.org/2000/svg"){var h=c.getAttribute(t)||"";h=e+h;var g=s.get(h);g?g.push(c):s.set(h,[c])}}return s}function sg(e,t,a){e=e.ownerDocument||e,e.head.insertBefore(a,t==="title"?e.querySelector("head > title"):null)}function A0(e,t,a){if(a===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;switch(t.rel){case"stylesheet":return e=t.disabled,typeof t.precedence=="string"&&e==null;default:return!0}case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function rg(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function q0(e,t,a,s){if(a.type==="stylesheet"&&(typeof s.media!="string"||matchMedia(s.media).matches!==!1)&&(a.state.loading&4)===0){if(a.instance===null){var l=Ui(s.href),c=t.querySelector(Xs(l));if(c){t=c._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=Uo.bind(e),t.then(e,e)),a.state.loading|=4,a.instance=c,nt(c);return}c=t.ownerDocument||t,s=ng(s),(l=Vt.get(l))&&_u(s,l),c=c.createElement("link"),nt(c);var h=c;h._p=new Promise(function(g,v){h.onload=g,h.onerror=v}),ct(c,"link",s),a.instance=c}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(a,t),(t=a.state.preload)&&(a.state.loading&3)===0&&(e.count++,a=Uo.bind(e),t.addEventListener("load",a),t.addEventListener("error",a))}}var Iu=0;function E0(e,t){return e.stylesheets&&e.count===0&&Po(e,e.stylesheets),0<e.count||0<e.imgCount?function(a){var s=setTimeout(function(){if(e.stylesheets&&Po(e,e.stylesheets),e.unsuspend){var c=e.unsuspend;e.unsuspend=null,c()}},6e4+t);0<e.imgBytes&&Iu===0&&(Iu=62500*o0());var l=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&Po(e,e.stylesheets),e.unsuspend)){var c=e.unsuspend;e.unsuspend=null,c()}},(e.imgBytes>Iu?50:800)+t);return e.unsuspend=a,function(){e.unsuspend=null,clearTimeout(s),clearTimeout(l)}}:null}function Uo(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)Po(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Ho=null;function Po(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Ho=new Map,t.forEach(C0,e),Ho=null,Uo.call(e))}function C0(e,t){if(!(t.state.loading&4)){var a=Ho.get(e);if(a)var s=a.get(null);else{a=new Map,Ho.set(e,a);for(var l=e.querySelectorAll("link[data-precedence],style[data-precedence]"),c=0;c<l.length;c++){var h=l[c];(h.nodeName==="LINK"||h.getAttribute("media")!=="not all")&&(a.set(h.dataset.precedence,h),s=h)}s&&a.set(null,s)}l=t.instance,h=l.getAttribute("data-precedence"),c=a.get(h)||s,c===s&&a.set(null,l),a.set(h,l),this.count++,s=Uo.bind(this),l.addEventListener("load",s),l.addEventListener("error",s),c?c.parentNode.insertBefore(l,c.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(l,e.firstChild)),t.state.loading|=4}}var er={$$typeof:Y,Provider:null,Consumer:null,_currentValue:W,_currentValue2:W,_threadCount:0};function L0(e,t,a,s,l,c,h,g,v){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=jl(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=jl(0),this.hiddenUpdates=jl(null),this.identifierPrefix=s,this.onUncaughtError=l,this.onCaughtError=c,this.onRecoverableError=h,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=v,this.incompleteTransitions=new Map}function og(e,t,a,s,l,c,h,g,v,E,z,R){return e=new L0(e,t,a,h,v,E,z,R,g),t=1,c===!0&&(t|=24),c=Dt(3,null,null,t),e.current=c,c.stateNode=e,t=yc(),t.refCount++,e.pooledCache=t,t.refCount++,c.memoizedState={element:s,isDehydrated:a,cache:t},kc(c),e}function lg(e){return e?(e=bi,e):bi}function cg(e,t,a,s,l,c){l=lg(l),s.context===null?s.context=l:s.pendingContext=l,s=Xn(t),s.payload={element:a},c=c===void 0?null:c,c!==null&&(s.callback=c),a=Zn(e,s,t),a!==null&&(xt(a,e,t),zs(a,e,t))}function ug(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var a=e.retryLane;e.retryLane=a!==0&&a<t?a:t}}function Bu(e,t){ug(e,t),(e=e.alternate)&&ug(e,t)}function dg(e){if(e.tag===13||e.tag===31){var t=Oa(e,67108864);t!==null&&xt(t,e,67108864),Bu(e,67108864)}}function pg(e){if(e.tag===13||e.tag===31){var t=Rt();t=Ml(t);var a=Oa(e,t);a!==null&&xt(a,e,t),Bu(e,t)}}var Go=!0;function D0(e,t,a,s){var l=A.T;A.T=null;var c=U.p;try{U.p=2,Uu(e,t,a,s)}finally{U.p=c,A.T=l}}function O0(e,t,a,s){var l=A.T;A.T=null;var c=U.p;try{U.p=8,Uu(e,t,a,s)}finally{U.p=c,A.T=l}}function Uu(e,t,a,s){if(Go){var l=Hu(s);if(l===null)qu(e,t,s,Yo,a),fg(e,s);else if(j0(l,e,t,a,s))s.stopPropagation();else if(fg(e,s),t&4&&-1<z0.indexOf(e)){for(;l!==null;){var c=oi(l);if(c!==null)switch(c.tag){case 3:if(c=c.stateNode,c.current.memoizedState.isDehydrated){var h=qa(c.pendingLanes);if(h!==0){var g=c;for(g.pendingLanes|=2,g.entangledLanes|=2;h;){var v=1<<31-Ct(h);g.entanglements[1]|=v,h&=~v}hn(c),(xe&6)===0&&(qo=qt()+500,Vs(0))}}break;case 31:case 13:g=Oa(c,2),g!==null&&xt(g,c,2),Co(),Bu(c,2)}if(c=Hu(s),c===null&&qu(e,t,s,Yo,a),c===l)break;l=c}l!==null&&s.stopPropagation()}else qu(e,t,s,null,a)}}function Hu(e){return e=Gl(e),Pu(e)}var Yo=null;function Pu(e){if(Yo=null,e=ri(e),e!==null){var t=d(e);if(t===null)e=null;else{var a=t.tag;if(a===13){if(e=p(t),e!==null)return e;e=null}else if(a===31){if(e=f(t),e!==null)return e;e=null}else if(a===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Yo=e,null}function hg(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(yv()){case wp:return 2;case kp:return 8;case zr:case bv:return 32;case xp:return 268435456;default:return 32}default:return 32}}var Gu=!1,ua=null,da=null,pa=null,tr=new Map,nr=new Map,ha=[],z0="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function fg(e,t){switch(e){case"focusin":case"focusout":ua=null;break;case"dragenter":case"dragleave":da=null;break;case"mouseover":case"mouseout":pa=null;break;case"pointerover":case"pointerout":tr.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":nr.delete(t.pointerId)}}function ar(e,t,a,s,l,c){return e===null||e.nativeEvent!==c?(e={blockedOn:t,domEventName:a,eventSystemFlags:s,nativeEvent:c,targetContainers:[l]},t!==null&&(t=oi(t),t!==null&&dg(t)),e):(e.eventSystemFlags|=s,t=e.targetContainers,l!==null&&t.indexOf(l)===-1&&t.push(l),e)}function j0(e,t,a,s,l){switch(t){case"focusin":return ua=ar(ua,e,t,a,s,l),!0;case"dragenter":return da=ar(da,e,t,a,s,l),!0;case"mouseover":return pa=ar(pa,e,t,a,s,l),!0;case"pointerover":var c=l.pointerId;return tr.set(c,ar(tr.get(c)||null,e,t,a,s,l)),!0;case"gotpointercapture":return c=l.pointerId,nr.set(c,ar(nr.get(c)||null,e,t,a,s,l)),!0}return!1}function mg(e){var t=ri(e.target);if(t!==null){var a=d(t);if(a!==null){if(t=a.tag,t===13){if(t=p(a),t!==null){e.blockedOn=t,Cp(e.priority,function(){pg(a)});return}}else if(t===31){if(t=f(a),t!==null){e.blockedOn=t,Cp(e.priority,function(){pg(a)});return}}else if(t===3&&a.stateNode.current.memoizedState.isDehydrated){e.blockedOn=a.tag===3?a.stateNode.containerInfo:null;return}}}e.blockedOn=null}function Qo(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var a=Hu(e.nativeEvent);if(a===null){a=e.nativeEvent;var s=new a.constructor(a.type,a);Pl=s,a.target.dispatchEvent(s),Pl=null}else return t=oi(a),t!==null&&dg(t),e.blockedOn=a,!1;t.shift()}return!0}function gg(e,t,a){Qo(e)&&a.delete(t)}function M0(){Gu=!1,ua!==null&&Qo(ua)&&(ua=null),da!==null&&Qo(da)&&(da=null),pa!==null&&Qo(pa)&&(pa=null),tr.forEach(gg),nr.forEach(gg)}function Ko(e,t){e.blockedOn===t&&(e.blockedOn=null,Gu||(Gu=!0,n.unstable_scheduleCallback(n.unstable_NormalPriority,M0)))}var Fo=null;function yg(e){Fo!==e&&(Fo=e,n.unstable_scheduleCallback(n.unstable_NormalPriority,function(){Fo===e&&(Fo=null);for(var t=0;t<e.length;t+=3){var a=e[t],s=e[t+1],l=e[t+2];if(typeof s!="function"){if(Pu(s||a)===null)continue;break}var c=oi(a);c!==null&&(e.splice(t,3),t-=3,Hc(c,{pending:!0,data:l,method:a.method,action:s},s,l))}}))}function Pi(e){function t(v){return Ko(v,e)}ua!==null&&Ko(ua,e),da!==null&&Ko(da,e),pa!==null&&Ko(pa,e),tr.forEach(t),nr.forEach(t);for(var a=0;a<ha.length;a++){var s=ha[a];s.blockedOn===e&&(s.blockedOn=null)}for(;0<ha.length&&(a=ha[0],a.blockedOn===null);)mg(a),a.blockedOn===null&&ha.shift();if(a=(e.ownerDocument||e).$$reactFormReplay,a!=null)for(s=0;s<a.length;s+=3){var l=a[s],c=a[s+1],h=l[gt]||null;if(typeof c=="function")h||yg(a);else if(h){var g=null;if(c&&c.hasAttribute("formAction")){if(l=c,h=c[gt]||null)g=h.formAction;else if(Pu(l)!==null)continue}else g=h.action;typeof g=="function"?a[s+1]=g:(a.splice(s,3),s-=3),yg(a)}}}function bg(){function e(c){c.canIntercept&&c.info==="react-transition"&&c.intercept({handler:function(){return new Promise(function(h){return l=h})},focusReset:"manual",scroll:"manual"})}function t(){l!==null&&(l(),l=null),s||setTimeout(a,20)}function a(){if(!s&&!navigation.transition){var c=navigation.currentEntry;c&&c.url!=null&&navigation.navigate(c.url,{state:c.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var s=!1,l=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(a,100),function(){s=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),l!==null&&(l(),l=null)}}}function Yu(e){this._internalRoot=e}Vo.prototype.render=Yu.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(o(409));var a=t.current,s=Rt();cg(a,s,e,t,null,null)},Vo.prototype.unmount=Yu.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;cg(e.current,2,null,e,null,null),Co(),t[si]=null}};function Vo(e){this._internalRoot=e}Vo.prototype.unstable_scheduleHydration=function(e){if(e){var t=Ep();e={blockedOn:null,target:e,priority:t};for(var a=0;a<ha.length&&t!==0&&t<ha[a].priority;a++);ha.splice(a,0,e),a===0&&mg(e)}};var vg=i.version;if(vg!=="19.2.8")throw Error(o(527,vg,"19.2.8"));U.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(o(188)):(e=Object.keys(e).join(","),Error(o(268,e)));return e=y(t),e=e!==null?x(e):null,e=e===null?null:e.stateNode,e};var R0={bundleType:0,version:"19.2.8",rendererPackageName:"react-dom",currentDispatcherRef:A,reconcilerVersion:"19.2.8"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var Jo=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Jo.isDisabled&&Jo.supportsFiber)try{ps=Jo.inject(R0),Et=Jo}catch{}}return sr.createRoot=function(e,t){if(!u(e))throw Error(o(299));var a=!1,s="",l=qf,c=Ef,h=Cf;return t!=null&&(t.unstable_strictMode===!0&&(a=!0),t.identifierPrefix!==void 0&&(s=t.identifierPrefix),t.onUncaughtError!==void 0&&(l=t.onUncaughtError),t.onCaughtError!==void 0&&(c=t.onCaughtError),t.onRecoverableError!==void 0&&(h=t.onRecoverableError)),t=og(e,1,!1,null,null,a,s,null,l,c,h,bg),e[si]=t.current,Au(e),new Yu(t)},sr.hydrateRoot=function(e,t,a){if(!u(e))throw Error(o(299));var s=!1,l="",c=qf,h=Ef,g=Cf,v=null;return a!=null&&(a.unstable_strictMode===!0&&(s=!0),a.identifierPrefix!==void 0&&(l=a.identifierPrefix),a.onUncaughtError!==void 0&&(c=a.onUncaughtError),a.onCaughtError!==void 0&&(h=a.onCaughtError),a.onRecoverableError!==void 0&&(g=a.onRecoverableError),a.formState!==void 0&&(v=a.formState)),t=og(e,1,!0,t,a??null,s,l,v,c,h,g,bg),t.context=lg(null),a=t.current,s=Rt(),s=Ml(s),l=Xn(s),l.callback=null,Zn(a,l,s),a=s,t.current.lanes=a,fs(t,a),hn(t),e[si]=t.current,Au(e),new Vo(t)},sr.version="19.2.8",sr}var qg;function F0(){if(qg)return Fu.exports;qg=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(i){console.error(i)}}return n(),Fu.exports=K0(),Fu.exports}var V0=F0(),pl=class{constructor(){this.listeners=new Set,this.subscribe=this.subscribe.bind(this)}subscribe(n){return this.listeners.add(n),this.onSubscribe(),()=>{this.listeners.delete(n),this.onUnsubscribe()}}hasListeners(){return this.listeners.size>0}onSubscribe(){}onUnsubscribe(){}},Qa,ba,Ki,Ty,J0=(Ty=class extends pl{constructor(){super();be(this,Qa);be(this,ba);be(this,Ki);se(this,Ki,i=>{if(typeof window<"u"&&window.addEventListener){const r=()=>i();return window.addEventListener("visibilitychange",r,!1),()=>{window.removeEventListener("visibilitychange",r)}}})}onSubscribe(){j(this,ba)||this.setEventListener(j(this,Ki))}onUnsubscribe(){var i;this.hasListeners()||((i=j(this,ba))==null||i.call(this),se(this,ba,void 0))}setEventListener(i){var r;se(this,Ki,i),(r=j(this,ba))==null||r.call(this),se(this,ba,i(o=>{typeof o=="boolean"?this.setFocused(o):this.onFocus()}))}setFocused(i){j(this,Qa)!==i&&(se(this,Qa,i),this.onFocus())}onFocus(){const i=this.isFocused();this.listeners.forEach(r=>{r(i)})}isFocused(){var i;return typeof j(this,Qa)=="boolean"?j(this,Qa):((i=globalThis.document)==null?void 0:i.visibilityState)!=="hidden"}},Qa=new WeakMap,ba=new WeakMap,Ki=new WeakMap,Ty),Ny=new J0,W0={setTimeout:(n,i)=>setTimeout(n,i),clearTimeout:n=>clearTimeout(n),setInterval:(n,i)=>setInterval(n,i),clearInterval:n=>clearInterval(n)},va,jd,Ay,$0=(Ay=class{constructor(){be(this,va,W0);be(this,jd,!1)}setTimeoutProvider(n){se(this,va,n)}setTimeout(n,i){return j(this,va).setTimeout(n,i)}clearTimeout(n){j(this,va).clearTimeout(n)}setInterval(n,i){return j(this,va).setInterval(n,i)}clearInterval(n){j(this,va).clearInterval(n)}},va=new WeakMap,jd=new WeakMap,Ay),hd=new $0;function X0(n){setTimeout(n,0)}var Z0=typeof window>"u"||"Deno"in globalThis;function tn(){}function ek(n,i){return typeof n=="function"?n(i):n}function tk(n){return typeof n=="number"&&n>=0&&n!==1/0}function nk(n,i){return Math.max(n+(i||0)-Date.now(),0)}function fd(n,i){return typeof n=="function"?n(i):n}function ak(n,i){return typeof n=="function"?n(i):n}function Eg(n,i){const{type:r="all",exact:o,fetchStatus:u,predicate:d,queryKey:p,stale:f}=n;if(p){if(o){if(i.queryHash!==Md(p,i.options))return!1}else if(!ts(i.queryKey,p))return!1}if(r!=="all"){const m=i.isActive();if(r==="active"&&!m||r==="inactive"&&m)return!1}return!(typeof f=="boolean"&&i.isStale()!==f||u&&u!==i.state.fetchStatus||d&&!d(i))}function Cg(n,i){const{exact:r,status:o,predicate:u,mutationKey:d}=n;if(d){if(!i.options.mutationKey)return!1;if(r){if(br(i.options.mutationKey)!==br(d))return!1}else if(!ts(i.options.mutationKey,d))return!1}return!(o&&i.state.status!==o||u&&!u(i))}function Md(n,i){return((i==null?void 0:i.queryKeyHashFn)||br)(n)}function br(n){return JSON.stringify(n,(i,r)=>md(r)?Object.keys(r).sort().reduce((o,u)=>(o[u]=r[u],o),{}):r)}function ts(n,i){if(n===i)return!0;if(typeof n!=typeof i)return!1;if(n&&i&&typeof n=="object"&&typeof i=="object"){if(Array.isArray(n)&&Array.isArray(i)){for(let o=0;o<i.length;o++)if(!ts(n[o],i[o]))return!1;return!0}const r=Object.keys(i);for(const o of r)if(!ts(n[o],i[o]))return!1;return!0}return!1}var ik=Object.prototype.hasOwnProperty;function Iy(n,i,r=0){if(n===i)return n;if(r>500)return i;const o=Lg(n)&&Lg(i);if(!o&&!(md(n)&&md(i)))return i;const d=(o?n:Object.keys(n)).length,p=o?i:Object.keys(i),f=p.length,m=o?new Array(f):{};let y=0;for(let x=0;x<f;x++){const k=o?x:p[x],L=n[k],O=i[k];if(L===O){m[k]=L,(o?x<d:ik.call(n,k))&&y++;continue}if(L===null||O===null||typeof L!="object"||typeof O!="object"){m[k]=O;continue}const _=Iy(L,O,r+1);m[k]=_,_===L&&y++}return d===f&&y===d?n:m}function QA(n,i){if(!i||Object.keys(n).length!==Object.keys(i).length)return!1;for(const r in n)if(n[r]!==i[r])return!1;return!0}function Lg(n){return Array.isArray(n)&&n.length===Object.keys(n).length}function md(n){if(!Dg(n))return!1;const i=n.constructor;if(i===void 0)return!0;const r=i.prototype;return!(!Dg(r)||!r.hasOwnProperty("isPrototypeOf")||Object.getPrototypeOf(n)!==Object.prototype)}function Dg(n){return Object.prototype.toString.call(n)==="[object Object]"}function sk(n){return new Promise(i=>{hd.setTimeout(i,n)})}function rk(n,i,r){return typeof r.structuralSharing=="function"?r.structuralSharing(n,i):r.structuralSharing!==!1?Iy(n,i):i}function ok(n,i,r=0){const o=[...n,i];return r&&o.length>r?o.slice(1):o}function lk(n,i,r=0){const o=[i,...n];return r&&o.length>r?o.slice(0,-1):o}var Rd=Symbol();function By(n,i){return!n.queryFn&&(i!=null&&i.initialPromise)?()=>i.initialPromise:!n.queryFn||n.queryFn===Rd?()=>Promise.reject(new Error(`Missing queryFn: '${n.queryHash}'`)):n.queryFn}function KA(n,i){return typeof n=="function"?n(...i):!!n}function ck(n,i,r){let o=!1,u;return Object.defineProperty(n,"signal",{enumerable:!0,get:()=>(u??(u=i()),o||(o=!0,u.aborted?r():u.addEventListener("abort",r,{once:!0})),u)}),n}var Uy=(()=>{let n=()=>Z0;return{isServer(){return n()},setIsServer(i){n=i}}})();function uk(){let n,i;const r=new Promise((u,d)=>{n=u,i=d});r.status="pending",r.catch(()=>{});function o(u){Object.assign(r,u),delete r.resolve,delete r.reject}return r.resolve=u=>{o({status:"fulfilled",value:u}),n(u)},r.reject=u=>{o({status:"rejected",reason:u}),i(u)},r}var dk=X0;function pk(){let n=[],i=0,r=f=>{f()},o=f=>{f()},u=dk;const d=f=>{i?n.push(f):u(()=>{r(f)})},p=()=>{const f=n;n=[],f.length&&u(()=>{o(()=>{f.forEach(m=>{r(m)})})})};return{batch:f=>{let m;i++;try{m=f()}finally{i--,i||p()}return m},batchCalls:f=>(...m)=>{d(()=>{f(...m)})},schedule:d,setNotifyFunction:f=>{r=f},setBatchNotifyFunction:f=>{o=f},setScheduler:f=>{u=f}}}var ft=pk(),Fi,wa,Vi,qy,hk=(qy=class extends pl{constructor(){super();be(this,Fi,!0);be(this,wa);be(this,Vi);se(this,Vi,i=>{if(typeof window<"u"&&window.addEventListener){const r=()=>i(!0),o=()=>i(!1);return window.addEventListener("online",r,!1),window.addEventListener("offline",o,!1),()=>{window.removeEventListener("online",r),window.removeEventListener("offline",o)}}})}onSubscribe(){j(this,wa)||this.setEventListener(j(this,Vi))}onUnsubscribe(){var i;this.hasListeners()||((i=j(this,wa))==null||i.call(this),se(this,wa,void 0))}setEventListener(i){var r;se(this,Vi,i),(r=j(this,wa))==null||r.call(this),se(this,wa,i(this.setOnline.bind(this)))}setOnline(i){j(this,Fi)!==i&&(se(this,Fi,i),this.listeners.forEach(o=>{o(i)}))}isOnline(){return j(this,Fi)}},Fi=new WeakMap,wa=new WeakMap,Vi=new WeakMap,qy),sl=new hk;function fk(n){return Math.min(1e3*2**n,3e4)}function Hy(n){return(n??"online")==="online"?sl.isOnline():!0}var gd=class extends Error{constructor(n){super("CancelledError"),this.revert=n==null?void 0:n.revert,this.silent=n==null?void 0:n.silent}};function Py(n){let i=!1,r=0,o;const u=uk(),d=()=>u.status!=="pending",p=T=>{var G;if(!d()){const N=new gd(T);L(N),(G=n.onCancel)==null||G.call(n,N)}},f=()=>{i=!0},m=()=>{i=!1},y=()=>Ny.isFocused()&&(n.networkMode==="always"||sl.isOnline())&&n.canRun(),x=()=>Hy(n.networkMode)&&n.canRun(),k=T=>{d()||(o==null||o(),u.resolve(T))},L=T=>{d()||(o==null||o(),u.reject(T))},O=()=>new Promise(T=>{var G;o=N=>{(d()||y())&&T(N)},(G=n.onPause)==null||G.call(n)}).then(()=>{var T;o=void 0,d()||(T=n.onContinue)==null||T.call(n)}),_=()=>{if(d())return;let T;const G=r===0?n.initialPromise:void 0;try{T=G??n.fn()}catch(N){T=Promise.reject(N)}Promise.resolve(T).then(k).catch(N=>{var P;if(d())return;const I=n.retry??(Uy.isServer()?0:3),Y=n.retryDelay??fk,F=typeof Y=="function"?Y(r,N):Y,K=I===!0||typeof I=="number"&&r<I||typeof I=="function"&&I(r,N);if(i||!K){L(N);return}r++,(P=n.onFail)==null||P.call(n,r,N),sk(F).then(()=>y()?void 0:O()).then(()=>{i?L(N):_()})})};return{promise:u,status:()=>u.status,cancel:p,continue:()=>(o==null||o(),u),cancelRetry:f,continueRetry:m,canStart:x,start:()=>(x()?_():O().then(_),u)}}var Ka,Ey,Gy=(Ey=class{constructor(){be(this,Ka)}destroy(){this.clearGcTimeout()}scheduleGc(){this.clearGcTimeout(),tk(this.gcTime)&&se(this,Ka,hd.setTimeout(()=>{this.optionalRemove()},this.gcTime))}updateGcTime(n){this.gcTime=Math.max(this.gcTime||0,n??(Uy.isServer()?1/0:300*1e3))}clearGcTimeout(){j(this,Ka)!==void 0&&(hd.clearTimeout(j(this,Ka)),se(this,Ka,void 0))}},Ka=new WeakMap,Ey);function mk(n){return{onFetch:(i,r)=>{var x,k,L,O,_;const o=i.options,u=(L=(k=(x=i.fetchOptions)==null?void 0:x.meta)==null?void 0:k.fetchMore)==null?void 0:L.direction,d=((O=i.state.data)==null?void 0:O.pages)||[],p=((_=i.state.data)==null?void 0:_.pageParams)||[];let f={pages:[],pageParams:[]},m=0;const y=async()=>{let T=!1;const G=Y=>{ck(Y,()=>i.signal,()=>T=!0)},N=By(i.options,i.fetchOptions),I=async(Y,F,K)=>{if(T)return Promise.reject(i.signal.reason);if(F==null&&Y.pages.length)return Promise.resolve(Y);const ue=(()=>{const J={client:i.client,queryKey:i.queryKey,pageParam:F,direction:K?"backward":"forward",meta:i.options.meta};return G(J),J})(),ae=await N(ue),{maxPages:ce}=i.options,de=K?lk:ok;return{pages:de(Y.pages,ae,ce),pageParams:de(Y.pageParams,F,ce)}};if(u&&d.length){const Y=u==="backward",F=Y?gk:Og,K={pages:d,pageParams:p},P=F(o,K);f=await I(K,P,Y)}else{const Y=n??d.length;do{const F=m===0?p[0]??o.initialPageParam:Og(o,f);if(m>0&&F==null)break;f=await I(f,F),m++}while(m<Y)}return f};i.options.persister?i.fetchFn=()=>{var T,G;return(G=(T=i.options).persister)==null?void 0:G.call(T,y,{client:i.client,queryKey:i.queryKey,meta:i.options.meta,signal:i.signal},r)}:i.fetchFn=y}}}function Og(n,{pages:i,pageParams:r}){const o=i.length-1;return i.length>0?n.getNextPageParam(i[o],i,r[o],r):void 0}function gk(n,{pages:i,pageParams:r}){var o;return i.length>0?(o=n.getPreviousPageParam)==null?void 0:o.call(n,i[0],i,r[0],r):void 0}var Ji,Fa,Wi,Wt,Va,it,xr,Ja,_t,Yy,In,Cy,yk=(Cy=class extends Gy{constructor(i){super();be(this,_t);be(this,Ji);be(this,Fa);be(this,Wi);be(this,Wt);be(this,Va);be(this,it);be(this,xr);be(this,Ja);se(this,Ja,!1),se(this,xr,i.defaultOptions),this.setOptions(i.options),this.observers=[],se(this,Va,i.client),se(this,Wt,j(this,Va).getQueryCache()),this.queryKey=i.queryKey,this.queryHash=i.queryHash,se(this,Fa,jg(this.options)),this.state=i.state??j(this,Fa),this.scheduleGc()}get meta(){return this.options.meta}get queryType(){return j(this,Ji)}get promise(){var i;return(i=j(this,it))==null?void 0:i.promise}setOptions(i){if(this.options={...j(this,xr),...i},i!=null&&i._type&&se(this,Ji,i._type),this.updateGcTime(this.options.gcTime),this.state&&this.state.data===void 0){const r=jg(this.options);r.data!==void 0&&(this.setState(zg(r.data,r.dataUpdatedAt)),se(this,Fa,r))}}optionalRemove(){!this.observers.length&&this.state.fetchStatus==="idle"&&j(this,Wt).remove(this)}setData(i,r){const o=rk(this.state.data,i,this.options);return ut(this,_t,In).call(this,{data:o,type:"success",dataUpdatedAt:r==null?void 0:r.updatedAt,manual:r==null?void 0:r.manual}),o}setState(i){ut(this,_t,In).call(this,{type:"setState",state:i})}cancel(i){var o,u;const r=(o=j(this,it))==null?void 0:o.promise;return(u=j(this,it))==null||u.cancel(i),r?r.then(tn).catch(tn):Promise.resolve()}destroy(){super.destroy(),this.cancel({silent:!0})}get resetState(){return j(this,Fa)}reset(){this.destroy(),this.setState(this.resetState)}isActive(){return this.observers.some(i=>ak(i.options.enabled,this)!==!1)}isDisabled(){return this.getObserversCount()>0?!this.isActive():this.options.queryFn===Rd||!this.isFetched()}isFetched(){return this.state.dataUpdateCount+this.state.errorUpdateCount>0}isStatic(){return this.getObserversCount()>0?this.observers.some(i=>fd(i.options.staleTime,this)==="static"):!1}isStale(){return this.getObserversCount()>0?this.observers.some(i=>i.getCurrentResult().isStale):this.state.data===void 0||this.state.isInvalidated}isStaleByTime(i=0){return this.state.data===void 0?!0:i==="static"?!1:this.state.isInvalidated?!0:!nk(this.state.dataUpdatedAt,i)}onFocus(){var r;const i=this.observers.find(o=>o.shouldFetchOnWindowFocus());i==null||i.refetch({cancelRefetch:!1}),(r=j(this,it))==null||r.continue()}onOnline(){var r;const i=this.observers.find(o=>o.shouldFetchOnReconnect());i==null||i.refetch({cancelRefetch:!1}),(r=j(this,it))==null||r.continue()}addObserver(i){this.observers.includes(i)||(this.observers.push(i),this.clearGcTimeout(),j(this,Wt).notify({type:"observerAdded",query:this,observer:i}))}removeObserver(i){this.observers.includes(i)&&(this.observers=this.observers.filter(r=>r!==i),this.observers.length||(j(this,it)&&(j(this,Ja)||ut(this,_t,Yy).call(this)?j(this,it).cancel({revert:!0}):j(this,it).cancelRetry()),this.scheduleGc()),j(this,Wt).notify({type:"observerRemoved",query:this,observer:i}))}getObserversCount(){return this.observers.length}invalidate(){this.state.isInvalidated||ut(this,_t,In).call(this,{type:"invalidate"})}async fetch(i,r){var y,x,k,L,O,_,T,G,N,I,Y;if(this.state.fetchStatus!=="idle"&&((y=j(this,it))==null?void 0:y.status())!=="rejected"){if(this.state.data!==void 0&&(r!=null&&r.cancelRefetch))this.cancel({silent:!0});else if(j(this,it))return j(this,it).continueRetry(),j(this,it).promise}if(i&&this.setOptions(i),!this.options.queryFn){const F=this.observers.find(K=>K.options.queryFn);F&&this.setOptions(F.options)}const o=new AbortController,u=F=>{Object.defineProperty(F,"signal",{enumerable:!0,get:()=>(se(this,Ja,!0),o.signal)})},d=()=>{const F=By(this.options,r),P=(()=>{const ue={client:j(this,Va),queryKey:this.queryKey,meta:this.meta};return u(ue),ue})();return se(this,Ja,!1),this.options.persister?this.options.persister(F,P,this):F(P)},f=(()=>{const F={fetchOptions:r,options:this.options,queryKey:this.queryKey,client:j(this,Va),state:this.state,fetchFn:d};return u(F),F})(),m=j(this,Ji)==="infinite"?mk(this.options.pages):this.options.behavior;m==null||m.onFetch(f,this),se(this,Wi,this.state),(this.state.fetchStatus==="idle"||this.state.fetchMeta!==((x=f.fetchOptions)==null?void 0:x.meta))&&ut(this,_t,In).call(this,{type:"fetch",meta:(k=f.fetchOptions)==null?void 0:k.meta}),se(this,it,Py({initialPromise:r==null?void 0:r.initialPromise,fn:f.fetchFn,onCancel:F=>{F instanceof gd&&F.revert&&this.setState({...j(this,Wi),fetchStatus:"idle"}),o.abort()},onFail:(F,K)=>{ut(this,_t,In).call(this,{type:"failed",failureCount:F,error:K})},onPause:()=>{ut(this,_t,In).call(this,{type:"pause"})},onContinue:()=>{ut(this,_t,In).call(this,{type:"continue"})},retry:f.options.retry,retryDelay:f.options.retryDelay,networkMode:f.options.networkMode,canRun:()=>!0}));try{const F=await j(this,it).start();if(F===void 0)throw new Error(`${this.queryHash} data is undefined`);return this.setData(F),(O=(L=j(this,Wt).config).onSuccess)==null||O.call(L,F,this),(T=(_=j(this,Wt).config).onSettled)==null||T.call(_,F,this.state.error,this),F}catch(F){if(F instanceof gd){if(F.silent)return j(this,it).promise;if(F.revert){if(this.state.data===void 0)throw F;return this.state.data}}throw ut(this,_t,In).call(this,{type:"error",error:F}),(N=(G=j(this,Wt).config).onError)==null||N.call(G,F,this),(Y=(I=j(this,Wt).config).onSettled)==null||Y.call(I,this.state.data,F,this),F}finally{this.scheduleGc()}}},Ji=new WeakMap,Fa=new WeakMap,Wi=new WeakMap,Wt=new WeakMap,Va=new WeakMap,it=new WeakMap,xr=new WeakMap,Ja=new WeakMap,_t=new WeakSet,Yy=function(){return this.state.fetchStatus==="paused"&&this.state.status==="pending"},In=function(i){const r=o=>{switch(i.type){case"failed":return{...o,fetchFailureCount:i.failureCount,fetchFailureReason:i.error};case"pause":return{...o,fetchStatus:"paused"};case"continue":return{...o,fetchStatus:"fetching"};case"fetch":return{...o,...bk(o.data,this.options),fetchMeta:i.meta??null};case"success":const u={...o,...zg(i.data,i.dataUpdatedAt),dataUpdateCount:o.dataUpdateCount+1,...!i.manual&&{fetchStatus:"idle",fetchFailureCount:0,fetchFailureReason:null}};return se(this,Wi,i.manual?u:void 0),u;case"error":const d=i.error;return{...o,error:d,errorUpdateCount:o.errorUpdateCount+1,errorUpdatedAt:Date.now(),fetchFailureCount:o.fetchFailureCount+1,fetchFailureReason:d,fetchStatus:"idle",status:"error",isInvalidated:!0};case"invalidate":return{...o,isInvalidated:!0};case"setState":return{...o,...i.state}}};this.state=r(this.state),ft.batch(()=>{this.observers.forEach(o=>{o.onQueryUpdate()}),j(this,Wt).notify({query:this,type:"updated",action:i})})},Cy);function bk(n,i){return{fetchFailureCount:0,fetchFailureReason:null,fetchStatus:Hy(i.networkMode)?"fetching":"paused",...n===void 0&&{error:null,status:"pending"}}}function zg(n,i){return{data:n,dataUpdatedAt:i??Date.now(),error:null,isInvalidated:!1,status:"success"}}function jg(n){const i=typeof n.initialData=="function"?n.initialData():n.initialData,r=i!==void 0,o=r?typeof n.initialDataUpdatedAt=="function"?n.initialDataUpdatedAt():n.initialDataUpdatedAt:0;return{data:i,dataUpdateCount:0,dataUpdatedAt:r?o??Date.now():0,error:null,errorUpdateCount:0,errorUpdatedAt:0,fetchFailureCount:0,fetchFailureReason:null,fetchMeta:null,isInvalidated:!1,status:r?"success":"pending",fetchStatus:"idle"}}var Sr,mn,dt,Wa,gn,ma,Ly,vk=(Ly=class extends Gy{constructor(i){super();be(this,gn);be(this,Sr);be(this,mn);be(this,dt);be(this,Wa);se(this,Sr,i.client),this.mutationId=i.mutationId,se(this,dt,i.mutationCache),se(this,mn,[]),this.state=i.state||wk(),this.setOptions(i.options),this.scheduleGc()}setOptions(i){this.options=i,this.updateGcTime(this.options.gcTime)}get meta(){return this.options.meta}addObserver(i){j(this,mn).includes(i)||(j(this,mn).push(i),this.clearGcTimeout(),j(this,dt).notify({type:"observerAdded",mutation:this,observer:i}))}removeObserver(i){se(this,mn,j(this,mn).filter(r=>r!==i)),this.scheduleGc(),j(this,dt).notify({type:"observerRemoved",mutation:this,observer:i})}optionalRemove(){j(this,mn).length||(this.state.status==="pending"?this.scheduleGc():j(this,dt).remove(this))}continue(){var i;return((i=j(this,Wa))==null?void 0:i.continue())??this.execute(this.state.variables)}async execute(i){var p,f,m,y,x,k,L,O,_,T,G,N,I,Y,F,K,P,ue;const r=()=>{ut(this,gn,ma).call(this,{type:"continue"})},o={client:j(this,Sr),meta:this.options.meta,mutationKey:this.options.mutationKey};se(this,Wa,Py({fn:()=>this.options.mutationFn?this.options.mutationFn(i,o):Promise.reject(new Error("No mutationFn found")),onFail:(ae,ce)=>{ut(this,gn,ma).call(this,{type:"failed",failureCount:ae,error:ce})},onPause:()=>{ut(this,gn,ma).call(this,{type:"pause"})},onContinue:r,retry:this.options.retry??0,retryDelay:this.options.retryDelay,networkMode:this.options.networkMode,canRun:()=>j(this,dt).canRun(this)}));const u=this.state.status==="pending",d=!j(this,Wa).canStart();try{if(u)r();else{ut(this,gn,ma).call(this,{type:"pending",variables:i,isPaused:d}),j(this,dt).config.onMutate&&await j(this,dt).config.onMutate(i,this,o);const ce=await((f=(p=this.options).onMutate)==null?void 0:f.call(p,i,o));ce!==this.state.context&&ut(this,gn,ma).call(this,{type:"pending",context:ce,variables:i,isPaused:d})}const ae=await j(this,Wa).start();return await((y=(m=j(this,dt).config).onSuccess)==null?void 0:y.call(m,ae,i,this.state.context,this,o)),await((k=(x=this.options).onSuccess)==null?void 0:k.call(x,ae,i,this.state.context,o)),await((O=(L=j(this,dt).config).onSettled)==null?void 0:O.call(L,ae,null,this.state.variables,this.state.context,this,o)),await((T=(_=this.options).onSettled)==null?void 0:T.call(_,ae,null,i,this.state.context,o)),ut(this,gn,ma).call(this,{type:"success",data:ae}),ae}catch(ae){try{await((N=(G=j(this,dt).config).onError)==null?void 0:N.call(G,ae,i,this.state.context,this,o))}catch(ce){Promise.reject(ce)}try{await((Y=(I=this.options).onError)==null?void 0:Y.call(I,ae,i,this.state.context,o))}catch(ce){Promise.reject(ce)}try{await((K=(F=j(this,dt).config).onSettled)==null?void 0:K.call(F,void 0,ae,this.state.variables,this.state.context,this,o))}catch(ce){Promise.reject(ce)}try{await((ue=(P=this.options).onSettled)==null?void 0:ue.call(P,void 0,ae,i,this.state.context,o))}catch(ce){Promise.reject(ce)}throw ut(this,gn,ma).call(this,{type:"error",error:ae}),ae}finally{j(this,dt).runNext(this)}}},Sr=new WeakMap,mn=new WeakMap,dt=new WeakMap,Wa=new WeakMap,gn=new WeakSet,ma=function(i){const r=o=>{switch(i.type){case"failed":return{...o,failureCount:i.failureCount,failureReason:i.error};case"pause":return{...o,isPaused:!0};case"continue":return{...o,isPaused:!1};case"pending":return{...o,context:i.context,data:void 0,failureCount:0,failureReason:null,error:null,isPaused:i.isPaused,status:"pending",variables:i.variables,submittedAt:Date.now()};case"success":return{...o,data:i.data,failureCount:0,failureReason:null,error:null,status:"success",isPaused:!1};case"error":return{...o,data:void 0,error:i.error,failureCount:o.failureCount+1,failureReason:i.error,isPaused:!1,status:"error"}}};this.state=r(this.state),ft.batch(()=>{j(this,mn).forEach(o=>{o.onMutationUpdate(i)}),j(this,dt).notify({mutation:this,type:"updated",action:i})})},Ly);function wk(){return{context:void 0,data:void 0,error:null,failureCount:0,failureReason:null,isPaused:!1,status:"idle",variables:void 0,submittedAt:0}}var Bn,nn,Tr,Dy,kk=(Dy=class extends pl{constructor(i={}){super();be(this,Bn);be(this,nn);be(this,Tr);this.config=i,se(this,Bn,new Set),se(this,nn,new Map),se(this,Tr,0)}build(i,r,o){const u=new vk({client:i,mutationCache:this,mutationId:++Wo(this,Tr)._,options:i.defaultMutationOptions(r),state:o});return this.add(u),u}add(i){j(this,Bn).add(i);const r=$o(i);if(typeof r=="string"){const o=j(this,nn).get(r);o?o.push(i):j(this,nn).set(r,[i])}this.notify({type:"added",mutation:i})}remove(i){if(j(this,Bn).delete(i)){const r=$o(i);if(typeof r=="string"){const o=j(this,nn).get(r);if(o)if(o.length>1){const u=o.indexOf(i);u!==-1&&o.splice(u,1)}else o[0]===i&&j(this,nn).delete(r)}}this.notify({type:"removed",mutation:i})}canRun(i){const r=$o(i);if(typeof r=="string"){const o=j(this,nn).get(r),u=o==null?void 0:o.find(d=>d.state.status==="pending");return!u||u===i}else return!0}runNext(i){var o;const r=$o(i);if(typeof r=="string"){const u=(o=j(this,nn).get(r))==null?void 0:o.find(d=>d!==i&&d.state.isPaused);return(u==null?void 0:u.continue())??Promise.resolve()}else return Promise.resolve()}clear(){ft.batch(()=>{j(this,Bn).forEach(i=>{this.notify({type:"removed",mutation:i})}),j(this,Bn).clear(),j(this,nn).clear()})}getAll(){return Array.from(j(this,Bn))}find(i){const r={exact:!0,...i};return this.getAll().find(o=>Cg(r,o))}findAll(i={}){return this.getAll().filter(r=>Cg(i,r))}notify(i){ft.batch(()=>{this.listeners.forEach(r=>{r(i)})})}resumePausedMutations(){const i=this.getAll().filter(r=>r.state.isPaused);return ft.batch(()=>Promise.all(i.map(r=>r.continue().catch(tn))))}},Bn=new WeakMap,nn=new WeakMap,Tr=new WeakMap,Dy);function $o(n){var i;return(i=n.options.scope)==null?void 0:i.id}var yn,Oy,xk=(Oy=class extends pl{constructor(i={}){super();be(this,yn);this.config=i,se(this,yn,new Map)}build(i,r,o){const u=r.queryKey,d=r.queryHash??Md(u,r);let p=this.get(d);return p||(p=new yk({client:i,queryKey:u,queryHash:d,options:i.defaultQueryOptions(r),state:o,defaultOptions:i.getQueryDefaults(u)}),this.add(p)),p}add(i){j(this,yn).has(i.queryHash)||(j(this,yn).set(i.queryHash,i),this.notify({type:"added",query:i}))}remove(i){const r=j(this,yn).get(i.queryHash);r&&(i.destroy(),r===i&&j(this,yn).delete(i.queryHash),this.notify({type:"removed",query:i}))}clear(){ft.batch(()=>{this.getAll().forEach(i=>{this.remove(i)})})}get(i){return j(this,yn).get(i)}getAll(){return[...j(this,yn).values()]}find(i){const r={exact:!0,...i};return this.getAll().find(o=>Eg(r,o))}findAll(i={}){const r=this.getAll();return Object.keys(i).length>0?r.filter(o=>Eg(i,o)):r}notify(i){ft.batch(()=>{this.listeners.forEach(r=>{r(i)})})}onFocus(){ft.batch(()=>{this.getAll().forEach(i=>{i.onFocus()})})}onOnline(){ft.batch(()=>{this.getAll().forEach(i=>{i.onOnline()})})}},yn=new WeakMap,Oy),Ue,ka,xa,$i,Xi,Sa,Zi,es,zy,Sk=(zy=class{constructor(n={}){be(this,Ue);be(this,ka);be(this,xa);be(this,$i);be(this,Xi);be(this,Sa);be(this,Zi);be(this,es);se(this,Ue,n.queryCache||new xk),se(this,ka,n.mutationCache||new kk),se(this,xa,n.defaultOptions||{}),se(this,$i,new Map),se(this,Xi,new Map),se(this,Sa,0)}mount(){Wo(this,Sa)._++,j(this,Sa)===1&&(se(this,Zi,Ny.subscribe(async n=>{n&&(await this.resumePausedMutations(),j(this,Ue).onFocus())})),se(this,es,sl.subscribe(async n=>{n&&(await this.resumePausedMutations(),j(this,Ue).onOnline())})))}unmount(){var n,i;Wo(this,Sa)._--,j(this,Sa)===0&&((n=j(this,Zi))==null||n.call(this),se(this,Zi,void 0),(i=j(this,es))==null||i.call(this),se(this,es,void 0))}isFetching(n){return j(this,Ue).findAll({...n,fetchStatus:"fetching"}).length}isMutating(n){return j(this,ka).findAll({...n,status:"pending"}).length}getQueryData(n){var r;const i=this.defaultQueryOptions({queryKey:n});return(r=j(this,Ue).get(i.queryHash))==null?void 0:r.state.data}ensureQueryData(n){const i=this.defaultQueryOptions(n),r=j(this,Ue).build(this,i),o=r.state.data;return o===void 0?this.fetchQuery(n):(n.revalidateIfStale&&r.isStaleByTime(fd(i.staleTime,r))&&this.prefetchQuery(i),Promise.resolve(o))}getQueriesData(n){return j(this,Ue).findAll(n).map(({queryKey:i,state:r})=>{const o=r.data;return[i,o]})}setQueryData(n,i,r){const o=this.defaultQueryOptions({queryKey:n}),u=j(this,Ue).get(o.queryHash),d=u==null?void 0:u.state.data,p=ek(i,d);if(p!==void 0)return j(this,Ue).build(this,o).setData(p,{...r,manual:!0})}setQueriesData(n,i,r){return ft.batch(()=>j(this,Ue).findAll(n).map(({queryKey:o})=>[o,this.setQueryData(o,i,r)]))}getQueryState(n){var r;const i=this.defaultQueryOptions({queryKey:n});return(r=j(this,Ue).get(i.queryHash))==null?void 0:r.state}removeQueries(n){const i=j(this,Ue);ft.batch(()=>{i.findAll(n).forEach(r=>{i.remove(r)})})}resetQueries(n,i){const r=j(this,Ue);return ft.batch(()=>(r.findAll(n).forEach(o=>{o.reset()}),this.refetchQueries({type:"active",...n},i)))}cancelQueries(n,i={}){const r={revert:!0,...i},o=ft.batch(()=>j(this,Ue).findAll(n).map(u=>u.cancel(r)));return Promise.all(o).then(tn).catch(tn)}invalidateQueries(n,i={}){return ft.batch(()=>(j(this,Ue).findAll(n).forEach(r=>{r.invalidate()}),(n==null?void 0:n.refetchType)==="none"?Promise.resolve():this.refetchQueries({...n,type:(n==null?void 0:n.refetchType)??(n==null?void 0:n.type)??"active"},i)))}refetchQueries(n,i={}){const r={...i,cancelRefetch:i.cancelRefetch??!0},o=ft.batch(()=>j(this,Ue).findAll(n).filter(u=>!u.isDisabled()&&!u.isStatic()).map(u=>{let d=u.fetch(void 0,r);return r.throwOnError||(d=d.catch(tn)),u.state.fetchStatus==="paused"?Promise.resolve():d}));return Promise.all(o).then(tn)}fetchQuery(n){const i=this.defaultQueryOptions(n);i.retry===void 0&&(i.retry=!1);const r=j(this,Ue).build(this,i);return r.isStaleByTime(fd(i.staleTime,r))?r.fetch(i):Promise.resolve(r.state.data)}prefetchQuery(n){return this.fetchQuery(n).then(tn).catch(tn)}fetchInfiniteQuery(n){return n._type="infinite",this.fetchQuery(n)}prefetchInfiniteQuery(n){return this.fetchInfiniteQuery(n).then(tn).catch(tn)}ensureInfiniteQueryData(n){return n._type="infinite",this.ensureQueryData(n)}resumePausedMutations(){return sl.isOnline()?j(this,ka).resumePausedMutations():Promise.resolve()}getQueryCache(){return j(this,Ue)}getMutationCache(){return j(this,ka)}getDefaultOptions(){return j(this,xa)}setDefaultOptions(n){se(this,xa,n)}setQueryDefaults(n,i){j(this,$i).set(br(n),{queryKey:n,defaultOptions:i})}getQueryDefaults(n){const i=[...j(this,$i).values()],r={};return i.forEach(o=>{ts(n,o.queryKey)&&Object.assign(r,o.defaultOptions)}),r}setMutationDefaults(n,i){j(this,Xi).set(br(n),{mutationKey:n,defaultOptions:i})}getMutationDefaults(n){const i=[...j(this,Xi).values()],r={};return i.forEach(o=>{ts(n,o.mutationKey)&&Object.assign(r,o.defaultOptions)}),r}defaultQueryOptions(n){if(n._defaulted)return n;const i={...j(this,xa).queries,...this.getQueryDefaults(n.queryKey),...n,_defaulted:!0};return i.queryHash||(i.queryHash=Md(i.queryKey,i)),i.refetchOnReconnect===void 0&&(i.refetchOnReconnect=i.networkMode!=="always"),i.throwOnError===void 0&&(i.throwOnError=!!i.suspense),!i.networkMode&&i.persister&&(i.networkMode="offlineFirst"),i.queryFn===Rd&&(i.enabled=!1),i}defaultMutationOptions(n){return n!=null&&n._defaulted?n:{...j(this,xa).mutations,...(n==null?void 0:n.mutationKey)&&this.getMutationDefaults(n.mutationKey),...n,_defaulted:!0}}clear(){j(this,Ue).clear(),j(this,ka).clear()}},Ue=new WeakMap,ka=new WeakMap,xa=new WeakMap,$i=new WeakMap,Xi=new WeakMap,Sa=new WeakMap,Zi=new WeakMap,es=new WeakMap,zy),Qy=B.createContext(void 0),FA=n=>{const i=B.useContext(Qy);if(!i)throw new Error("No QueryClient set, use QueryClientProvider to set one");return i},Tk=({client:n,children:i})=>(B.useEffect(()=>(n.mount(),()=>{n.unmount()}),[n]),b.jsx(Qy.Provider,{value:n,children:i}));const Ak=[{id:"frontend",name:"Frontend Engineer",icon:"🖥️",blurb:"UI, UX, browsers, performance and accessibility.",skills:["JavaScript / TypeScript","React · Vue · Angular","CSS & accessibility","Web performance"],questions:{junior:[{q:"Explain the difference between `let`, `const`, and `var` in JavaScript.",a:"`var` is function-scoped and hoisted (initialized as undefined), while `let` and `const` are block-scoped and live in the temporal dead zone until declared. `let` allows reassignment, `const` does not — though `const` objects and arrays can still be mutated. Modern code prefers `const` by default, `let` only when you must reassign, and avoids `var` entirely.",kp:["block scoping","const cannot be reassigned","hoisting","temporal dead zone","prefer const by default"]},{q:"What is the DOM and how does JavaScript interact with it?",a:"The Document Object Model is the browser's tree-structured representation of the HTML page. JavaScript interacts with it through APIs like `document.querySelector`, `getElementById`, `createElement` and `addEventListener` to read, modify, and respond to the page. Every change can trigger layout and paint, so you should batch updates and minimize direct DOM manipulation.",kp:["tree representation of HTML","querySelector and getElementById","addEventListener","creating and appending nodes","minimize reflows and repaints"]},{q:"Describe the CSS box model and how `box-sizing` affects it.",a:"Every element is a box made of content, padding, border, and margin. By default (content-box), `width` sets only the content width, so padding and border add to the rendered size. With `box-sizing: border-box`, the width includes padding and border, which makes layouts far more predictable — it's the standard reset used in modern codebases.",kp:["content padding border margin","border-box includes padding and border","margin collapsing","predictable sizing"]},{q:"What's the difference between `==` and `===` in JavaScript?",a:"`==` performs type coercion before comparing, which leads to surprising results like `0 == false` being true. `===` (strict equality) compares both value and type without coercion. You should always prefer `===`, and use explicit checks like `x == null` only when you deliberately want to catch both `null` and `undefined`.",kp:["loose vs strict equality","type coercion","prefer triple equals","null and undefined edge cases"]},{q:"What is a Promise in JavaScript and why was it introduced?",a:"A Promise represents a value that may not be available yet — it's a cleaner way to handle asynchronous work than nested callbacks, avoiding 'callback hell'. A promise has three states: pending, fulfilled, and rejected, and you chain with `.then()` / `.catch()` or `async`/`await`. It also gives you a single error path and composition tools like `Promise.all`.",kp:["pending fulfilled rejected","avoids callback hell","then and catch chaining","async await","Promise.all"]}],mid:[{q:"Explain closures in JavaScript and give a real-world use case.",a:"A closure is a function that retains access to variables from its outer scope even after that scope has returned. Common uses: data privacy (module pattern), creating function factories or counters, and capturing values in event handlers and `setTimeout` callbacks — which is exactly why `var` in a loop historically caused bugs. Closures keep references alive, so misuse can cause memory leaks.",kp:["inner function remembers outer scope","data privacy and module pattern","capturing loop variables","memory leaks","function factories"]},{q:"Explain the event loop. How do microtasks and macrotasks differ?",a:"JavaScript is single-threaded: the call stack runs one task at a time, and asynchronous callbacks are queued. The event loop continuously checks the call stack, then the microtask queue, then the macrotask queue. Microtasks (promise callbacks, `queueMicrotask`) always drain before the next macrotask (`setTimeout`, I/O), which is why promise callbacks can starve timers if overused.",kp:["single-threaded call stack","microtasks before macrotasks","promises are microtasks","setTimeout is a macrotask","rendering happens between tasks"]},{q:"Explain React's virtual DOM and reconciliation.",a:"React keeps an in-memory representation of the UI and differs it against the previous render to compute the minimal set of DOM updates — that's reconciliation. Keys tell React which list items are stable across renders so it can reuse DOM nodes instead of rebuilding them. Updates are batched, and the commit phase applies the changes; misuse of keys or unstable components forces full re-renders and kills performance.",kp:["in-memory UI tree","diffing algorithm","keys for list identity","batched updates","minimal DOM mutations"]},{q:"How do you optimize a slow web page? Walk me through your approach.",a:"First I measure — Lighthouse, DevTools performance panel, and real-user metrics — because guesses are usually wrong. Then I attack the biggest wins: reduce bundle size with code splitting and tree-shaking, lazy-load below-the-fold content, optimize images (modern formats, sizing, lazy loading), and reduce main-thread work like unnecessary re-renders. Finally I verify with before/after metrics and add budgets so regressions get caught in CI.",kp:["measure before optimizing","code splitting and lazy loading","image optimization","reduce re-renders","performance budgets in CI","real-user monitoring"]},{q:"How would you debug a memory leak in a single-page application?",a:"I'd start in the DevTools Memory panel: take heap snapshots before and after actions, look for detached DOM nodes and listeners still referenced by global variables or closures. Common culprits are unremoved event listeners, `setInterval` never cleared, and closures capturing large objects. I'd reproduce a leak in the Performance monitor, isolate the component, and verify the fix by repeating the snapshot comparison.",kp:["heap snapshots","detached DOM nodes","unremoved event listeners","intervals and timers not cleared","closures capturing large objects"]}],senior:[{q:"Design a state management approach for a large React application.",a:"I'd start with the principle 'as local as possible': colocate state with the component that owns it, lift only what's genuinely shared. Server data goes through a data-fetching layer (like React Query or SWR) with cache keys and invalidation, while a lightweight store or context handles truly global client state like auth or theme. Derived values are computed with selectors or memoization rather than duplicated in state, and updates flow through a predictable, testable path.",kp:["colocate state locally","separate server and client state","cache invalidation","selectors for derived state","avoid prop drilling","predictable update flow"]},{q:"How do you make an application accessible, and how do you verify it?",a:"Accessibility starts with semantic HTML — real buttons, landmarks, and headings — which buys most of the a11y for free. ARIA is used only to fill gaps, never to paper over bad markup. I verify with automated tools (axe in CI), keyboard-only navigation tests, contrast checks, and real screen-reader passes (VoiceOver/NVDA) on key flows. Accessibility issues are tracked like bugs, not afterthoughts.",kp:["semantic HTML first","ARIA only when needed","keyboard navigation","color contrast","screen reader testing","automated axe checks in CI"]},{q:"How would you migrate a legacy monolith frontend to a modern stack without stopping delivery?",a:"I'd use the strangler pattern: carve the app into bounded pieces and migrate one at a time behind a router so old and new live side by side. Feature flags gate each slice, and a contract-first approach keeps APIs stable during transition. For cross-app embedding I'd consider iframes or web components for isolation, and micro-frontends only when team autonomy demands it — they add real complexity. The key rule: the codebase stays deployable at every step.",kp:["strangler pattern incremental migration","feature flags","contract-first APIs","web components for isolation","deployable at every step","avoid micro-frontends unless justified"]},{q:"How do you ensure frontend performance at scale — specifically Core Web Vitals?",a:"Core Web Vitals (LCP, CLS, INP) have to be owned like product metrics, not fixed reactively. LCP: minimize server response, deliver critical CSS and preload key resources, use next-gen images. CLS: reserve space for images/ads, avoid injecting layout above the fold. INP: keep the main thread free — avoid long tasks, lazy hydrate, debounce expensive work. I'd instrument with real-user monitoring, set budgets in CI, and tie regressions back to the commit that caused them.",kp:["LCP CLS INP definitions","critical CSS and font loading","next-gen images and preloading","long tasks and main-thread time","real-user monitoring","budgets enforced in CI"]},{q:"How do you handle state and navigation in an app with dozens of routes and deep linking?",a:"I'd separate route definitions from components, keep URL as the source of truth for shareable state, and derive what's ephemeral (scroll positions, in-flight form state) from memory. Code-split per route, lazy-load heavy screens, and define a small set of navigation transitions. Deep links map to route params, with guards handling auth and not-found states centrally.",kp:["URL as source of truth","route-based code splitting","lazy loading screens","route guards for auth","deep link to route mapping"]}],staff:[{q:"Design a frontend platform team's offering to 10+ product teams.",a:"The platform should make the right thing easy: a versioned design system and component library, shared build tooling with CI templates, and a CLI/scaffolder so a new app starts with best practices baked in. Documentation, migration guides, and a support model (office hours, champions per team) matter as much as the code. The hard part is governance: the platform sets standards, but product teams keep ownership of their code, so you need a lightweight way to approve exceptions.",kp:["versioned design system","shared build tooling and CI templates","scaffolding and CLI","documentation and support","champions in each team","flexibility vs consistency balance"]},{q:"Many teams ship daily. How do you prevent regressions across the frontend?",a:"Combine layers of automated safety: type checks and contract tests at merge time, visual regression testing on key flows, automated a11y scans, and canary/staged rollouts that watch error and performance signals before full release. Feature flags let you turn off a bad change instantly. The last layer is ownership: every shared component has an owning team, and regression monitoring is instrumented so problems surface in minutes, not weeks.",kp:["visual regression testing","contract and type checks","canary and staged rollouts","feature flags as kill switch","ownership of shared code","automated monitoring"]},{q:"Your performance budget is being blown by 20 teams. What do you do?",a:"First, instrument and rank — most of the damage usually comes from a few offenders, so I'd measure per-team bundle and runtime impact and publish the numbers. Then I'd make compliance cheap: central rules in the bundler, shared image/CDN infrastructure, and a hard budget gate in CI with a clear exception process. Culture follows structure: celebrate the teams that hit budgets, and tie a senior champion to each top offender rather than chasing all 20 at once.",kp:["measure and rank offenders","central bundler rules","shared infrastructure","budget gates in CI","champions and incentives","celebrate measurable wins"]},{q:"Compare micro-frontends, module federation, and a monolith for a 5,000-engineer company.",a:"A monolith is usually right: it keeps integration cheap, one version of everything, and shared performance tooling. Module federation adds runtime module sharing with real costs — version skew, dependency conflicts, and debugging across boundaries. Micro-frontends buy team autonomy and independent deploys, but you pay in integration testing, duplicated dependencies, and fragmented UX. My answer: start monolith, adopt federation only where independent deploy velocity is proven to matter, and never fragment for architectural fashion.",kp:["monolith as default","module federation version skew","micro-frontends integration cost","team autonomy tradeoff","incremental adoption","shared performance tooling"]}],principal:[{q:"Define the frontend technical strategy for the next 3 years.",a:"It must start from business goals: where does the company need speed, reliability, or new surfaces? I'd make a small number of explicit bets — a consolidated framework and rendering strategy, a design system roadmap, performance as a product KPI — and kill fragmentation everywhere else. The plan includes a hiring and training path, a migration roadmap with measurable milestones, and a quarterly review cadence with the exec team so the strategy stays alive instead of collecting dust.",kp:["aligned to business goals","consolidated framework bet","performance as product","migration roadmap","training and hiring plan","measurable KPIs and review cadence"]},{q:"How do you drive adoption of a new architecture across an org that resists change?",a:"Resistance usually means the change isn't obviously better for the people doing it. I'd find 1-2 respected early-adopter teams, build the new path *with* them rather than for them, and let their measurable wins (faster deploys, fewer bugs) sell it. Executive sponsorship sets the direction, but persuasion comes from evidence. I'd make the migration path low-friction with tooling and migration scripts, keep exceptions visible, and publicly celebrate every team that converts.",kp:["early adopter teams first","build with not for","measurable wins as evidence","executive sponsorship","low-friction migration tooling","celebrate and document success"]},{q:"You must cut frontend infrastructure costs by 40% without losing reliability.",a:"Start with the data: tag all resources, find what's idle or duplicated, and kill waste before touching anything that works. Then structural wins: move static assets to a cheaper CDN tier with smarter caching, reduce bundle and image weight to cut bandwidth, and right-size build runners. Where possible, shift bursty compute to serverless. Finally, put cost guardrails in place — budgets and alerts — so the 40% doesn't creep back, and communicate every tradeoff in terms of what didn't change (reliability, UX).",kp:["audit usage before cutting","tagging and waste elimination","CDN and caching strategy","bundle and image weight","serverless for bursty work","guardrails and cost monitoring"]},{q:"How do you set the hiring bar and interview process for frontend engineers org-wide?",a:"A credible process starts with a rubric: what does a frontend engineer at each level actually do here? Interviews become structured around those dimensions — coding, system design, debugging, collaboration — with consistent questions and a calibration loop where interviewers compare scores and share signal. I'd invest in the candidate experience (clear expectations, fast feedback) because strong candidates are evaluating us too, and track outcomes — hire quality and performance — to keep improving the process itself.",kp:["role-based rubrics per level","structured consistent interviews","calibration across interviewers","candidate experience","track hire quality","continuous process improvement"]}]}},{id:"backend",name:"Backend Engineer",icon:"⚙️",blurb:"APIs, databases, distributed systems and reliability.",skills:["APIs & services","Databases & caching","Distributed systems","Go · Java · Node · Python"],questions:{junior:[{q:"Walk me through what happens when you type a URL into a browser and press Enter.",a:"The browser resolves the domain via DNS to an IP, opens a TCP connection (TLS handshake for HTTPS), and sends an HTTP request. The server processes it, typically hitting a load balancer, application code, and possibly a database, then returns an HTTP response with status code and body. The browser parses the response, and caching layers (browser, CDN) may shortcut the whole flow on repeat visits.",kp:["DNS resolution","TCP and TLS handshake","HTTP request and response","server processing and database","status codes","caching layers"]},{q:"Explain REST and common HTTP methods and status codes.",a:"REST treats resources identified by URLs, manipulated with HTTP verbs: GET to read, POST to create, PUT to replace, PATCH to partially update, DELETE to remove. Status codes group outcomes: 2xx success, 3xx redirects, 4xx client errors (404 not found, 400 bad request, 401/403 auth), 5xx server errors. REST is stateless — each request carries what it needs — and PUT/DELETE are idempotent, meaning repeating them has the same effect.",kp:["resources identified by URL","GET POST PUT DELETE semantics","2xx 4xx 5xx status codes","statelessness","idempotency of PUT DELETE"]},{q:"What's the difference between an INNER JOIN and a LEFT JOIN in SQL?",a:"Both combine rows from two tables on a condition. INNER JOIN returns only rows that match in both tables; unmatched rows disappear. LEFT JOIN returns every row from the left table, padding the right side with NULLs where there's no match. LEFT JOINs are common for 'all X, with their Y if any' queries, but watch for row multiplication when the joined side has duplicates.",kp:["matching rows on a condition","inner drops unmatched rows","left keeps all left rows null-padded","row multiplication on one-to-many"]},{q:"What is an API and how do you design a simple one?",a:"An API exposes a system's capabilities over HTTP in a consistent, documented way. Good API design: clear resource naming (plural nouns, predictable URLs), consistent status codes and error shapes, input validation on every endpoint, versioning from day one, and documentation consumers can rely on. A minimal API is a route, a handler that validates and processes, and a serialized response.",kp:["clear resource naming","consistent error and status shapes","input validation","versioning","documentation","serialized responses"]},{q:"What's the difference between a process and a thread?",a:"A process is an isolated program instance with its own memory space; a thread is a unit of execution within a process that shares the process's memory. Threads are cheaper to create and communicate (shared memory), but shared state brings race conditions. Processes are safer (crash isolation, no shared state) at the cost of heavier communication. In server code this maps to concurrency models: threads, event loops, or processes per request.",kp:["process has own memory space","threads share process memory","cheaper context switching for threads","race conditions from shared state","crash isolation of processes"]}],mid:[{q:"Explain database indexing. When does it help and when does it hurt?",a:"An index is a structure (usually a B-tree) that lets the database find rows without scanning the whole table — it speeds up lookups, range queries, and joins dramatically. It hurts writes (each insert/update must maintain the index), and it only helps when the query can use it, so you verify with `EXPLAIN`. Composite indexes depend on column order; the most selective column goes first. Covering indexes can serve queries entirely from the index.",kp:["B-tree speeds lookups","write amplification on inserts","explain plans to verify","composite index column order","covering indexes","index selectivity"]},{q:"What is idempotency and how do you implement it in an API?",a:"An idempotent operation can be retried and produce the same result. In practice: clients send an idempotency key, the server deduplicates by that key (unique constraint in the DB), and retries with the same key return the original result instead of double-processing. This matters for payments, order creation, and any operation with side effects. Combined with retry-with-backoff, it gives at-least-once delivery without duplicate effects.",kp:["retries produce same result","idempotency keys from client","unique constraint for dedupe","safe retries","at-least-once semantics"]},{q:"Explain authentication vs authorization. Walk through a JWT flow.",a:"Authentication answers 'who are you?' — the login step. Authorization answers 'what can you do?' — permission checks after identity is known. A JWT is a signed token with header, payload, and signature: the server signs it with a secret, the client stores it, and subsequent requests include it so the server can verify without a session lookup. JWTs are stateless but hard to revoke, so pair a short-lived access token with a refresh token, and keep the signing key secure.",kp:["authn is identity authz is permissions","JWT header payload signature","stateless verification","short-lived access plus refresh token","signing key security","revocation challenges"]},{q:"Explain the CAP theorem with a real example.",a:"CAP says a distributed system can guarantee only two of Consistency, Availability, and Partition tolerance under a network partition — and partitions are inevitable, so you choose between consistency and availability when they happen. DynamoDB-style systems favor availability and eventual consistency; HBase/ZooKeeper-style systems favor consistency and may refuse requests during partitions. Real systems blend: 'consistent reads at the cost of availability during an outage' vs 'serve stale data rather than fail'.",kp:["consistency availability partition tolerance","partitions are inevitable","AP systems eventual consistency","CP systems refuse during partition","tradeoffs are real decisions"]},{q:"What is a message queue and when would you use one?",a:"A message queue decouples producers from consumers: a producer publishes, a broker stores, and consumers process asynchronously. Use it to smooth load spikes, decouple services (order service publishes 'order created', email service consumes it), and add retry/backpressure. Tradeoffs: at-least-once delivery means consumers must be idempotent, and you add operational complexity and latency. Don't reach for a queue when a simple synchronous call or a database table works.",kp:["decouples producer and consumer","smooths load spikes","asynchronous processing","at-least-once delivery","idempotent consumers","don't over-engineer"]}],senior:[{q:"Design a rate limiter for a public API.",a:"Choose an algorithm: token bucket is simple and allows bursts; sliding window is smoother. Track counters per key (user or IP) in a fast store like Redis with TTLs, and enforce at the gateway or middleware. On violation return 429 with a Retry-After header and meaningful error messages. For distributed enforcement, use atomic Redis ops (INCR + EXPIRE) or a Lua script. Monitor quota usage so you can detect abuse and tune limits, and make sure the limiter itself degrades gracefully — never the single point of failure.",kp:["token bucket or sliding window","per-user or per-IP keys","Redis counters with TTL","429 with retry-after","distributed atomic operations","monitoring and graceful degradation"]},{q:"Your production database is getting slow. How do you approach it?",a:"Find the slow queries first — don't guess. Enable slow query logs, run EXPLAIN ANALYZE on the offenders, and check for missing or misused indexes, lock contention, and full scans. Then the usual ladder: add targeted indexes, cache hot reads, offload analytics to a replica, and only then consider partitioning or sharding, which add real complexity. Watch connection pool sizing too — a common cause of 'the database is slow' is app-side exhaustion.",kp:["find slow queries first","explain analyze","targeted indexes","cache hot reads","replicas for analytics","connection pool sizing","sharding only as last resort"]},{q:"Explain eventual consistency and how you handle stale reads.",a:"Eventual consistency means replicas converge over time rather than immediately — reads may briefly see old data. You handle it by matching consistency to the operation: read-your-writes for the current user (route reads to the replica that saw the write, or wait for acknowledgment), versioning to detect conflicts, and explicit staleness windows in the UI ('updating…'). Strong consistency stays for money and identity; everything else gets a freshness budget.",kp:["replicas converge asynchronously","read-your-writes consistency","versioning and conflict detection","staleness windows in UX","strong consistency for critical data"]},{q:"Design a background job system.",a:"Core pieces: a queue (Redis or a broker), workers that consume jobs, and a retry policy with exponential backoff and a dead-letter queue for poison messages. Jobs should be idempotent so retries are safe, and workers need concurrency limits and backpressure so a flood of jobs doesn't collapse the database. Add scheduling for cron-like jobs, observability on queue depth, age, and failure rates, and a replay mechanism. Design the job payload as a durable command, not a pointer to mutable state.",kp:["queue with retries and backoff","dead-letter queue","idempotent job handlers","concurrency and backpressure","scheduling","observability of queue depth","replay and re-drive"]},{q:"How do you ensure your API is secure and performant under load?",a:"Security: authenticate and authorize every request, validate and limit input, rate limit, and follow the OWASP basics (no injection, safe error messages, HTTPS everywhere). Performance: profile with load tests to find the bottleneck, cache aggressively at the right layer, add pagination and field selection to big endpoints, and use connection pooling and async I/O. Then verify: load test with realistic traffic, set latency SLOs, and monitor in production with traces.",kp:["authn and authz on every route","input validation and OWASP basics","rate limiting","load test to find bottlenecks","caching at the right layer","pagination and field selection","latency SLOs with monitoring"]}],staff:[{q:"Design a payments system that must never lose money.",a:"The invariants: every operation is idempotent (unique constraint on idempotency keys), and money movement lives in an append-only ledger with double-entry accounting — every debit has a credit, so the books always balance. External providers are reconciled against our ledger asynchronously, with mismatch alerts. The system is designed for compensating transactions, not mutation: if a charge fails after a hold, you release, never delete. Add an immutable audit trail, separate money paths from the main CRUD app, and make the ledger the source of truth that everything else derives from.",kp:["idempotency with unique constraints","append-only double-entry ledger","reconciliation with external systems","compensating transactions","immutable audit trail","ledger as source of truth"]},{q:"How do you migrate a monolithic database to a distributed or sharded architecture with zero downtime?",a:"The pattern is dual-write plus backfill: write new records to both old and new stores, backfill historical data with a verification pass that compares counts and checksums, then flip reads behind a feature flag once the new store is consistent. Cut over gradually — move a percentage of traffic — and keep a tested rollback that stops writes to the new store and resumes the old. Run reconciliation jobs for a period after cutover, and have a clear owner and runbook for every step.",kp:["dual-write pattern","backfill with verification","feature-flag read cutover","gradual traffic ramp","tested rollback plan","post-cutover reconciliation"]},{q:"Design an event-driven architecture. How do you guarantee exactly-once processing?",a:"Events become the source of truth; services communicate by publishing and subscribing. Exactly-once is impossible in distributed systems, so you implement effectively-once: at-least-once delivery plus idempotent consumers that deduplicate by event ID (unique constraint or a processed-events store). The outbox pattern guarantees reliable publishing — write the event in the same transaction as the business change, then a relay publishes it. Add a schema registry for evolution, dead-letter queues for poison events, and monitor lag so replay is easy.",kp:["effectively-once via idempotency","dedupe by event ID","outbox pattern for reliable publish","schema registry and versioning","dead-letter queues","lag monitoring and replay"]},{q:"Design a globally distributed system serving millions of users.",a:"Start from latency and residency: place data and compute near users, with regions chosen for regulation. Choose a replication model — active-active for reads and local writes, active-passive for simplicity — and define conflict resolution (last-write-wins for most, CRDTs or business rules where it matters). Global load balancing via DNS/anycast routes users to the nearest region. Add automated failover with periodic DR drills, and understand the real cost: cross-region replication is expensive, so replicate deliberately, not everything-everywhere.",kp:["data residency and latency","active-active vs active-passive","conflict resolution strategy","global DNS and anycast","automated failover and DR drills","replication cost management"]}],principal:[{q:"Design the backend platform strategy for a company scaling 10x.",a:"The platform exists to make delivery safe and fast for product teams: a standardized core stack, self-service infrastructure (deploy, databases, queues through an internal platform), and enforced contracts and API governance. Define SLOs and error budgets so reliability is a decision input, not a surprise. Scale the org with the system: a platform team that treats product teams as customers, with a small number of golden paths instead of infinite flexibility. Sequence it as: standardize, then automate, then measure — never all at once.",kp:["standardized core stack","self-service internal platform","API governance and contracts","SLOs and error budgets","platform team as internal product","golden paths over flexibility"]},{q:"How do you decide when to build vs buy (databases, queues, ML infra)?",a:"Frame it as core vs context: if the capability is a competitive advantage, build; otherwise buy or use managed services. Then look at total cost of ownership — purchase cost plus operations, on-call, and expertise — not just license fees. Evaluate exit costs and lock-in: can we leave if it fails? Match maturity: a young team shouldn't run its own database. And always keep the decision reversible where possible.",kp:["core vs context competency","total cost of ownership","managed services for maturity","exit costs and lock-in","time to market","operational capacity to run it"]},{q:"A critical service has a 99.99% SLO but your team keeps getting paged. How do you fix reliability culture?",a:"Start with the evidence: what's actually consuming on-call time? Reduce toil with automation and fix the alerting — alerts should be actionable and meaningful, or they train people to ignore them. Then make error budgets real: if the budget is spent, releases slow down by policy, which forces product tradeoffs into the open. Blameless postmortems with action items and owners convert incidents into improvement. Finally, rotate on-call fairly with training and shadowing so reliability is a shared skill, not a punishment.",kp:["measure on-call toil","meaningful actionable alerting","error budgets gate releases","blameless postmortems with owners","fair on-call rotation with training","reduce toil with automation"]},{q:"How do you set up architecture governance that engineers actually follow?",a:"Governance works when it's lightweight and embedded: ADRs (architecture decision records) capture decisions with context, a small review board handles only the decisions that matter (skip bikeshedding), and guardrails are automated in CI — lint rules, dependency policies, cost budgets — so compliance is a side effect of normal work. Documentation-as-code keeps the system current, and a clear exception process means nobody has to subvert the rules. Above all: evangelize through working examples, because people follow what they see working.",kp:["ADR decision records","lightweight review boards","automated guardrails in CI","documentation as code","explicit exception process","evangelize through examples"]}]}},{id:"fullstack",name:"Full-Stack Engineer",icon:"🧩",blurb:"End-to-end product delivery across client and server.",skills:["Frontend + backend","APIs & data","Auth & real-time","Product thinking"],questions:{junior:[{q:"Walk me through a typical request from frontend to database and back.",a:"A user action in the UI triggers a fetch to an API endpoint. The server's router matches the path to a handler, which validates input, runs any business logic, queries the database, and serializes the result as JSON. The response flows back over HTTP, and the frontend updates its state and re-renders. Every layer is a place to add caching, validation, or error handling.",kp:["UI event triggers fetch","router matches handler","validation and business logic","database query","JSON response","state update and re-render"]},{q:"What is CORS and why do browsers enforce it?",a:"CORS (Cross-Origin Resource Sharing) is a browser security mechanism: a page at origin A can't read responses from origin B unless B explicitly allows it via the Access-Control-Allow-Origin header. Browsers enforce it to prevent malicious sites from making credentialed requests to sites you're logged into. For complex requests the browser sends a preflight OPTIONS request. The fix belongs on the server: configure allowed origins explicitly, never a wildcard with credentials.",kp:["same-origin policy","browser-enforced security","access-control-allow-origin header","preflight OPTIONS requests","credentials handling","server-side configuration"]},{q:"What is JSON and how is it used in web APIs?",a:"JSON is a lightweight text format for structured data: objects of key-value pairs, arrays, and primitive values. It's the de facto API format because it's human-readable and natively parseable by JavaScript. APIs serialize server data to JSON, clients parse it, and tools like JSON Schema validate its shape. Design matters: consistent field naming, explicit null vs absent, and never returning sensitive fields by default.",kp:["key-value text format","serialization and parsing","application/json content type","nested structures and arrays","schema validation","consistent field naming"]},{q:"Explain environment variables and why secrets should never be in code.",a:"Environment variables keep configuration outside the codebase, so the same code runs in dev, staging, and prod with different values. Secrets like API keys and DB passwords must never be committed: anything in git is effectively public forever, and leaked credentials get scraped by bots within minutes. Use .env files locally, a secret manager in production, inject at deploy time, rotate regularly, and give each service only the credentials it needs.",kp:["config outside code","dev staging prod parity","secrets never in git","secret managers","rotation and least privilege","injected at deploy time"]}],mid:[{q:"Explain sessions vs tokens for authentication in a full-stack app.",a:"Sessions store state server-side, hand the client a cookie, and are easy to revoke — but they need sticky sessions or a shared store at scale. Tokens (JWTs) are stateless and scale horizontally trivially, but revocation is hard and size grows. Common approach: short-lived access token for API calls plus a refresh token, or session-backed auth for classic web apps. The right answer depends on your clients: cookie sessions suit server-rendered web apps; tokens suit SPAs, mobile, and third-party integrations.",kp:["server-side sessions via cookie","stateless JWT tokens","revocation tradeoffs","CSRF vs XSS concerns","mobile and third-party clients","hybrid short-lived token design"]},{q:"How do you keep client and server data in sync?",a:"Treat server data as a cache the client owns: a data-fetching library (React Query, SWR) manages keys, caching, refetching, and invalidation instead of hand-rolled fetch logic. Optimistic updates apply the change immediately and roll back on failure. For real-time needs, add WebSockets or SSE for targeted updates. Offline-first apps keep a local store as source of truth and sync mutations through a queue with conflict resolution.",kp:["server state as cache","fetching libraries manage invalidation","optimistic updates with rollback","websockets or SSE for real-time","offline queue and sync","stale-while-revalidate"]},{q:"What is a webhook? How do you secure and debug them?",a:"A webhook is an HTTP callback: one service POSTs an event to a URL another service owns. Because the receiving URL is public, you must verify authenticity — sign the payload with HMAC using a shared secret and check it on receipt, plus require HTTPS. Handlers must be idempotent because providers retry with backoff. Debugging: log raw payloads, use a webhook testing tool locally, and keep replay endpoints for reproducing events.",kp:["HTTP callback for events","HMAC signed payloads","verify signature on receipt","idempotent handlers with retries","HTTPS required","replay and debugging tools"]},{q:"Design a full-stack feature: profile editing with image upload.",a:"Frontend: a form with client-side validation and optimistic save state. Upload: send the image via multipart to a signed endpoint or presigned URL (direct to object storage), validating type, size, and dimensions server-side — never trust client checks. Store the metadata (URL, size, user id) in the database, serve through a CDN with cache-busting on the URL. Security: authenticate every mutation, guard against path traversal by using storage keys you generate, and handle upload failures with clear UX.",kp:["client and server validation","presigned URL or multipart upload","object storage and CDN","authenticate every mutation","generate storage keys server-side","progress and error UX"]}],senior:[{q:"Design a real-time collaborative editor like Google Docs (conceptual).",a:"The core problem is concurrent edits converging to one document. Two families of solutions: Operational Transformation (used by Google Docs) or CRDTs, both giving eventual consistency without data loss. WebSockets carry updates; the server acts as the coordinator and source of truth; clients apply transformations and resolve conflicts locally. Beyond the core: presence and cursors, permission checking per edit, offline support with a local change log, and storage snapshots with an undo/version history.",kp:["operational transformation or CRDTs","websocket transport","server as source of truth","conflict resolution","presence and cursors","offline change log and sync"]},{q:"How do you handle authentication across web, mobile, and third-party apps?",a:"Use OAuth2 with the right flow per client: authorization code with PKCE for mobile and SPAs, authorization code for server-side web apps, client credentials for machine-to-machine. SSO via an identity provider (Okta, Auth0, Google) centralizes identity. Issue short-lived access tokens with rotating refresh tokens, and keep revocation centralized in the auth service. The auth service itself must be boring and well-audited — it's the crown jewels.",kp:["OAuth2 flows per client","PKCE for mobile and SPAs","SSO with identity providers","refresh token rotation","centralized auth service","central revocation"]},{q:"Design a feature that must work offline-first.",a:"The local store (IndexedDB/SQLite) is the source of truth; the server is a synchronization target. Reads come from the local store, writes go into an outbox queue and sync in the background with retry. Conflicts need per-data-type strategies: last-write-wins for simple fields, merge for lists, and versioned objects with user resolution for important documents. Schema versioning and migrations are mandatory since devices update at their own pace. The UI must communicate sync state honestly — 'saved locally, syncing'.",kp:["local store as source of truth","outbox queue with retry","background sync","per-type conflict resolution","schema versioning and migrations","honest sync state UX"]},{q:"How do you reduce end-to-end latency for users on slow networks?",a:"Shrink what travels and move it closer: CDN and edge caching for static and API responses, HTTP/2 or HTTP/3 with compression, and smaller payloads (pagination, field selection, or batching). Render fast first — server-side rendering or streaming for first paint, service worker precaching for repeat visits. Give the UI graceful fallbacks: skeletons, cached data shown immediately, and offline-tolerant retries instead of blank errors.",kp:["edge caching and CDN","HTTP/2 and compression","smaller payloads and batching","SSR for first paint","service worker precaching","graceful fallbacks and skeletons"]}],staff:[{q:"Design a multi-tenant SaaS platform where each customer needs isolation.",a:"Choose an isolation model per data sensitivity: shared schema with tenant_id + row-level security is cheapest; schema-per-tenant or DB-per-tenant buys stronger isolation for enterprises. Every query, cache key, and background job must be tenant-scoped — this is where leaks happen. Add tenant-scoped auth and rate limits so one noisy neighbor can't take you down, and handle compliance and data residency per tenant (a tenant's data stays in its region). Expose an admin console with per-tenant health, usage, and kill switch.",kp:["isolation models shared schema to db per tenant","tenant-scoped queries and cache keys","row-level security","noisy neighbor mitigation","per-tenant data residency","tenant kill switches"]},{q:"Design a feature-flag and experimentation platform.",a:"Feature flags need ultra-low-latency evaluation — cache the flag rules at the edge and in the SDK so the flag service is never on the request path. Target by user, cohort, or percentage for progressive rollouts and instant kill switches. Experimentation layers on top: deterministic assignment (hash of user id), event collection, and statistically sound analysis with guardrail metrics. The unsung work is hygiene: flag ownership, expiry, and cleanup so flags don't become permanent dead code.",kp:["edge evaluation and SDK caching","targeting rules and cohorts","deterministic A/B assignment","guardrail metrics","kill switches and progressive rollout","flag hygiene and expiry"]},{q:"Design a search feature across a large product catalog.",a:"Index documents in a search engine (Elasticsearch/OpenSearch or a vector DB for semantic search) using an inverted index. The ingestion pipeline tokenizes, normalizes, and enriches documents, then reindexes on changes with alias swaps for zero-downtime updates. Ranking combines relevance (BM25, embeddings) with business rules (popularity, freshness). Add faceted filters, typo tolerance, and pagination/search-as-you-type, and measure quality with click-through on results — search quality is a feedback loop, not a one-time build.",kp:["inverted index","ingestion and tokenization pipeline","relevance ranking BM25 or embeddings","facets and filters","typo tolerance","reindexing with alias swaps","measure via click-through"]},{q:"How do you evolve an API from v1 to v2 without breaking clients?",a:"Prefer additive changes forever: new fields, new endpoints, never removing or changing meaning. When breaking changes are unavoidable, run both versions with a clear deprecation policy — announce timeline, keep v1 alive long enough, and give migration guides and tooling. Version via URL or header consistently, and use compatibility tests that lock the old behavior. Track v1 usage metrics so you know when it's truly dead, then sunset it.",kp:["additive changes first","deprecation policy with timeline","consistent versioning strategy","compatibility tests","migration guides and tooling","usage metrics before sunset"]}],principal:[{q:"Design the developer experience platform for 100+ engineers shipping full-stack.",a:"The platform's job is to make the golden path the easy path: project scaffolding with best practices baked in, CI/CD templates that work on day one, ephemeral preview environments, and built-in observability (logs, traces, dashboards) in every service. Local development parity with production is a force multiplier. Everything is measured: time-to-first-deploy for new hires, build times, flake rates, developer satisfaction surveys — the platform competes on developer productivity like a product competes on revenue.",kp:["scaffolding and templates","CI/CD golden paths","preview environments","observability built in","local dev parity","measure developer productivity"]},{q:"One team ships 3x faster with terrible quality; another is slow but excellent. What's your strategy?",a:"Both are symptoms, so measure both axes before prescribing. The fast team probably has no safety net — invest in automated tests, deploy safety (canaries, rollbacks), and code review. The slow team is probably bottlenecked on process or fear — attack review latency, break large changes into smaller deploys, and add test coverage so confidence comes from automation instead of caution. Align incentives: reward shipping with quality, not either alone, and make the deploy pipeline the safety net both teams trust.",kp:["measure speed and quality separately","shift quality left with automation","deploy safety canary rollback","reduce review latency","small frequent deploys","align incentives on both axes"]},{q:"How do you design for scale: from 1k to 10M users?",a:"Design for the 10M shape but don't build it on day one: stateless services that scale horizontally, a cache layer that absorbs read spikes, async processing for anything non-critical, and data modeled so it can shard later. The discipline is avoiding premature optimization — you optimize the architecture that survives, not the one that's hypothetical. Load test early to find the real bottlenecks, and let the database be the last thing you shard, not the first.",kp:["stateless horizontally scalable services","cache layers","async where possible","shardable data model","avoid premature optimization","load test to find real bottlenecks"]},{q:"Define API governance and standards for the whole company.",a:"Standards should make the right thing automatic: naming conventions, pagination, error shapes, and idempotency documented once and enforced by linters and CI checks rather than review nagging. A schema registry governs evolution, and every API has an owner with an SLO. Security review is automated and gated. The governance body stays small and pragmatic — it approves exceptions and evolves the standards — because the goal is consistency that lets engineers move between teams without relearning everything.",kp:["naming and error conventions","automated linting in CI","schema registry","owner and SLO per API","automated security review","pragmatic exception process"]}]}},{id:"devops",name:"DevOps / Cloud",icon:"☁️",blurb:"CI/CD, containers, cloud infrastructure and reliability.",skills:["Kubernetes & Docker","AWS · GCP · Azure","CI/CD & IaC","SRE & observability"],questions:{junior:[{q:"What is a container and how is it different from a VM?",a:"A container packages an application with its dependencies and runs isolated processes sharing the host OS kernel — fast startup, small footprint, portable. A VM virtualizes the hardware: each VM runs a full guest OS on a hypervisor, so it's heavier but has stronger isolation. In practice: containers for application workloads, VMs when you need a full OS or kernel-level isolation. Containers made 'works on my machine' obsolete because the image is the environment.",kp:["packages app with dependencies","shares host kernel","isolated processes","fast startup vs VMs","image is the environment"]},{q:"Explain CI and CD. What's the difference?",a:"Continuous Integration means merging code frequently and automatically building and testing on every change, so integration problems surface early. Continuous Delivery means every change is automatically deployed to staging and ready to go to production, with the production deploy automated as well. The payoff: small, reversible changes instead of big-bang releases, and fast feedback to developers.",kp:["merge frequently","build and test on every push","catch integration problems early","automated deploy to staging","production deploys automated","small reversible changes"]},{q:"What is Infrastructure as Code and why does it matter?",a:"IaC means defining infrastructure — networks, servers, databases — in configuration files (Terraform, CloudFormation, Pulumi) instead of clicking in a console. Infrastructure becomes version-controlled, reviewable, and reproducible: you can rebuild an environment from scratch, review changes in pull requests, and detect drift. It turns 'what's running where?' from tribal knowledge into a codebase, and it's the prerequisite for treating infrastructure like software.",kp:["define infrastructure in config","version-controlled","reviewable in pull requests","reproducible environments","drift detection","terraform and cloudformation"]},{q:"Walk me through debugging a container that won't start.",a:"Start with the logs — `docker logs` or the orchestrator's logs — they usually tell you what's wrong. Verify the image and tag exist and match, check environment variables and secrets are present, and confirm ports and health checks line up. Look at resource limits (OOM kills) and whether dependencies like the database are reachable. Compare against the last known good version; if nothing else, `docker run` it manually with the same config to reproduce locally.",kp:["check logs first","verify image and tag","environment and secrets present","ports and health checks","resource limits and OOM","compare to last known good"]}],mid:[{q:"Design a CI/CD pipeline for a web application.",a:"Stages: lint and format, unit tests, build, and image creation, with dependency caching so runs stay fast. Deploy to a staging environment automatically, run integration and e2e tests there, then promote to production — either on merge with a canary, or behind an approval gate for larger teams. Every stage needs a rollback story, and the pipeline itself is code, reviewed like any other change. Secrets are injected from a secret manager, never stored in the repo.",kp:["lint test build stages","dependency caching","artifact and image build","staging before production","approval gates or canary","rollback strategy","secrets from secret manager"]},{q:"How do you deploy a service with zero downtime?",a:"The standard options: rolling deployment (new instances come up, health-checked, then old ones drain and shut down), blue-green (a whole new environment is validated then traffic flips), and canary (a small percentage of traffic hits the new version, watched on metrics, then ramped). All of them need health checks, connection draining, and a fast rollback. The database is the hard part — schema migrations must be backward-compatible so old and new code run against the same schema.",kp:["rolling deployment","blue-green environment swap","canary with metrics and ramp","health checks and readiness","connection draining","backward-compatible migrations"]},{q:"Explain requests vs limits for CPU and memory in Kubernetes.",a:"Requests are what the scheduler guarantees and uses for placement; limits are hard caps. CPU is compressible — a pod over its CPU limit gets throttled — while memory is not: exceeding the memory limit gets the pod OOM-killed. Requests and limits together define Kubernetes Quality of Service classes (Guaranteed, Burstable, BestEffort). Set requests from real usage (with headroom), and think about oversubscription: limits above requests let you pack more pods but risk noisy neighbors.",kp:["requests guarantee scheduling","limits are hard caps","cpu compressible memory is not","OOM kills","quality of service classes","oversubscription tradeoffs"]},{q:"How do you monitor a system? What would you alert on?",a:"Cover the three pillars: metrics, logs, and traces. For services, the RED method (Rate, Errors, Duration); for infrastructure, USE (Utilization, Saturation, Errors). Define SLOs from user experience and alert on error budgets — alert on symptoms (users affected) with runbooks, not on causes (you'll get there during investigation). Every alert must be actionable and every page must have a runbook; if an alert doesn't lead to action, delete it.",kp:["metrics logs traces","RED method for services","USE method for infrastructure","SLOs and error budgets","alert on symptoms with runbooks","avoid alert fatigue"]}],senior:[{q:"Design a Kubernetes deployment for a high-availability web service.",a:"A Deployment with multiple replicas spread across nodes and availability zones (pod anti-affinity, topology spread), managed by an HPA scaling on real metrics like request rate or CPU. Readiness probes gate traffic, liveness probes restart dead pods, and a PodDisruptionBudget ensures voluntary node drains don't drop availability. Stateless app in front of a managed database (state doesn't live in pods), with network policies restricting east-west traffic and a Service/Ingress exposing it. Everything is GitOps-managed so the cluster state is declarative.",kp:["replicas with anti-affinity and zone spread","HPA on real metrics","readiness and liveness probes","pod disruption budgets","stateless apps with managed state","network policies and ingress","gitops declarative state"]},{q:"How do you set up observability across microservices?",a:"Correlation is the hard part: propagate a trace/request ID through every service boundary (headers), then logs, metrics, and traces can be joined. Centralize logs with structured JSON and searchable fields; export metrics with consistent labels to a time-series store; and add distributed tracing to see the full request path with per-span latency. Every service publishes golden signals, and dashboards are organized per service with an error budget view on top. Add alerting with runbooks that reference the dashboards.",kp:["correlation and trace IDs","propagate context via headers","structured centralized logs","metrics with consistent labels","distributed tracing spans","golden signals per service","runbooks tied to alerts"]},{q:"Design a disaster recovery plan.",a:"Define the targets first: RPO (how much data can we lose — drives backup frequency) and RTO (how fast must we recover — drives failover design). Then the mechanics: automated backups with verified restores (test them regularly, untested backups are rumors), cross-region replication for critical data, and a documented failover runbook that's actually rehearsed in game days. Decide failover mode: active-passive (cheaper, slower RTO) vs active-active (expensive, near-zero RTO). Include a communication plan: who declares the incident, who tells customers, and when you fail back.",kp:["RPO and RTO targets","verified backup restores","cross-region replication","rehearsed failover runbooks","active-active vs active-passive","communication and failback plan"]},{q:"How do you keep secrets secure in a cloud environment?",a:"Centralize secrets in a secret manager (AWS Secrets Manager, Vault) with rotation automation — never in code, env files, or image layers (those get baked into artifacts forever). Enforce least privilege with IAM: services get scoped roles, short-lived credentials, and no standing keys where possible. Encrypt at rest and in transit everywhere, enable audit logging on secret access, and run periodic reviews of who can access what. Treat a leaked secret as an incident: rotate immediately and find how it leaked.",kp:["centralized secret manager","automated rotation","least privilege IAM roles","short-lived credentials","audit logging","encryption at rest and transit"]}],staff:[{q:"Design the platform engineering team to serve 50 squads.",a:"The team succeeds by making infrastructure a product, not a ticket queue: golden paths and paved roads — a handful of blessed, fully supported ways to build, deploy, and run services — with self-service access so squads never wait on a human. An internal developer portal (backstage-style) exposes templates, docs, and environment management. Guardrails are policy-as-code, enforced automatically, not by review. The platform team measures itself on developer throughput, cost, and reliability, and it runs its own services with the same standards it preaches.",kp:["golden paths and paved roads","self-service infrastructure","internal developer portal","policy as code guardrails","product mindset with metrics","dogfooding the platform"]},{q:"How do you scale Kubernetes to thousands of nodes and tens of thousands of pods?",a:"At that scale you run many clusters (regional or per-team) rather than one giant one, managed through a federation or fleet layer. Inside clusters: namespace quotas and resource governance so one team can't starve others, node autoscaling plus pod autoscaling tuned to real demand, bin-packing to keep utilization high, and cluster autoscaler limits. Watch the control plane — API server load, etcd limits — and use vertical scaling of control-plane components. Network and DNS become bottlenecks: efficient service discovery and CNI choices matter. And cost management is a feature, not an afterthought.",kp:["many clusters via federation","namespace quotas and governance","node and pod autoscaling","control plane scaling limits","network and DNS bottlenecks","cost management built in"]},{q:"Design a multi-cloud or hybrid strategy. When does it make sense?",a:"Multi-cloud is usually a cost and complexity multiplier, so the default is one cloud done well. It makes sense when: regulatory requirements demand specific regions/vendors, you need resilience against a cloud-wide outage (rare, and active-active multi-cloud is brutally hard), or you're acquiring companies with different footprints. Hybrid (on-prem + cloud) is common for data gravity or compliance. If you go multi-cloud, abstract only the stable layers (containers, IaC, Kubernetes) and accept that you'll run everything twice. Have an exit strategy either way: portable infrastructure is cheap insurance.",kp:["single cloud is the default","regulatory and data residency drivers","active-active multi-cloud complexity","hybrid for data gravity","abstraction layers only where stable","portability as exit insurance"]},{q:"You're on call for a major platform outage. Walk me through it.",a:"First, stabilize: stop the bleeding with the fastest safe action — rollback, failover, or scaling out — before deep investigation. Communicate immediately and continuously: a status page, a stakeholder thread, and clear ownership of the incident. Then gather evidence with timelines while it's fresh. After recovery: a blameless postmortem that asks 'what in the system allowed this?' not 'who did it?', with action items, owners, and dates. The final step is making sure the fix actually prevents recurrence and that the runbook reflects what we learned.",kp:["stabilize before investigate","fast rollback or failover","continuous stakeholder communication","evidence and timeline","blameless postmortem","action items with owners","prevent recurrence"]}],principal:[{q:"Define the reliability and SLO strategy for the company.",a:"SLOs must be defined from user journeys, not infrastructure internals: 'sign-in works in under 2s 99.9% of the time' beats 'API latency p99'. Tier the targets — core money paths get tight SLOs, experimental features get room to breathe. Error budgets turn reliability into an engineering decision: when the budget is spent, you slow releases and fix, which forces product tradeoffs into the open. Measure burn rate so you act on trends, not only after the quarter is gone. And build the culture: blameless reviews, runbooks, and on-call that's respected, not resented.",kp:["SLOs from user journeys","tiered targets by criticality","error budgets gate change","burn rate monitoring","blameless culture","reliability as shared ownership"]},{q:"Design cloud cost optimization as a program, not a one-off.",a:"Make cost visible first: mandatory tagging with showback or chargeback so every team sees its bill and owns it. Then attack the structural wins: rightsizing (match instance sizes to actual usage), commitment discounts for stable workloads, idle resource cleanup (stale environments, orphaned volumes), and storage lifecycle policies. Build FinOps culture: cost reviews in planning, budgets and anomaly alerts, and celebrate savings like revenue. Automate the boring part — policy-as-code that deletes or downsizes — so savings don't depend on discipline alone.",kp:["tagging and showback chargeback","rightsizing and commitments","idle resource cleanup","budgets and anomaly alerts","finops culture and incentives","automated remediation"]},{q:"How do you evaluate a new technology for the platform (a new database, a new cloud service)?",a:"Start with requirements and constraints, not the shiny thing: what problem are we solving, what are the operational and security requirements? Run a POC against real workloads with realistic data — synthetic benchmarks lie. Assess operational maturity: can we run, monitor, and troubleshoot this at our scale, and who owns it? Model the cost honestly, including migration and exit costs. Check security and compliance fit. And have an exit strategy: a decision without an off-ramp is a bet you can't fold.",kp:["requirements before technology","POC with real workloads","operational maturity and ownership","honest cost model","security and compliance review","exit strategy"]},{q:"How do you build security into the delivery pipeline?",a:"Shift left: static analysis (SAST) and dependency scanning run in CI on every merge, and secrets scanning catches credentials before they land in git. Images are scanned and signed, and only signed images deploy. At runtime, add detection: anomaly monitoring, intrusion detection, and audit logging. Policy-as-code (Open Policy Agent-style) enforces standards automatically — no human gate to be skipped. And the human layer: penetration tests and red-team exercises on a schedule, with findings tracked like bugs, plus a ready incident response plan.",kp:["SAST and dependency scanning in CI","secret scanning","image signing and supply chain","policy as code","runtime detection and audit","pen tests and incident response"]}]}}],qk=[{id:"data",name:"Data Science / ML",icon:"📊",blurb:"Statistics, machine learning, experimentation and data products.",skills:["Statistics & ML","Python & SQL","Experimentation","ML platforms"],questions:{junior:[{q:"Explain supervised vs unsupervised learning with examples.",a:"Supervised learning trains on labeled data — input-output pairs — to predict outputs for new inputs: classification (spam vs not spam) and regression (predict price). Unsupervised learning finds structure in unlabeled data: clustering customers into segments, dimensionality reduction, anomaly detection. The choice comes down to whether you have labels and what question you're answering.",kp:["labeled vs unlabeled data","classification and regression","clustering and dimensionality reduction","training and evaluation","when labels exist"]},{q:"What is overfitting and how do you prevent it?",a:"Overfitting is when a model memorizes the training data, including its noise, and generalizes poorly to new data. Prevention: more training data, simpler models, regularization (L1/L2, dropout), early stopping, and cross-validation to detect it. The diagnostic is a gap between training and validation performance — big gap, big overfitting. You fight it with validation discipline: the test set is touched once, at the end.",kp:["memorizes training noise","train vs validation gap","cross-validation","regularization and early stopping","simpler models","test set used once"]},{q:"What's the difference between precision and recall?",a:"Precision is the fraction of positive predictions that are actually correct — 'of everything I flagged, how much was real?' Recall is the fraction of actual positives we caught — 'of everything real, how much did I find?' They trade off through the decision threshold: raise it and precision climbs while recall drops. F1 is their harmonic mean for a single number. Which matters more depends on the cost of false positives vs false negatives — spam filters hate false positives; cancer screening hates false negatives.",kp:["precision = flagged and correct","recall = real and found","threshold tradeoff","F1 harmonic mean","cost of false positives vs negatives"]},{q:"Write a SQL query to summarize sales by region for the last month.",a:"The shape: SELECT region, COUNT(*) AS orders, SUM(amount) AS revenue FROM sales WHERE order_date >= date_trunc('month', CURRENT_DATE) GROUP BY region ORDER BY revenue DESC. WHERE filters rows before grouping; HAVING filters groups after. Add an index on order_date (and region) so the scan is fast, and be careful with timezones when 'last month' is defined across regions.",kp:["select group by","count and sum aggregates","where filters rows having filters groups","order by","index on filtered columns"]},{q:"What is a confusion matrix?",a:"A confusion matrix is a table of predicted vs actual classes: true positives, true negatives, false positives, and false negatives. From it you derive accuracy, precision, recall, and F1. It's the honest picture that accuracy hides — for a 99% negative class, a model that predicts 'negative' always is 99% accurate but useless. Always look at the matrix, not just the headline number.",kp:["predicted vs actual table","true false positive negative","derive precision recall f1","accuracy hides class imbalance"]}],mid:[{q:"Explain the bias-variance tradeoff.",a:"Bias is systematic error from a model that's too simple to capture the pattern — underfitting. Variance is error from a model too sensitive to training data — overfitting. Total error = bias² + variance + irreducible noise, and model complexity is the knob that moves them in opposite directions. You find the sweet spot with cross-validation: pick the complexity where validation error is lowest, not where training error is lowest.",kp:["bias is systematic underfitting","variance is sensitivity to data","total error decomposition","complexity knob","cross-validation to tune"]},{q:"Design an A/B test for a new recommendation algorithm.",a:"Start with the hypothesis and one primary metric (e.g., engagement per user) plus guardrail metrics (revenue, latency) that must not regress. Do the statistics up front: baseline rate, minimum detectable effect, and sample size with power 0.8 — then don't peek at results early (peeking inflates false positives). Randomize at the user level to avoid network effects, run long enough to capture novelty effects, and pre-register the analysis. Ship based on significance plus a judgment call on the guardrails.",kp:["hypothesis and primary metric","guardrail metrics","sample size and power","no peeking","user-level randomization","novelty effects and duration"]},{q:"What is feature engineering? Give examples.",a:"Feature engineering turns raw data into inputs a model can learn from, using domain knowledge: date → day-of-week and holiday flags, text → TF-IDF or embeddings, categoricals → one-hot or target encoding, missing values → imputation with a flag for 'was missing'. Scaling (standardization) matters for distance-based models. It's iterative: engineer, train, inspect feature importance, repeat — and beware of leakage, features that contain the answer (like using refund status to predict fraud).",kp:["domain knowledge transforms","date and text features","categorical encoding","missing value handling","scaling and normalization","feature leakage"]},{q:"Explain a decision tree and how random forests improve on it.",a:"A decision tree recursively splits data on the feature that best separates classes (lowest impurity — Gini or entropy), producing interpretable rules. Single trees overfit and are unstable. A random forest trains many trees on bootstrap samples (bagging) and at each split considers only a random subset of features — decorrelating the trees — then averages predictions. That variance reduction is why forests beat single trees while staying robust to noise.",kp:["recursive splitting on impurity","gini or entropy","bagging bootstrap samples","random feature subsets","averaging reduces variance","robust to noise"]}],senior:[{q:"Design a recommendation system from scratch.",a:"Two-stage architecture: candidate generation — broad recall via collaborative filtering (item-item similarity, matrix factorization) and content-based signals — then ranking with a model (GBDT or neural) over features like user history, item popularity, and context. Handle the cold start: new users get popularity/contextual picks; new items get content-based suggestions. Evaluate offline (rank metrics like NDCG) but decide online with A/B tests, because offline metrics often disagree with engagement. The feedback loop — watching what users click — is the real product.",kp:["candidate generation then ranking","collaborative filtering and content-based","cold start handling","offline metrics NDCG","online A/B validation","feedback loop"]},{q:"Your model has 99% accuracy but is useless in production. Why?",a:"Almost always because accuracy is the wrong metric: on imbalanced data (99% negatives), a do-nothing model hits 99%. The business cares about the cost matrix — a false negative on fraud costs money, a false positive costs a customer. Other causes: evaluating on a different distribution than production, data leakage in training, or a model that's miscalibrated so thresholds don't mean what you think. The fix is to define the business metric, evaluate on the production distribution, and check calibration.",kp:["class imbalance hides accuracy","business cost matrix","wrong evaluation distribution","data leakage","calibration and thresholds","metric tied to business value"]},{q:"Explain batch vs online learning. When would you use streaming?",a:"Batch learning retrains a model on the full dataset on a schedule — simpler, well-understood, fine when data changes slowly. Online learning updates the model incrementally per sample or mini-batch — needed when concept drift is fast (fraud patterns, ad CTR), when data arrives continuously, or when you can't store it all. Streaming ML (Kafka + online models) trades complexity for freshness. A hybrid is common: online updates between scheduled batch retrains, with monitoring to catch drift either way.",kp:["batch retrains on schedule","online updates per sample","concept drift speed","continuous data arrival","freshness vs complexity","hybrid with drift monitoring"]},{q:"How do you detect and handle concept drift?",a:"Monitor the distribution of predictions and features over time — PSI or KS tests on feature/prediction distributions, and comparison of actuals vs predictions where labels arrive late. Set thresholds that trigger an alert, then the playbook: investigate (drift on features? on the label relationship? or just data quality?), retrain or recalibrate, and deploy the champion-challenger comparison. The subtle part: distinguish real drift from data pipeline breakage — check that first.",kp:["monitor prediction and feature distributions","PSI or KS tests","alert thresholds","champion challenger","distinguish drift from pipeline breakage","retraining triggers"]}],staff:[{q:"Design the ML platform for the company (training, serving, monitoring).",a:"The platform productizes the whole lifecycle: a feature store with consistent training/serving features (the silent killer of ML is train-serve skew), experiment tracking (MLflow-style) so runs are reproducible, a model registry with versioning, approvals, and rollback, and multiple serving paths — batch, online, and edge — behind one interface. Monitoring is continuous: prediction distributions, drift, latency, and business impact. Governance: lineage from data to model to decision, and compliance checks for regulated models. The platform wins when data scientists self-serve and models are deployable in minutes, not weeks.",kp:["feature store consistent train serve","experiment tracking and reproducibility","model registry with approvals","batch online edge serving","drift and latency monitoring","governance and lineage"]},{q:"How do you ensure ML models are fair and unbiased?",a:"Fairness is a process, not a checkmark. Define fairness metrics up front for protected attributes (disparate impact, equalized odds), audit training data for bias and underrepresentation, and test the trained model across segments — not just overall accuracy. Document decisions: what the model does, who it affects, and how it was validated, so it's auditable. Keep human oversight on high-stakes decisions, and monitor post-deployment because bias can emerge as the world changes.",kp:["define fairness metrics up front","audit data for bias","segment-level evaluation","documented decisions","human oversight","post-deployment monitoring"]},{q:"Design a data pipeline for real-time personalization.",a:"Streaming ingestion (Kafka/Kinesis) captures events; real-time feature computation updates user state in a fast store (Redis); the serving layer queries features and scores in milliseconds. The hard parts: consistency between real-time and batch-computed features (reconcile and backfill), failure handling with replay from the log, and cost — real-time everywhere is expensive, so use it only where freshness pays. Add monitoring: lag, staleness, and a fallback to cached/static features when real-time is degraded.",kp:["streaming ingestion","real-time feature computation","low-latency scoring","backfill and consistency","replay on failure","staleness fallbacks"]},{q:"You must explain a complex model's decisions to regulators. How?",a:"Layer the explanations: global interpretability — SHAP values, feature importance, partial dependence — to explain what drives the model overall; local explanations (SHAP per prediction, LIME) for individual decisions; and a simpler surrogate model (a shallow tree or logistic regression) as a sanity-checkable summary. Document methodology, validation, and lineage. Build a human review process for contested decisions, and keep an audit trail of every decision and its inputs. If the model can't be explained even approximately, that's a product decision to make explicitly.",kp:["SHAP and LIME","global and local explanations","surrogate models","documentation and lineage","human review process","audit trail"]}],principal:[{q:"Define the data & AI strategy for a company over the next 3 years.",a:"Strategy is bets plus sequencing. Start with the foundation — data quality, access, and governance — because models are only as good as the data, and most AI efforts fail on data plumbing, not algorithms. Pick 2-3 business-critical use cases where AI creates durable advantage (not 'we should do ML because everyone is'). Choose a platform model: centralized ML team vs embedded — usually a hybrid with a core platform team. Set responsible-AI principles and a hiring/training plan. Measure the program in business terms: revenue impact, cost saved, not model accuracy.",kp:["data quality foundation first","use cases tied to business advantage","platform vs embedded teams","responsible AI principles","hiring and training plan","business KPIs not accuracy"]},{q:"How do you decide whether to build or buy ML infrastructure?",a:"Same lens as any build-vs-buy: core vs context. If ML is the company's product and advantage (recommendations for Netflix), build the differentiated layers and buy commodity ones (compute, managed serving). Evaluate TCO including the team required to operate it, and check data gravity — building around your data in your cloud often beats buying a great tool far away. Consider time to value: a bought platform gets a pilot running this quarter. And know the exit costs: portability of models and data matters more than portability of infra.",kp:["core vs context competency","TCO including operations","data gravity","time to value","build differentiated layers","exit costs and portability"]},{q:"A production model is losing the company millions. Walk me through your response.",a:"Stop the bleeding first: roll back to the last good model (that's why we keep champions), or disable the affected path entirely. Then root-cause with full urgency: check data drift, feature pipeline breakage, and the deploy — in that order, because those cause most production failures, not the algorithm. Communicate honestly and promptly to stakeholders with a timeline. Then the prevention loop: a postmortem with owners, drift monitoring if it was missing, and a validation gate for future deploys. The lesson is usually process, and the fix is usually monitoring.",kp:["rollback or disable immediately","check drift pipeline deploy","honest stakeholder communication","postmortem with owners","monitoring and validation gates","prevent recurrence"]},{q:"How do you set up data governance in a large organization?",a:"Governance that stops work fails; governance that makes safe work easy succeeds. Build a data catalog with lineage so people can find and trust data, assign owners and stewards to critical datasets, and set quality SLAs with monitoring. Privacy and retention policies get automated (classification, access control, retention jobs), and access is granted by role with review. The balance: golden datasets and standards for what matters, self-service for everything else, and an exception process that's fast. Govern the crown jewels strictly; let the long tail breathe.",kp:["data catalog and lineage","owners and stewards","quality SLAs with monitoring","automated privacy and retention","role-based access with review","govern the critical not the trivial"]}]}},{id:"mobile",name:"Mobile Engineer",icon:"📱",blurb:"iOS & Android, app architecture, offline and store releases.",skills:["Swift · Kotlin","React Native · Flutter","Offline & sync","App stores"],questions:{junior:[{q:"Describe the app lifecycle on iOS or Android.",a:"On iOS: NotRunning → Inactive → Active → Background → Suspended, with callbacks like viewWillAppear/viewDidAppear for view lifecycle. On Android: onCreate, onStart, onResume, onPause, onStop, onDestroy. The key skill is handling transitions: save state when backgrounding, restore when returning, and never assume your app stays in memory — the OS can kill backgrounded apps at any time, so state must be persistable and restorable.",kp:["foreground background states","lifecycle callbacks","save state when backgrounding","restore on return","process death is possible"]},{q:"What is a RecyclerView (Android) / UICollectionView (iOS) and why use it?",a:"It's the lazy list view: it renders only the visible rows and recycles the views that scroll off-screen, reusing them for new data instead of creating views for every item. That's what keeps scrolling at 60fps even with thousands of items. You supply data through an adapter (Android) or data source (iOS), and diffing APIs (DiffUtil / diffable data sources) animate minimal updates efficiently.",kp:["lazy rendering of visible rows","view recycling","smooth scrolling","adapter or data source pattern","diffing for updates"]},{q:"How do you store data locally on a mobile device?",a:"It depends on the data: small preferences go in UserDefaults/SharedPreferences; structured data in SQLite (or Room/Core Data wrappers); files on disk for media; and secrets — tokens, passwords — in the secure enclave-backed Keychain/Keystore, never in plain preferences. Cache network responses with a policy (TTL, eviction) so the app is fast and offline-tolerant. The rule: user data on disk is always at risk, so encrypt what matters and back up deliberately.",kp:["preferences for small values","sqlite or room core data","file storage for media","keychain keystore for secrets","cache with ttl policies"]},{q:"What's the difference between a stack, queue, and deque in app development?",a:"These are data structures the OS and frameworks use everywhere: navigation controllers keep a stack of screens (push/pop), message queues process events in order (FIFO), and deques allow adding/removing from both ends (used for caches and buffers). Understanding them matters for managing navigation state and for writing efficient algorithms — e.g., a sliding window over recent events is a natural deque use.",kp:["stack is lifo navigation","queue is fifo event processing","deque both ends","navigation controller stack","sliding windows"]}],mid:[{q:"Explain the MVVM architecture pattern for mobile.",a:"MVVM separates UI from logic: the View is passive and renders state; the ViewModel holds observable UI state and reacts to user events, containing all the presentation logic; the Model is the data layer. The View observes the ViewModel (bindings or StateFlow/Combine), so the ViewModel is testable without UI. It fixes the classic MVC problem where ViewControllers become god objects. MVI and Clean Architecture build on the same idea: one-way data flow and testable layers.",kp:["view passive observes state","viewmodel holds ui state","model is data layer","testability without ui","one-way data flow","avoids god view controllers"]},{q:"How do you handle offline mode in a mobile app?",a:"Cache aggressively for reads, queue for writes: read from the local database as the source of truth with background sync to the server; writes go into an outbox queue that syncs when connectivity returns, with retry and backoff. Conflicts need a strategy per data type — last-write-wins, merge, or user resolution. The UI must show sync state honestly ('saved locally — syncing…'), and background sync (WorkManager/BGTaskScheduler) should be opportunistic, not guaranteed.",kp:["local database as source","outbox queue with retry","background sync","conflict resolution strategy","honest sync state ui","opportunistic scheduling"]},{q:"What is deep linking and how do you implement it?",a:"Deep links route users straight to a specific screen: URL schemes (myapp://profile/42), universal links (iOS) and app links (Android) which use HTTPS domains so they're verified and don't prompt. The link maps to a route with parameters, handled centrally in the navigation layer. Deferred deep links track the install: the link survives until the app is installed, then routes to the content. Security: validate the link source and parameters — deep links are an attack surface.",kp:["url schemes vs universal app links","map link to route and params","deferred deep links after install","centralized handling","validate link source","attack surface"]},{q:"How do you handle security on mobile?",a:"Layers: secure transport (HTTPS, certificate pinning where appropriate), secure storage (Keychain/Keystore for secrets), minimal permissions requested with justification, and never hardcode API keys — inject them or fetch at runtime. Obfuscation (ProGuard/R8) and root/jailbreak detection protect against tampering on compromised devices, but assume the client is untrusted: sensitive logic belongs server-side. Keep third-party dependencies patched — most mobile breaches come through libraries.",kp:["https and certificate pinning","secure enclave storage","minimal permissions","no hardcoded keys","obfuscation and tamper detection","client is untrusted","dependency patching"]}],senior:[{q:"Design the architecture for a chat application.",a:"Real-time transport via WebSockets for delivery and presence, with a local message store (Room/Core Data) as the source of truth for the UI. Messages flow: send → optimistic append → server ack → status update; receiving works through the socket, with pull-pagination for history. Handle offline: queue outbound messages and sync on reconnect, with delivery statuses (sent/delivered/read). Push notifications cover the app-not-open case, and media goes through upload endpoints with progress. Scale: shard conversations, and use message IDs for idempotent sync.",kp:["websocket real-time transport","local store as source of truth","optimistic sends with status","offline queue and resync","push for background","idempotent message sync"]},{q:"How do you ensure smooth 60fps scrolling performance?",a:"Keep the main thread free: offload image loading and decoding off the UI thread (async, sized down), reuse views/cells, and avoid layout passes in scroll callbacks. Use the profilers — Instruments / Android Studio Profiler — to find jank frames and expensive layout. Diff-based updates (DiffUtil) avoid full-list rebinds, and prefetch the next page of data. The discipline: measure before and after every 'optimization', and keep a performance budget.",kp:["off-main-thread image work","reuse cells and views","avoid layout in scroll callbacks","diff-based list updates","profiler-driven optimization","prefetch pagination"]},{q:"How do you test a mobile app comprehensively?",a:"The pyramid: unit tests for logic and ViewModels (fast, most numerous), integration tests for data layers, and UI tests (Espresso/XCUITest) for the critical user journeys. Add snapshot testing to catch visual regressions, and run the suite in CI on a device farm to cover the fragmentation matrix — a few real devices for key flows plus emulators for breadth. Beta testing (TestFlight/Play beta) with analytics and crash reporting covers what automation can't, and crash-free rate becomes your north star.",kp:["unit integration ui test pyramid","snapshot testing","device farm in CI","beta testing","crash reporting and analytics","crash-free rate metric"]},{q:"How do you handle app updates and database migrations?",a:"Schema migrations are versioned (Room migrations, Core Data lightweight + heavyweight), each migration knows its from-version and to-version, and the app upgrades through them sequentially — never assume users are one version behind. Test migrations against real data shapes, including the edge of users who skipped several versions. Pair migrations with feature flags for staged rollouts so you can enable features gradually and disable instantly. Have a force-update policy for breaking changes, and handle downgrade gracefully (users can reinstall).",kp:["versioned sequential migrations","never assume one version behind","test migration edge cases","feature flags staged rollout","force update policy","graceful failure on upgrade"]}],staff:[{q:"Design a mobile CI/CD pipeline serving multiple product teams.",a:"The platform pieces: reproducible signed builds with certificate management (the classic mess — automate and guard them), a build matrix on a device farm for the test suite, caching to keep builds fast, and per-environment configurations injected at build time (not hardcoded). Releases: staged rollouts through the stores with monitoring gates (crash rate, key metrics), automatic rollback on regression, and release automation so shipping is boring. Add a lightweight ownership model: teams own their apps; the platform owns the rails.",kp:["signed builds and certificate automation","device farm test matrix","build caching and speed","staged rollouts with monitoring gates","automatic rollback","teams own apps platform owns rails"]},{q:"How do you design for a global user base?",a:"Localization is structural: all strings through resource files with plurals and locale-aware formatting (dates, numbers, currencies), RTL layouts for Arabic/Hebrew, and testing in every locale, not just translations. Performance is geographic: users far from your servers need lighter payloads, image CDNs, and edge-cached APIs; latency budgets per region. Watch for cultural and regulatory differences (privacy law compliance per region), and size the app itself — app size kills adoption in emerging markets, so keep the binary and resources lean.",kp:["resource-based strings with plurals","rtl and locale formats","regional latency budgets","cdn and edge for media","per-region privacy compliance","lean app size"]},{q:"How do you decide between native, React Native, and Flutter for the company?",a:"Evaluate on team expertise, performance needs, and platform surface: native gives the deepest access and best performance but doubles cost; React Native shares JS logic and has a huge ecosystem (and companies like Meta run it at scale); Flutter offers strong UI consistency with Dart. The deciding factors: how much platform-specific behavior you need (deep OS integration favors native), who you can hire, and whether you can sustain two platforms. My default advice: pilot the cross-platform option on a real feature before committing — the tradeoffs are felt, not predicted.",kp:["team expertise matters most","performance and os integration needs","code sharing vs platform depth","ecosystem and hiring","pilot before committing","sustain two platforms cost"]},{q:"How do you reduce crash rate and improve stability?",a:"Instrument first: crash reporting with symbolication and grouping, plus ANR/freeze monitoring (the silent killer on Android). Then triage by impact, not count — top crash clusters by affected users — and fix root causes, not symptoms, with a regression test for each. Ship stability as an SLO with progressive rollout: new versions ramp by percentage and pause if crash rate exceeds threshold. Culture: stability is a release-blocking metric, and every on-call rotation learns the crash dashboard.",kp:["crash reporting with grouping","anr and freeze monitoring","fix by user impact","regression tests per fix","stability slo gates releases","progressive rollout with thresholds"]}],principal:[{q:"Define the mobile platform strategy: SDKs, tooling, shared modules.",a:"The platform is the product that app teams build on: shared networking, theming/design system, analytics and observability SDKs, and standard navigation/auth. Version and deprecate SDKs with a real policy, keep the API surface small and stable, and treat internal teams as customers with docs and office hours. Balance: the platform sets the rails, product teams own their apps. Measure adoption, and kill internal SDKs nobody uses — unused platform code is just tech debt with a roadmap.",kp:["shared sdks design system","analytics and observability baked in","versioning and deprecation policy","internal customers with docs","platform sets rails teams own apps","measure adoption kill unused"]},{q:"How do you ensure app store compliance and manage release risk?",a:"Compliance is process: know the review guidelines, build an internal review checklist (permissions, privacy labels, data policy), and have a legal review path for anything sensitive. Release risk is managed with staged rollouts, remote config and kill switches (a server-side switch that disables a feature instantly), and internal beta before external. Track the metrics that matter per release: crash-free, ANR rate, and core-journey conversion. When a bad release ships, the runbook is: assess blast radius, decide fix vs rollback, communicate, and postmortem.",kp:["review guidelines and internal checklist","privacy and legal reviews","staged rollouts","remote config kill switches","release metrics crash anr conversion","bad release runbook"]},{q:"Design the data sync architecture for a large offline-first app.",a:"Local database as the source of truth with a sync protocol built on versions and cursors: the server hands out a sync token, the client pulls changes since the token and pushes its outbox, and both sides merge with per-type conflict strategies (LWW, merge, or explicit resolution UI). Bandwidth is a product concern: delta sync, field-level updates, and compression for slow networks. Background sync is scheduled opportunistically and resumable — never assume a sync finishes in one session. Add monotonic versioning (tombstones for deletes) and a reconciliation sweep for missed updates.",kp:["local db as source of truth","sync tokens and cursors","per-type conflict resolution","delta sync for bandwidth","resumable background sync","tombstones and reconciliation"]},{q:"How do you plan for 100M+ installs (push, analytics, APIs)?",a:"Push is the first bottleneck: segment and fan out in batch with per-provider quotas, and design for providers' rate limits. Analytics: sample where you can, aggregate client-side, and stream through a pipeline that absorbs bursts. APIs: cache aggressively, add regional endpoints, and rate limit per user with graceful degradation. Data costs balloon at that scale — design payloads and retention with cost per user in mind. Security at scale: abuse detection, anomaly monitoring, and automated responses, because attackers find scale attractive.",kp:["push segmentation and fanout","analytics sampling and pipelines","regional api and caching","rate limits and degradation","cost per user design","abuse detection at scale"]}]}},{id:"qa",name:"QA / Test Automation",icon:"🧪",blurb:"Testing strategy, automation frameworks and quality culture.",skills:["Test strategy","Automation frameworks","CI/CD integration","Performance & a11y"],questions:{junior:[{q:"What's the difference between unit, integration, and end-to-end tests?",a:"Unit tests verify a single function or class in isolation — fast, numerous, they pinpoint failures. Integration tests verify components working together: a service with its database, an API with its client. End-to-end tests exercise full user journeys through the real UI and stack — slowest, most fragile, but highest confidence. The test pyramid says: many unit, some integration, few e2e — you want fast feedback, and e2e for everything is slow and brittle.",kp:["unit tests isolated functions","integration tests components together","e2e full user journeys","test pyramid","speed vs confidence"]},{q:"What makes a good test case?",a:"A good test case has a clear, specific purpose, explicit preconditions and steps, a concrete expected result, and covers the interesting edge cases, not just the happy path. Tests should be independent (order doesn't matter), repeatable, and readable — the name explains what behavior is being verified. If a test doesn't fail when the behavior breaks, it's not a test; it's theater.",kp:["clear purpose and expected result","explicit preconditions and steps","edge cases not just happy path","independent and repeatable","readable names","fails when behavior breaks"]},{q:"What is regression testing and why does it matter?",a:"Regression testing verifies that existing functionality still works after a change — new code breaks old behavior all the time, often in non-obvious places. Manual regression is expensive and boring (humans miss steps); automation makes it cheap and repeatable, which is why regression suites run in CI on every change. The strategy: prioritize the critical paths and highest-risk areas for automated regression coverage.",kp:["existing features still work","changes break old behavior","automated suites in CI","prioritize critical paths","catch unintended breakage"]},{q:"Walk me through the bug life cycle.",a:"A bug is reported (New) with reproduction steps, then triaged for severity (impact) and priority (urgency), assigned, fixed, and the fix is verified — if it passes, it's closed; if not, it's reopened. Along the way: duplicates get merged, and not all bugs get fixed — some get deferred with a reason. The discipline that makes the cycle work: reproducible steps, clear acceptance criteria, and a definition of done that includes regression checks.",kp:["new triaged assigned","fixed verified closed","severity vs priority","reproduction steps","reopen flow","deferred with reason"]}],mid:[{q:"How do you build a test automation framework from scratch?",a:"Layers: a driver layer (Selenium/Playwright/Appium), a page object model so tests speak in UI terms ('loginPage.fillCredentials') instead of selectors, a test data layer, reporting with screenshots and video on failure, and CI integration. Then the hard parts: parallel execution across browsers/devices, retry policies with flake tracking, and test isolation so tests don't depend on each other. Start with the critical journeys, not 100% coverage — a framework that's fast and reliable on 20 flows beats one that's slow and flaky on 200.",kp:["page object model","test data management","reporting with screenshots","parallel execution","flake tracking and retries","test isolation","start with critical journeys"]},{q:"What causes flaky tests and how do you reduce them?",a:"Flakiness comes from non-determinism: timing (fixed waits instead of waiting for conditions), shared state (tests mutating the same data or running in parallel), network/third-party dependencies, and order dependencies. Reductions: explicit waits for expected conditions, isolated test data per test, mocks for external services, and a retry policy with limits so flakes are visible, not hidden. Track the flake rate as a metric — a suite with rising flakiness loses trust, and nobody trusts the suite that cries wolf.",kp:["deterministic waits not sleeps","isolate test data","mock external dependencies","parallel safety","track flake rate","retry with visibility"]},{q:"Explain test-driven development (TDD).",a:"TDD is red-green-refactor: write a failing test for the behavior you want, implement the minimum code to pass, then refactor safely under the test's protection. The discipline forces you to think about the interface and edge cases before the implementation, keeps tests aligned with behavior, and makes the design emerge from usage. It's not about coverage numbers — it's a design and feedback tool. Realistic take: unit-test-driven for logic-heavy code; e2e-first is usually the wrong flavor of TDD.",kp:["red green refactor loop","write failing test first","minimum implementation","refactor under protection","design emerges from usage","best for logic-heavy code"]},{q:"How do you test an API?",a:"Layer the checks: status codes and response schemas (contract), positive and negative cases (missing fields, invalid types, unauthenticated), authentication and authorization behavior, pagination and edge cases, and error handling — errors are part of the contract. Add performance/load testing for the endpoints that matter, and contract testing to catch breaking changes between services. Test data must be isolated and deterministic, and the suite runs in CI against a test environment.",kp:["status codes and schemas","positive and negative cases","auth and authorization tests","pagination and errors","load testing key endpoints","contract testing","isolated test data"]}],senior:[{q:"Design a testing strategy for a microservices architecture.",a:"Contract tests are the backbone: consumer-driven contracts (Pact-style) between services, run in each service's CI, so a producer knows when it would break consumers. Service-level integration tests with real dependencies where cheap and test doubles elsewhere; e2e only for the critical user journeys that cross many services (keep them few — they're expensive and flaky). Add chaos for resilience where it matters. The strategy trades exhaustive e2e for layered confidence: contracts catch integration breaks fast, and journeys prove the whole thing works.",kp:["consumer-driven contracts","contract tests in CI per service","service integration tests","few critical e2e journeys","test doubles for dependencies","layered confidence"]},{q:"How do you measure test coverage and decide when it's enough?",a:"Line and branch coverage are starting points, not goals: 80% of a trivial module means nothing if the critical logic is untested. Focus on risk-based coverage: the paths that lose money, break trust, or are hard to fix get the coverage. Mutation testing tells you if tests actually detect bugs — mutants that survive mean weak assertions. Track coverage trends, not snapshots, and enforce coverage gates on changed code in CI. The honest metric is defect escape rate: tests are working when bugs don't reach users.",kp:["line and branch coverage baseline","risk-based not percentage-based","mutation testing for quality","coverage trends in CI","gates on changed code","defect escape rate"]},{q:"How do you performance test a web application?",a:"Define the load model from reality: typical traffic shape, peaks, and user journeys — then use a tool (k6, JMeter, Gatling) to simulate it against a staging-like environment. Measure response times at percentiles (p50/p95/p99 — averages lie), throughput, and resource utilization, and find the bottleneck: app code, database, or infrastructure. Set thresholds from SLOs and run performance in CI as a regression gate on critical journeys. Test failure modes too: what happens at 3x load — graceful degradation or collapse?",kp:["realistic load model","p95 p99 not averages","find the bottleneck","thresholds from SLOs","performance gates in CI","failure mode testing"]},{q:"How do you build a quality culture in a fast-moving team?",a:"Shift left: quality starts at design and code review, not at the end. Automate the pyramid so humans do what machines can't (exploratory testing, judgment) and machines do the boring repetition. Make developers own their tests — testing is a craft, not a handoff. Use metrics without blame: track escapes and flakiness to find system problems, not people problems. And make quality visible: a green suite, fast feedback, and celebrations when the team ships with confidence.",kp:["shift left to design and review","automate the pyramid","developers own their tests","metrics without blame","fast feedback loops","quality visible and celebrated"]}],staff:[{q:"Design a QA platform serving multiple teams (frameworks, infra, tools).",a:"The platform provides: standardized test frameworks and templates per stack, shared test infrastructure as code (browser grids, device farms, environments), centralized reporting and analytics (flake rates, coverage, trends per team), and self-service so teams run their own suites. The hard work is governance: a small set of blessed tools and patterns with a documented exception path, plus communities of practice. The platform team is judged on its customers' outcomes — team velocity and defect escape rates — not on its own roadmap.",kp:["standardized frameworks per stack","test infra as code","centralized analytics","self-service for teams","blessed tools with exception path","measure team outcomes"]},{q:"How do you handle testing in a CI/CD world with frequent deploys?",a:"The suite must keep up with deploy cadence or it becomes the bottleneck: risk-based test selection (run what this change touches first), parallel execution and caching, and fast feedback tiers — unit and contract in minutes, full e2e asynchronously. Deploy gates use signal, not checklists: canary metrics (error rate, latency) are the real test, with automated rollback when they regress. Flakiness is a first-class problem to fix, because at high cadence flaky tests are worse than no tests.",kp:["risk-based test selection","parallelism and caching","fast feedback tiers","canary metrics as gates","automated rollback","flakiness fix first-class"]},{q:"Design accessibility testing as part of quality.",a:"Automated scans (axe) in CI catch maybe 30-40% of issues — they're the floor, not the ceiling. Add manual checks: keyboard-only navigation of every journey, screen reader passes (VoiceOver/NVDA), contrast and touch-target review, and testing with real users with disabilities where possible. Track a11y regressions like bugs with owners, and bake accessibility requirements into the design system and component tests so new components are accessible by default. Report a11y health with the rest of quality metrics, not as a side quest.",kp:["automated axe in CI as floor","keyboard-only journeys","screen reader testing","contrast and touch targets","real users with disabilities","a11y in design system","tracked like bugs"]},{q:"How do you test data pipelines and ML models?",a:"Data quality checks upstream: schema validation, null/duplicate checks, and freshness monitoring — garbage in, garbage out, and it's detectable before it poisons models. Golden datasets: curated inputs with expected outputs that catch regressions in transforms. For models: evaluation suites in CI (metrics on holdout sets), drift monitoring in production, and backfill verification when logic changes. Treat pipeline code like application code: unit tests for transforms, integration tests against realistic data.",kp:["schema and data quality checks","golden datasets","model evaluation in CI","drift monitoring","backfill verification","unit test transforms"]}],principal:[{q:"Define quality engineering strategy org-wide.",a:"Quality is a system property, not a team's job: shift left into design and development, shift right into production monitoring and canary verification. The platform over projects: invest in tooling and infrastructure that makes quality cheap for everyone, rather than QA heroics on individual releases. Metrics that matter: defect escape rate, time-to-detect, flake rate — reported in business terms. Hire and train: QE engineers who code, and engineers who test. And get executive alignment that quality is a release decision, not an afterthought.",kp:["quality is a system property","shift left and shift right","platform over project heroics","metrics in business terms","hire and train both crafts","executive alignment"]},{q:"When is manual testing still necessary?",a:"Manual/exploratory testing earns its keep where automation can't: novel features where you don't yet know the risks, usability and UX validation (does this actually feel good?), and complex scenarios requiring human judgment. Also compliance and legal sign-offs. The discipline: exploratory testing is a skill — session-based with charter and notes — not 'click around'. The trend line should be downward as automation matures, and every manual test you keep is a candidate for automation once it stabilizes.",kp:["exploratory for novel features","usability and UX judgment","compliance sign-offs","session-based with charters","automation once stable","downward trend over time"]},{q:"Design a chaos engineering program for a company just starting.",a:"Start small and safe: game days — scheduled, low-blast-radius exercises where teams practice failing (kill a node, kill a dependency, degrade a database) with observers and a rollback plan. Automate only after the manual drills reveal the weak points: steady-state hypothesis → experiment → verify, gradually expanding blast radius. Prerequisites first: observability, because you can't learn from chaos you can't see; and a blameless culture, because chaos experiments that punish people will die. The goal is confidence in failure, not drama.",kp:["start with game days","low blast radius first","observability prerequisite","blameless culture","automate after manual drills","steady-state hypothesis experiments"]},{q:"How do you measure the ROI of QA investment?",a:"Measure both sides: the cost of quality — tooling, time spent testing, time lost to flaky suites; and the value — cost of escaped defects (incidents, support, churn), release velocity (can teams ship confidently and often?), and time-to-detect/fix. The story that lands with executives: fewer production incidents, faster releases, and a lower defect escape rate over time. The honest caveat: quality investment pays off as risk reduction, so frame it as insurance with measurable premiums and claims.",kp:["cost of escaped defects","release velocity correlation","time lost to flakiness","incident reduction","frame as risk insurance","trends over time"]}]}},{id:"security",name:"Security Engineer",icon:"🛡️",blurb:"AppSec, infrastructure security, cryptography and response.",skills:["Application security","Cloud & network security","Cryptography","Incident response"],questions:{junior:[{q:"What is the OWASP Top 10? Name the top vulnerabilities.",a:"The OWASP Top 10 is the standard list of the most critical web application security risks, updated regularly by the community. The perennial top offenders: injection (SQL, OS, LDAP), broken authentication and session management, sensitive data exposure, and security misconfiguration. It's a starting point for prioritization, not a checklist — you still threat-model your own app. The top of the list changes over time (e.g., SSRF rising, and supply-chain risks entering).",kp:["standard web app risk list","injection","broken authentication","sensitive data exposure","misconfiguration","prioritization not checklist"]},{q:"What's the difference between authentication and authorization?",a:"Authentication verifies identity — who you are (login with password, MFA). Authorization decides what you can do — which resources and actions that identity may access (RBAC roles, permissions). A common failure is conflating them: being logged in doesn't mean being allowed. Implement both separately: authn at the edge (sessions/tokens), authz checked on every resource access with the principle of least privilege.",kp:["identity vs permissions","mfa and sessions","role-based access control","least privilege","checked on every access"]},{q:"What is HTTPS/TLS and why is it important?",a:"TLS encrypts traffic between client and server so attackers can't read or tamper with it in transit. The handshake establishes trust via certificates issued by certificate authorities, negotiates keys, then encrypts the session. HTTPS also enables security features that plain HTTP can't: cookies with Secure flag, HSTS, and integrity of the page itself. Today, HTTPS everywhere is the baseline; plain HTTP should be reserved for nothing.",kp:["encryption in transit","certificate authority trust","tls handshake","prevents eavesdropping and tampering","hsts and secure cookies"]},{q:"What is SQL injection and how do you prevent it?",a:"SQL injection happens when user input is concatenated into a SQL query, letting an attacker alter the query structure — 'OR 1=1' tricks, data exfiltration, even full database compromise. Prevention is straightforward and non-negotiable: parameterized queries (prepared statements) everywhere, ORMs that parameterize by default, input validation as defense-in-depth, and least-privilege database accounts so even a successful injection has limited blast radius. Never trust input; never build queries by string concatenation.",kp:["user input alters query structure","parameterized queries","orm parameterization","input validation","least privilege db accounts","never concatenate input into sql"]}],mid:[{q:"Explain XSS and its types. How do you defend?",a:"XSS (cross-site scripting) injects attacker-controlled scripts into a page that other users run. Stored XSS persists on the server (a comment field), reflected XSS echoes in the response (a search query), DOM XSS runs in the client via unsafe DOM APIs like innerHTML. Defense: output-encode everything by context (HTML, attribute, JS), use frameworks' auto-escaping, set a strict Content-Security-Policy, sanitize rich input server-side, and mark cookies HttpOnly so scripts can't steal sessions.",kp:["stored reflected dom types","output encoding by context","content security policy","framework auto-escaping","httpOnly cookies","server-side sanitization"]},{q:"What is CSRF and how do you prevent it?",a:"CSRF (cross-site request forgery) tricks a logged-in victim's browser into sending a state-changing request to a site they trust — an image tag or form can POST to your bank while the user's session cookie rides along automatically. Prevention: SameSite cookies (the modern default), CSRF tokens validated on state-changing requests, checking Origin/Referer headers, and preferring idempotent methods for reads. Defense in depth: use all three where it matters.",kp:["attacker triggers state-changing request","same-site cookies","csrf tokens","origin header checks","idempotent methods for reads"]},{q:"How do you securely store passwords?",a:"Never plaintext, never reversible encryption, never fast hashes like MD5/SHA. Use a slow, memory-hard password hashing function — bcrypt, scrypt, or Argon2 — with a unique random salt per user, and tune the work factor to be slow enough for attackers but acceptable to users. Add login rate limiting and breach detection (lockout, notify on suspicious access). If a database leaks, the goal is that cracking the hashes is economically pointless.",kp:["bcrypt scrypt argon2","unique salt per user","slow memory-hard hashing","rate limit logins","breach response plan","never reversible encryption"]},{q:"Explain the principle of least privilege with examples.",a:"Least privilege means every user, service, and process gets exactly the permissions it needs and nothing more. Examples: database accounts with scoped grants (a web app shouldn't be able to DROP tables), IAM roles instead of long-lived keys, service accounts restricted to their specific APIs, and short-lived credentials that expire. It's enforced with reviews: periodically audit who can access what and remove what's unused. The payoff is blast-radius reduction — a compromise of one component can't cascade.",kp:["minimal necessary permissions","scoped database grants","iam roles not long-lived keys","short-lived credentials","regular access reviews","blast radius reduction"]}],senior:[{q:"Design authentication for a service used by millions.",a:"Layered design: OAuth2/OIDC with the right flows per client, MFA and passkeys as the security baseline for sensitive actions, and passwordless options to remove the weakest credential. Defense: rate limiting and lockout, anomaly detection on login patterns (new device, new geo), and breach detection with credential-stuffing protection. Sessions: short-lived access tokens, rotating refresh tokens, and centralized revocation. Headers and controls: HSTS, CSP, secure cookies. And the operational side: monitor auth failures, and have a response plan for when the auth service itself is attacked.",kp:["oauth2 oidc flows","mfa and passkeys","rate limiting and anomaly detection","short-lived tokens with rotation","central revocation","monitor and respond"]},{q:"What is threat modeling and how do you actually do it?",a:"Threat modeling finds security problems at design time instead of after the incident. Process: draw the architecture and data flows, identify assets and trust boundaries, then enumerate threats — STRIDE (Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation) is the classic framework — and prioritize by likelihood and impact. For each real threat, assign a mitigation and an owner. Keep models lightweight (a whiteboard session plus a document) and refresh them when the system changes significantly. It's a habit, not an artifact.",kp:["architecture and data flows","assets and trust boundaries","STRIDE framework","prioritize by risk","mitigations with owners","refresh as system changes"]},{q:"Walk me through your incident response process.",a:"Phases: preparation (runbooks, on-call, tools — done before the incident), detection and triage (confirm it's real, assess severity and scope), containment (stop the bleeding: isolate, block, disable), eradication (remove the attacker's access and the vulnerability), recovery (restore from known-good state, verify), and lessons learned (blameless postmortem with owners). Throughout: preserve evidence (logs, memory, snapshots), communicate on a cadence, and track everything — legal may need it. Speed matters, but forensics and communication can't be sacrificed.",kp:["preparation runbooks before incident","containment first","preserve evidence","eradicate and recover from known-good","stakeholder communication","blameless postmortem"]},{q:"Explain zero trust architecture.",a:"Zero trust flips the old 'trust the inside' model: never trust, always verify. Every request — inside or outside the network — is authenticated, authorized, and encrypted. Mechanics: identity-based access to everything, micro-segmentation so lateral movement is limited, continuous verification (re-check risk signals during a session, not just at login), least privilege, and assume-breach design with monitoring and response. The shift is from network location as security to identity and context as security.",kp:["never trust always verify","identity-based access","micro-segmentation","continuous verification","least privilege everywhere","assume breach mindset"]}],staff:[{q:"Design an application security program for 100+ engineers.",a:"Secure SDLC woven into existing workflows: security training at onboarding and annually, SAST and dependency scanning in CI with gates, DAST on staging, and security review for high-risk changes only — not every PR, or the program dies in the queue. A security champions program: one trained person per team who triages and advocates. Vulnerability management: a tracked pipeline from report to fix with SLA by severity. Incident response ready with runbooks and rehearsals. And executive reporting: risk posture in business terms, so security is a board topic, not a basement concern.",kp:["secure SDLC in existing workflow","SAST DAST in CI gates","security champions per team","vulnerability pipeline with SLAs","trained incident response","executive risk reporting"]},{q:"How do you secure a Kubernetes and cloud environment?",a:"Layered: network — policies and segmentation so pods talk only to what they need; identity — RBAC and service accounts with least privilege, no admin by default; supply chain — image scanning and signing, only signed images deploy; secrets — external secret manager, never in manifests; data — encryption at rest and in transit; and runtime — audit logging, anomaly detection, and runtime security (falco-style) watching for suspicious behavior. The cloud side mirrors it: IAM, VPC design, and SCPs (service control policies). And everything is auditable — because you can't secure what you can't see.",kp:["network policies and segmentation","rbac least privilege","image scanning and signing","external secrets management","runtime security and audit logging","iam and service control policies"]},{q:"Design a secrets management and key rotation strategy.",a:"Central vault (Vault, Secrets Manager, KMS) as the only place secrets live; applications fetch at startup or via SDK — never baked into images or env. Rotation is automated with defined cadences per secret type, and service accounts authenticate to the vault with short-lived identities. Access: least privilege with audit trails, and emergency access (break-glass) with approval and recording. Key hierarchy: master keys in HSM/KMS protecting data keys. Test rotation regularly — a rotation you can't perform is a trap waiting to spring during an incident.",kp:["central vault only source","automated rotation cadences","short-lived identities","audit trails on access","break-glass emergency access","key hierarchy with KMS","rehearse rotation"]},{q:"How do you evaluate and manage supply chain security?",a:"Supply chain risk spans dependencies, build tools, and vendors. Technical: dependency scanning with reachability analysis (a vulnerable dep you never call matters less), a software bill of materials (SBOM) for every artifact, signature verification of what you consume, and pinned/curated registries with trust policies. Organizational: vendor assessment for critical third parties (security posture, breach history, contractual obligations), and incident response prepared for the 'our dependency was compromised' scenario — assume it will happen and know your exposure.",kp:["dependency scanning and reachability","software bill of materials","signature verification","curated registries","vendor risk assessment","compromised dependency response"]}],principal:[{q:"Define the security strategy for the company (people, process, technology).",a:"Start from risk: what are we protecting, from whom, and what's the cost of compromise — that drives priorities, not fear-of-the-week. People: security culture and training, champions, and hiring for the roles that matter. Process: secure SDLC, vulnerability management, incident response, and compliance mapped to what customers actually require. Technology: invest in detection and response (you will be breached; the question is time-to-detect), least-privilege architecture, and encryption. Governance: risk register with executive ownership, board-level reporting in business language, and third-party risk management. Strategy is a budget, and security earns its budget by reducing risk the business cares about.",kp:["risk-based prioritization","security culture and champions","detection and response investment","compliance mapped to customers","board-level business reporting","third-party risk"]},{q:"How do you balance security with developer velocity?",a:"The enemy of both is friction. Make secure the easy path: secure defaults in frameworks and templates (paved roads), automated checks that don't need a human, and self-service security tooling with clear output — a PR comment beats a ticket. Tier the controls: strict gates for high-risk code (payments, auth, data), lightweight for the rest. Measure friction (time added by security) and adjust — if teams are working around you, the program is failing even when coverage looks great. Build trust by being the team that unblocks, not the team that blocks.",kp:["secure defaults in paved roads","automated not human gates","self-service with clear output","risk-tiered controls","measure security friction","unblock rather than block"]},{q:"Design security for a multi-tenant SaaS.",a:"Tenant isolation is the core invariant, enforced at every layer: row-level isolation in the database, tenant-scoped authorization on every API call, per-tenant encryption keys where required, and isolation boundaries for compute and storage. Data residency per tenant (a tenant's data stays in its region) with compliance per market. Abuse and fraud detection: anomalous usage patterns per tenant, rate limiting, and automated containment — a compromised tenant must not threaten others. Incident response scoped per tenant, with communication obligations when breaches cross tenants.",kp:["tenant isolation at every layer","row-level and api-level isolation","per-tenant keys and residency","abuse detection and containment","per-tenant incident response","compliance per market"]},{q:"How do you prepare the company for a breach?",a:"Preparation is a program: incident response playbooks for the likely scenarios (data breach, ransomware, account compromise, supply chain), with roles and decision rights clear before the crisis. Tabletop exercises on a schedule — the drill is where the plan gets fixed. Communication templates pre-drafted for customers, regulators, and press, because writing under pressure produces bad writing. Backups and recovery tested, not assumed. Legal counsel and cyber insurance in place. And after every real incident: the improvement loop — because preparation is never finished.",kp:["playbooks for likely scenarios","tabletop exercises on schedule","pre-drafted communication","tested backups and recovery","legal and insurance in place","improvement loop after incidents"]}]}}],an=[{id:"junior",name:"Junior Developer",icon:"🌱",years:"0–2 years",blurb:"Core fundamentals, clean code, and a solid learning mindset.",focus:"language basics, data structures, debugging, testing fundamentals, communication"},{id:"mid",name:"Mid-Level",icon:"⚙️",years:"2–4 years",blurb:"Ship features independently and make sound engineering trade-offs.",focus:"design patterns, APIs, databases, moderate system design, code review"},{id:"senior",name:"Senior",icon:"🚀",years:"4–7 years",blurb:"Lead features end-to-end, mentor others, own architecture decisions.",focus:"architecture, scalability, mentoring, cross-team collaboration, system design"},{id:"staff",name:"Staff",icon:"🏗️",years:"7–10 years",blurb:"Cross-team impact: set technical direction and unblock large systems.",focus:"large-scale systems, technical strategy, standards, risk management"},{id:"principal",name:"Principal",icon:"🧭",years:"10+ years",blurb:"Org-wide architecture and high-leverage bets that shape the company.",focus:"org-wide architecture, platform strategy, executive communication, hiring bar"},{id:"cto",name:"CTO",icon:"🏛️",years:"Executive",blurb:"Technical vision, org building, cost, security and board-level communication.",focus:"technical vision, engineering org, budget, security & compliance, hiring leaders"},{id:"ceo",name:"CEO",icon:"👑",years:"Executive",blurb:"Business strategy, product-market fit, capital and company building.",focus:"strategy, product, market, fundraising, talent, metrics, communication"}],vn={junior:0,mid:1,senior:2,staff:3,principal:4,cto:5,ceo:6};function Tt(n){return an.find(i=>i.id===n)||an[0]}const Ky={id:"general",name:"General / Any company",icon:"🌐",tagline:"Broad, balanced questions for any technical interview.",hq:"Everywhere",difficulty:3,stack:["General engineering practice"],values:["Fundamentals","Communication","Problem solving"],style:"A well-rounded mix of technical, behavioral, and design questions.",sample:[]},yd=[{id:"google",name:"Google",icon:"🔍",tagline:"Search, Android, Cloud, AI",hq:"Mountain View, CA",difficulty:4,stack:["Go","Java","Python","C++","Kubernetes","Spanner","Bigtable","TensorFlow"],values:["Focus on the user","Think 10x","Data-driven decisions","Move fast without breaking things"],style:"Structured rounds: coding, system design, product sense, and 'Googleyness'. Expect follow-ups that dig one level deeper every time.",sample:[{q:"How would you design a system that serves trending searches with sub-second latency?",a:"Two problems: compute trends and serve them fast. Trend computation consumes a stream of search events, aggregates counts in sliding time windows (count-min sketch for memory efficiency), and ranks the deltas. Serving is a read-heavy cache: trending lists are small, recomputed every few minutes, cached at the edge (CDN) and in-memory, so requests never hit the database. Personalization can layer on top with user context. The tradeoffs are freshness vs cost and the risk of echo chambers from regional popularity.",kp:["streaming event aggregation","sliding time windows","count-min sketch","cache trending lists at edge","freshness vs cost tradeoff","personalization layer"]},{q:"Design a rate limiter for Google's public APIs.",a:"Scale and distribution are the defining constraints: enforce limits across many front-end servers with a shared, fast store (like Redis or a distributed counter), using a token bucket or sliding window per API key. Decisions: limits per key, per user, per endpoint, with burst allowances. Return 429 with Retry-After, and make the limiter itself horizontally scalable and never the bottleneck — degrade gracefully if the counter store is down. Log quota usage for abuse detection and quota analytics.",kp:["distributed shared counter store","token bucket sliding window","per key per endpoint limits","429 with retry-after","graceful degradation","abuse detection telemetry"]},{q:"Walk me through how you'd improve the quality of a search engine's results.",a:"Define quality metrics first: relevance (NDCG on judged queries), user signals (click-through, dwell time, abandonment), and freshness. Build an evaluation set of hand-judged queries and a feedback loop from user behavior. Then improve in layers: query understanding (spelling, synonyms, intent classification), ranking features (relevance, authority, freshness, personalization), and serving (result diversity, snippets). Every change ships behind an experiment with guardrails, because search is a system where offline gains don't always translate online.",kp:["judged evaluation set","relevance metrics NDCG","user behavior signals","query understanding layers","experimentation with guardrails","offline vs online validation"]},{q:"Tell me about a time you had to choose between shipping fast and shipping right.",a:"The strong answer follows STAR: a specific situation, what you actually did, the measured outcome. Google interviewers want to hear you reason about tradeoffs explicitly — how you defined 'right' (correctness, security, scalability), what the cost of delay was, and how you de-risked the fast path (feature flags, canary, follow-up fix). They also probe your judgment: when the tradeoff is genuinely false, say so. End with the lesson and how it changed your future decisions.",kp:["specific STAR example","explicit tradeoff reasoning","defined right and cost of delay","de-risked fast path","measured outcome","lesson applied forward"]}]},{id:"meta",name:"Meta",icon:"📘",tagline:"Social platforms, AI, VR",hq:"Menlo Park, CA",difficulty:4,stack:["React","Hack/PHP","Python","C++","GraphQL","Cassandra","TAO","PyTorch"],values:["Move fast","Focus on long-term impact","Be direct","Be bold"],style:"Coding rounds on a shared editor with follow-ups, plus behavioral rounds asking for specific past examples. Direct, fast-paced, outcome-focused.",sample:[{q:"Design a News Feed that serves a billion users.",a:"The core is fan-out: on write (push stories to followers' caches at write time) vs on read (pull/merge at request time) — most large systems use a hybrid: fan-out on write for regular users, on read for celebrities with millions of followers. Ranking combines recency, affinity, and content signals, computed in a scoring service. The feed is cached per-user with pagination cursors; heavy read traffic is absorbed by cache tiers. Consistency: eventual is fine — a story appearing slightly late beats the cost of synchronous fan-out.",kp:["fan-out on write vs read","hybrid for high-follower users","ranking signals recency affinity","per-user cached feed","pagination cursors","eventual consistency tradeoff"]},{q:"How would you build a real-time presence and typing indicator for a chat app?",a:"Presence: each client maintains a WebSocket; the server tracks per-user connection state and publishes presence changes to subscribed friends, with heartbeat timeouts for staleness. Typing indicators: throttled events (typing, stopped) broadcast to the conversation's participants, not stored — they're ephemeral. Scale concerns: a presence service holding connection state must be sharded by user, and fan-out to large groups needs efficient pub/sub. Handle disconnects gracefully — 'online' is a lie the moment a client is silent, so define staleness honestly.",kp:["websocket connection state","heartbeat and staleness","throttled typing events","pub sub fan-out","shard presence by user","ephemeral not stored"]},{q:"How do you reduce the latency of a mobile app's cold start?",a:"Measure the phases first: process start, framework init, first frame, first content. Attacks: defer non-critical initialization (analytics, SDKs) off the critical path, lazy-load modules, keep the first screen's data local or prefetched, minimize the binary size and JIT work, and render a meaningful placeholder instantly. On Android: avoid heavy work in Application.onCreate. On iOS: watch view controller init and first layout. Track cold start as a metric with a budget, and use profiles, not guesses, to find the real cost.",kp:["measure cold start phases","defer non-critical init","lazy load modules","prefetch first screen data","minimize binary and jit work","cold start as budgeted metric"]},{q:"Tell me about a time you moved fast and broke something. What did you do?",a:"Meta explicitly wants speed with ownership — the interview is about how you handled the aftermath, not the mistake itself. A strong answer: a specific incident, how you detected it, how you contained it (rollback, feature flag), how you communicated, and the systemic fix that made it unrepeatable. Emphasize owning the outcome end-to-end rather than blaming process, and what you changed in your own workflow. Avoid choosing an example that shows reckless disregard for users.",kp:["specific real incident","fast detection and containment","ownership not blame","systemic fix","communication","changed behavior going forward"]}]},{id:"amazon",name:"Amazon",icon:"📦",tagline:"E-commerce, AWS, logistics",hq:"Seattle, WA",difficulty:4,stack:["Java","AWS","DynamoDB","Lambda","S3","Kafka"],values:["Customer obsession","Ownership","Bias for action","Frugality","Deliver results","Have backbone"],style:"Leadership Principles behavioral rounds with 'tell me about a time' questions, plus system design and coding. Expect 'why Amazon?' and deep dives into your past projects.",sample:[{q:"Tell me about a time you had to make a decision with incomplete information.",a:"This is a Leadership Principles question (Bias for action + Are right a lot). Structure: the decision and why it couldn't wait, what you did to gather information fast (experiments, talking to customers, prototypes), the decision itself with your reasoning, and the outcome — including how you monitored and corrected course. Amazon wants evidence you can move with 70% of the information and adjust, not analysis paralysis. Quantify the outcome where you can.",kp:["decision with time pressure","gathered information fast","explicit reasoning","acted with partial data","monitored and corrected","measured outcome"]},{q:"Design a system that tells customers when their package will arrive.",a:"Split it: order → fulfillment center → carrier → doorstep. The ETA model consumes events from each stage (scan, sort, pickup, delivery attempt) and predicts remaining time using historical carrier performance, distance, and anomalies (weather, holidays). Serving: the promise shown to customers must be conservative — under-promising beats missing. Architecture: event stream for tracking, a prediction service, a cache for the customer-facing promise, and a feedback loop comparing predicted vs actual to improve the model. Handle the failure mode: when tracking data is missing, degrade to a windowed estimate, not a confident lie.",kp:["event stream of shipment stages","prediction model historical performance","conservative promises","feedback loop predicted vs actual","graceful degradation on missing data","customer-facing cache"]},{q:"How would you design a shopping cart service that never loses a customer's items?",a:"Durability and availability over everything: cart state is written synchronously to a replicated store (DynamoDB-style) before the user gets confirmation; reads can hit cache. Concurrency: versioned updates so two tabs don't silently overwrite each other — last-write-wins only for low-stakes fields, merge or prompt for conflicts. Cart must survive login/logout, device switches, and abandoned sessions (persist with TTL and restore on return). Idempotency for add/remove operations so retries are safe, and instrumentation to catch the silent data loss that availability-focused designs hide.",kp:["durable replicated writes","versioned conflict handling","survives login and devices","abandoned cart restore","idempotent mutations","instrumentation for data loss"]},{q:"Tell me about a time you disagreed with a decision made by your team or manager.",a:"Amazon's 'Have backbone; disagree and commit' wants: you had a real disagreement, you voiced it constructively with data, you escalated appropriately if needed, and then — if the decision went the other way — you committed fully and executed. The test is whether you can both push back and execute. Show respect for the decision-maker, evidence for your position, and no lingering resentment in your delivery. End with the outcome, whether your view won or not.",kp:["real disagreement with evidence","voiced constructively","appropriate escalation","disagree and commit","executed fully","reflection on outcome"]}]},{id:"microsoft",name:"Microsoft",icon:"🪟",tagline:"Windows, Azure, Office, AI",hq:"Redmond, WA",difficulty:3,stack:["C#","TypeScript",".NET","Azure","SQL Server","VS Code","OpenAI partnership"],values:["Growth mindset","Customer obsession","Diverse and inclusive","One Microsoft"],style:"Structured rounds with coding, system design, and STAR behavioral questions. Values collaboration and learning; 'tell me about a time you learned something hard' is a classic.",sample:[{q:"How would you design a cloud storage service like OneDrive (file sync)?",a:"Core pieces: object storage for file content, a metadata service for the file tree and versions, and a sync client that uploads/downloads with delta sync and conflict resolution. The sync protocol is the heart: change detection, chunked uploads with resume, server-side change log so clients catch up efficiently, and conflict policies (both versions kept, renamed). Add sharing with permissions, offline access with a local cache, and encryption at rest and in transit. Failure handling: partial uploads, interrupted syncs, and reconciliation when client and server disagree.",kp:["object storage plus metadata service","delta sync and chunked resume","change log for catch-up","conflict resolution policy","offline local cache","reconciliation on disagreement"]},{q:"Explain the CAP theorem and how Azure Cosmos DB handles it.",a:"CAP: under a network partition you choose consistency or availability. Cosmos DB's value is making the choice tunable per request — consistency levels from strong to eventual (bounded staleness, session, consistent prefix, eventual) with corresponding latency and availability tradeoffs, all on a multi-region, multi-master replicated store. You can have a strong-consistency path for money operations and eventual for the feed, in one service. The interview point: know that 'tunable consistency' means you must understand your application's real consistency needs and pick deliberately.",kp:["partition forces consistency vs availability","tunable consistency levels","bounded staleness session consistent prefix","multi-region multi-master","strong for money eventual for feed","deliberate consistency choices"]},{q:"Tell me about a time you learned a new technology quickly to get the job done.",a:"Microsoft's growth mindset is the theme. Pick a real example with stakes: the technology, why it mattered, your learning method (structured course, building something real, pairing with an expert), how you applied it, and the outcome. They want to see how you learn, not that you knew it already: show deliberate practice, comfort being a beginner, and turning learning into shipped results. A good answer includes what you'd do differently next time.",kp:["real stakes and why it mattered","deliberate learning method","applied to real work","measured outcome","comfort being a beginner","reflection on learning process"]},{q:"Design an AI assistant integration for a productivity product.",a:"Architecture: a gateway that takes user prompts with product context, calls the LLM with retrieval augmentation (index the user's documents/data so answers are grounded), and streams responses. The hard parts: grounding and accuracy (retrieval quality, citations, hallucination guards), cost and latency control (prompt caching, model tiering, rate limits), privacy (data stays in tenant, no training on customer data), and safety (prompt injection defenses when the assistant reads user documents). Add observability: cost per request, quality sampling, and feedback collection.",kp:["gateway with product context","retrieval augmented generation","grounding and citations","prompt injection defense","cost latency control and caching","tenant privacy guarantees"]}]},{id:"apple",name:"Apple",icon:"🍎",tagline:"Hardware, software, services",hq:"Cupertino, CA",difficulty:4,stack:["Swift","Objective-C","C/C++","Metal","WebKit","Privacy technologies"],values:["Design excellence","Privacy by design","Simplicity","Craft and attention to detail"],style:"Deep technical rounds, craft-focused. Expect questions about your actual projects with relentless follow-ups, plus design sensibility and privacy awareness.",sample:[{q:"How do you keep a scrolling list buttery smooth at 60fps?",a:"The main thread must never do heavy work: offload image decode, avoid layout in scroll callbacks, reuse cells, and keep cell construction cheap. On iOS specifically: prefetch (UICollectionView prefetching), draw once and cache, avoid shadow/opacity animations that force offscreen rendering, and profile with Instruments (Core Animation, Time Profiler) to find the actual cost. Set a frame drop budget and verify with real-device testing, because simulators lie. The craft answer shows you know the profile is where the truth is.",kp:["main thread stays free","offload image decode","cell reuse and cheap construction","prefetch and cached drawing","profile with instruments","verify on real devices"]},{q:"Explain how you'd design a feature with privacy as a first-class requirement.",a:"Start from Apple's stance: data minimization — collect the least data, process on-device where possible, and never use user data for purposes they didn't consent to. Design: on-device processing (e.g., on-device ML or local analytics) before any server involvement, differential privacy or aggregation for telemetry, end-to-end encryption for user content, and clear, honest consent flows with easy revocation. Engineering: make privacy the default path (no telemetry without explicit opt-in, app transport security on), and design the data model so nothing unnecessary is stored in the first place.",kp:["data minimization","on-device processing first","end-to-end encryption","honest consent and revocation","privacy as default not opt-out","differential privacy telemetry"]},{q:"Design a system that syncs a user's photos across devices.",a:"The library is the source of truth, synchronized via a change log: each device applies remote changes and uploads its own with conflict resolution (usually both versions kept with metadata merging). Photos need efficient transfer: full-res originals with optimized device-sized versions, incremental uploads with checksums, and background sync that respects battery and data budgets. Deduplication and content hashing avoid double uploads; the server stores versions and manages device preferences. Add: end-to-end encryption, since photo privacy is non-negotiable, and recovery — the library must survive device loss.",kp:["library as source of truth","change log sync protocol","conflict resolution","optimized and full-res versions","incremental checksummed uploads","end-to-end encryption"]},{q:"Describe a project where you obsessed over the details. What did you do?",a:"Apple's culture wants evidence of craft: pick something where the difference between good and excellent was visible to users — a micro-interaction, a performance edge, a pixel-perfect layout, an error state designed with care. Show your process: how you noticed the weakness, the iterations (with users or critique), the tradeoffs you rejected, and the final result. Quantify where possible (a 30% faster startup, a crash rate to zero) and connect the detail to the product experience.",kp:["detail users could see","process of iteration","tradeoffs considered and rejected","measured improvement","connected to user experience","craft mindset"]}]},{id:"netflix",name:"Netflix",icon:"🎬",tagline:"Streaming, content, culture",hq:"Los Gatos, CA",difficulty:4,stack:["Java","Node.js","React","GraphQL","AWS","Cassandra","Spinnaker","Chaos engineering"],values:["Judgment","Impact","Curiosity","Courage","Freedom and responsibility","The Keeper Test"],style:"High-performance culture. Interviews probe judgment and impact; expect 'what would you do differently?' and culture-fit rounds about freedom and responsibility.",sample:[{q:"Design a video streaming service that must never buffer.",a:"Never buffering is impossible, so design the experience: adaptive bitrate (ABR) — encode multiple qualities per second, and the player switches quality based on measured bandwidth and buffer health, prioritizing playback continuity over resolution. Content is served from a CDN with caches near users; the most popular content is pre-seeded. The control plane (catalog, recommendations) is separate from the data plane (video bytes). Degradation is by design: lower quality gracefully rather than a frozen frame, and track buffer health as a first-class metric.",kp:["adaptive bitrate streaming","quality ladder encodings","player buffer management","CDN with edge caching","control plane data plane separation","buffer health metrics"]},{q:"How would you design a global content delivery network?",a:"Layers: origin storage, a hierarchy of caches (regional → edge), and DNS-based routing that sends users to the nearest healthy cache. The interesting problems: cache admission and eviction (what gets cached where — popularity drives this), warm vs cold starts (pre-position popular content before traffic arrives), and failure handling (cache misses escalate to origin; origin must survive stampedes — use request coalescing and capacity headroom). Measure: hit ratio by tier, latency by region, and cost per delivered byte. The economics matter as much as the architecture.",kp:["cache hierarchy regional to edge","dns routing to nearest cache","popularity-driven placement","request coalescing on misses","hit ratio and latency metrics","cost per byte economics"]},{q:"Explain chaos engineering and how you'd introduce it to a team.",a:"Chaos engineering is confidence through controlled failure: form a steady-state hypothesis (the system keeps serving under this failure), design an experiment with a small blast radius, run it in production or staging, observe, and learn. Start boring: kill a node, fail a dependency, add latency to a service. Prerequisites: observability (you can't learn from chaos you can't see), a blameless culture, and rollback plans. Netflix runs automated chaos (Chaos Monkey) because their architecture must survive instance loss as a design requirement, not an accident.",kp:["steady-state hypothesis","small blast radius first","observability prerequisite","blameless learning","automated chaos at scale","survivable by design"]},{q:"Tell me about a time you had a big impact on a product or system.",a:"Netflix's Impact value wants scale and ownership: pick something with measurable, significant outcomes — a performance win, a cost reduction, a feature that moved a business metric. Quantify aggressively (X% faster, $Y saved, Z% conversion) and be honest about your specific contribution vs the team's. Show judgment: how you chose this problem over others, how you drove it to completion through ambiguity, and what you'd do differently. The Keeper Test subtext: they're evaluating whether you're the kind of engineer they'd fight to keep.",kp:["measurable significant outcome","your specific contribution","judgment in choosing problem","drove through ambiguity","quantified impact","honest reflection"]}]},{id:"stripe",name:"Stripe",icon:"💳",tagline:"Payments infrastructure",hq:"San Francisco / Dublin",difficulty:5,stack:["Ruby","Go","Scala","React","TypeScript","PostgreSQL","Kafka","ML"],values:["Users first","Global optimization","Sweat the details","Build to last","Play long-term games"],style:"Among the hardest: deep API design taste, distributed systems, and 'write an API' questions. Expect sharp follow-ups on edge cases and failure modes.",sample:[{q:"Design an idempotency layer for a payments API.",a:"The API must be retry-safe: clients send an Idempotency-Key header, the server stores the request hash and response keyed by that key with a TTL, and retries return the original result instead of double-charging. Storage: a dedicated table with the key as primary key and a unique constraint; concurrent first-time requests need atomic insert-or-return (or a lock) so two racing retries can't both execute. Scrub the stored data for compliance (keys expire, responses truncated). Also handle: key reuse across different requests is an error, and key collisions are a correctness bug that costs money.",kp:["idempotency key from client","store request hash and response","atomic insert to prevent races","retry returns original result","ttl and data scrubbing","key reuse is an error"]},{q:"Walk me through what happens when a customer pays with Stripe.",a:"The payment journey: the client creates a PaymentIntent, Stripe returns a client secret, the customer authorizes (card details via Stripe.js/Element or a redirect for wallets), and Stripe confirms with the network. The money moves through: authorization → capture (or automatic capture) → settlement, with the balance updated via a ledger — double-entry, append-only, reconciled against network reports. Webhooks notify the merchant asynchronously (idempotent, signed). Failure paths: decline (3DS challenges, retry logic), timeouts (reconciliation catches ambiguity), and refunds as separate flows with their own lifecycle.",kp:["payment intent lifecycle","authorization capture settlement","append-only double-entry ledger","signed idempotent webhooks","decline and 3ds handling","reconciliation for ambiguous outcomes"]},{q:"Design a dashboard API that reports revenue metrics in real time.",a:"The hard part is what 'real time' means for money: reporting must be correct, so the pipeline is: ledger events → stream → aggregation service → serving API, with a reconciliation pass that corrects the real-time numbers against the settled truth. Design for correctness over immediacy: show provisional numbers clearly labeled, and let final numbers replace them. Serving: pre-aggregated rollups (daily, monthly, per merchant) in a fast store with cache; the API paginates and filters server-side. Guard the join: metrics must be consistent across endpoints (same definitions everywhere) or the dashboard loses trust.",kp:["ledger events to aggregation pipeline","reconciliation against settled truth","provisional vs final labeling","pre-aggregated rollups","consistent metric definitions","server-side filtering pagination"]},{q:"Tell me about a time you sweat the details on something customers noticed.",a:"Stripe's 'sweat the details' values the last 5%: pick an example where the polish was visible — an error message that turned a support ticket into a self-serve fix, a latency improvement users felt, an API design that made integration painless. Show the iteration: how you found the weakness, the alternatives you considered, and why you chose the one you did. Include a tradeoff you made deliberately. The subtext: Stripe believes details compound into trust, and they're hiring for that instinct.",kp:["visible customer-facing detail","iteration process","alternatives considered","deliberate tradeoff","measured result","details compound into trust"]}]},{id:"airbnb",name:"Airbnb",icon:"🏠",tagline:"Travel marketplace",hq:"San Francisco, CA",difficulty:3,stack:["Ruby on Rails","React","TypeScript","GraphQL","Kafka","MySQL","ML"],values:["Champion the mission","Be a host","Embrace the adventure","Simplify","Every frame matters"],style:"Product-sense heavy: design questions that start from user needs. Mission-driven behavioral rounds. Expect 'design a feature' questions with a UX-first lens.",sample:[{q:"Design a search and discovery feature for a travel marketplace.",a:"Start from the user: filtering by location, dates, price, and amenity preferences, ranked by relevance (location match, reviews, price value, popularity). Architecture: search index (Elasticsearch) with filters and ranking, backed by a pipeline that indexes listings with fresh availability and pricing. The product layer: map-first vs list view, search suggestions, and saved searches. Ranking is the product: what makes a great match — and the answer should include experimentation (A/B tests) and learning from booking outcomes, not clicks.",kp:["user-first requirements","search index with filters","relevance ranking signals","availability and pricing freshness","map and list views","optimize for bookings not clicks"]},{q:"How would you handle duplicate or spam listings at scale?",a:"Layered detection: rules at ingest (blocked patterns, velocity checks, known-bad signals), ML classification on listing content and images (duplicate detection via embeddings, spam patterns), and human review for the ambiguous tail with a trust and safety workflow. The harder, product-level work: identity verification at signup, reputation signals (reviews, host history), and making the cost of abuse high (payments friction). Track abuse metrics and iterate — spammers adapt, so detection is a treadmill, not a project.",kp:["rules at ingest","ml duplicate and spam detection","embeddings for similarity","human review for tail","identity and reputation signals","abuse as ongoing treadmill"]},{q:"Design a reviews system that users trust.",a:"Trust is the product: both sides review (guest and host) with private feedback to reduce retaliation, reviews are locked in (can't be edited after a window, or only with transparency) to prevent pressure, and content moderation catches abusive or fake reviews. The system: review creation flow with structured categories plus free text, a moderation pipeline (automated + human), and scoring that resists gaming (recency weighting, outlier handling). Show the marketplace lens: reviews are the information that makes strangers transact, so integrity beats volume.",kp:["two-sided reviews","anti-retaliation design","locked reviews with transparency","moderation pipeline","gaming resistance in scoring","integrity over volume"]},{q:"Tell me about a time you championed the user in a product decision.",a:"Airbnb's mission value wants the user's voice in your decision-making: a real example where you pushed for the user experience against pressure (deadline, cost, or opinion), how you made the case (research, data, prototypes), and the outcome. Show empathy as an engineering skill: how you understood the user's context and translated it into a technical or product decision. End with what the company or users gained.",kp:["real user-centered decision","made case with evidence","understood user context","pushed back constructively","outcome for users","empathy as engineering skill"]}]},{id:"uber",name:"Uber",icon:"🚗",tagline:"Mobility and delivery",hq:"San Francisco, CA",difficulty:4,stack:["Go","Java","Python","React Native","Kafka","MySQL","Postgres","Machine learning"],values:["Customer obsession","We before me","Act like an owner","Always hustle"],style:"System design heavy — 'design Uber' is a classic. Real-time, geo-distributed systems with availability demands. Behavioral rounds probe ownership and hustle.",sample:[{q:"Design the dispatch system that matches riders and drivers.",a:"The constraints: real-time (sub-second matching), geo-distributed, and availability-critical. Architecture: drivers stream GPS to a location service (geohashed or spatial index); a dispatch service matches supply to demand optimizing a global objective (ETAs, utilization, fairness) with a batch-and-solve approach — rebalance every few seconds rather than greedily. ETA estimation needs a live map/route service. Degradation: when location data lags, match on last-known with confidence checks; when dispatch is overloaded, fall back to simpler matching rather than failing. Measure the whole thing on dispatch latency and utilization, not just match rate.",kp:["driver location stream","geohash spatial indexing","batch matching optimization","live eta and routing","graceful degradation on stale data","dispatch latency metrics"]},{q:"How would you estimate ETAs accurately across a city?",a:"Layered estimation: real-time traffic (probe data from trips aggregated per road segment) blended with historical patterns (time of day, day of week) and static map data, with a fallback when live data is missing. The model: segment-level travel time prediction feeding a routing engine. The product layer: ETA must be honest and calibrated — a consistently wrong ETA erodes trust faster than a slower but accurate one. Monitor predicted vs actual systematically, and re-train on drift (new roads, weather, events).",kp:["real-time traffic probes","historical pattern blending","segment travel time model","honest calibrated promises","predicted vs actual monitoring","retrain on drift"]},{q:"Design a system that handles surge pricing during a rainstorm.",a:"Surge exists to balance supply and demand: when demand outpaces supply (rain, events, rush hour), prices rise to attract more drivers and allocate scarce supply to the highest-willingness riders. The system: real-time demand/supply imbalance detection per geo region, a pricing engine that adjusts multipliers with constraints (fairness caps, transparency), and instant propagation to riders before they book. The engineering: geo aggregation of supply/demand, low-latency pricing reads, and careful experimentation — surge affects behavior of both sides, so it's validated with controlled tests, and the incentives must be communicated honestly to users.",kp:["supply demand imbalance detection","geo-region aggregation","pricing engine with fairness caps","low-latency pricing propagation","dual-sided behavior effects","honest user communication"]},{q:"Tell me about a time you went above and beyond to solve a problem.",a:"Uber's hustle value: pick a real example where the problem was underspecified or urgent and you owned it end-to-end — took it beyond your scope, rallied the help you needed, and delivered. Show the specifics: what made it hard, the obstacles, what you did when things went wrong, and the measured result. Avoid humble-bragging about overwork; emphasize ownership and impact instead. They want to see the 'act like an owner' instinct in action.",kp:["real underspecified problem","owned it end-to-end","rallied resources","overcame obstacles","measured result","owner mindset"]}]},{id:"spotify",name:"Spotify",icon:"🎵",tagline:"Music streaming",hq:"Stockholm / New York",difficulty:3,stack:["Java","Kotlin","Python","React","Kafka","Cassandra","BigQuery","ML"],values:["Innovation","Collaboration","Passion","Sincerity"],style:"Squad-based culture — expect collaboration and autonomy questions. Product metrics and experimentation feature heavily, especially for data and backend roles.",sample:[{q:"Design a music recommendation system.",a:"The layers: candidate generation (collaborative filtering on listening behavior, content-based on audio features/embeddings, editorial and context playlists), then ranking (a model over features: user history, freshness, genre fit, context — morning vs workout). The feedback loop is the product: skips, repeats, and saves tell you what worked. Cold start: new users get curated/contextual picks; new tracks get audio-feature-based similarity. Evaluation: offline metrics (precision@k, NDCG) plus A/B tests on engagement and retention — because the real objective is long-term engagement, not clicks.",kp:["collaborative and content-based candidates","audio features and embeddings","ranking with context features","feedback loop skips saves","cold start strategies","offline metrics plus experiments"]},{q:"How do you measure the health of a feature like Discover Weekly?",a:"Start from the objective: does it drive long-term engagement and retention? Metrics: adoption (who uses it), engagement (listens, saves, session length), and the critical ones — retention lift for users who engage with it, and diversity of discovery (are users finding music they'd never find otherwise?). Guardrails: churn, skip rate, and diversity collapse. The analysis: cohort comparisons and A/B tests, watching not just the metric but the behavior beneath it — a feature can look great in aggregate and fail for specific segments.",kp:["adoption engagement retention","retention lift cohorts","discovery diversity metric","guardrail metrics","segment-level analysis","behavior beneath the metric"]},{q:"Design a system for streaming audio with seamless playback.",a:"The player pipeline: audio is encoded in multiple bitrates and chunked; the player downloads ahead (buffer) while playing, switching quality based on network conditions (adaptive bitrate). Seamlessness = predicting the next song (gapless playback, crossfade) and prefetching it during the current one. Offline: full-song downloads with smart caching (cache the tracks you'll likely play next). Server side: CDN with edge caches, session management, and rights-aware delivery (what you can play depends on licensing per region). The product metrics: playback failures, rebuffer rate, and time-to-first-play.",kp:["adaptive bitrate chunked audio","prefetch and buffering","gapless and crossfade","smart offline caching","cdn and regional licensing","playback failure metrics"]},{q:"Tell me about a time you collaborated across teams to ship something.",a:"Spotify's squad/guild model makes collaboration the interview theme: a real example where you worked across team boundaries (design, data, another squad), how you aligned goals and handled disagreement, and your specific contribution to the outcome. Show the mechanics: communication rituals, shared ownership, giving and receiving feedback. End with the result and what made the collaboration work — and be honest about what was hard.",kp:["real cross-team example","aligned goals across boundaries","handled disagreement","specific contribution","communication mechanics","honest about difficulty"]}]},{id:"cloudflare",name:"Cloudflare",icon:"☁️",tagline:"CDN, security, edge",hq:"San Francisco / London",difficulty:4,stack:["Go","Rust","TypeScript","Workers","ClickHouse","Kubernetes"],values:["Trust","Curiosity","Scrappy","Transparency"],style:"Technical depth on distributed systems at the edge. Expect questions about performance, scale, and failure — they literally run a global network.",sample:[{q:"How would you serve a request from the edge with sub-millisecond overhead?",a:"The edge is a proxy: DNS routes the user to the nearest PoP, TLS terminates there, and the request hits a highly optimized HTTP stack. The principles: keep the hot path in memory (no disk, no network hops), minimize allocations and copies, use connection reuse and HTTP/3, and avoid per-request lock contention. Where compute is needed, run it at the edge (Workers-style) so the user never leaves the PoP. Measure everything in overhead terms: the proxy's added latency must be a small, predictable constant, verified at scale with real traffic distributions.",kp:["terminate at nearest PoP","in-memory hot path","minimize allocations and copies","connection reuse http3","edge compute avoids round trips","measure overhead as budget"]},{q:"Design a WAF (Web Application Firewall) rule engine that runs at the edge.",a:"The constraint: evaluate rules against every request at the edge in microseconds. Architecture: compile rules (OWASP CRS + custom) into an efficient matching structure — optimized regex sets, bloom filters for cheap rejection, and early-exit evaluation — running in the request path in C/Rust/Wasm. The control plane: rule deployment must be global and fast (rule updates propagate to all PoPs in seconds) and atomic, because a bad rule is a global outage. Observability: match rates per rule, false positive detection (blocking legit traffic), and analytics so operators tune rules with data.",kp:["compile rules to efficient matchers","bloom filters and early exit","run in request path","fast atomic global rule deployment","false positive monitoring","operator analytics"]},{q:"How do you build and debug systems when every request can hit any of hundreds of edge locations?",a:"Key insight: edge systems are many identical replicas, so determinism and reproducibility matter more than in a central service. Build for it: identical binaries/configs everywhere (config diffs are the failure mode), request tracing that works across PoPs (every edge hop carries trace context), centralized logs/metrics with local sampling, and canary rollouts that ramp percentage of PoPs. Debugging: reproduce against the exact config (record and replay), use controlled chaos (kill a PoP, see what breaks), and lean on the fleet's statistics — a bug in 1 of 300 locations is a config skew or a hardware anomaly, not a code bug.",kp:["identical replicas everywhere","cross-pop trace context","config skew as failure mode","canary pop rollouts","record replay reproduction","fleet statistics debugging"]},{q:"Tell me about a time you made a system measurably faster.",a:"Cloudflare's 'scrappy' value wants evidence and numbers: pick a real optimization — latency, throughput, resource cost — with a before/after measured on real workloads. Show your method: profiling to find the actual bottleneck (not the guessed one), the change, the verification, and the guardrails that kept it fast (benchmarks, budgets). Include the tradeoffs you considered. A strong answer shows the discipline: measure → change → re-measure, and knowing when the optimization wasn't worth it.",kp:["real measured optimization","profiling found actual bottleneck","before after on real workloads","guardrails kept it fast","considered tradeoffs","measure change re-measure discipline"]}]},{id:"datadog",name:"Datadog",icon:"📈",tagline:"Observability SaaS",hq:"New York, NY",difficulty:3,stack:["Go","Python","Java","React","Kafka","ClickHouse","Elasticsearch","AWS"],values:["Care about customers","Wear the customer's shoes","Be scrappy","Own your outcomes"],style:"Practical systems questions: ingestion pipelines, time-series storage, debugging stories. Expect 'walk me through how you debugged something hard'.",sample:[{q:"Design a metrics ingestion pipeline that handles millions of time series.",a:"Agents on customer hosts collect and batch metrics, sending them to ingest gateways that validate and route to storage. The storage engine is the crux: time-series data is append-heavy with high cardinality, so design for compression (delta-of-delta timestamps, XOR values — the Gorilla approach), downsampling/rollups for long retention, and sharding by series. Query path: serve recent data from hot storage, rollups for older data. The whole pipeline must absorb bursts (agents retry with backoff, gateways shed load gracefully) and never lose the customer's data silently — drop metrics loudly.",kp:["agent batching and retry","ingest gateways with backpressure","compression delta of delta","downsampling and rollups","shard by series","loud not silent drops"]},{q:"How do you build a dashboard that stays fast while querying terabytes?",a:"The query path must never scan everything: pre-aggregate (rollups at multiple resolutions — 1s/1m/1h), push filters down to storage, and cache aggressively (same query twice → serve cache; dashboard refresh → serve cache while refreshing in background). Architect dashboards as a set of small, parallelizable queries with time bounds, and degrade gracefully: if the full-resolution query is too expensive, fall back to rollups, then to cached data — a slow dashboard is a useless dashboard. Add query cost limits and per-dashboard budgets so one team can't tax the cluster.",kp:["pre-aggregated rollups","pushdown filters","cache with background refresh","parallel small queries","graceful resolution fallback","query budgets"]},{q:"Walk me through the hardest production debugging you've done.",a:"Datadog hires people who've felt real production pain: pick a genuinely hard incident — intermittent, distributed, or mysterious — and walk through it like a story with a method: the symptom, the hypotheses you formed and eliminated, the evidence that cracked it (logs, traces, reproductions), the root cause, and the fix. End with the systemic improvement that made it unrepeatable (monitoring, tests, architectural change). The interviewer is evaluating your debugging discipline and honesty — include a wrong turn you took.",kp:["hard real incident","systematic hypothesis elimination","evidence that cracked it","root cause and fix","systemic prevention","honest about wrong turns"]},{q:"Tell me about a time you turned customer feedback into an engineering decision.",a:"Datadog's customer-obsession value: a real example where customer pain shaped what you built — how you heard it (support, usage data, direct conversations), how you validated it was real and general (not one loud customer), how you prioritized it, and the outcome. Show judgment in saying no to some requests, and show the loop closing: how you knew it worked (adoption, support tickets down, retention).",kp:["real customer pain","validated real and general","prioritized with judgment","shipped and measured","said no to some requests","closed the loop"]}]}];function hl(n){return yd.find(i=>i.id===n)||Ky}const ga=[{q:"Tell me about a time you had a conflict with a teammate. How did you resolve it?",a:"Use STAR: a specific situation, what you did, the result. The strongest answers show you addressed the conflict directly and respectfully — understood their perspective before arguing yours, found the shared goal underneath the disagreement, and separated the person from the problem. The outcome should include both the technical resolution and the preserved (or improved) working relationship. Interviewers are listening for emotional maturity, not for who was right.",kp:["specific situation","understood their perspective","shared goal framing","resolved constructively","relationship preserved","self-awareness"]},{q:"Describe a project you're most proud of.",a:"Pick something with real stakes and measurable impact. Walk through: the problem and why it mattered, your specific contribution (not the team's), the obstacles and how you overcame them, and the measured result — users, revenue, performance, or velocity. Close with what you learned. Avoid picking something where you can't articulate your own role, and avoid vague impact statements — quantify.",kp:["specific contribution","why it mattered","obstacles overcome","measured impact","lessons learned"]},{q:"Tell me about a time you failed.",a:"The point isn't the failure — it's your honesty and growth. Choose a real failure with real consequences (not a fake 'failure' that was actually a success), take ownership without deflecting to others or circumstances, and show what you learned and how you changed your behavior. The strongest answers include the specific mechanism that prevented the same mistake again. Interviewers distrust candidates who can't name a genuine failure.",kp:["honest real failure","took ownership","no deflection","specific learning","changed behavior","growth mindset"]},{q:"Tell me about a time you disagreed with your manager.",a:"Show that you can challenge respectfully and commit effectively: you raised the disagreement with evidence and reasoning, listened to their counterarguments with an open mind, and either persuaded them or accepted the decision and executed fully. Avoid stories where you were right and they were wrong in a way that sounds like resentment. The evaluation is on your judgment and your ability to maintain trust through disagreement.",kp:["evidence-based challenge","respectful delivery","listened to counterarguments","accepted and committed","trust maintained"]},{q:"Describe a time you had to deliver under a tight deadline.",a:"Show your prioritization under pressure: how you identified what mattered most, what you cut or negotiated in scope, how you communicated tradeoffs to stakeholders, and how you stayed calm and organized. The outcome should show you delivered the critical parts well. A strong answer includes an honest acknowledgment of what was sacrificed and whether the tradeoff was worth it.",kp:["prioritized ruthlessly","negotiated scope","communicated tradeoffs","calm under pressure","delivered outcome","honest about cost"]},{q:"Tell me about a time you mentored or helped someone grow.",a:"Mentorship isn't just explaining things — it's diagnosis: understanding where the person actually struggles, adjusting your approach to their level, giving feedback they can act on, and building their independence rather than dependency. Describe a specific person, your approach, and the outcome — their growth, and what it did for the team. Senior-level interviews weight this heavily; it's evidence you can multiply impact.",kp:["diagnosed their need","adapted approach","actionable feedback","their growth","built independence","team benefit"]},{q:"Tell me about a time you made a decision with incomplete information.",a:"The best answers show the decision framework: what you did to gather the fastest useful information (talk to users, run a small experiment, prototype), the assumptions you made explicit, how you decided with speed, and how you monitored and corrected course after. Interviewers at higher levels want to see comfort with ambiguity — analysis paralysis is the failure mode they're screening for.",kp:["gathered fastest useful info","explicit assumptions","decided with speed","monitored outcome","corrected course","comfort with ambiguity"]},{q:"Tell me about a time you received tough feedback.",a:"The test is whether you can receive feedback without getting defensive. Describe the feedback, your initial reaction (honesty here earns trust), what you did with it — a concrete change — and the outcome. The strongest answers show feedback transformed into a habit, and an ongoing practice of seeking feedback rather than waiting for it. Avoid framing the feedback as unfair; own the part that was yours.",kp:["accepted without defensiveness","honest initial reaction","concrete change","measured outcome","seeks feedback ongoing"]},{q:"Describe a time you improved a process or workflow.",a:"Show the full loop: how you noticed the inefficiency (often by feeling the pain yourself), how you validated the fix would help, how you implemented it and got buy-in, and the measured improvement — time saved, errors reduced, velocity up. Process improvements at higher levels scale: the same fix applied to multiple teams or codified into tooling. Include the resistance you faced, because changing process means changing people.",kp:["identified real inefficiency","validated the fix","got buy-in","measured improvement","scaled beyond one team","overcame resistance"]},{q:"Tell me about a time you handled an angry customer or stakeholder.",a:"The skill is de-escalation and ownership: you listened fully before responding, acknowledged their frustration without being defensive, took ownership of the problem (even where it wasn't purely your fault), and either resolved it or escalated it with context. The outcome should show the relationship repaired or the situation improved. Avoid stories where the customer was simply wrong — the interesting ones have real substance.",kp:["listened first","acknowledged without defensiveness","took ownership","resolved or escalated well","relationship repaired","root cause fixed"]},{q:"Describe a time you took a calculated risk.",a:"A calculated risk has stakes and reasoning: what was at stake, what you did to reduce the downside (experiments, fallbacks, staged rollout), the decision itself, and the outcome. The best answers are honest about the tension — if it had no real downside, it wasn't a risk. Higher-level interviews want to see risk appetite calibrated to impact: big risks on reversible decisions, caution on irreversible ones.",kp:["real stakes","reduced the downside","explicit reasoning","outcome","reversible vs irreversible","lesson learned"]},{q:"Tell me about a time you worked on a cross-functional team.",a:"Show you can operate where goals, vocabulary, and incentives differ: the roles involved (design, product, data, other engineering teams), how you aligned on a shared goal, how you communicated across the gap, your specific contribution, and the result. The strongest answers show you actively bridging — translating technical constraints into product terms and vice versa. Conflict or misalignment in the story is a feature, not a flaw, if you handled it well.",kp:["diverse roles involved","aligned shared goals","bridged communication gap","specific contribution","handled misalignment","measured result"]}],hr={mid:[{q:"Design a URL shortener.",a:"Requirements and scale first: ~100M URLs, read-heavy (100:1). Core: generate a short unique key (base62 encoding of a counter or hash with collision handling), store the mapping in a database with the key as primary key, and serve redirects (301 for permanent, 302 for analytics). Reads dominate, so cache hot mappings and put a CDN in front. Add optional analytics (click counts, referrers) via an event pipeline. Edge cases: custom aliases, key reuse, and expiry.",kp:["requirements and scale estimate","base62 key generation","collision handling","301 302 redirect semantics","cache hot mappings","analytics pipeline"]},{q:"Design a chat application.",a:"Transport: WebSockets for real-time delivery and presence, with a fallback to polling/SSE. Storage: messages in a sharded database, paginated by conversation; each conversation gets a monotonically increasing sequence for sync. States: sent → delivered → read, tracked per message. Offline: client queue with resync on reconnect using the sequence. Group chats fan out; large groups use a pull model. Push notifications cover the app-not-open case. Scale: shard by conversation or user, and make message IDs idempotent for retries.",kp:["websocket real-time transport","message storage and pagination","sequence-based sync","delivery statuses","offline queue and resync","sharding strategy"]},{q:"Design a news feed.",a:"The core tradeoff is fan-out: on write, push the post to followers' caches at write time (fast reads, expensive for celebrities); on read, merge posts from followed users at request time (simple, slower). Large systems use a hybrid — push for most users, pull for high-follower accounts. Ranking combines recency, affinity, and engagement. The feed is a per-user cache with cursor pagination, backed by a cache tier (Redis) over the source data. Consistency is eventual: a story arriving a minute late is acceptable.",kp:["fan-out on write vs read","hybrid for high-follower accounts","ranking signals","per-user cache","cursor pagination","eventual consistency"]},{q:"Design a rate limiter.",a:"Algorithm: token bucket (simple, allows bursts) or sliding window (smoother). Track counters per key (user/IP/API key) in a fast store like Redis with TTLs, using atomic operations for distributed correctness. Enforce at the gateway or middleware; on violation return 429 with Retry-After. The limiter itself must scale horizontally and never be a bottleneck — degrade gracefully if the counter store is down (allow, don't block, with a circuit breaker). Monitor usage to tune limits and detect abuse.",kp:["token bucket or sliding window","counters with ttl","atomic distributed ops","429 with retry-after","graceful degradation","abuse monitoring"]}],senior:[{q:"Design a social media platform like Twitter/X.",a:"Core components: a post service (content storage, sharded by post ID or user), a timeline service with fan-out (push to followers' timelines at write time, pull for high-follower accounts), and a search/trends service over the post stream. Caching dominates: hot users' timelines are precomputed and cached; the top posts of the day get dedicated cache layers. Consistency: eventual — a timeline slightly behind is fine; the failure mode to design for is the celebrity posting (write storm) and the viral event (read storm).",kp:["post storage sharding","timeline fan-out","celebrity pull model","cache hierarchy","write storm handling","eventual consistency"]},{q:"Design a video streaming platform like Netflix.",a:"Two planes: the control plane (catalog, recommendations, auth) and the data plane (the actual video bytes). Data plane: content is transcoded into multiple qualities and chunked, distributed to a CDN with caches near users; the player uses adaptive bitrate to pick quality by bandwidth. The catalog/metadata service is a classic read-heavy service with caching. Recommendations are a separate offline pipeline (see recommendation design). DRM and licensing gate what can play where. The economics — storage and bandwidth per title — are first-class design constraints.",kp:["control plane data plane separation","transcoding quality ladder","cdn distribution","adaptive bitrate playback","catalog service caching","drm and licensing"]},{q:"Design a ride-hailing system like Uber.",a:"The heart is dispatch: drivers stream location to a location service (spatial index, geohash), and a dispatch service matches supply to demand in batches, optimizing a global objective (ETA, utilization, fairness) rather than greedily. ETA estimation needs a live routing service. Trip state machine: request → match → pickup → ride → payment → rating, each an event. Real-time components (location, dispatch) are the hard availability problem; trip history and payments can be eventually consistent. Degrade gracefully: stale locations, overloaded dispatch, and low supply all have fallbacks.",kp:["driver location stream","spatial index geohash","batch matching optimization","trip state machine","live eta routing","graceful degradation"]},{q:"Design a distributed key-value store like Dynamo.",a:"Consistent hashing partitions data across nodes with virtual nodes for even distribution; each key is replicated to N successor nodes for availability. Reads/writes use quorum (R + W > N) to balance consistency and latency. Conflicts (concurrent writes) are resolved with vector clocks — keep both versions and let the application resolve, or last-write-wins. Hinted handoff keeps availability when a node is down, and Merkle trees detect divergence for anti-entropy. This is the AP-end of the spectrum: availability over strong consistency.",kp:["consistent hashing with virtual nodes","replication factor","quorum reads and writes","vector clocks for conflicts","hinted handoff","merkle tree anti-entropy"]}],staff:[{q:"Design a payment system that must never lose money.",a:"The invariants: every operation is idempotent (unique constraint on idempotency keys), and money movement is recorded in an append-only ledger with double-entry accounting — every debit has a credit, so the books always balance. External providers are reconciled against the ledger asynchronously with mismatch alerts. Compensating transactions, not mutation: a failed capture after a hold releases, never deletes. Add an immutable audit trail, isolate the money path from the main CRUD app, and make the ledger the source of truth.",kp:["idempotency unique constraints","append-only double-entry ledger","reconciliation with providers","compensating transactions","immutable audit trail","ledger as source of truth"]},{q:"Design a search engine.",a:"Three systems: crawling (discover and fetch pages, politeness, dedupe), indexing (parse, tokenize, build the inverted index, plus auxiliary indexes for freshness and metadata), and serving (query parsing, ranking, and retrieval in milliseconds). Ranking is the product: relevance (BM25, embeddings), authority (PageRank-style), freshness, and personalization, trained on click feedback. Scale: the index is sharded by document, the query is broadcast and merged; hot queries are cached. Freshness adds the crawl-reindex loop.",kp:["crawler with politeness","inverted index","ranking relevance authority freshness","sharded index and query merge","click feedback loop","crawl reindex freshness"]},{q:"Design a globally distributed database with strong consistency where it matters.",a:"The design tension: strong consistency across regions costs latency. The answer is tiered: a consensus-based replicated core (Paxos/Raft) for the data that must be strongly consistent, with transaction routing that pins related operations to one region, and replication-based eventual consistency for the rest. Read-your-writes for the current session is the pragmatic middle ground. Failover: automatic leader election, with periodic DR drills validating RPO/RTO. The honest answer includes what you refuse to make strongly consistent because the latency cost isn't worth it.",kp:["consensus replication paxos raft","tiered consistency","transaction routing to region","read-your-writes sessions","automatic failover and drills","refuse consistency where it costs"]},{q:"Design a recommendation infrastructure at scale.",a:"Two stages at serving time: candidate generation (broad recall — item-item similarity, user embeddings, contextual rules) and ranking (a model scoring candidates on features from a feature store). The platform pieces: a feature store for consistent training/serving, an offline pipeline that trains on logs, an online pipeline that serves and logs new interactions, and an experimentation platform to A/B test. The loop is the product: recommendations learn from feedback, so the pipeline's freshness, latency, and logging quality matter more than any single model.",kp:["candidate generation and ranking","feature store consistency","offline training online serving","feedback loop logging","experimentation platform","freshness latency quality"]}],principal:[{q:"Design an event streaming platform like Kafka from first principles.",a:"The core abstraction is the log: an ordered, immutable, append-only sequence of records, partitioned for parallelism with per-partition ordering. Durability comes from replication (leader + ISR followers) with acks configurable from fire-and-forget to all. Consumers coordinate via consumer groups — each partition assigned to one consumer for ordering. The hard parts: retention and compaction, exactly-once semantics (transactional producers and consumer offsets), scaling (partition counts, broker limits), and operational concerns (rebalancing storms, disk layout, zookeeper/KRaft).",kp:["log as core abstraction","partitions with per-partition ordering","replication with ISR","consumer groups","retention and compaction","rebalancing and operations"]},{q:"Design a multi-tenant SaaS platform architecture.",a:"Separate control plane from data plane: the control plane handles onboarding, provisioning, billing, and configuration; the data plane runs tenant workloads. Isolation is a spectrum — shared infrastructure with strong logical isolation (multi-tenant compute, per-tenant namespaces) up to dedicated clusters for enterprises that demand it, priced accordingly. Metering and billing are their own pipeline (usage events → aggregation → invoices). The operational demands: onboarding automation, per-tenant quotas and noisy-neighbor control, and per-region compliance.",kp:["control plane data plane split","isolation spectrum and pricing","metering and billing pipeline","onboarding automation","per-tenant quotas","regional compliance"]},{q:"Design a platform serving 1B requests/day with 99.99% availability.",a:"Start with the SLO, because it defines everything: 99.99% is ~52 minutes of downtime a year, so design for redundancy at every layer — multiple zones, active-active regions where it pays, no single points of failure, and graceful degradation (feature shutdowns, cache fallbacks) that keeps the core alive when the periphery fails. Capacity planning with headroom, load testing to find limits, and automation for rollouts and rollbacks. The culture: error budgets, blameless postmortems, and game days, because availability is a property of the operating system, not just the code.",kp:["slo defines design","multi-zone redundancy","graceful degradation","capacity and load testing","automated rollback","error budget culture"]},{q:"Design the architecture for an AI assistant platform.",a:"Layers: a gateway that authenticates, routes, and guards every prompt; model serving (with a pool of models tiered by task and cost); retrieval-augmented generation with a vector store of the user's knowledge; and a context/prompt management layer that assembles the right context cheaply (prompt caching, compression). The hard engineering: cost and latency control (caching, model tiering, rate limits, streaming), safety and guardrails (prompt injection defenses, content filters, audit logs), and observability (cost per request, quality sampling, feedback collection).",kp:["gateway auth routing guards","model tiering by cost","retrieval augmented generation","prompt caching and compression","prompt injection defenses","cost observability per request"]}]},_d=[{q:"How would you build the engineering org as the company scales from 20 to 200 engineers?",a:"Sequence matters more than structure. At 20, keep teams flat and delivery-obsessed; hire senior leaders early (staff/principal engineers and tech leads) because they set the patterns everyone copies. Around 50+, organize into product-aligned teams with clear ownership, and add only the process that removes real pain — retros, on-call, design review — never process as decoration. Invest in the leadership pipeline (tech lead training) and a hiring engine that scales with you. The failure mode to avoid: over-hierarchizing early, or under-structuring late.",kp:["flat and delivery-focused early","hire senior leaders first","product-aligned teams","process for pain not decoration","leadership pipeline","avoid premature hierarchy"]},{q:"How do you set the technical vision and get the org behind it?",a:"A vision no one can explain is a hallucination. Start by aligning with the business: what must the technology make possible in 2-3 years? Write it as a short, concrete document — the bets, the tradeoffs, what we will NOT do — and socialize it relentlessly: town halls, one-on-ones, and early wins that prove the direction works. Make decision-making inclusive (senior voices disagreeing early), then decisive. Review the vision quarterly against reality; a vision that can't change is a dogma.",kp:["aligned to business goals","short concrete document","explicit tradeoffs and non-goals","socialize relentlessly","early proof wins","review and adapt quarterly"]},{q:"How do you think about build vs buy vs partner for core infrastructure?",a:"The lens is core vs context: if a capability is your competitive advantage, build it; if it's table stakes, buy or use managed services. Then the real math: total cost of ownership including operations and on-call (a 'free' open-source database you run yourself is rarely free), lock-in and exit costs, and your team's capacity to operate it. Timing matters: buy early to move fast, build once you understand the problem deeply — building what you don't understand is how you get a worse version of a product someone else sells.",kp:["core vs context competency","tco including operations","lock-in and exit costs","team capacity to operate","buy early build once understood","reversible decisions"]},{q:"How do you manage the engineering budget (headcount, cloud, tools)?",a:"Budget is strategy with numbers: start from business priorities, not last year plus 10%. Headcount: model productivity per engineer honestly (team size has diminishing returns — 10 great engineers beat 30 mediocre ones). Cloud cost: make it visible per team (tagging, showback) and attack structural waste — rightsizing, commitments, idle resources. Tools: audit what's actually used and kill the SaaS graveyard. The discipline: a monthly review of spend vs value, with the same rigor as revenue review. Frugality is a feature when it's about focus, not penny-pinching.",kp:["budget follows priorities","diminishing returns on headcount","cloud cost visibility per team","tool spend audit","monthly spend value review","frugality as focus"]},{q:"How do you ensure security and compliance without slowing delivery?",a:"The answer is risk-tiered controls and automation: secure defaults in frameworks and templates (paved roads), automated scanning in CI (SAST, dependencies, secrets) so security is a side effect of normal work, and human review reserved for genuinely high-risk changes. Compliance is automated where possible (evidence collection, policy-as-code) and mapped to what customers actually require — don't build for regulations you don't face. Security champions per team keep it human. The culture piece: security is everyone's job, and the security team measures friction and unblocks rather than blocks.",kp:["risk-tiered controls","automated scanning in CI","secure defaults paved roads","compliance automated and scoped","security champions","measure and reduce friction"]},{q:"How do you handle a major production incident as CTO?",a:"Your job in the first hour is presence, not diagnosis: confirm the facts, set the communication cadence (internal, customers, execs), and make sure the right people are working without interference. Let the engineers work — your role is removing obstacles, not hovering. After recovery, drive the postmortem culture: blameless analysis, action items with owners, and a public 'what we learned' that builds trust. The CTO-level question is systemic: what made this possible, and what structural change prevents the class of incident, not just this one?",kp:["presence and communication first","let experts work","removing obstacles","blameless postmortem","prevent the class not the instance","customer trust rebuilt"]},{q:"How do you hire and retain senior and staff engineers?",a:"Hiring: a compelling mission and real technical problems, a fast and respectful process, and senior people who interview well (candidates hire the team, not the logo). The bar: structured interviews calibrated across the org, and a hiring bar that's about judgment, not trivia. Retention is the harder half: meaningful work, a visible career path (what does 'staff' mean here?), technical challenges that grow, and a culture of respect — people leave managers and boredom more than compensation. Track retention by tenure and by reason, and treat attrition as a product problem.",kp:["compelling mission and problems","fast respectful process","structured calibrated bar","visible career paths","challenging meaningful work","retention as product problem"]},{q:"How do you measure engineering productivity and health?",a:"Start from outcomes, not vanity metrics: DORA (deploy frequency, lead time, change failure rate, MTTR) measures delivery, and developer satisfaction (surveys, eNPS) measures the experience. The traps: gaming metrics (cycle time that punishes hard work), and mistaking activity (PRs, hours) for productivity. Use metrics for diagnosis, not judgment — a slow team is usually blocked (dependencies, architecture, process) rather than lazy. And measure what the business feels: does engineering speed translate to business outcomes? That's the metric that matters to the CEO.",kp:["DORA delivery metrics","developer satisfaction surveys","diagnosis not judgment","outcomes over activity","find blockers not blame","business outcome correlation"]},{q:"How do you decide when to introduce a new technology?",a:"Problem first, technology second — a new tool without a named problem is a hobby. Run a spike or POC against real workloads (synthetic benchmarks lie), check operational readiness (can we run, monitor, and troubleshoot this at scale, and who owns it?), model the cost honestly including migration, and have an exit strategy. The org-wide rule: a small number of blessed technologies, with a lightweight exception process — not because one stack is objectively best, but because fragmentation is a tax everyone pays. And respect the adoption curve: the first team to adopt pays the integration cost; reward them.",kp:["problem first not technology","POC with real workloads","operational readiness and ownership","honest cost and exit strategy","blessed stacks with exceptions","reward early adopters"]},{q:"How do you work with the CEO and board on technical topics?",a:"Translation is the job: the CEO cares about outcomes, risk, and cost — not architecture. Report in business terms: what technology enables or blocks, what risks exist (and their probabilities and mitigations), and what investments cost and return. Be honest about timelines (underpromise), surface bad news early with options, and educate patiently — a board that understands your technical bets is an asset in a crisis. The cadence: regular, structured updates (monthly for the CEO, quarterly for the board) with metrics, not vibes.",kp:["translate tech to business outcomes","honest timelines and bad news early","risk framed with probabilities","regular structured cadence","educate the board","metrics not vibes"]},{q:"How would you approach the technical due diligence of an acquisition?",a:"The goal is knowing what you're buying and what it costs to integrate. Assess: architecture health (monolith vs modular, tech debt that blocks velocity), the security and compliance posture (a breach in your acquisition is your breach), key personnel (are the people who understand the system staying?), and integration cost (identity, data, CI/CD, culture). Score against a rubric and be honest about the deal-breakers. The post-acquisition plan matters as much as the assessment: what to keep, what to migrate, and what to decommission — most acquirers overpay for code they rewrite and underpay for the team.",kp:["architecture and tech debt","security and compliance posture","key personnel retention","integration cost identity data","deal-breaker honesty","post-acquisition plan"]},{q:"What does a great engineering culture look like, and how do you build it?",a:"Culture is the system of beliefs that survive when you're not in the room: psychological safety (people can raise problems and be wrong without punishment), blameless learning from failures, high standards enforced kindly, and ownership with trust. You build it by modeling it — the CTO's behavior is the culture — and by the decisions you make: how you react to a postmortem, whether you reward surfacing problems, who you promote. Codify the values, hire and fire for them, and revisit them as the org grows. Culture is built in small moments, not offsites.",kp:["psychological safety","blameless learning","high standards with kindness","ownership and trust","modeling from leadership","promote and hire for values"]}],Nd=[{q:"How do you evaluate a new market opportunity?",a:"The framework: market size and growth (is the pool big and growing?), the pain (how acute, how often, who feels it?), competition (is the wedge defensible — technology, network effects, brand?), unit economics (can the business model work at scale?), and timing (is the market ready — too early kills as surely as too late). Then the founder's question: why us, why now? The honest answer admits you can't validate a market from a spreadsheet — the evaluation ends with talking to real customers, not slides.",kp:["market size and growth","acute customer pain","defensible wedge","unit economics","timing readiness","validate with customers"]},{q:"How do you think about pricing strategy?",a:"Price is a product decision: it signals positioning, selects customers, and funds everything else. Start from value delivered (what does the customer's problem cost them?), not cost-plus — price to value, then verify with willingness-to-pay research and experiments. Anchor against the alternative (the status quo, the competitor), and think about the architecture: per-seat vs usage vs value-based tiers, with a free tier where it feeds adoption. The discipline: pricing is changeable, so instrument it (conversion, churn by plan) and iterate; leaving money on the table is a strategy too — for early adoption.",kp:["value-based not cost-plus","willingness to pay research","positioning and customer selection","tier architecture","experiment and iterate","pricing as product signal"]},{q:"How do you raise capital and manage investors?",a:"Raising is a story plus evidence: the market, the insight, the traction, and the team — told with a clear ask. Choose investors for the long game (value beyond money: network, hiring help, honesty), not just valuation; term sheets have teeth, so understand the terms (liquidation preference, board seats, pro-rata). Post-raise, treat investors as stakeholders to manage deliberately: honest monthly updates, early disclosure of problems, and a board that adds value. Runway discipline is the non-negotiable: know your burn, raise before you need to, and never let fundraising become the strategy.",kp:["story plus traction evidence","investors as long-term partners","understand term sheet terms","honest regular communication","board management","runway discipline"]},{q:"How do you set company strategy for the next 12 months?",a:"Strategy is choices: what to do AND what to explicitly not do. Start from the vision (3-5 years), then pick the few bets that move the needle this year — for a startup, usually one thing matters most (product-market fit, or the growth engine). Translate bets into OKRs with owners and metrics, allocate resources accordingly (including killing things), and set a review cadence (monthly at minimum) where strategy meets reality. The discipline is focus: a strategy that tries to do everything is a wish list.",kp:["choices including non-goals","vision to annual bets","few high-leverage priorities","OKRs with owners and metrics","resource allocation follows bets","monthly review against reality"]},{q:"How do you hire your first executives?",a:"Your first execs are co-founders in all but name: they define the company's DNA in their function. Look for complementary strengths (you're product-obsessed? hire the operator), values alignment you've verified in person, a track record at the right stage (a 10,000-person company exec often fails at 50), and reference checks that go beyond the list — call people they've worked for and people they've managed. Set clear mandates and success criteria for the first 90 days, integrate them deliberately (they're joining your culture, not just your company), and move fast if it's wrong — a bad exec hire is a two-year tax.",kp:["complementary strengths","values alignment verified","right stage experience","deep reference checks","90-day mandate","move fast on misfires"]},{q:"How do you build a company culture from day one?",a:"Culture forms whether you design it or not — the job is making it deliberate. Define a small number of real values (3-5, not a poster on the wall): what you reward, what you tolerate, what you fire for. Then live them visibly: the CEO's behavior is the strongest signal; hiring and firing for values is the second. Build the rituals early (all-hands, retros, decision cadence) because they compound. And be honest that culture is tested in bad times — how you handle a layoff or a scandal defines it more than any offsite.",kp:["few real values","values in hiring and firing","leadership models culture","rituals that compound","tested in bad times","deliberate not accidental"]},{q:"How do you make decisions when data is incomplete?",a:"The framework: separate reversible from irreversible decisions. For reversible ones, decide fast with the best available data and correct as you learn — speed is a feature, and you get feedback quickly. For irreversible ones, slow down: get the most decision-relevant information fast (customers, small experiments), name your assumptions explicitly, and put tripwires in place to detect when you're wrong. Own the decision either way. The failure mode to avoid is decision paralysis dressed as rigor — most companies die of hesitation, not wrong turns.",kp:["reversible vs irreversible","speed on reversible","fast relevant information","explicit assumptions","tripwires to detect error","own the outcome"]},{q:"How do you handle a crisis (product, PR, or financial)?",a:"The playbook: stabilize first (protect customers and operations), communicate early and honestly — silence is a message and it's usually the wrong one — and take ownership even where fault is shared. Put the best people on the fix with a clear owner and cadence, and protect the team's morale through it. Then the CEO-level work: learn systemically (what allowed this?), communicate the changes publicly, and rebuild trust deliberately — trust earned in crises outlasts the crisis itself. Never lie; a crisis found in a lie is a different, worse company.",kp:["stabilize and protect customers","communicate early and honestly","take ownership","clear owner and cadence","systemic learning","rebuild trust deliberately"]},{q:"How do you think about product-market fit and when to pivot?",a:"Product-market fit is measurable: retention (do users come back and stay?), willingness to pay, and the growth signal (word-of-mouth, organic). Define your fit metrics explicitly — for most products it's retention curves, not acquisition. When the data says no fit, pivot deliberately: keep what works (the insight, the team, the assets), change the what or the who, and re-test with a fast experiment. The failure modes: pivoting on vibes before the data is clear, and refusing to pivot because of sunk cost. Bias toward action either way — fit is found by iterating, not deliberating.",kp:["retention defines fit","willingness to pay","organic growth signal","deliberate pivot keeps insights","avoid sunk cost","iterate fast"]},{q:"How do you manage cash flow and burn?",a:"Cash is oxygen: you manage it weekly, not quarterly. Know your runway (cash / net burn) at all times, model scenarios (base, bad, terrible) and pre-decide the triggers for action at each level. Attack burn structurally, not with heroics: the biggest lines (headcount, infra) get the scrutiny. Revenue-side: shorten the cash conversion cycle (collect faster, bill better). Raise before you need to — the worst fundraising happens from desperation. And the discipline that matters: spending decisions get the same rigor as revenue decisions, which is rare and which is why most companies die of small leaks, not one big event.",kp:["runway tracked weekly","scenario planning with triggers","structural cost attack","shorten cash conversion cycle","raise before needed","spend rigor equals revenue rigor"]},{q:"How do you communicate with employees during uncertain times?",a:"Uncertainty is managed with honesty and cadence: say what you know, what you don't, and when you'll know more — employees fill silence with the worst-case story, so the cost of opacity is fear. Communicate in person or live where possible, repeat the message (people hear things once), and answer the hard questions directly, including the ones you'd rather avoid. Give the team agency: what they can control, and how they contribute. And remember the emotional dimension — empathy isn't weakness, and the team's trust in you is the company's real balance sheet during a storm.",kp:["honesty about unknowns","cadence beats silence","answer hard questions","repeat and clarify","give agency","empathy builds trust"]},{q:"What metrics would you track for a SaaS business?",a:"The scoreboard: ARR and its growth rate (headline), net revenue retention (the best single health metric — do customers expand?), gross margin (is the business model structurally sound?), CAC and the payback period, and logo churn with reasons. Behind the headline numbers: cohort retention curves (the future in miniature), usage and engagement (leading indicator of churn), and unit economics per segment. The discipline: a small dashboard of the metrics that drive decisions, reviewed weekly with the exec team — and a willingness to change what's on it as the company's stage changes.",kp:["arr and growth rate","net revenue retention","gross margin","cac payback and churn","cohort retention curves","usage as leading indicator"]}],ni=[...Ak,...qk];function It(n){return ni.find(i=>i.id===n)}function fl(n){const i=n.slice();for(let r=i.length-1;r>0;r--){const o=Math.floor(Math.random()*(r+1));[i[r],i[o]]=[i[o],i[r]]}return i}function Re(n,i){return i<=0?[]:fl(n).slice(0,Math.min(i,n.length))}const Ek=new Set("a an the and or but if of to in on at for with from by as is are was were be been being it its this that these those do does did done has have had i you he she we they them their your my our his her not no can could will would should may might must shall than then so such there here what which who whom when where why how all any both each few more most other some only own same very just about into over under up out off above below again once also too keep let make made using use used want would go get got put take takes going things thing way ways one two new good bad much many come comes going s t re ve".split(" "));function ml(n){return String(n||"").toLowerCase().replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(i=>i.length>1&&!Ek.has(i)&&!/^\d+$/.test(i))}function Ck(n){return n.length>6&&n.endsWith("ing")?n.slice(0,-3):n.length>5&&n.endsWith("ed")?n.slice(0,-2):n.length>4&&n.endsWith("ies")?n.slice(0,-3)+"y":n.length>3&&n.endsWith("s")&&!n.endsWith("ss")?n.slice(0,-1):n}function ei(n){const i=new Set;for(const r of ml(n)){const o=Ck(r);o.length>3&&!/^\d+$/.test(o)&&i.add(o)}return i}const Fy=[["deep linking","deep-link"],["deep link","deep-link"],["big o","big-o"],["time complexity","time-complexity"],["space complexity","space-complexity"],["call stack","call-stack"],["task queue","task-queue"],["event loop","event-loop"],["async await","async-await"],["state management","state-management"],["global state","global-state"],["lifting state","lifting-state"],["virtual dom","virtual-dom"],["re render","re-render"],["dependency array","dependency-array"],["screen reader","screen-reader"],["keyboard navigation","keyboard-navigation"],["semantic html","semantic-html"],["focus management","focus-management"],["reduced motion","reduced-motion"],["responsive design","responsive-design"],["mobile first","mobile-first"],["fluid layout","fluid-layout"],["type system","type-system"],["static typing","static-typing"],["type inference","type-inference"],["union types","union-types"],["lexical scope","lexical-scope"],["lexical scoping","lexical-scope"],["pure function","pure-function"],["pure functions","pure-function"],["design pattern","design-pattern"],["design patterns","design-pattern"],["strategy pattern","strategy-pattern"],["observer pattern","observer-pattern"],["status code","status-code"],["status codes","status-code"],["real time","real-time"],["server sent events","sse"],["memory leak","memory-leak"],["memory leaks","memory-leak"],["garbage collection","garbage-collection"],["race condition","race-condition"],["race conditions","race-condition"],["linked list","linked-list"],["linked lists","linked-list"],["hash map","hash-map"],["hash maps","hash-map"],["hash table","hash-table"],["hash tables","hash-table"],["binary search","binary-search"],["sliding window","sliding-window"],["brute force","brute-force"],["divide and conquer","divide-and-conquer"],["dynamic programming","dynamic-programming"],["two pointers","two-pointers"],["two pointer","two-pointers"],["feature flag","feature-flag"],["feature flags","feature-flag"],["load balancer","load-balancer"],["load balancing","load-balancing"],["message queue","message-queue"],["message queues","message-queue"],["event driven","event-driven"],["event stream","event-stream"],["eventual consistency","eventual-consistency"],["strong consistency","strong-consistency"],["high availability","high-availability"],["unit test","unit-test"],["unit tests","unit-test"],["integration test","integration-test"],["integration tests","integration-test"],["test coverage","test-coverage"],["circuit breaker","circuit-breaker"],["graceful degradation","graceful-degradation"],["code splitting","code-splitting"],["lazy loading","lazy-loading"],["tree shaking","tree-shaking"],["data model","data-model"],["data modeling","data-model"],["foreign key","foreign-key"],["primary key","primary-key"],["search engine","search-engine"],["full text search","full-text-search"],["machine learning","machine-learning"],["cross functional","cross-functional"],["micro services","microservices"],["micro service","microservices"],["high level","high-level"],["low level","low-level"],["authentication","authentication"],["single page","single-page"],["short term","short-term"],["long term","long-term"]],Lk=Object.fromEntries(Fy),Dk=new RegExp("\\b("+Fy.map(n=>n[0]).sort((n,i)=>i.length-n.length).join("|")+")\\b","g");function Ok(n){return String(n||"").toLowerCase().replace(Dk,i=>Lk[i]??i)}const vr={routing:["routing","router","routes","route","navigation","navigate","navigating","deep-link","url","uri","deep linking"],caching:["caching","cache","cached","memoize","memoization","memoized","invalidation","invalidate","ttl","expiry"],complexity:["complexity","big-o","asymptotic","time-complexity","space-complexity","runtime"],closure:["closure","closures","lexical scope","lexical-scope","scope chain","scoping"],hoisting:["hoisting","hoisted","hoist"],eventloop:["event-loop","call-stack","task-queue","microtask","microtasks","macrotask","macrotasks","async","async-await","promise","promises","await","callback","callbacks"],state:["state","stateful","state-management","store","stores","redux","zustand","context","global-state","lifting-state","stateful"],component:["component","components","props","render","renders","rendering","re-render","re-renders","virtual-dom","vdom","jsx","mount","unmount","lifecycle","effect","effects","dependency-array","cleanup"],security:["security","authentication","authorization","auth","jwt","oauth","xss","csrf","injection","sanitize","sanitization","encryption","encrypt"],database:["database","databases","db","sql","nosql","index","indexes","indexing","query","queries","transaction","transactions","schema","schemas","normalization","denormalization","denormalize","shard","sharding","replica","replicas","replication","foreign-key","primary-key","relational"],scaling:["scaling","scale","scalability","throughput","latency","horizontal","vertical","load","capacity"],availability:["availability","uptime","failover","redundancy","high-availability","redundant"],consistency:["consistency","consistent","eventual-consistency","strong-consistency","acid","cap theorem"],messaging:["messaging","message-queue","message-queues","queue","queues","kafka","rabbitmq","pub-sub","pubsub","message broker","event-driven","event-stream","streaming","backpressure"],testing:["testing","test","tests","unit-test","unit-tests","integration-test","integration-tests","e2e","tdd","mock","mocks","stub","stubs","test-coverage","regression","regressions","assertion","assertions"],observability:["observability","monitoring","metrics","logging","logs","tracing","trace","traces","alerting","alerts","dashboards","telemetry"],resilience:["resilience","error handling","errors","exception","exceptions","retry","retries","backoff","circuit-breaker","circuit breaker","fallback","fallbacks","graceful-degradation","graceful degradation","idempotency","idempotent","timeout","timeouts","bulkhead","rate limiting","rate limit"],splitting:["code-splitting","lazy-loading","lazy-load","split","splitting","splitter","bundle","bundles","bundling","tree-shaking","chunk","chunks"],accessibility:["accessibility","a11y","aria","screen-reader","keyboard-navigation","semantic-html","contrast","focus-management","reduced-motion","landmark","landmarks"],responsive:["responsive","responsive-design","mobile-first","breakpoint","breakpoints","fluid-layout","adaptive"],typing:["typing","types","type-system","typescript","static-typing","generics","type-inference","union-types","structural typing"],immutability:["immutability","immutable","mutation","mutations","mutating","pure-function","pure-functions","side effect","side effects"],performance:["performance","profiling","profiler","bottleneck","bottlenecks","optimization","optimize","optimizing","benchmark","benchmarks","web vitals","lcp","inp","cls"],patterns:["patterns","design-pattern","design-patterns","factory","singleton","strategy-pattern","observer-pattern","adapter","decorator","composition","inheritance","interface","creational","structural","behavioral"],api:["api","apis","rest","http","endpoint","endpoints","webhook","webhooks","graphql","status-code","status-codes","idempotency","pagination","versioning","crud"],realtime:["real-time","websocket","websockets","sse","realtime"],storage:["storage","localstorage","sessionstorage","cookies","indexeddb","persistence","persist","persisting","durable"],memory:["memory","memory-leak","memory-leaks","garbage-collection","garbage collector","allocation","heap"],concurrency:["concurrency","concurrent","parallel","parallelism","race-condition","race-conditions","deadlock","deadlocks","locking","lock","locks","mutex","semaphore","thread","threads","multithreading","multi-threading"],structures:["array","arrays","hash-map","hash-maps","hash-table","hash-tables","dictionary","linked-list","linked-lists","stack","tree","trees","graph","graphs","binary-search","sorting","sort","traversal","dfs","bfs","recursion","recursive","heap","heaps","queue","queues","data structures","data-structure"],algorithms:["algorithm","algorithms","brute-force","two-pointers","sliding-window","divide-and-conquer","dynamic-programming","greedy","backtracking","big-o","complexity"],leadership:["leadership","lead","leading","mentor","mentoring","vision","roadmap","roadmaps","hiring","influence","stakeholder","stakeholders","alignment"],communication:["communication","communicate","communicating","presenting","presentation","feedback","collaboration","cross-functional","listening"],agile:["agile","scrum","kanban","sprint","sprints","standup","retrospective","velocity","estimation","estimating","backlog"],devops:["devops","ci","cd","pipeline","pipelines","deployment","deploy","deploying","release","releases","rollback","canary","feature-flag","feature-flags","docker","kubernetes","k8s","container","containers","orchestration","infrastructure"],cloud:["cloud","aws","azure","gcp","serverless","lambda","load-balancer","load-balancing","cdn","edge","instance","instances"],modeling:["modeling","data-model","data-modeling","entity","entities","relations","relationship","relationships","foreign-key","primary-key"],search:["search","search-engine","ranking","relevance","full-text-search","tokenizer","inverted index"],ml:["machine-learning","ml","model training","training data","inference","embeddings","vector","vectors","llm","llms","rag","prompt","prompts","fine-tuning"],async:["async","await","callback","callbacks","event-loop","microtask","microtasks","promise","promises","non-blocking","nonblocking"],architecture:["architecture","architectural","system design","high-level design","component diagram","data flow","service diagram","whiteboard","design a"],"cap-theorem":["cap theorem","consistency","availability","partition tolerance","pacelc"],sharding:["sharding","shard","partitioning","partition","hash ring","consistent hashing","range partitioning","shard key"],replication:["replication","replica","leader","follower","master","slave","quorum","raft","paxos","replication lag"],"message-queue":["kafka","rabbitmq","sqs","pub-sub","event-driven","event sourcing","cqrs","message broker","backpressure"],"load-balancing":["load balancer","load balancing","round robin","least connections","cdn","reverse proxy","gateway"],microservices:["microservices","service mesh","api gateway","service discovery","sidecar","istio","grpc","service-to-service"],containerization:["docker","kubernetes","k8s","container","orchestration","pod","deployment","helm","terraform"]},tl={};function Vy(){for(const n of Object.keys(tl))delete tl[n];for(const[n,i]of Object.entries(vr))for(const r of i)tl[r]=n}Vy();function zk(n){return vr[n]??[]}function Hn(n){const i=new Set;for(const r of ml(Ok(n))){const o=tl[r];o&&i.add(o)}return i}function Id(n,i){const r=Hn(n);let o=0;for(const u of Hn(i))r.has(u)&&o++;return o}function Jy(n,i){const r=Hn(n),o=Hn(i);if(o.size&&r.size){let p=0;for(const f of o)r.has(f)&&p++;if(p>0&&(o.size<=1||p>=2))return!0}const u=ei(n),d=ei(i);for(const p of u)if(d.has(p))return!0;return!1}function Wy(n,i,r=""){const o=[],u=[],d=[],p=Id(r,n)>0;for(const m of i??[])m&&(Jy(n,m)?o.push(m):p?u.push(m):d.push(m));const f=Math.max(1,(i??[]).length);return{covered:o,partial:u,missing:d,pct:(o.length+.5*u.length)/f}}function jk(n,i,r=""){const o=n.join(" ");return Wy(o,i,r)}const Mk={junior:40,mid:60,senior:80,staff:100,principal:120,cto:110,ceo:80},Rk=/\b(for example|e\.g\.|for instance|such as|in practice|in production|say we|imagine|let'?s say|like when|take a|case study)\b|`|=>|function\s*\(/i,_k=/\b(trade-?offs?|pros? and cons?|downside|downsides|benefit|benefits|at the expense of|cheaper|faster but|slower but|however|but it'?s (more|less|at)|weigh)\b/i,Nk=/\b(first|second|third|then|next|finally|lastly|step|approach|option|on the other hand|alternatively|alternate)\b/i;function Ik(n,i){const r=ml(n).length,o=Mk[i??"mid"]??60;return{words:r,expected:o,example:Rk.test(n),tradeoffs:_k.test(n),structured:Nk.test(n),vocab:Hn(n).size}}const Bd=[{re:/closures? (are|is|come|comes|happen|due|about|because of).{0,40}hoist/i,correction:"Not quite — closures come from lexical scope, not hoisting. Hoisting moves declarations; a closure captures the surrounding scope so the function remembers it later. They're related language features, but the mechanism is scope, not hoisting."},{re:/cache invalidat\w+ is (easy|simple|trivial)|just clear the cache/i,correction:"Careful — cache invalidation is famously the hard part of caching (the two-hard-things joke exists for a reason). The robust answer names a strategy: versioned keys, TTLs, write-through vs write-behind, or event-driven invalidation — not 'just clear it'."},{re:/settimeout (is|guarantee|always) (a|exact|promise)|settimeout.{0,20}promise/i,correction:"setTimeout is not a promise and gives no exact-time guarantee — it queues a callback for at least N ms after the current work. Promises have their own microtask queue that drains before timers. Mixing them up is a classic trap interviewers probe."},{re:/== and === (are|is) (the|basically|pretty much) (same|identical)|double equals.{0,30}same/i,correction:"== and === are not the same — == coerces types before comparing (so '5' == 5 is true) while === requires the same type. In modern codebases the rule is: use === and let the linter enforce it."},{re:/event loop runs on (multiple|several|many|parallel) threads|js (is|uses) multi-?thread/i,correction:"JavaScript's event loop is single-threaded — one call stack. What's concurrent is the async I/O (workers, the browser's network thread) that *feeds* callbacks back to that one thread. Workers give you real parallelism, but the main thread is still one."},{re:/(microtasks?|promises?) (run|fire|execute|drain) (after|following) (macro)?(tasks?|timers?)/i,correction:"Order is the opposite: microtasks (promise .then / queueMicrotask) drain BEFORE the next macrotask (setTimeout). So a promise scheduled inside a timer callback still runs before the *next* timer fires."},{re:/first.{0,30}(shard|sharding)|just (add|spin up) (more|many) servers/i,correction:"Scale in order of complexity: read replicas and caching first, denormalization second, sharding only when the simpler levers are exhausted — sharding adds real operational complexity (resharding, hot keys, cross-shard queries)."},{re:/nosql is (always|just) (faster|better than sql)/i,correction:"NoSQL isn't 'faster' — it's a different consistency/query trade-off. A relational store with the right index often beats a document store for joins and range queries. The honest answer compares the access patterns, not the brand."},{re:/typescript types (are|get) (checked|enforced) at runtime|types are checked at runtime/i,correction:"TypeScript types are erased at compile time — there are no runtime checks. Validation still needs runtime guards (zod, io-ts, or manual checks). Saying types are checked at runtime is the exact kind of claim an interviewer will push on."},{re:/useeffect (runs|fires) after every render.{0,30}(no matter|regardless|always)/i,correction:"useEffect runs after render, but only when its dependency array changes (or on mount, or when deps are omitted). The trap is deps: missing a dependency causes stale closures; adding unstable ones causes re-run loops."},{re:/css is not a (programming|real) language|html is not a language/i,correction:"CSS is Turing-complete and HTML is a markup language — the 'not a language' take is a joke, not an interview answer. The substance: CSS is declarative, and the interesting questions are specificity, cascade, and layout."},{re:/rest is (always|automatically) (better|worse) than graphql|graphql is always better/i,correction:"Neither is universally better — REST wins on caching, simplicity and long-lived public APIs; GraphQL wins on client-driven shapes and reducing over-fetching. The strong answer picks by the access patterns, not the brand."},{re:/agile means no (planning|documentation|process)/i,correction:"Agile isn't 'no planning' — it's planning in smaller loops with feedback. The manifesto values working software and responding to change, not abandoning docs or process."},{re:/blockchain (is|solves) everything|blockchain is (the answer|perfect)/i,correction:"Blockchain is a distributed-consensus ledger with real costs (throughput, energy, complexity). Most problems are better solved with a normal database — the interview answer should name what blockchain actually guarantees and when it's worth it."}];function Bk(n){for(const i of Bd)if(i.re.test(n))return i.correction;return null}for(const[n,i]of Object.entries(vr))[...i];Bd.slice();function Ud(n){if(n){for(const[i,r]of Object.entries(n.families??{}))!Array.isArray(r)||!r.length||(vr[i]=[...new Set([...vr[i]??[],...r])]);Vy();for(const i of n.misconceptions??[])if(i&&typeof i.re=="string"&&i.re&&i.correction)try{Bd.push({re:new RegExp(i.re,"i"),correction:i.correction})}catch{}}}const Uk=/^(hi|hello|hey|yo|good (morning|afternoon|evening))[.!]*$/i,Hk=/^(thanks|thank you|great|got it|understood|makes sense|awesome|perfect|nice)[.!]*$/i,Pk=/\b(grade|score|rate|mark|evaluate|assess|how (did|well) (i|did)|coverage)\b/i,Gk=/\b(hint|stuck|clue|nudge|help me (start|begin)|i don'?t know|can'?t figure|no idea|give me a (way|start|push))\b/i,Yk=/\b(compare|difference|differences|vs\.?|versus|which is better|better than|how does .{0,40} differ)\b/i,Qk=/\b(explain|how does|how do|how would|what is|what'?s|what are|why (does|is|do|would)|walk me through|tell me about)\b/i,Kk=/\b(disagree|not sure|isn'?t|wrong|debate|objection|however|but (i|what|that|my|the)|actually (i|that|my)|i think that'?s (wrong|not))\b/i,Fk=/\b(i'?ll|i will|i would|i'?d|i can|i could|i plan|i'?m going|i am going|i decided|i use|i used|i chose|i prefer|i think|i did|my approach|my solution|my answer|what about|this is how|here'?s (my|how)|i have|i'?ve)\b/i,Vk=/\b(suggest|recommend).{0,30}(next|problem|practice)|what should i (do|practice|study|focus)|next problem|keep going|what next|continue|what'?s next\b/i;function $y(n){const i=String(n||"").trim();return i?i.split(/\s+/).length<=4&&Uk.test(i)?"greeting":i.split(/\s+/).length<=5&&Hk.test(i)?"thanks":Pk.test(i)?"grade":Gk.test(i)?"hint":Yk.test(i)?"compare":Kk.test(i)?"debate":Qk.test(i)?"explain":Fk.test(i)?"approach":Vk.test(i)?"next":"other":"other"}const Jk=new Set("a an the and or but if of to in on at for with from by as is are was were be been being it its this that these those do does did done has have had i you he she we they them their your my our his her not no can could will would should may might must shall than then so such there here what which who whom when where why how all any both each few more most other some only own same very just about into over under up out off above below again once also too".split(" "));function on(n){return String(n||"").toLowerCase().replace(/[^a-z0-9\s-]/g," ").split(/[\s-]+/).filter(i=>i.length>1&&!Jk.has(i))}const Wk=n=>on(n).filter(i=>i.length>2),Mg=n=>n.length>6&&n.endsWith("ing")?n.slice(0,-3):n.length>5&&n.endsWith("ed")?n.slice(0,-2):n.length>4&&n.endsWith("ies")?n.slice(0,-3)+"y":n.length>3&&n.endsWith("s")&&!n.endsWith("ss")?n.slice(0,-1):n;function Hd(n,...i){const r=new Set(on(n).map(Mg).filter(o=>o.length>3));if(!r.size)return!1;for(const o of i)for(const u of on(o).map(Mg))if(u.length>3&&r.has(u))return!0;return!1}function Pd(n,i){const o=on(n).length;let u=0;const d=[],p=[];for(const L of i.kp??[]){const O=Wk(L);if(!O.length)continue;O.length>0&&Jy(n,L)?(u++,d.push(L)):p.push(L)}const f=Math.max(1,i.kp.length),m=u/f,y=Math.min(1,o/30),x=m*.75+y*.25;let k=Math.round(1+x*4);return(!n||!n.trim())&&(k=0),k=Math.max(0,Math.min(5,k)),{score:k,pct:x,covered:d,missed:p,words:o}}function bd(n,i,r){if(r<=0||!n.length)return[];const o=new Set(i.flatMap(d=>on(d)));if(!o.size)return Re(n,r);const u=n.map(d=>{const p=on(d.q+" "+(d.a??"")+" "+(d.kp??[]).join(" "));let f=0;for(const m of p)o.has(m)&&f++;return{q:d,hit:f}});return u.sort((d,p)=>p.hit-d.hit||Math.random()-.5),u.slice(0,Math.min(r,u.length)).map(d=>d.q)}const mt={productName:"InterviewIQ",tagline:"AI Interview Coach",supportEmail:"gaurav.123337@gmail.com",ownerEmail:"gaurav.123337@gmail.com",repoUrl:"https://github.com/gaurav123337/interviewiq",proUrl:"",payment:{provider:"razorpay"},teamProUrl:"",features:{paywall:!0,testLicensing:!0},supabase:{url:"https://ndrusywvceojsoirhkhl.supabase.co",anonKey:"sb_publishable_KL1mXNkhOnu8gYqCgMpf7A_3ue6dabe"}},H={onboard:"iq.onboard",settings:"iq.settings",sessions:"iq.sessions",apiKey:"iq.apiKey",apiBase:"iq.apiBase",apiModel:"iq.apiModel",tier:"iq.tier",usage:"iq.usage",licenseKey:"iq.licenseKey",notifPrefs:"iq.notifPrefs",notifLast:"iq.notifLast",drillSrs:"iq.drillSrs",syncMeta:"iq.syncMeta",goal:"iq.goal",skills:"iq.skills",roadmapProg:"iq.roadmapProg",theme:"iq.theme",notifLastWeekly:"iq.notifLastWeekly",ragAlertWeek:"iq.ragAlertWeek",ragDigestWeek:"iq.ragDigestWeek",ragGapNotif:"iq.ragGapNotif",code:"iq.code",uiCode:"iq.uiCode",codingTrack:"iq.codingTrack",remoteConfig:"iq.remoteConfig",career:"iq.career",resume:"iq.resume",shortlist:"iq.shortlist",jobs:"iq.jobs",jobsRefreshedAt:"iq.jobsRefreshedAt",gapPlans:"iq.gapPlans",applyKit:"iq.applyKit",lastKit:"iq.lastKit",lastCompare:"iq.lastCompare",applyTrack:"iq.applyTrack",questionBank:"iq.questionBank",announcements:"iq.announcements",publishedQ:"iq.publishedQ",announceSeen:"iq.announceSeen",eventOutbox:"iq.eventOutbox",profileStats:"iq.profileStats",feedbackVotes:"iq.feedbackVotes",coachTopics:"iq.coachTopics",playgroundFocus:"iq.playgroundFocus",feedPageSize:"iq.feedPageSize",resumeStrictBanner:"iq.resumeStrictBanner",displayCurrency:"iq.displayCurrency",resourcesPersonal:"iq.resources.personal",resourcesApproved:"iq.resources.approved",catalogVersion:"iq.catalogVersion",trendSignals:"iq.trendSignals",counselorPlan:"iq.counselorPlan",counselorProgress:"iq.counselorProgress",externalApplyHint:"iq.externalApplyHint",moduleModels:"iq.moduleModels",sysDesignProgress:"iq.sysDesignProgress",sysDesignQuiz:"iq.sysDesignQuiz",sysDesignHistory:"iq.sysDesignHistory",sysDesignBookmarks:"iq.sysDesignBookmarks",sysDesignFlashcards:"iq.sysDesignFlashcards",sysDesignTimer:"iq.sysDesignTimer",skillRoadmaps:"iq.skillRoadmaps",skillRoadmapCache:"iq.skillRoadmapCache"};function ne(n,i){try{const r=localStorage.getItem(n);return r==null?i:JSON.parse(r)}catch{return i}}function oe(n,i){localStorage.setItem(n,JSON.stringify(i)),Xy(n)}function ns(n){localStorage.removeItem(n),Xy(n)}const vd=new Set;function $k(n){return vd.add(n),()=>{vd.delete(n)}}function Xy(n){for(const i of vd)try{i(n)}catch{}}function VA(n){const i=Pn().resumeBranding??{},r=Object.keys(i).find(o=>o.toLowerCase()===n.toLowerCase());return r?i[r]??{}:i._default??{}}const Xo={features:{},ai:{},limits:{},companyFreq:{},rag:{}};function Pn(){const n=ne(H.remoteConfig,Xo);return{features:{...Xo.features,...(n==null?void 0:n.features)??{}},ai:{...Xo.ai,...(n==null?void 0:n.ai)??{}},limits:{...Xo.limits,...(n==null?void 0:n.limits)??{}},companyFreq:{...(n==null?void 0:n.companyFreq)??{}},coachVocab:n==null?void 0:n.coachVocab,rag:{...(n==null?void 0:n.rag)??{}},policies:{...(n==null?void 0:n.policies)??{}},jobs:n==null?void 0:n.jobs,resumeBranding:{...(n==null?void 0:n.resumeBranding)??{}}}}function Xk(n){oe(H.remoteConfig,n),Ud(n.coachVocab)}function cr(n){return Pn().features[n]!==!1}function Zk(){return cr("paywall")}const wd={sessionsPerMonth:3,aiPerDay:5};function Zy(){const{limits:n}=Pn();return{sessionsPerMonth:n.sessionsPerMonth??wd.sessionsPerMonth,aiPerDay:n.aiPerDay??wd.aiPerDay}}function as(){const{ai:n}=Pn();return{model:n.model,embeddingsModel:n.embeddingsModel,maxTokens:n.maxTokens,temperature:n.temperature,moduleDefaults:n.moduleDefaults}}function gl(){return{...Pn().rag??{}}}function eb(){return Pn().ai.enabled!==!1}function ex(){return ne(H.announcements,[])}function tx(n){oe(H.announcements,n)}function tb(){return ne(H.announceSeen,[])}function nx(n){const i=tb();i.includes(n)||oe(H.announceSeen,[...i,n])}function Rg(){const n=tb();return ex().filter(r=>r.published&&!n.includes(r.id)).sort((r,o)=>o.createdAt-r.createdAt)[0]??null}function ax(){return ne(H.publishedQ,[])}function ix(n){oe(H.publishedQ,n)}function yl(n,i){return ax().filter(r=>r.published&&r.fieldId===n&&r.level===i).map(r=>({q:r.question,a:r.answer,kp:r.keyPoints}))}const rl={company:{label:"Company Fit",color:"#6366f1"},field:{label:"Technical",color:"#22d3ee"},behavioral:{label:"Behavioral",color:"#34d399"},sysdesign:{label:"System Design",color:"#a855f7"},cto:{label:"Leadership",color:"#fbbf24"},ceo:{label:"Business",color:"#fb7185"}};function sx({fieldId:n,companyId:i,levelId:r,count:o,mode:u}){const d=It(n),p=hl(i),f=Tt(r),m=vn[f.id],y=[],x=new Set,k=(T,G,N,I)=>{!T||x.has(T.q)||(x.add(T.q),y.push({...T,cat:G,catLabel:rl[G].label,catColor:rl[G].color,level:N,src:I}))},L=T=>[...(d==null?void 0:d.questions[T])??[],...yl(n??"",T)],O=(T,G)=>Re(L(T),G);if(u==="behavioral")Re(ga,Math.min(o,ga.length)).forEach(T=>k(T,"behavioral",r??"mid","behavioral"));else if(r==="cto")Re(p.sample,2).forEach(T=>k(T,"company","cto","company")),Re(_d,2).forEach(T=>k(T,"cto","cto","cto")),Re(ga,1).forEach(T=>k(T,"behavioral","cto","behavioral")),O("principal",2).forEach(T=>k(T,"field","principal","field")),O("staff",1).forEach(T=>k(T,"field","staff","field")),Re(hr.principal??[],1).forEach(T=>k(T,"sysdesign","principal","sysdesign"));else if(r==="ceo")Re(p.sample,2).forEach(T=>k(T,"company","ceo","company")),Re(Nd,3).forEach(T=>k(T,"ceo","ceo","ceo")),Re(ga,1).forEach(T=>k(T,"behavioral","ceo","behavioral")),O("principal",1).forEach(T=>k(T,"field","principal","field"));else if(u==="journey"){const T=Math.max(1,m);for(let G=0;G<o;G++){const N=G/Math.max(1,o-1),I=an[Math.max(0,Math.round(N*T))].id,Y=(d==null?void 0:d.questions[I])??[];k(Y[Math.floor(Math.random()*Y.length)],"field",I,"field")}m>=3&&Re(hr.senior??[],1).forEach(G=>k(G,"sysdesign","senior","sysdesign")),Re(ga,1).forEach(G=>k(G,"behavioral",r??"junior","behavioral")),p.sample.length&&Re(p.sample,1).forEach(G=>k(G,"company",r??"junior","company"))}else{const T=o,G=p.sample.length?Math.max(1,Math.round(T*.3)):0,N=Math.max(1,T-G-1),I=m>=1&&m<=4?Math.max(0,Math.min(1,Math.round(T*.12))):0;Re(p.sample,Math.min(G,p.sample.length)).forEach(Y=>k(Y,"company",r??"junior","company")),O(r??"junior",N).forEach(Y=>k(Y,"field",r??"junior","field")),Re(ga,1).forEach(Y=>k(Y,"behavioral",r??"junior","behavioral")),I&&Re(hr[m===1?"mid":m===2?"senior":m===3?"staff":"principal"]??[],1).forEach(F=>k(F,"sysdesign",r??"junior","sysdesign")),(m===2||m===3)&&o>=8&&O(an[m+1].id,1).forEach(Y=>k(Y,"field",an[m+1].id,"field"))}return{questions:fl(y).sort((T,G)=>vn[T.level]-vn[G.level]).slice(0,o),meta:{field:(d==null?void 0:d.name)??"General",fieldId:(d==null?void 0:d.id)??"general",company:p.name,companyId:p.id,level:f.name,levelId:f.id,mode:u}}}function Gd({fieldId:n,companyId:i,levelId:r,keywords:o,count:u,mode:d="standard"}){const p=It(n),f=hl(i),m=Tt(r),y=vn[m.id],x=[],k=new Set,L=(N,I,Y,F)=>{!N||k.has(N.q)||(k.add(N.q),x.push({...N,cat:I,catLabel:rl[I].label,catColor:rl[I].color,level:Y,src:F}))},O=(N,I)=>bd([...(p==null?void 0:p.questions[N])??[],...yl(n??"",N)],o,I),_=f.sample.length?Math.max(1,Math.round(u*.25)):0,T=Math.max(2,u-_-1);return Re(f.sample,Math.min(_,f.sample.length)).forEach(N=>L(N,"company",m.id,"company")),O(m.id,T).forEach(N=>L(N,"field",m.id,"field")),Re(ga,1).forEach(N=>L(N,"behavioral",m.id,"behavioral")),y>=1&&y<=4&&Re(hr[y===1?"mid":y===2?"senior":y===3?"staff":"principal"]??[],1).forEach(I=>L(I,"sysdesign",m.id,"sysdesign")),u>=8&&y<an.length-1&&O(an[y+1].id,1).forEach(N=>L(N,"field",an[y+1].id,"field")),{questions:fl(x).sort((N,I)=>vn[N.level]-vn[I.level]).slice(0,u),meta:{field:(p==null?void 0:p.name)??"General",fieldId:(p==null?void 0:p.id)??"general",company:f.name,companyId:f.id,level:m.name,levelId:m.id,mode:d}}}const rx=/\b(when i was|in my|at my|during|my team|my role was|the project|the situation|i worked on|back when|in a previous)\b/i,ox=/\b(i needed to|my goal|the task|my task was|i was tasked|assigned to|i was responsible|i had to|my objective|i was asked to|the challenge was|i owned)\b/i,lx=/\b(i (did|built|led|created|introduced|changed|implemented|designed|wrote|shipped|drove|refactored|negotiated|hired|launched|fixed|improved|reduced|started|organized|mentored|taught|automated)|we (built|shipped|launched|implemented))\b/i,cx=/\b(result|outcome|as a result|because of this|led to|in the end|it worked|the impact|increased|decreased|reduced|improved|grew|saved|converted|adopted|learned|what i (learned|took away))\b/i,ur=[{id:"S",label:"Situation",re:rx,hint:"Set the scene — when and where, with enough context that the interviewer can follow the story."},{id:"T",label:"Task",re:ox,hint:"Name your goal or responsibility — what you were trying to accomplish."},{id:"A",label:"Action",re:lx,hint:"Describe YOUR actions in first person with specifics — what you did, not what the team vaguely did."},{id:"R",label:"Result",re:cx,hint:"Quantify the outcome — numbers, adoption, time saved — and what you learned."}];function ux(n){const i=String(n||"").trim(),r=i.split(/\s+/).filter(Boolean).length,o=ur.filter(L=>L.re.test(i)).map(L=>L.id),u=ur.filter(L=>!L.re.test(i)).map(L=>L.id),d=ur.filter(L=>L.re.test(i)),p={S:1,T:1,A:2,R:2},f=ur.reduce((L,O)=>L+p[O.id],0),m=d.reduce((L,O)=>L+p[O.id],0),y=Math.min(1,r/70),x=m/f*.85+y*.15;let k=Math.round(1+x*4);return i||(k=0),k=Math.max(0,Math.min(5,k)),{score:k,pct:x,present:o,missing:u,words:r}}const dx={junior:"At junior level, showing a clear, correct reasoning process matters more than perfect answers.",mid:"At mid level, interviewers want structured answers: approach, implementation, and tradeoffs.",senior:"At senior level, lead with the tradeoffs — interviewers are evaluating judgment, not just correctness.",staff:"At staff level, connect your answer to org-level impact: leverage, risk, and how the decision scales.",principal:"At principal level, frame answers around org-wide strategy and high-leverage bets.",cto:"At CTO level, answers should land in business terms: cost, risk, people, and outcomes.",ceo:"At CEO level, everything ties back to strategy, markets, and the people who execute it."};function px(n,i){const r=ux(n),o=[],u=[];r.present.includes("S")&&o.push("You set the scene — the situation is concrete and easy to follow."),r.present.includes("T")&&o.push("You named your task or goal — what you were responsible for."),r.present.includes("A")&&o.push("You described your actions in first person — specific and ownable."),r.present.includes("R")&&o.push("You closed with a result — impact, outcome, or a lesson learned."),o.length||o.push("You engaged with the question — now let's structure it as a STAR story."),r.words>0&&r.words<40&&u.push(`Your answer was brief (${r.words} words) — a behavioral answer needs a full story arc, not a summary.`);for(const d of ur)r.missing.includes(d.id)&&u.push(`${d.label}: ${d.hint}`);return r.missing.includes("A")&&u.push("Lead with first-person actions ('I built…', 'I drove…') — interviewers want to hear what YOU did."),r.missing.includes("R")&&r.present.length>=3&&u.push("Close with a measured result — numbers or a concrete outcome beat 'it went well'."),!r.missing.includes("A")&&!r.missing.includes("R")&&u.push("One more level: reflect on what you learned — self-awareness separates strong stories from great ones."),{...r,covered:r.present.map(d=>d+" present"),missed:r.missing.map(d=>d+" missing"),strengths:o,gaps:u}}function _g(n,i){if(i.cat==="behavioral")return px(n);const r=Pd(n,i),o=[],u=[];return r.score===0?(o.push("You submitted an empty answer — every answer, even a partial one, is a chance to show your reasoning."),u.push("Structure your answer: state your approach, walk through it, then summarize the tradeoffs.")):(r.covered.length?Re(r.covered,Math.min(2,r.covered.length)).forEach(d=>o.push(`You touched on: ${d}.`)):o.push("You engaged with the question — keep building the habit of structuring answers (approach → reasoning → tradeoffs)."),r.missed.length&&Re(r.missed,Math.min(3,r.missed.length)).forEach(d=>u.push(`Consider covering: ${d}.`)),r.words<25&&r.score>=1&&u.push(`Your answer was brief (${r.words} words). Interviewers reward concrete detail — add an example or walk through your reasoning step by step.`),r.words>=25&&r.score<=2&&u.push("Length isn't the issue — coverage is. Re-read the model answer and note which key points you missed."),u.push(dx[i.level])),{...r,strengths:o,gaps:u}}function bl(n){return n>=.9?"A":n>=.8?"B":n>=.65?"C":n>=.5?"D":"F"}function JA(n){const i=new Map;let r=0,o=0;for(const p of n){const f=p.q.catLabel,m=i.get(f)??{label:f,score:0,pct:0,n:0};m.n++,m.score=0,i.set(f,m)}for(const p of n){const f=i.get(p.q.catLabel);f.score+=p.fb.score}for(const p of n)r++,o+=p.fb.score;if(!r)return{score:0,pct:0,grade:"F",cats:[]};const u=[...i.entries()].map(([p,f])=>({label:p,score:+(f.score/f.n).toFixed(2),pct:f.score/(f.n*5)})),d=o/(r*5);return{score:+(d*5).toFixed(2),pct:d,grade:bl(d),cats:u}}function WA(n){const i=n.pct;return i>=.75?{label:"HIRE",tone:"hire",note:"Strong, consistent performance across rounds — you'd advance to the next stage."}:i>=.55?{label:"LEAN HIRE",tone:"lean",note:"Solid fundamentals with a few gaps to close — review the study topics below before the real thing."}:{label:"NO HIRE",tone:"no",note:"Not there yet — but every miss below is a fixable topic. Drill the study list and retake this mock."}}function $A(n){const i=new Map;for(const r of n)for(const o of r.fb.missed??[])i.set(o,(i.get(o)??0)+1);return[...i.entries()].sort((r,o)=>o[1]-r[1]).slice(0,6).map(([r])=>r)}function kd(n,i){const r=It(n),o=[];for(const u of an)for(const d of[...(r==null?void 0:r.questions[u.id])??[],...yl(n,u.id)])o.push({...d,lvl:u.id});if(i){const u=i.toLowerCase();return{field:r,items:o.filter(d=>d.q.toLowerCase().includes(u)||(d.a??"").toLowerCase().includes(u)||(d.kp??[]).some(p=>p.toLowerCase().includes(u)))}}return{field:r,items:o}}const nb=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7),XA=n=>{const i=Math.max(0,n),r=Math.floor(i/60),o=i%60;return`${r}:${String(o).padStart(2,"0")}`};function Ng(n,i){return sx({fieldId:n.field,companyId:n.company,levelId:n.level,count:i.count,mode:i.mode})}function hx(n,i){const r=It(n);return{questions:[{...i,cat:"field",catLabel:"Technical",catColor:"#22d3ee",level:i.lvl,src:"bank"}],meta:{field:(r==null?void 0:r.name)??"Question Bank",fieldId:n,company:"Question Bank",companyId:"bank",level:Tt(i.lvl).name,levelId:i.lvl,mode:"standard"}}}function fx(n,i){return Gd({fieldId:n.fieldId,companyId:n.companyId,levelId:n.levelId,keywords:n.keywords,count:i.count,mode:i.mode})}function Ig(n,i,r,o){const u=Gd({fieldId:n,companyId:null,levelId:i,keywords:r,count:o.count});return{...u,meta:{...u.meta,company:"Weak Topics",companyId:"weak",mode:o.mode}}}function mx(n){return{questions:n.answers.map(i=>i.q),meta:n.meta}}function Bg(n,i,r){if(!r.length)return null;const u=r.reduce((d,p)=>d+p.fb.score,0)/(r.length*5);return{id:nb(),date:Date.now(),meta:n,config:i,agg:{score:+(u*5).toFixed(1),pct:u,grade:bl(u)},answers:r.map(d=>({q:d.q,user:d.user,score:d.fb.score,pct:d.fb.pct,missed:d.fb.missed}))}}const gx=new Set("experience work working team role job ability skills skill including etc company will must required require requirements years year plus strong good excellent knowledge understanding design develop building using within across provide help etc candidate candidates applicants apply join us about our their your what who when where why how should could would may might able opportunity position responsibilities responsible report reports direct directly manage managing manager team's collaborate collaboration cross-functional cross functional stakeholders stakeholder product roadmap roadmaps growth mission values culture remote hybrid onsite office salary benefits equity stock options relocation visa sponsorship full-time full time permanent contract freelance contractor interns internship graduate graduate new technology technologies technical engineering engineer engineers software platform systems system service services application applications customer customers user users users data database databases api apis frontend frontend backend backend product code coding quality qa testing tests test performance scalable scale reliability reliable secure security authentication authorization privacy compliance cloud infrastructure infra server servers client clients browser browsers mobile ios android web internet network networking machine learning ml ai artificial intelligence gen generative llm large language models agile scrum jira sprint standup meeting meetings email slack chat communication written verbal storytelling documentation docs write writing english fluent proficiency good great nice fun friendly fast-paced fast paced dynamic startup established company industry field areas domain specific general modern latest cutting edge build ship launch deliver drive own lead leadership mentor mentoring coaching grow growth learn learning opportunity chance opportunity growth trajectory potential impact ownership autonomy flexibility flexible".split(" ")),yx=[{id:"ceo",words:["chief executive officer","chief operating officer","co-founder","cofounder"]},{id:"cto",words:["chief technology officer","vp of engineering","vice president of engineering","vice president engineering","head of engineering","director of engineering"]},{id:"principal",words:["principal engineer","distinguished engineer","principal software","principal"]},{id:"staff",words:["staff engineer","staff software"]},{id:"senior",words:["senior","lead engineer","lead software","lead developer"]},{id:"junior",words:["junior","entry-level","entry level","new grad","new graduate","fresher","internship","intern"]}];function bx(n,i){if(i.has("ceo"))return"ceo";if(i.has("cto"))return"cto";for(const o of yx)if(o.words.some(u=>n.includes(u)))return o.id;const r=n.match(/(\d{1,2})\s*\+?\s*(?:years|yrs)\b/);if(r){const o=Number(r[1]);return o>=10?"principal":o>=7?"staff":o>=4?"senior":o>=2?"mid":"junior"}return"mid"}function vx(n){let i="frontend",r=0;for(const o of ni){let u=0;for(const d of o.skills){const p=on(d);p.length&&(u+=p.filter(f=>n.has(f)).length)}u>r&&(r=u,i=o.id)}return i}function wx(n){for(const o of yd){const u=on(o.name);if(u.length&&u.every(d=>n.has(d)))return o.id}let i=null,r=0;for(const o of yd){const u=o.stack.filter(d=>d.split(/\s+/).some(p=>n.has(p.toLowerCase()))).length;u>r&&(r=u,i=o.id)}return r>0?i:null}function kx(n){const i=n.toLowerCase(),r=new Set(on(n).filter(o=>!gx.has(o)));return{levelId:bx(i,r),fieldId:vx(r),companyId:wx(r),keywords:[...r].slice(0,40)}}const Yd=n=>`${n.currentLevel}|${n.targetLevel}|${n.fieldId}|${n.companyId}`,xx={fingerprint:"",completed:[],completedAt:{},updatedAt:0};function Qd(){return ne(H.goal,null)}function ZA(n){oe(H.goal,n)}function rs(){return ne(H.skills,null)}function ab(n){oe(H.skills,n)}function eq(n){const i={...n,skippedAt:Date.now()};return ab(i),i}function Kd(){return ne(H.roadmapProg,xx)}function ib(n){oe(H.roadmapProg,n)}function tq(n,i){const r=Kd(),o=Yd(n),u=r.fingerprint===o?r.completed:[],d=u.includes(i),p={fingerprint:o,completed:d?u.filter(f=>f!==i):[...u,i],completedAt:{...r.fingerprint===o?r.completedAt:{}},updatedAt:Date.now()};return d?delete p.completedAt[i]:p.completedAt[i]=Date.now(),ib(p),p}function Sx(){ns(H.roadmapProg)}function nq(){ns(H.goal),ns(H.skills),Sx()}const xd=["junior","mid","senior","staff","principal","cto","ceo"],Tx=.6,Ug={company:{label:"Company Fit",color:"#6366f1"},field:{label:"Technical",color:"#22d3ee"},behavioral:{label:"Behavioral",color:"#34d399"},sysdesign:{label:"System Design",color:"#a855f7"},cto:{label:"Leadership",color:"#fbbf24"},ceo:{label:"Business",color:"#fb7185"}};function Ax(n,i){const r=It(n),o=xd.indexOf(i),u=[],d=new Set,p=(y,x,k,L)=>{!y||d.has(y.q)||(d.add(y.q),u.push({...y,cat:x,catLabel:Ug[x].label,catColor:Ug[x].color,level:k,src:L}))},f=o>=5?1:2,m=Math.min(o+1,4);for(let y=0;y<=m;y++){const x=xd[y],k=y<=o?f:1;Re((r==null?void 0:r.questions[x])??[],k).forEach(L=>p(L,"field",x,"field"))}return o>=5&&Re(_d,2).forEach(y=>p(y,"cto","cto","cto")),o===6&&Re(Nd,3).forEach(y=>p(y,"ceo","ceo","ceo")),{questions:u.slice(0,10),meta:{field:(r==null?void 0:r.name)??"General",fieldId:(r==null?void 0:r.id)??"general",company:"Skill Diagnostic",companyId:"diagnostic",level:Tt(i).name,levelId:i,mode:"diagnostic"}}}function qx(n,i){var d;const r={};for(const p of n)(r[d=p.q.level]??(r[d]=[])).push(p.fb.pct);let o="junior";for(const p of xd){const f=r[p];if(!(f!=null&&f.length))continue;if(f.reduce((y,x)=>y+x,0)/f.length>=Tx)o=p;else break}const u=n.map(p=>p.fb.pct);return{date:Date.now(),level:o,pct:u.length?u.reduce((p,f)=>p+f,0)/u.length:0,perSkill:Ex(n,i)}}function Ex(n,i){const r=It(i),o={};for(const u of(r==null?void 0:r.skills)??[]){const d=n.filter(p=>Hd(u,p.q.q,...p.q.kp??[]));d.length&&(o[u]=d.reduce((p,f)=>p+f.fb.pct,0)/d.length)}return o}function Hg(n,i){const r=qx(n,i),o=rs();return o&&ab({...o,diagnostic:r,skippedAt:void 0,skills:o.skills.map(u=>({...u,measured:r.perSkill[u.skill]??u.measured}))}),r}let sb=!1;function Wu(n){sb=n}let Fd=!1;function Cx(n){Fd=n}function Lx(){return Fd}const Dx={...wd};function Vd(){return Zk()}function os(){return Fd||sb?"pro":ne(H.tier,"free")}function rb(n){oe(H.tier,n)}const Ox=(n=new Date)=>`${n.getFullYear()}-${n.getMonth()+1}`,zx=(n=new Date)=>`${n.getFullYear()}-${n.getMonth()+1}-${n.getDate()}`;function vl(){const n=ne(H.usage,{}),i=Ox(),r=zx();return{month:i,sessions:n.month===i?n.sessions??0:0,day:r,aiToday:n.day===r?n.aiToday??0:0}}function jx(){const n=vl();oe(H.usage,{month:n.month,sessions:n.sessions+1,day:n.day,aiToday:n.aiToday})}function Ar(){const n=vl();oe(H.usage,{month:n.month,sessions:n.sessions,day:n.day,aiToday:n.aiToday+1})}function aq(){return os()==="pro"?1/0:Math.max(0,Zy().sessionsPerMonth-vl().sessions)}function Jd(){return os()==="pro"?1/0:Math.max(0,Zy().aiPerDay-vl().aiToday)}const $u=864e5,Mx=2,Pg=26,Xu=n=>{const[i,r,o]=n.split("-").map(Number);return new Date(i,r-1,o)},Sd=n=>`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`,Gg=()=>Sd(new Date);function Zu(n,i){return{label:n.q,pool:i,practice:n}}function Rx(n){var f;const i=It(n.fieldId),r=hl(n.companyId),o=vn[n.targetLevel],u=vn[n.currentLevel],d=o-u,p=[];if(p.push({id:"foundations",label:"Foundations",goal:`Reinforce ${Tt(n.currentLevel).name.toLowerCase()} fundamentals: core concepts, clean answers, common traps.`,weight:20,topics:Tt(n.currentLevel).focus.split(",").map(m=>({label:m.trim()})).filter(m=>m.label)}),p.push({id:"field",label:`Field deep dive — ${(i==null?void 0:i.name)??"your field"}`,goal:`Go deep on ${(i==null?void 0:i.name)??"your field"} bread-and-butter: aim for tradeoff-rich answers at ${Tt(n.targetLevel).name.toLowerCase()} depth.`,weight:28,topics:((i==null?void 0:i.skills)??[]).map(m=>({label:m}))}),(f=n.jdKeywords)!=null&&f.length&&p.push({id:"jd",label:"Job description fit",goal:`Tailored to your posting: ${n.jdKeywords.slice(0,4).join(" · ")}${n.jdKeywords.length>4?"…":""}`,weight:14,topics:n.jdKeywords.slice(0,10).map(m=>({label:m}))}),r.id!==Ky.id&&p.push({id:"company",label:`Company fit — ${r.name}`,goal:`Study ${r.name}'s stack and culture values; practice answering in their style (${r.style.slice(0,90)}…).`,weight:16,topics:[...r.stack.map(m=>({label:m})),...r.values.map(m=>({label:m}))]}),o>=3){const m=o===3?["senior","staff"]:o===4?["staff","principal"]:["principal"],y=[];for(const x of m)(hr[x]??[]).forEach(k=>y.push(Zu(k,"sysdesign")));p.push({id:"sysdesign",label:"System design",goal:"Practice system design: requirements → scale → components → data → tradeoffs → failure modes.",weight:14,topics:y.slice(0,6)})}if((o>=1||d>=1)&&p.push({id:"behavioral",label:"Behavioral & leadership",goal:"Polish STAR stories: situation, task, action, result — with measurable outcomes.",weight:12,topics:ga.slice(0,4).map(m=>Zu(m,"behavioral"))}),o>=5){const m=n.targetLevel==="ceo"?Nd:_d,y=n.targetLevel==="ceo"?6:4;p.push({id:"exec",label:n.targetLevel==="ceo"?"Executive & business":"Executive & leadership",goal:n.targetLevel==="ceo"?"Strategy, markets, fundraising and culture — every answer ties back to outcomes, risk and the people who execute.":"Org building, technical vision, budget and board communication — land answers in business terms.",weight:12,topics:m.slice(0,y).map(x=>Zu(x,n.targetLevel==="ceo"?"ceo":"cto"))})}return p}function _x(n,i,r){const o=n.filter(u=>u.meta.fieldId===i).flatMap(u=>u.answers).filter(u=>Hd(r,u.q.q,...u.q.kp??[]));return o.length?o.reduce((u,d)=>u+d.pct,0)/o.length:null}function Nx(n,i,r){var f;const o={},u={};for(const m of(i==null?void 0:i.skills)??[])o[m.skill]=m.self;for(const[m,y]of Object.entries(((f=i==null?void 0:i.diagnostic)==null?void 0:f.perSkill)??{}))u[m]=y;const d={},p=It(n.fieldId);for(const m of(p==null?void 0:p.skills)??[]){const y=_x(r,n.fieldId,m);y!==null&&(d[m]=y)}return{self:o,measured:u,session:d}}function Ix(n,i){var o;const r=new Map;for(const u of n.filter(d=>d.meta.fieldId===i).slice(-10))for(const d of u.answers){if(d.pct>=.55)continue;const p=(o=d.missed)!=null&&o.length?d.missed:d.q.kp;for(const f of p)r.set(f,(r.get(f)??0)+1)}return[...r.entries()].sort((u,d)=>d[1]-u[1]).slice(0,10).map(([u])=>u)}function Yg(n){return new Set(on(n).filter(i=>i.length>2))}function ed(n,i){const r=Yg(n),o=Yg(i);if(!r.size||!o.size)return!1;for(const u of r)if(o.has(u))return!0;return!1}function Bx(n,i,r){const o=Nx(n,i,r),u=hl(n.companyId),d=Tt(n.targetLevel).focus.split(",").map(_=>_.trim()),p=Ix(r,n.fieldId),f=_=>o.self[_]??2,m=_=>o.measured[_],y=_=>o.session[_],x=Rx(n),k=[],L=new Map,O=(_,T,G)=>{const N=_.label,I=f(N),Y=m(N),F=y(N);let K="P1";const P=Y??F;if(T.id==="field")K=P!==void 0&&P>=.8?"P2":P!==void 0&&P<.6||I<3?"P0":"P1";else if(T.id==="company"){const de=u.stack.includes(N);K=de&&(I<3||Y!==void 0&&Y<.6)?"P0":de?"P1":"P2"}else T.id==="foundations"?K=I<3?"P0":"P1":T.id==="jd"?K="P0":T.id==="behavioral"?K="P1":K="P2";d.some(de=>de===N||ed(de,N))&&T.id!=="exec"&&(K="P0"),p.some(de=>ed(de,N))&&(K=K==="P2"?"P1":"P0");let ue="new";P!==void 0&&P>=.8?ue="mastered":(I<3||P!==void 0&&P<.6)&&(ue="learning");const ae=Y!==void 0&&Y>=.8?`You're at ${Math.round(Y*100)}% here — review only`:Y!==void 0&&Y<.6?`Gap detected — diagnostic shows ${Math.round(Y*100)}%`:F!==void 0&&F>=.8?`Your sessions average ${Math.round(F*100)}% — review only`:p.some(de=>ed(de,N))?"Missed recently — prioritize this":void 0,ce={id:`${T.id}-${G}`,label:N,priority:K,phase:T.id,estHours:0,progress:ue,info:void 0,practice:_.practice,statusNote:ae};k.push(ce),L.set(N,ce)};return x.forEach((_,T)=>{_.topics.forEach((G,N)=>O(G,_,N))}),{phases:x,topics:k}}const Gi={"JavaScript / TypeScript":{primer:"Core language mechanics (scoping, async, the event loop) plus static typing — the foundation of every modern web role.",links:[{label:"MDN JavaScript Guide",url:"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"},{label:"TypeScript Handbook",url:"https://www.typescriptlang.org/docs/handbook/intro.html"},{label:"JS event loop explained",url:"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop"}]},"React · Vue · Angular":{primer:"Component models, rendering (virtual DOM vs reactivity), state management, and when each framework fits.",links:[{label:"React docs",url:"https://react.dev/learn"},{label:"Vue guide",url:"https://vuejs.org/guide/introduction.html"},{label:"Angular docs",url:"https://angular.dev/overview"}]},"CSS & accessibility":{primer:"Layout systems, the box model, responsive design, and semantic, keyboard-usable markup with ARIA only as a gap-filler.",links:[{label:"MDN CSS",url:"https://developer.mozilla.org/en-US/docs/Web/CSS"},{label:"MDN Accessibility",url:"https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility"},{label:"Every Layout",url:"https://every-layout.dev/"}]},"Web performance":{primer:"Core Web Vitals, the critical rendering path, bundle/image weight, and measuring before optimizing.",links:[{label:"web.dev performance",url:"https://web.dev/learn/performance"},{label:"MDN Performance",url:"https://developer.mozilla.org/en-US/docs/Web/Performance"},{label:"Core Web Vitals",url:"https://web.dev/articles/vitals"}]},"APIs & services":{primer:"RESTful design, HTTP semantics, idempotency, error contracts, and versioning — the backbone of backend interviews.",links:[{label:"MDN HTTP",url:"https://developer.mozilla.org/en-US/docs/Web/HTTP"},{label:"REST resource naming",url:"https://cloud.google.com/apis/design/resources"},{label:"Stripe API design guide",url:"https://github.com/stripe/openapi"}]},"Databases & caching":{primer:"Indexing, transactions, normalization vs denormalization, and cache layers — know when each helps and hurts.",links:[{label:"Use the Index, Luke",url:"https://use-the-index-luke.com/"},{label:"PostgreSQL docs",url:"https://www.postgresql.org/docs/"},{label:"Redis docs",url:"https://redis.io/docs/"}]},"Distributed systems":{primer:"Consistency, partitioning, replication and failure handling — the vocabulary of every senior+ system design round.",links:[{label:"Designing Data-Intensive Applications",url:"https://dataintensive.net/"},{label:"MIT 6.824 Distributed Systems",url:"https://pdos.csail.mit.edu/6.824/"},{label:"CAP theorem explained",url:"https://www.ibm.com/think/topics/cap-theorem"}]},"Go · Java · Node · Python":{primer:"Strong fundamentals in at least one backend language: memory model, concurrency, tooling, and idiomatic code.",links:[{label:"Go tour",url:"https://go.dev/tour/"},{label:"Java tutorials",url:"https://docs.oracle.com/javase/tutorial/"},{label:"Node.js docs",url:"https://nodejs.org/en/learn"},{label:"Python tutorial",url:"https://docs.python.org/3/tutorial/"}]},"Frontend + backend":{primer:"The full request lifecycle — UI event to database and back — plus where state, auth, and caching live on each side.",links:[{label:"MDN full-stack path",url:"https://developer.mozilla.org/en-US/docs/Learn_web_development"},{label:"How the web works",url:"https://developer.mozilla.org/en-US/docs/Learn_web_development/Web_and_web_standards/How_the_web_works"}]},"APIs & data":{primer:"Designing the data contract between client and server: JSON shape, validation, pagination, and error semantics.",links:[{label:"MDN JSON",url:"https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/JSON"},{label:"JSON Schema",url:"https://json-schema.org/learn/getting-started-step-by-step"}]},"Auth & real-time":{primer:"Sessions vs tokens, OAuth flows, WebSockets/SSE, and keeping client state in sync with the server.",links:[{label:"OAuth 2.0 explained",url:"https://oauth.net/2/"},{label:"MDN WebSockets",url:"https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API"},{label:"Auth0 docs",url:"https://auth0.com/docs"}]},"Product thinking":{primer:"Connecting engineering decisions to user outcomes: tradeoffs, iteration, and communicating in product terms.",links:[{label:"Mind the Product",url:"https://www.mindtheproduct.com/"},{label:"First Round Review",url:"https://review.firstround.com/"}]},"Kubernetes & Docker":{primer:"Containers and orchestration: images, pods, deployments, services, and how apps actually run at scale.",links:[{label:"Kubernetes docs",url:"https://kubernetes.io/docs/tutorials/"},{label:"Docker docs",url:"https://docs.docker.com/get-started/"}]},"AWS · GCP · Azure":{primer:"Core cloud services across compute, storage and networking, plus when to pick which — and their cost models.",links:[{label:"AWS docs",url:"https://docs.aws.amazon.com/"},{label:"Google Cloud docs",url:"https://cloud.google.com/docs"},{label:"Azure docs",url:"https://learn.microsoft.com/en-us/azure/"}]},"CI/CD & IaC":{primer:"Pipelines, automated tests at each stage, and infrastructure defined as code with Terraform or similar.",links:[{label:"GitHub Actions docs",url:"https://docs.github.com/en/actions"},{label:"Terraform docs",url:"https://developer.hashicorp.com/terraform/tutorials"}]},"SRE & observability":{primer:"SLOs, error budgets, monitoring, logging and tracing — and the operational culture that keeps services healthy.",links:[{label:"Google SRE book",url:"https://sre.google/sre-book/table-of-contents/"},{label:"OpenTelemetry docs",url:"https://opentelemetry.io/docs/"}]},"Statistics & ML":{primer:"Distributions, hypothesis testing, regression, bias-variance, and evaluating models honestly.",links:[{label:"Introduction to Statistical Learning",url:"https://www.statlearning.com/"},{label:"Google ML crash course",url:"https://developers.google.com/machine-learning/crash-course"}]},"Python & SQL":{primer:"Idiomatic Python plus the SQL you'll be quizzed on: joins, aggregation, window functions, and query planning.",links:[{label:"Python tutorial",url:"https://docs.python.org/3/tutorial/"},{label:"SQLBolt",url:"https://sqlbolt.com/"},{label:"PostgreSQL tutorial",url:"https://www.postgresql.org/docs/current/tutorial.html"}]},Experimentation:{primer:"A/B testing done right: randomization, power, multiple-comparison control, and reading results without fooling yourself.",links:[{label:"Trustworthy Online Controlled Experiments",url:"https://experimentguide.com/"},{label:"Evan Miller: sample size",url:"https://www.evanmiller.org/ab-testing/sample-size.html"}]},"ML platforms":{primer:"The stack that ships models: training pipelines, feature stores, serving, monitoring, and MLOps hygiene.",links:[{label:"MLflow docs",url:"https://mlflow.org/docs/"},{label:"Kubeflow docs",url:"https://www.kubeflow.org/docs/"}]},"Swift · Kotlin":{primer:"Modern native language fundamentals: optionals/null-safety, concurrency, and the platform's idioms.",links:[{label:"Swift docs",url:"https://docs.swift.org/swift-book/"},{label:"Kotlin docs",url:"https://kotlinlang.org/docs/home.html"}]},"React Native · Flutter":{primer:"Cross-platform architecture: the bridge/engine model, widget/component lifecycles, and native interop.",links:[{label:"React Native docs",url:"https://reactnative.dev/docs/getting-started"},{label:"Flutter docs",url:"https://docs.flutter.dev/"}]},"Offline & sync":{primer:"Service workers, IndexedDB as the local source of truth, and conflict resolution when devices diverge.",links:[{label:"MDN Service Workers",url:"https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API"},{label:"MDN IndexedDB",url:"https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API"}]},"App stores":{primer:"Store guidelines, review cycles, release trains, and how to ship and update mobile apps operationally.",links:[{label:"App Store guidelines",url:"https://developer.apple.com/app-store/review/guidelines/"},{label:"Google Play policy",url:"https://support.google.com/googleplay/android-developer/answer/9859455"}]},"Test strategy":{primer:"The testing pyramid, what to test at each layer, and designing test suites that catch regressions without slowing delivery.",links:[{label:"Test pyramid (Martin Fowler)",url:"https://martinfowler.com/articles/practical-test-pyramid.html"},{label:"Google testing blog",url:"https://testing.googleblog.com/"}]},"Automation frameworks":{primer:"End-to-end and UI automation with Playwright/Cypress-style tools, plus reliability patterns (waits, retries, isolation).",links:[{label:"Playwright docs",url:"https://playwright.dev/docs/intro"},{label:"Cypress docs",url:"https://docs.cypress.io/guides/overview/why-cypress"}]},"CI/CD integration":{primer:"Wiring tests into pipelines, flake control, parallel sharding, and gating releases on quality signals.",links:[{label:"GitHub Actions docs",url:"https://docs.github.com/en/actions"},{label:"Continuous Integration (Fowler)",url:"https://martinfowler.com/articles/continuousIntegration.html"}]},"Performance & a11y":{primer:"Load/soak testing, performance budgets, and automated accessibility scans wired into the pipeline.",links:[{label:"web.dev performance",url:"https://web.dev/learn/performance"},{label:"axe-core docs",url:"https://www.deque.com/axe/core-documentation/api-documentation/"}]},"Application security":{primer:"The OWASP Top 10 in practice: injection, broken auth, SSRF, and building security into the SDLC.",links:[{label:"OWASP Top 10",url:"https://owasp.org/www-project-top-ten/"},{label:"OWASP cheat sheets",url:"https://cheatsheetseries.owasp.org/"}]},"Cloud & network security":{primer:"IAM, network segmentation, least privilege, and the shared-responsibility model across cloud providers.",links:[{label:"AWS security docs",url:"https://docs.aws.amazon.com/security/"},{label:"Cloudflare Learning Center",url:"https://www.cloudflare.com/learning/"}]},Cryptography:{primer:"Hashing vs encryption, symmetric vs asymmetric, TLS, and the practical pitfalls (don't roll your own).",links:[{label:"OWASP crypto cheat sheet",url:"https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html"},{label:"Crypto 101",url:"https://www.crypto101.io/"}]},"Incident response":{primer:"Detection, containment, eradication and recovery — plus blameless postmortems and communication during incidents.",links:[{label:"SRE workbook: incident response",url:"https://sre.google/workbook/incident-response/"},{label:"Atlassian incident handbook",url:"https://www.atlassian.com/incident-management/handbook"}]}},Zo={"language basics":{primer:"Syntax, types, control flow and idiomatic constructs of your main language — solid, correct answers at junior level.",links:[{label:"MDN JavaScript",url:"https://developer.mozilla.org/en-US/docs/Web/JavaScript"}]},"data structures":{primer:"Arrays, hash maps, linked lists, trees, graphs, heaps — time/space complexity and when to reach for each.",links:[{label:"Visualgo",url:"https://visualgo.net/en"},{label:"Big-O cheat sheet",url:"https://www.bigocheatsheet.com/"}]},debugging:{primer:"Reproduce → isolate → hypothesize → verify. Know your debugger, logs, and how to read a stack trace.",links:[{label:"MDN debugging",url:"https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Tools_and_setup/What_are_browser_developer_tools"}]},"testing fundamentals":{primer:"Unit vs integration vs end-to-end, good assertions, and testing the behavior that matters.",links:[{label:"Jest docs",url:"https://jestjs.io/docs/getting-started"},{label:"Test pyramid",url:"https://martinfowler.com/articles/practical-test-pyramid.html"}]},communication:{primer:"Structuring answers (approach → reasoning → tradeoffs), active listening, and explaining simply.",links:[{label:"Google: communication",url:"https://www.thebalancemoney.com/communication-skills-2063779"}]},"design patterns":{primer:"The classic GoF patterns and when they help — plus the modern take (composition over inheritance).",links:[{label:"Refactoring Guru",url:"https://refactoring.guru/design-patterns"}]},APIs:{primer:"HTTP verbs, status codes, request/response design, and idempotency — the contract between systems.",links:[{label:"MDN HTTP",url:"https://developer.mozilla.org/en-US/docs/Web/HTTP"}]},databases:{primer:"Relational modeling, indexes, transactions, and the ACID vs BASE tradeoff.",links:[{label:"Use the Index, Luke",url:"https://use-the-index-luke.com/"}]},"moderate system design":{primer:"A repeatable framework: requirements → scale → components → data → tradeoffs, applied to mid-size systems.",links:[{label:"System design primer",url:"https://github.com/donnemartin/system-design-primer"}]},"code review":{primer:"What to look for, how to give kind, actionable feedback, and how to receive it.",links:[{label:"Google eng practices",url:"https://google.github.io/eng-practices/review/"}]},architecture:{primer:"Layering, modularity, coupling and cohesion — and making tradeoffs explicit in design documents.",links:[{label:"Martin Fowler",url:"https://martinfowler.com/architecture/"}]},scalability:{primer:"Load, latency and throughput: caching, replication, partitioning, and finding the real bottleneck.",links:[{label:"System design primer",url:"https://github.com/donnemartin/system-design-primer"}]},mentoring:{primer:"Diagnosing where someone struggles, giving actionable feedback, and building independence rather than dependency.",links:[{label:"Radical Candor",url:"https://www.radicalcandor.com/"}]},"cross-team collaboration":{primer:"Aligning goals and vocabulary across teams, and bridging communication gaps productively.",links:[{label:"First Round Review",url:"https://review.firstround.com/"}]},"system design":{primer:"End-to-end design interviews: clarifying requirements, estimating scale, sketching components, and defending tradeoffs.",links:[{label:"System design primer",url:"https://github.com/donnemartin/system-design-primer"},{label:"Designing Data-Intensive Applications",url:"https://dataintensive.net/"}]},"large-scale systems":{primer:"Multi-region replication, data residency, failure domains, and the economics of global infrastructure.",links:[{label:"Designing Data-Intensive Applications",url:"https://dataintensive.net/"}]},"technical strategy":{primer:"Choosing bets, writing them down, and aligning architecture with business goals over a multi-year horizon.",links:[{label:"An Elegant Puzzle",url:"https://www.elegantpuzzle.com/"}]},standards:{primer:"Setting conventions teams actually follow — lightweight governance, ADRs, and automation over enforcement.",links:[{label:"ADR pattern",url:"https://adr.github.io/"}]},"risk management":{primer:"Identifying, quantifying and mitigating technical risk — and communicating it to stakeholders honestly.",links:[{label:"SRE book: risk",url:"https://sre.google/sre-book/risk-management/"}]},"org-wide architecture":{primer:"Architecting across teams: platform decisions, shared services, and setting direction beyond one codebase.",links:[{label:"An Elegant Puzzle",url:"https://www.elegantpuzzle.com/"}]},"platform strategy":{primer:"Building internal platforms that make the right thing easy — golden paths, self-service, and treating teams as customers.",links:[{label:"Team Topologies",url:"https://teamtopologies.com/"}]},"executive communication":{primer:"Translating technical topics into business outcomes, risk and cost — with metrics, not vibes.",links:[{label:"First Round Review",url:"https://review.firstround.com/"}]},"hiring bar":{primer:"Structured interviews, rubrics and calibration — hiring judgment, not trivia.",links:[{label:"Google: hiring",url:"https://www.rework.withgoogle.com/guides/hiring/"}]},"technical vision":{primer:"A concrete, communicable picture of the future that the org can rally behind — and that can change.",links:[{label:"An Elegant Puzzle",url:"https://www.elegantpuzzle.com/"}]},"engineering org":{primer:"Team structure, leadership pipelines and process that scales from a few engineers to hundreds.",links:[{label:"An Elegant Puzzle",url:"https://www.elegantpuzzle.com/"}]},budget:{primer:"Headcount, cloud and tooling spend tied to priorities — with visibility and monthly review.",links:[{label:"FinOps foundation",url:"https://www.finops.org/"}]},"security & compliance":{primer:"Risk-tiered controls, automated scanning, and compliance mapped to what customers actually require.",links:[{label:"OWASP Top 10",url:"https://owasp.org/www-project-top-ten/"}]},"hiring leaders":{primer:"What to look for in first execs and senior hires: complementary strengths, stage fit, and deep references.",links:[{label:"First Round Review",url:"https://review.firstround.com/"}]},strategy:{primer:"Strategy is choices: what you'll do AND what you won't, tied to a clear vision and reviewed against reality.",links:[{label:"YC library",url:"https://www.ycombinator.com/library"}]},product:{primer:"Product-market fit, pricing, and the product decisions that shape the engineering roadmap.",links:[{label:"Lenny's Newsletter",url:"https://www.lennysnewsletter.com/"}]},market:{primer:"Sizing markets, understanding competition and timing, and validating with real customers.",links:[{label:"YC library",url:"https://www.ycombinator.com/library"}]},fundraising:{primer:"The raise as story plus evidence, term-sheet literacy, and runway discipline.",links:[{label:"YC: fundraising",url:"https://www.ycombinator.com/library/4A-how-to-raise-a-seed-round"}]},talent:{primer:"Hiring, developing and retaining people — the leverage that compounds everything else.",links:[{label:"First Round Review",url:"https://review.firstround.com/"}]},metrics:{primer:"Picking the few metrics that drive decisions — ARR, retention, unit economics — and reviewing them weekly.",links:[{label:"Lenny's Newsletter",url:"https://www.lennysnewsletter.com/"}]}},Yi={Go:{primer:"Goroutines, channels, the memory model, and idiomatic Go — heavily quizzed at companies running it in production.",links:[{label:"Effective Go",url:"https://go.dev/doc/effective_go"}]},Java:{primer:"JVM fundamentals, concurrency (threads, locks, executor), collections, and garbage collection.",links:[{label:"Java concurrency",url:"https://docs.oracle.com/javase/tutorial/essential/concurrency/"}]},Python:{primer:"Idiomatic Python, the GIL, async, and the ecosystem — know what's fast and what's not.",links:[{label:"Python docs",url:"https://docs.python.org/3/"}]},C:{primer:"Pointers, memory management and undefined behavior — the systems language that underpins everything.",links:[{label:"Learn C",url:"https://www.learn-c.org/"}]},"C++":{primer:"RAII, move semantics, templates and memory safety — expect deep follow-ups if listed on your target's stack.",links:[{label:"cppreference",url:"https://en.cppreference.com/w/"}]},Kubernetes:{primer:"Pods, deployments, services, scheduling and controllers — how the control plane actually works.",links:[{label:"Kubernetes docs",url:"https://kubernetes.io/docs/concepts/"}]},Spanner:{primer:"Google's globally distributed database: TrueTime, external consistency, and what makes it unique.",links:[{label:"Spanner paper",url:"https://research.google/pubs/spanner-google-s-globally-distributed-database/"}]},Bigtable:{primer:"A wide-column NoSQL store — row keys, locality, and when it beats a relational database.",links:[{label:"Bigtable overview",url:"https://cloud.google.com/bigtable/docs/overview"}]},TensorFlow:{primer:"Graphs, eager execution, training loops, and the Keras layer API.",links:[{label:"TensorFlow docs",url:"https://www.tensorflow.org/learn"}]},React:{primer:"Rendering, hooks, reconciliation, and state management — the most-asked frontend framework in interviews.",links:[{label:"React docs",url:"https://react.dev/learn"}]},GraphQL:{primer:"Schema, resolvers, N+1 problems, and the tradeoffs vs REST.",links:[{label:"GraphQL docs",url:"https://graphql.org/learn/"}]},Cassandra:{primer:"A distributed wide-column store: consistent hashing, tunable consistency, and the write path.",links:[{label:"Cassandra docs",url:"https://cassandra.apache.org/doc/latest/"}]},PyTorch:{primer:"Tensors, autograd, modules and training loops — the research-to-production ML framework.",links:[{label:"PyTorch docs",url:"https://pytorch.org/tutorials/"}]},AWS:{primer:"EC2, S3, Lambda, DynamoDB and the mental model of AWS services — the default cloud in most interviews.",links:[{label:"AWS docs",url:"https://docs.aws.amazon.com/"}]},DynamoDB:{primer:"Partition keys, item collections, read/write capacity and its availability-first consistency model.",links:[{label:"DynamoDB docs",url:"https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/"}]},Lambda:{primer:"Serverless functions: cold starts, concurrency, and event sources.",links:[{label:"Lambda docs",url:"https://docs.aws.amazon.com/lambda/"}]},S3:{primer:"Object storage: keys, consistency, lifecycle and cost tiers.",links:[{label:"S3 docs",url:"https://docs.aws.amazon.com/s3/"}]},Kafka:{primer:"The log as the core abstraction: partitions, replication, consumer groups, and exactly-once semantics.",links:[{label:"Kafka docs",url:"https://kafka.apache.org/documentation/"}]},"C#":{primer:"The .NET language: async/await, LINQ, generics, and the CLR.",links:[{label:"C# docs",url:"https://learn.microsoft.com/en-us/dotnet/csharp/"}]},TypeScript:{primer:"Static typing on top of JS: unions, generics, inference, and the type system's limits.",links:[{label:"TypeScript handbook",url:"https://www.typescriptlang.org/docs/handbook/intro.html"}]},".NET":{primer:"The runtime and framework: ASP.NET Core, dependency injection, and the GC.",links:[{label:".NET docs",url:"https://learn.microsoft.com/en-us/dotnet/"}]},Azure:{primer:"Core Azure services and the Microsoft cloud's identity (Entra ID) and compute model.",links:[{label:"Azure docs",url:"https://learn.microsoft.com/en-us/azure/"}]},"SQL Server":{primer:"T-SQL, indexing, transactions and the engine's execution plans.",links:[{label:"SQL Server docs",url:"https://learn.microsoft.com/en-us/sql/"}]},Swift:{primer:"Optionals, value semantics, concurrency (async/await), and Apple platform idioms.",links:[{label:"Swift docs",url:"https://docs.swift.org/swift-book/"}]},"Objective-C":{primer:"The legacy Apple language: message passing, ARC, and interop with Swift.",links:[{label:"Apple docs",url:"https://developer.apple.com/library/archive/documentation/Cocoa/"}]},Metal:{primer:"Apple's GPU API: command buffers, shaders, and high-performance rendering.",links:[{label:"Metal docs",url:"https://developer.apple.com/metal/"}]},WebKit:{primer:"The browser engine: rendering pipeline, layout, and the JS engine boundary.",links:[{label:"WebKit blog",url:"https://webkit.org/blog/"}]},"Node.js":{primer:"The event loop, streams, modules, and the single-threaded concurrency model.",links:[{label:"Node.js docs",url:"https://nodejs.org/en/learn"}]},Ruby:{primer:"Metaprogramming, blocks, and the Rails ecosystem's idioms.",links:[{label:"Ruby docs",url:"https://www.ruby-lang.org/en/documentation/"}]},Scala:{primer:"Functional + object-oriented on the JVM: immutability, pattern matching, and type classes.",links:[{label:"Scala docs",url:"https://docs.scala-lang.org/"}]},PostgreSQL:{primer:"MVCC, indexing, transactions, and the most-asked open-source database in interviews.",links:[{label:"PostgreSQL docs",url:"https://www.postgresql.org/docs/"}]},MySQL:{primer:"InnoDB, indexes, replication, and the classic LAMP-stack database.",links:[{label:"MySQL docs",url:"https://dev.mysql.com/doc/"}]},"React Native":{primer:"The JS-to-native bridge, the new architecture, and mobile-specific tradeoffs.",links:[{label:"React Native docs",url:"https://reactnative.dev/docs/getting-started"}]},Kotlin:{primer:"Null-safety, coroutines, and modern Android development.",links:[{label:"Kotlin docs",url:"https://kotlinlang.org/docs/home.html"}]},BigQuery:{primer:"Serverless analytics: columnar storage, slot-based pricing, and SQL at petabyte scale.",links:[{label:"BigQuery docs",url:"https://cloud.google.com/bigquery/docs"}]},Rust:{primer:"Ownership, borrowing, and fearless concurrency — expect systems-level depth.",links:[{label:"Rust book",url:"https://doc.rust-lang.org/book/"}]},ClickHouse:{primer:"The columnar OLAP database: merge trees, partitioning, and analytical query patterns.",links:[{label:"ClickHouse docs",url:"https://clickhouse.com/docs"}]},Elasticsearch:{primer:"The inverted index, sharding, and relevance scoring for search.",links:[{label:"Elastic docs",url:"https://www.elastic.co/guide/"}]},"Machine learning":{primer:"Core ML concepts: model selection, evaluation, overfitting, and production concerns.",links:[{label:"Google ML crash course",url:"https://developers.google.com/machine-learning/crash-course"}]},"Ruby on Rails":{primer:"MVC, ActiveRecord, conventions, and the productivity-first framework.",links:[{label:"Rails guides",url:"https://guides.rubyonrails.org/"}]},"Hack/PHP":{primer:"Meta's PHP-derived language: HHVM, type checking, and the web-serving model.",links:[{label:"Hack docs",url:"https://docs.hhvm.com/hack/"}]},"General engineering practice":{primer:"Balanced fundamentals across languages, systems and process — the default when no specific company is chosen.",links:[{label:"MDN web docs",url:"https://developer.mozilla.org/"},{label:"System design primer",url:"https://github.com/donnemartin/system-design-primer"}]},TAO:{primer:"Meta's distributed graph store powering the social graph — an object/association model at massive scale.",links:[{label:"TAO: Facebook's graph store",url:"https://engineering.fb.com/2021/06/09/core-infra/tao-100x-faster/"}]},"VS Code":{primer:"The most-used editor: extensions, language servers and the Electron architecture underneath.",links:[{label:"VS Code docs",url:"https://code.visualstudio.com/docs"}]},"OpenAI partnership":{primer:"How LLM capabilities ship into products — the Azure OpenAI service, deployment models and cost control.",links:[{label:"Azure OpenAI docs",url:"https://learn.microsoft.com/en-us/azure/ai-services/openai/"}]},"Privacy technologies":{primer:"Privacy engineering: data minimization, on-device processing, differential privacy and encryption.",links:[{label:"Apple privacy",url:"https://www.apple.com/privacy/"}]},Spinnaker:{primer:"Netflix's continuous-delivery platform: pipelines, canary analysis and multi-cloud deploys.",links:[{label:"Spinnaker docs",url:"https://spinnaker.io/docs/"}]},"Chaos engineering":{primer:"Deliberately injecting failures to find weaknesses before they find you — Chaos Monkey and Gremlin style.",links:[{label:"Principles of Chaos",url:"https://principlesofchaos.org/"}]},ML:{primer:"Machine learning fundamentals and how models actually ship in production systems.",links:[{label:"Google ML crash course",url:"https://developers.google.com/machine-learning/crash-course"}]},Postgres:{primer:"PostgreSQL — the open-source relational database: MVCC, indexing, transactions and replication.",links:[{label:"PostgreSQL docs",url:"https://www.postgresql.org/docs/"}]},Workers:{primer:"Cloudflare Workers: serverless functions at the edge on V8 isolates — cold starts, limits, KV and D1.",links:[{label:"Cloudflare Workers docs",url:"https://developers.cloudflare.com/workers/"}]},"C/C++":{primer:"Systems programming: pointers, memory management, RAII, and the tradeoffs of both languages.",links:[{label:"cppreference",url:"https://en.cppreference.com/w/"}]}},Ux={primer:"Master the fundamentals, see how it's used in real systems, then practice answering interview questions about it.",links:[{label:"MDN Web Docs",url:"https://developer.mozilla.org/"},{label:"freeCodeCamp",url:"https://www.freecodecamp.org/"},{label:"InterviewBit",url:"https://www.interviewbit.com/"}]},td=n=>n.toLowerCase().trim().replace(/\s+/g," ");function Hx(n,i){const r=td(n);if(Gi[n]??Gi[r])return Gi[n]??Gi[r];if(Zo[n]??Zo[r])return Zo[n]??Zo[r];if(Yi[n]??Yi[r])return Yi[n]??Yi[r];for(const o of Object.keys(Yi))if(r.includes(td(o)))return Yi[o];for(const o of Object.keys(Gi))if(r.includes(td(o)))return Gi[o];return Ux}function Px(n){return n==="P0"?3.5:n==="P1"?2.25:1.25}function Gx(n,i){const r=i.reduce((f,m)=>f+m.weight,0),o=i.map(f=>n*f.weight/r),u=n>=i.length?1:0,d=o.map(f=>Math.max(u,Math.floor(f)));let p=n-d.reduce((f,m)=>f+m,0);if(p>0){const f=o.map((m,y)=>({i:y,frac:m-Math.floor(m)})).sort((m,y)=>y.frac-m.frac);for(let m=0;m<p;m++)d[f[m%f.length].i]+=1}return d}function ob(n,i,r=[]){var F;const o=Xu(Gg()),u=Xu(n.targetDate),d=Math.max(1,Math.round((u.getTime()-o.getTime())/$u)),p=Math.min(Pg,Math.max(Mx,Math.ceil(d/7))),{phases:f,topics:m}=Bx(n,i,r),y=f.filter(K=>m.some(P=>P.phase===K.id)),x=Math.min(Pg,Math.max(p,y.length)),k=Gx(x,y);for(const K of m)K.info=Hx(K.label);const L=[];let O=0;const _=Math.max(1,n.hoursPerWeek/5),T=Gg();y.forEach((K,P)=>{const ue=m.filter(de=>de.phase===K.id),ae=k[P],ce=[];for(let de=0;de<ae;de++){O++;const J=Sd(new Date(o.getTime()+(O-1)*7*$u)),Z=Sd(new Date(Xu(J).getTime()+6*$u)),Ne=Z<T?"passed":J<=T&&T<=Z?"current":"upcoming";ce.push({week:O,start:J,end:Z,phase:K.id,phaseLabel:K.label,goal:K.goal,topics:[],status:Ne,totalHours:n.hoursPerWeek})}ue.forEach((de,J)=>{de.estHours=+(Px(de.priority)*_).toFixed(1),ce[J%ae].topics.push(de)}),L.push(...ce)});const G=((F=i==null?void 0:i.diagnostic)==null?void 0:F.level)??null,N=vn[n.targetLevel]-vn[G??n.currentLevel],I=G?"diagnostic":"self",Y=`${G?`Diagnostic: you're at ${Tt(G).name} `:`Starting from ${Tt(n.currentLevel).name} `}→ ${Tt(n.targetLevel).name} · ${x} weeks · ${n.hoursPerWeek}h/wk`;return{goal:n,weeks:L,gapLevels:N,measuredLevel:G,source:I,summary:Y}}function Yx(n,i){if(i.fingerprint!==Yd(n.goal))return n;const r=new Set(i.completed);for(const o of n.weeks)for(const u of o.topics)u.done=r.has(u.id);for(const o of n.weeks){if(o.status!=="current"||!o.topics.length||!o.topics.every(f=>f.done))continue;const u=n.weeks.flatMap(f=>f.topics).filter(f=>!f.done),d=Math.min(2,u.length);if(!d)break;const p=[];for(const f of n.weeks)if(!(f.week<=o.week)){for(const m of f.topics)if(!m.done&&!p.includes(m)&&(p.push(m),p.length>=d))break;if(p.length>=d)break}for(const f of p)for(const m of n.weeks)m!==o&&(m.topics=m.topics.filter(y=>y!==f));o.topics=[...o.topics,...p];break}for(const o of n.weeks)o.status!=="passed"&&(!o.topics.length||o.topics.every(u=>u.done))&&(o.status="done");return n}function Qx(n,i){if(!n||!i.length)return;const r=rs();if(!r)return;const o=ne(H.sessions,[]);let u;try{u=ob(n,r,o)}catch{return}const d=Kd(),p=Yd(n),f=new Set(d.fingerprint===p?d.completed:[]);let m=!1;for(const y of u.weeks)for(const x of y.topics){if(f.has(x.id))continue;i.some(L=>L.pct>=.7&&(x.label===L.q.q||Hd(x.label,L.q.q,L.q.a)))&&(f.add(x.id),m=!0)}m&&ib({fingerprint:p,completed:[...f],completedAt:{...d.fingerprint===p?d.completedAt:{},...Object.fromEntries([...f].filter(y=>!(d.fingerprint===p&&y in d.completedAt)).map(y=>[y,Date.now()]))},updatedAt:Date.now()})}const Kx=n=>n.toLowerCase().trim().replace(/\s+/g," "),Fx={concepts:[{name:"Types, values & coercion",blurb:"Primitive vs reference types, dynamic vs static typing, and the implicit coercion traps that surprise people."},{name:"Control flow & functions",blurb:"Conditionals, loops, early returns, and first-class functions — the building blocks of readable logic."},{name:"Scope, hoisting & closures",blurb:"Block vs function scope, the order names resolve, and how closures capture state — the mental model behind most gotchas."},{name:"Error handling",blurb:"Exceptions vs error values, failing loudly with context, and never swallowing errors."},{name:"Idioms & tooling",blurb:"Language conventions, linters, formatters, package managers, and the ecosystem you work in daily."}],points:["Open with a definition: 'I'd start with the type system and how the language models values and memory.'","Show awareness of typed vs untyped languages and when each helps.","Give a small, code-shaped example: a function, a loop, an error path.","Mention the tooling you actually use (linter, formatter, package manager, debugger).","Reason about trade-offs instead of reciting syntax."],traps:["Assuming strict equality or forgetting coercion rules.","Not understanding hoisting/scope, then getting confused by closures.","Ignoring error paths — answers fall apart on edge cases.","Reciting syntax instead of explaining when and why to use it."],qa:[{q:"How do you decide between typed and untyped code?",a:"Strong answer: static types catch whole classes of bugs and make refactoring safe at scale, at the cost of ceremony and a slower loop. For a small script or prototype, untyped is faster; for a codebase that will live and grow, typed wins. I'd mention that type systems are a spectrum — inference, unions, generics — and that the real win is the confidence to change code."},{q:"Walk me through how you'd refactor a messy 200-line function.",a:"1) Read it and list what it actually does. 2) Extract one behavior per small function with clear names. 3) Return early and flatten nesting. 4) Cover the behavior with tests first if it's important. 5) Keep the diff reviewable. The key point: refactor in small steps with tests, not a big-bang rewrite."}],related:["JavaScript / TypeScript","data structures","debugging","code review"]},Vx={concepts:[{name:"Unit vs integration vs E2E",blurb:"What each level catches, how much it costs, and how fast it runs — the testing pyramid in practice."},{name:"Good assertions",blurb:"Assert behavior, not implementation; one behavior per test; test the contract users rely on."},{name:"Test doubles",blurb:"Mocks, stubs and fakes — when each fits, and why mocking your own internals is a smell."},{name:"Coverage vs confidence",blurb:"Coverage is a proxy, not a goal; meaningful cases beat high percentages."},{name:"Regression protection",blurb:"Every fixed bug gets a test that would have caught it, so it can't come back."}],points:["Name the testing pyramid and justify your proportions (many units, fewer E2E).","Say it plainly: 'I test behavior, not implementation details.'","Show you know when NOT to mock — mock boundaries, not your own code's internals.","Mention testing failure paths, not just the happy path.","Tie testing to confidence: 'Tests let me refactor without fear.'"],traps:["Testing implementation details — every refactor breaks the tests.","Mocking everything — tests pass but prove nothing.","Chasing 100% coverage instead of meaningful cases.","Flaky, slow E2E suites that the team stops trusting."],qa:[{q:"What's the difference between unit, integration and end-to-end tests, and when would you use each?",a:"Units test one function/component in isolation — fast, cheap, great for logic. Integration tests verify that pieces work together (DB, API, modules) and catch contract mismatches. E2E tests drive the real user flow through the real stack — slowest and flakiest, so you keep the count low and focused on critical journeys. I'd pick by cost and confidence: most tests at the unit level, a solid integration layer, a few E2E for the money paths."},{q:"A bug keeps coming back. How do you prevent it?",a:"1) Write a failing test that reproduces the exact case. 2) Fix the root cause, not the symptom. 3) Confirm the test passes and the bug is gone. 4) If it recurs in different forms, ask what makes this class of bug possible and address it at the design level — better types, validation, or invariants."}],related:["debugging","code review","JavaScript / TypeScript","language basics"]},Qg={concepts:[{name:"Arrays & hash maps",blurb:"The workhorses: O(1) lookup with the right keying, ordered iteration, and their memory costs."},{name:"Stacks, queues & linked lists",blurb:"Ordering semantics — LIFO, FIFO — and the real-world problems they model (undo, tasks, buffers)."},{name:"Trees & graphs",blurb:"Traversals (DFS/BFS), heaps for priority, and path-finding — when to reach for each."},{name:"Time vs space",blurb:"Big-O reasoning and the constant trade-off between speed and memory."},{name:"Choosing the right structure",blurb:"Start from the operations you need — insert, look up, order — and pick the structure that fits."}],points:["Always state time AND space complexity before coding.","Tie the structure choice to the operations the problem actually needs.","Know one real-world use per structure (map → cache, queue → rate limiting).","Verbalize the path: brute force → better → best, with the trade-off at each step.","Ask clarifying questions about constraints before jumping in."],traps:["Jumping to code before analyzing the problem.","Confusing O(log n) structures with O(1) claims.","Ignoring space complexity entirely.","Choosing a fancy structure when an array or map is the right answer."],qa:[{q:"How would you design the data structure for a social feed?",a:"A feed is ordered, timestamped, append-heavy and read-often. I'd use a list-like structure for ordering plus an index for lookups — in practice: a time-ordered log, hash maps keyed by user for 'who follows whom' and read cursors, and a cache in front of the hot reads. I'd mention the write path (fan-out on publish) and that the right answer depends on read:write ratio and whether consistency needs to be real-time."},{q:"Explain Big-O with a real example of O(n²) vs O(n log n).",a:"Big-O describes how runtime or memory grows with input size. A naive nested loop over an array is O(n²) — doubling the input quadruples the work. Sorting then scanning, or using a hash map to trade space for time, often gets you to O(n log n) or O(n). I'd give a concrete example: finding duplicates in a list — nested loops O(n²) vs a hash set O(n)."}],related:["language basics","system design","debugging","JavaScript / TypeScript"]},Jx={concepts:[{name:"Reproduce first",blurb:"A bug you can't reproduce deterministically, you can't fix confidently."},{name:"Read the error",blurb:"Stack traces, logs and the exact failing input carry most of the answer."},{name:"Bisect & isolate",blurb:"Binary-search the change or input that broke it — git bisect, comments, halves."},{name:"Hypothesize, don't guess",blurb:"One experiment at a time, each testing a single hypothesis."},{name:"Regression protection",blurb:"A bug isn't fixed until a test proves it can't come back."}],points:["Open with: 'First I reproduce it deterministically, then I read the error carefully.'","Name your toolkit: debugger, structured logs, profiler, git bisect.","Show you fix root causes, not symptoms.","Finish with: 'Then I add a regression test so it can't come back.'"],traps:["Fixing the symptom and shipping.","Adding log lines everywhere without a hypothesis.","Blaming the environment before checking your own change.","Shipping 'should be fixed' without reproducing the original case."],qa:[{q:"Tell me about a difficult bug you debugged.",a:"A strong answer uses the structure: the symptom, how I reproduced it, how I isolated the cause (bisect/hypothesis), the root cause, the fix, and the regression test I added. Bonus points for naming the lesson — e.g. 'after that I never trust implicit timezone conversion.'"},{q:"How do you approach a performance problem in production?",a:"Measure first. Use profiling and tracing to find the actual bottleneck rather than guessing. Form a hypothesis, make one change, re-measure. Compare before/after on real traffic or a load test. Then prevent regressions with a performance budget or alert."}],related:["testing fundamentals","code review","SRE & observability","language basics"]},Wx={concepts:[{name:"Know your audience",blurb:"Exec summary for leadership, detail for engineers — depth follows the listener."},{name:"Structured delivery",blurb:"Context → decision → impact, or STAR for stories. Structure beats spontaneity."},{name:"Active listening",blurb:"Clarify before answering; restate to confirm; ask questions that sharpen the ask."},{name:"Writing that scales",blurb:"Docs, updates and async communication that don't force follow-up meetings."},{name:"Giving & receiving feedback",blurb:"Specific, timely, behavioral — and open when it's aimed at you."}],points:["'I adapt depth to the audience — one paragraph for execs, detail for engineers.'","Use a one-paragraph structure for every story: context, what I did, the result.","'I ask clarifying questions rather than assuming.'","'I write decisions down with the reasoning, so context survives the meeting.'"],traps:["Dumping detail on an exec audience.","Ambiguous updates that generate follow-up emails.","Interrupting, or answering before the question is finished.","Avoiding hard feedback to keep things pleasant."],qa:[{q:"How do you explain a technical decision to a non-technical stakeholder?",a:"Lead with the outcome and the business impact, not the mechanism. One-line context, the options considered, the recommendation, and what it costs or buys. Offer the technical depth separately for anyone who wants it. Check understanding with a question rather than assuming it landed."},{q:"Tell me about a time you disagreed with a teammate and how you handled it.",a:"Structure: the disagreement (technical, not personal), how I listened to their position and argued from data or a quick experiment, how we reached a decision (and who owned it), and the outcome. Emphasize that the relationship survived because the disagreement was about the problem, not the person."}],related:["cross-team collaboration","code review","executive communication","risk management"]},$x={concepts:[{name:"Event loop & async",blurb:"Call stack, task queue, microtasks — the model behind promises and async/await."},{name:"Scoping & closures",blurb:"Lexical scope, closures, and why 'var vs let vs const' actually matters."},{name:"Prototypes & this",blurb:"Property lookup chains, and how context binding works (and breaks)."},{name:"Types & inference",blurb:"TypeScript's structural typing, unions, generics — and the costs of the type system."},{name:"Modules & tooling",blurb:"ESM vs CJS, bundlers, tree-shaking, and the build pipeline."}],points:["Explain the event loop in one breath: call stack → task queue → microtasks.","'TypeScript gives me the confidence to refactor at scale.'","Show GC awareness: closures and listeners that leak memory.","Reason about why code breaks, not just how to write it."],traps:["== vs === coercion confusion.","'this' surprises — when arrow functions save you and when they don't.","Blocking the main thread with heavy synchronous work.","Type gymnastics or 'any' everywhere — either extreme loses the point."],qa:[{q:"Explain how JavaScript handles asynchronous code.",a:"JS is single-threaded, so async work doesn't block. The event loop runs the call stack; when an async operation (timer, network, promise) finishes, its callback goes to the task queue or the microtask queue, and the loop drains microtasks before the next task. Promises and async/await are syntax over this — await pauses the function, not the thread. I'd mention ordering: microtasks (promises) run before tasks (timers)."},{q:"What problem does TypeScript solve, and what are its costs?",a:"It adds static types on top of JS: catch whole bug classes at compile time, get editor navigation/refactor safety, and make interfaces explicit across a team. Costs: build step, learning curve, type ceremony on quick code, and occasionally fighting the type system. The trade-off is worth it for codebases that live and grow; I'd keep types pragmatic — infer where possible, model the edges well."}],related:["React · Vue · Angular","language basics","Web performance","data structures"]},Xx={concepts:[{name:"Component model",blurb:"Props down, events up; composition and reusability over inheritance."},{name:"Rendering strategies",blurb:"Virtual DOM vs reactivity vs change detection — what each framework actually does."},{name:"State management",blurb:"Local, lifted, global — and when each level is the right one."},{name:"Lifecycle & effects",blurb:"Mount/update/unmount, dependency arrays, and cleanup that prevents leaks."},{name:"Performance",blurb:"Memoization, code splitting, avoiding wasted re-renders — measured, not guessed."}],points:["Compare frameworks on trade-offs, not loyalty.","'State is the source of truth; the UI is a projection of it.'","Know your effect rules: dependencies, cleanup, and why they matter.","Treat SSR/rendering strategy as a real decision with costs."],traps:["Mutating state in place.","Giant components with tangled prop drilling.","Memoizing everything 'just in case'.","Skipping effect cleanup — memory leaks and stale subscriptions."],qa:[{q:"When do you lift state up vs reach for a global store?",a:"Start with local state; lift to the nearest common parent when two components need it. A global store earns its place when state is shared across many unrelated parts, needs persistence/sync, or has complex derived data — not just to avoid prop drilling. I'd name the cost: global state makes components harder to reason about in isolation, so it should earn that complexity."},{q:"Your page re-renders too often. How do you diagnose and fix it?",a:"Measure first — use the profiler to see which components re-render and why. Common causes: unstable props (new objects/arrays each render), missing memoization, context that updates too broadly, or state living too high. Fix by stabilizing the props, memoizing the right components, or narrowing the context. Re-measure after each change."}],related:["JavaScript / TypeScript","CSS & accessibility","Web performance","testing fundamentals"]},Zx={concepts:[{name:"Box model & layout",blurb:"Flexbox and grid, spacing systems, and the mental model behind every layout."},{name:"Responsive design",blurb:"Mobile-first breakpoints, fluid type, and content that adapts, not just squishes."},{name:"Semantic HTML",blurb:"Landmarks and native elements — the foundation of accessibility."},{name:"Keyboard & screen-reader UX",blurb:"Focus management, ARIA only as a gap-filler, and testing with real tools."},{name:"Design systems",blurb:"Tokens, theming, and consistency at scale."}],points:["'Semantic HTML first; ARIA only to fill genuine gaps.'","Show you reason in flex/grid, not float hacks.","'I test with a keyboard and a screen reader.'","Mention prefers-reduced-motion and contrast ratios."],traps:["Div soup instead of semantic landmarks.","ARIA where a native element would do.","Fixed pixel layouts that break at small sizes.","Decorative markup that confuses screen readers."],qa:[{q:"How do you make a complex form accessible?",a:"Use native inputs with real labels associated via for/id. Group related fields with fieldset/legend. Keep a logical tab order, visible focus states, and clear error messaging linked to the field (aria-describedby). Test with a keyboard only — every step must be reachable — then a screen reader. Native semantics first; ARIA only for what HTML can't express."},{q:"Center a div — and explain the trade-offs of each approach.",a:"Flexbox with justify/align center — simplest, works for anything in a flex container. Grid with place-items — same idea. Margin auto — needs a width on the element. Absolute positioning + transform — works but takes the element out of flow. I'd pick flex/grid first, and mention the key trade-off: which approach affects the surrounding layout."}],related:["React · Vue · Angular","Web performance","JavaScript / TypeScript"]},e1={concepts:[{name:"Core Web Vitals",blurb:"LCP, INP, CLS — what they measure and what typically moves each one."},{name:"Critical rendering path",blurb:"HTML → CSS → JS → first paint, and what blocks it."},{name:"Bundles & assets",blurb:"Code splitting, tree-shaking, and image weight — the biggest wins early."},{name:"Caching",blurb:"HTTP caching, service workers, and edge caching — each layer's job."},{name:"Measure first",blurb:"Lab vs field data, budgets, and optimizing only what's actually slow."}],points:["'I measure before and after — no optimization without data.'","Name the Vitals and the usual culprits for each.","'Ship less JavaScript; split by route.'","Mention the caching strategy at every layer."],traps:["Optimizing without measuring.","Chasing LCP while ignoring layout shift.","Shipping huge images and bundles.","Micro-optimizing code that isn't the bottleneck."],qa:[{q:"Your LCP is 6 seconds. Walk me through your debugging process.",a:"Check field data to confirm it's real and segment by device/route. Then lab tools: Lighthouse for a breakdown, the network panel for the largest element's resources, and the performance trace for what blocks rendering. Common fixes: preload the LCP image, inline critical CSS, remove render-blocking JS, compress/convert images, or serve from the edge. Re-measure after each change."},{q:"How do code splitting and caching interact?",a:"Code splitting makes each route load only what it needs — smaller first paint. Caching makes repeat visits instant: hashed filenames for immutable caching, so the browser reuses unchanged chunks and only fetches what changed. The interaction: split by route + hash + long cache = fast first visit and near-instant repeat visits."}],related:["JavaScript / TypeScript","CSS & accessibility","React · Vue · Angular"]},t1={concepts:[{name:"HTTP semantics",blurb:"Methods, status codes, headers, and caching — the contract between client and server."},{name:"Resource modeling",blurb:"Nouns, nesting, naming — design the surface like a product."},{name:"Idempotency & retries",blurb:"Idempotency keys that make retries safe in distributed systems."},{name:"Error contracts",blurb:"Consistent, machine-readable errors — a stable contract clients can rely on."},{name:"Versioning & evolution",blurb:"Additive, backward-compatible changes and a deprecation path."}],points:["'Design the error contract like a product surface.'","'Idempotency keys make retries safe.'","'Status codes carry meaning — use them consistently.'","'Prefer additive, backward-compatible evolution.'"],traps:["Returning 200 for everything, errors included.","Breaking clients with silent schema changes.","No pagination on list endpoints.","Retrying unsafe operations without idempotency."],qa:[{q:"Design a REST API for creating and canceling orders.",a:"POST /orders to create (201 + location), with an Idempotency-Key so retries don't double-order. Cancel as a state transition: POST /orders/{id}/cancel, or PATCH status — I'd model it explicitly so the flow is visible. Errors as a stable shape: code + message + field. List endpoints paginated. I'd also mention webhooks/status endpoints for async fulfillment."},{q:"How do you evolve an API without breaking clients?",a:"Additive changes first: new fields are additive, new endpoints are safe. Never repurpose an existing field's meaning. Deprecate loudly and slowly — announce, keep serving, then remove on a schedule clients can plan for. Version when the change is breaking, but treat versioning as a last resort because it forks the surface."}],related:["Databases & caching","system design","Distributed systems","Auth & real-time"],architectures:[{name:"Rate Limiter Service",blurb:"Protect backend services from abuse while allowing legitimate bursts.",components:["Client → API Gateway → Rate Limiter (Redis-backed) → Upstream Service","Rate Limiter checks: token bucket / sliding window counter in Redis","Config: per-endpoint limits stored in DB, hot-reloaded into Redis"],tradeoffs:["Token bucket (allows bursts, smooth rate) vs sliding window (stricter, simpler)","Centralized Redis (consistent, single point of failure) vs local counters (fast, eventual consistency)","Per-user limits vs per-IP limits vs per-API-key limits"],scaleNotes:"Redis: ~100K rate-limit checks/sec per instance. At 10K RPS, a single Redis instance handles it. For >50K RPS, use Redis Cluster with sharded rate-limit keys.",failureModes:["Redis down → fail open (allow traffic) or fail closed (reject all)? Choose based on business risk.","Clock skew in distributed counters → use Redis TIME command, not local clock","Race condition on concurrent increments → use Redis MULTI/EXEC or Lua scripts for atomicity"],followUpQa:[{q:"How do you rate-limit a distributed system with multiple API servers?",a:"Centralized rate limiter in Redis: each API server checks the same Redis key for the user's quota. Use INCR + EXPIRE (or Lua script for atomicity) so concurrent requests from multiple servers count correctly. Alternative: local counters with periodic sync — faster but allows slight over-counting."},{q:"How do you handle rate limit headers for clients?",a:"Return X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers on every response. When limited, return 429 with Retry-After header. Clients use these to implement backoff. Document the limits in your API docs."}]}]},n1={concepts:[{name:"Indexing",blurb:"How indexes speed reads and slow writes — and which queries actually need them."},{name:"Transactions & isolation",blurb:"ACID, isolation levels, and when relaxing them is the right call."},{name:"Normalization vs denormalization",blurb:"The read/write trade-off — start normalized, denormalize where reads demand it."},{name:"Caching layers",blurb:"In-memory, query caches, CDNs — and the hard part, invalidation."},{name:"Scaling reads & writes",blurb:"Replicas, sharding, and queues — in that order of complexity."}],points:["'Indexes are a read/write trade-off — here's both sides.'","'Cache invalidation is the hard part; here's my strategy.'","'Start normalized; denormalize where reads demand it.'","'Transactions guarantee correctness where it matters.'"],traps:["Indexing every column.","Caching with no invalidation plan.","Sharding before simpler levers are exhausted.","Ignoring isolation levels until data corrupts."],qa:[{q:"A query is slow. How do you fix it?",a:"EXPLAIN it — check for a full table scan, look at the plan. Common fixes: add the right index (covering if possible), avoid functions on indexed columns, reduce rows returned (paginate, filter early), or restructure the query. Measure before and after. If it's still slow at scale, consider caching or denormalizing — but index first."},{q:"How would you scale a database hitting read limits?",a:"Ladder of options, cheapest first: add read replicas and route read traffic; cache hot reads (Redis/CDN) with an invalidation strategy; denormalize for the hot read patterns; only then consider sharding, which adds real complexity. I'd also check whether you can reduce reads at the app layer — fewer, bigger queries."}],related:["APIs & services","system design","Distributed systems"],architectures:[{name:"Read-Heavy Dashboard",blurb:"Analytics dashboard that serves millions of reads/day from a small write volume.",components:["Write path: App → API → OLTP DB (Postgres) → CDC (Debezium) → OLAP DB (ClickHouse)","Read path: Dashboard → API → OLAP DB (pre-aggregated materialized views)","Cache: Redis for hot dashboard queries (TTL 60s)"],tradeoffs:["OLTP + OLAP split (CQRS): write-optimized DB for app, read-optimized for analytics","Pre-aggregate (fast reads, stale) vs compute on read (fresh, slow)","CDC streaming (near-real-time) vs batch ETL (simpler, 15min delay)"],scaleNotes:"1K writes/s to OLTP, 50K reads/s from OLAP. Materialized views refresh every 5 min. Redis cache cuts OLAP load by 80% for hot dashboards.",failureModes:["CDC lag → dashboard shows stale data → surface freshness indicator","OLAP query timeout → pre-computed views always fast, ad-hoc queries have timeout + fallback","Redis cache miss storm → cache-aside with singleflight to prevent stampede"],followUpQa:[{q:"When should you denormalize?",a:"When a read query joins 3+ tables on every request and the data doesn't change often. Denormalize the hot read path into a materialized view or a separate read-optimized table. Accept the write amplification cost for the read speed gain."},{q:"How do you handle cache invalidation?",a:"TTL-based for most data (stale-while-revalidate). Event-driven for critical paths (write to DB → publish event → cache invalidator subscribes). Versioned cache keys for schema changes. The hard part is knowing when data changed — CDC makes this reliable."}]},{name:"Multi-Tenant SaaS Database",blurb:"Isolation, scaling, and cost efficiency across many tenants.",components:["Per-tenant schema isolation (schema-per-tenant) or shared schema with tenant_id column","Connection pooler (PgBouncer) in front of Postgres","Read replicas for analytics queries"],tradeoffs:["Schema-per-tenant (strong isolation, hard to migrate) vs shared schema (easy to manage, noisy neighbor risk)","Connection pooling ( PgBouncer: transaction mode for serverless) vs direct connections","Per-tenant backups (expensive) vs global backup + point-in-time recovery"],scaleNotes:"100 tenants with 10M rows each = 1B rows total. Shared schema: one DB, index on tenant_id. Schema-per-tenant: 100 schemas, each independently scalable.",failureModes:["Noisy neighbor (one tenant's query overwhelms) → query timeout per tenant + resource quotas","Cross-tenant data leak → RLS (Row Level Security) policies enforced at DB level","Migration across 100 schemas → automated migration scripts with dry-run mode"],followUpQa:[{q:"How do you prevent noisy neighbors?",a:"Per-tenant query timeout (pgStatementTimeout). Resource quotas via connection pooler. Separate read replicas for analytics-heavy tenants. Monitoring per-tenant query patterns to detect abuse early."},{q:"When do you shard a multi-tenant DB?",a:"When a single tenant outgrows one machine (large enterprise with billions of rows). Shard by tenant_id — each shard is a Postgres instance with a subset of tenants. Use Citus for distributed Postgres or application-level sharding with a lookup service."}]}]},nd={concepts:[{name:"Requirements first",blurb:"Functional, non-functional, and scale estimates — before any diagram."},{name:"High-level architecture",blurb:"Clients, services, data stores, queues — and how they talk."},{name:"Data flow",blurb:"Requests, caches, async jobs, and the consistency each step needs."},{name:"Trade-offs",blurb:"Availability vs consistency vs cost vs speed — name yours explicitly."},{name:"Failure modes",blurb:"Retries, backoff, circuit breakers, fallbacks — design for what breaks."}],points:["'Let me clarify requirements and estimate scale before designing.'","'Start simple: a service, a DB, a cache. Add only what's needed.'","'Here's my consistency/availability trade-off, explicitly.'","'What happens when each piece fails?' — walk through failure modes."],traps:["Drawing a diagram before requirements.","Adding Kafka and Kubernetes to every answer for flair.","Ignoring read/write ratio and data size.","No monitoring, rollback, or incident story."],qa:[{q:"Design a URL shortener.",a:"Requirements: create short URLs, redirect at scale, maybe analytics and expiry. Scale estimate: reads >> writes, cache heavily. Design: a service that generates unique IDs (or hashes a counter/key), stores long→short mapping in a DB, redirects with 301/302, and serves hot reads from cache. Mention collisions, DB sharding if needed, and analytics as an async job."},{q:"Design a social feed. How do you handle scale?",a:"Two write paths: push (fan-out on publish — fast reads, heavy writes) vs pull (compute on read — light writes, slow reads), usually a hybrid: push for active users, pull for the long tail. Cache timelines, store posts in a log, and make the read path async where freshness isn't critical. Consistency: eventual is fine for most feeds."}],related:["Distributed systems","Databases & caching","APIs & services","large-scale systems"],architectures:[{name:"URL Shortener",blurb:"Write-light, read-heavy — the classic system design starter.",components:["Client → Load Balancer → API Service → ID Generator → Key-Value Store","Read path: Client → LB → API → Cache (Redis) → DB (fallback)"],tradeoffs:["Counter-based IDs (sequential, predictable) vs hash-based IDs (random, collision risk)","301 redirect (cached, faster) vs 302 redirect (trackable, analytics)","Single DB vs sharded — sharding adds complexity but handles write growth"],scaleNotes:"100M URLs/day → ~1.2K writes/s (single DB). 10B redirects/day → ~115K reads/s → cache + read replicas.",failureModes:["ID generator exhaustion → use wider ID space or switch to hash","Cache stampede on viral URL → cache-aside with TTL jitter","DB write failure → queue writes, serve stale from cache"],followUpQa:[{q:"How would you add click analytics?",a:"Async write: after redirect, fire event to Kafka. Analytics service consumes, writes to ClickHouse. Don't block the redirect on analytics — eventual consistency is fine for counts."},{q:"How do you prevent abuse?",a:"Rate limiting per API key/IP (token bucket in Redis). CAPTCHA for anonymous users. URL allowlist/blocklist. Quotas per tier."}]},{name:"Chat System",blurb:"Real-time bidirectional messaging with delivery guarantees.",components:["Client ← WebSocket → Gateway Service → Message Router → Message Store","Presence Service ← Heartbeat → Client (online/offline/last-seen)","Push Notification Service ← Event → APNs / FCM (for offline recipients)"],tradeoffs:["WebSocket (stateful, low-latency) vs long-polling (simpler, higher latency)","Fan-out on write (pre-compute timelines) vs fan-out on read (light writes)","Exactly-once delivery (complex) vs at-least-once + idempotent consumers (practical)"],scaleNotes:"WhatsApp: ~100B messages/day. Each message = 1 write + N reads (group). Gateway handles ~1M WebSocket connections per server (epoll).",failureModes:["WebSocket disconnect → reconnect with sequence number, replay missed messages","Message store down → queue at gateway, drain on recovery","Push notification failure → retry with exponential backoff, fallback to SMS"],followUpQa:[{q:"How do you handle message ordering?",a:"Monotonically increasing sequence number per conversation (server-assigned). Clients buffer out-of-order messages. For distributed systems, use partition-by-conversation so ordering is per-partition."},{q:"How does end-to-end encryption work?",a:"Signal Protocol (Double Ratchet + X3DH). Each device generates a key pair; server stores public keys only. Messages encrypted client-side. Server relays ciphertext — can't read content. Group encryption uses sender keys."}]},{name:"News Feed",blurb:"The push-vs-pull trade-off — the defining architecture decision.",components:["Write path: Client → Post Service → Fan-out Service → Timeline Cache (per-user)","Read path: Client → Feed Service → Timeline Cache (Redis sorted sets)","Pull fallback: Feed Service → Post Storage (for high-follower accounts)"],tradeoffs:["Fan-out on publish (push): fast reads, heavy writes — OK for most users, expensive for celebrities","Fan-out on read (pull): light writes, slow reads — OK for celebrities, slow for everyone else","Hybrid (Twitter's approach): push for normal users, pull for celebrities","Store full timeline vs store post IDs + hydrate on read"],scaleNotes:"Twitter: ~500M tweets/day, ~350B timeline reads/day. Celebrity tweet = 50M followers → impossible to push, must pull.",failureModes:["Fan-out delay → user sees stale feed → accept eventual consistency (up to 30s)","Celebrity tweet storm → fan-out queue backs up → serve from pull path","Cache eviction on cold users → pull path activates, slightly slower first load"],followUpQa:[{q:"How do you handle the celebrity problem?",a:"Don't fan-out for accounts >N followers. On read: merge pre-computed timeline (normal users) with real-time pulls for celebrity accounts followed. K-way merge on timestamp, bounded by page size."},{q:"How do you rank relevant vs recent?",a:"Two layers: candidate generation (timeline cache gives recent posts) and ranking (ML model scores by predicted engagement). Features: author affinity, post type, recency decay, virality signals. A/B test the ranking function."}]}]},a1={concepts:[{name:"Consistency models",blurb:"Strong vs eventual, and what your feature can actually tolerate."},{name:"Partitioning & replication",blurb:"Sharding, quorums, leader election — data that survives and scales."},{name:"Messaging & queues",blurb:"Decoupling, backpressure, at-least-once delivery and its consequences."},{name:"Failure handling",blurb:"Timeouts, retries, circuit breakers, idempotency — the reliability toolkit."},{name:"Observability",blurb:"Tracing, metrics, and logs as first-class citizens."}],points:["'Assume every network call can fail and every message can duplicate.'","'Choose consistency based on what the feature can tolerate.'","'Idempotent handlers make retries safe.'","'You can't debug what you can't observe.'"],traps:["Assuming synchronous consistency everywhere.","Retrying without backoff or idempotency.","Ignoring partial failure in request flows.","No tracing — black-box production incidents."],qa:[{q:"Explain the CAP theorem with a concrete example.",a:"When a network partition happens, you choose between consistency (all nodes agree) and availability (every request gets a response). A bank transfer needs consistency — better to reject during a partition. A social 'like' count tolerates eventual consistency — keep serving. The point: CAP forces you to decide what matters per feature, not per system."},{q:"Your service is slow in production. How do you find the cause?",a:"Start from observability: dashboards for latency/error rate, then distributed traces to find which hop is slow, then logs for the specific request. Common causes: a downstream dependency, a hot key, GC, or a slow query. Fix, then add an alert so it doesn't recur silently."}],related:["system design","Databases & caching","SRE & observability","APIs & services"],architectures:[{name:"Distributed Task Queue",blurb:"Reliable background job processing with retries and idempotency.",components:["Producer → Message Broker (Kafka / SQS) → Consumer Workers → Database","Dead Letter Queue (DLQ) for permanently failed jobs","Monitoring: Grafana dashboards for queue depth, latency, error rate"],tradeoffs:["At-least-once + idempotent consumers (practical) vs exactly-once (complex, slow)","Push (broker delivers, lower latency) vs pull (workers poll, simpler, better backpressure)","FIFO ordering (limited throughput) vs unordered (higher parallelism)"],scaleNotes:"Kafka: millions of events/sec per topic. SQS: ~3K messages/sec standard, ~300/sec FIFO. Consumer parallelism = partition count.",failureModes:["Consumer crash → broker redelivers → idempotent handler deduplicates","Poison message → max retries exceeded → moves to DLQ for inspection","Consumer lag → scale consumers horizontally (partition count limits this)"],followUpQa:[{q:"How do you handle poison messages that always fail?",a:"Move to a Dead Letter Queue (DLQ) after N retries with exponential backoff. Alert on DLQ depth. Inspect the message: often a schema change broke the handler. Fix the handler, replay from DLQ. Never block the main queue on a poison message."},{q:"Kafka vs SQS — when do you choose which?",a:"Kafka: when you need replay (retention days/weeks), multiple consumer groups reading the same events, or high throughput (>100K/s). SQS: when you need simple work queue semantics, no replay, and AWS-managed infra. Kafka is a log; SQS is a queue. Use the log when the event matters beyond the first consumer."}]},{name:"Service Mesh Pattern",blurb:"Cross-cutting concerns (TLS, retries, tracing) extracted from application code into infrastructure.",components:["Service A ← Sidecar Proxy (Envoy) → Service B ← Sidecar Proxy → Service C","Control Plane (Istio / Linkerd) — config distribution, cert management","Observability: Jaeger traces, Prometheus metrics, Kibana logs — all from sidecars"],tradeoffs:["Sidecar overhead (latency, memory per pod) vs removing cross-cutting code from services","Istio (feature-rich, complex) vs Linkerd (lighter, simpler)","mTLS everywhere (security) vs permissive mode (easier migration)"],scaleNotes:"Sidecar adds ~10ms p99 latency per hop, ~50MB memory per pod. At 100 services × 3 replicas = 300 sidecars. Acceptable for most; consider skip-perf for latency-critical paths.",failureModes:["Sidecar crash → traffic fails → restart policy + readiness probes","Control plane down → new config can't propagate, existing proxies continue with last config","mTLS cert expiry → auto-rotation via control plane, monitor cert TTL"],followUpQa:[{q:"When should you NOT use a service mesh?",a:"When you have <10 services and no mTLS compliance requirement. The operational complexity of a mesh (debugging sidecar issues, resource overhead) outweighs the benefits. Start with per-service libraries for retries/tracing; graduate to a mesh when the cross-cutting code is duplicated across many teams."},{q:"How does a service mesh handle canary deployments?",a:"Traffic splitting at the sidecar: route 5% of traffic to the new version's pods. The control plane configures the split; sidecars enforce it. Metrics from both versions are compared in real-time. If error rate spikes, automatic rollback shifts traffic back. This is how Argo Rollouts + Istio work together."}]}]},i1={concepts:[{name:"Creational",blurb:"Factory, builder, singleton — flexible object creation without global-state abuse."},{name:"Structural",blurb:"Adapter, facade, decorator — composing types cleanly."},{name:"Behavioral",blurb:"Strategy, observer, state — delegating behavior and decoupling callers."},{name:"When to skip them",blurb:"Simplicity beats pattern-fitting; a pattern earns its place by solving a real problem."},{name:"Patterns in the wild",blurb:"Recognize them in your framework — most patterns are already there, used well."}],points:["'Name the problem a pattern solves before naming the pattern.'","'Patterns are tools, not goals — I prefer the simplest correct design.'","'Recognize patterns in the framework rather than forcing them in.'","Discuss alternatives and trade-offs, not just the pattern."],traps:["Pattern-packing a codebase for looks.","Singleton misuse as a global-state hack.","Abstracting before there's a second use case.","Reciting GoF definitions without application."],qa:[{q:"Give an example of a pattern you used and the problem it solved.",a:"Pick one you actually used: e.g. a strategy pattern to swap payment providers without touching callers, or an observer for event handling. Structure: the problem (rigid code, or a switch that grew), why the pattern fit, what it cost (more files/indirection), and how it paid off (new provider added with zero changes to callers)."},{q:"When would you NOT use a design pattern?",a:"When the simple version is already clear. If there's one implementation today and no sign of a second, abstraction is speculative. Patterns add indirection and files; they pay for themselves only when the variation actually arrives. I'd rather rename a variable than add a factory."}],related:["code review","language basics","technical strategy"]},s1={concepts:[{name:"Review the intent",blurb:"Understand what the change is for before judging the diff."},{name:"Read for risk",blurb:"Correctness, security, performance, edge cases — in that order of importance."},{name:"Kind, specific feedback",blurb:"Suggestions over commands; explain the 'why' of a concern."},{name:"Self-review first",blurb:"Run the diff through your own eyes before asking anyone else."},{name:"Small, focused changes",blurb:"The best review is a small diff — reviewability is a feature of the author's work."}],points:["'I review for correctness and risk first, style and nits last.'","'I leave reviews I'd want to receive: specific, actionable, kind.'","'I self-review and run the tests before requesting a review.'","'I ask questions — why here? — rather than issuing commands.'"],traps:["Nitpicking style while missing a logic bug.","Blocking merges on personal preference.","Approving without understanding the change.","Reviewing only after the PR has grown huge."],qa:[{q:"What do you look for when reviewing a pull request?",a:"First the intent: does the change do what the description says? Then correctness and risk: edge cases, error handling, security, performance. Then test coverage: is the behavior that matters covered? Finally style and naming, explicitly as nits. I leave blocking comments only for things that matter, and I explain why."},{q:"How do you give feedback on a teammate's code without friction?",a:"Comment on the code, not the person; frame as questions or suggestions with the 'why'; praise what's good explicitly; separate must-fix from nice-to-have. If something's unclear, assume good intent and ask. Review fast so the feedback is still relevant."}],related:["testing fundamentals","communication","debugging"]},Wd={concepts:[{name:"STAR structure",blurb:"Situation, Task, Action, Result — the skeleton of every story."},{name:"Quantified results",blurb:"Numbers, timeframes and scope — outcomes that land."},{name:"Own the outcome",blurb:"Your role explicitly, including failures and the lesson."},{name:"Leadership signals",blurb:"Influence without authority, mentoring, and raising the bar."},{name:"Story bank",blurb:"Have 4–6 rehearsed stories covering conflict, failure, leadership, impact."}],points:["'I structure every story as STAR: situation, task, action, result.'","Name the outcome with numbers: scale, time saved, measurable impact.","For failures: what you learned and what you changed.","'Here's specifically what I did' — your role, not just the team's."],traps:["Rambling past two minutes without structure.","Vague results — 'it went well' — with no metrics.","Taking all the credit or none of it.","Scripts that sound rehearsed."],qa:[{q:"Tell me about a time you had a conflict with a teammate.",a:"STAR it: the situation (a real disagreement), the task (we needed a decision), the action (I listened, argued from data or a small experiment, and we reached a decision together — or escalated cleanly), the result (what shipped and what it taught you). The interviewer is testing whether you handle disagreement professionally, not whether you won."},{q:"Tell me about a time you failed and what you changed.",a:"Pick a real failure with real stakes. Structure: what I attempted, what went wrong and why (own it — no blaming), what I changed as a result (process, checks, communication), and what happened next. A good answer shows self-awareness and that the lesson stuck."}],related:["communication","cross-team collaboration","executive communication"]},$d={concepts:[{name:"Vision & direction",blurb:"Define outcomes and constraints, not just tasks."},{name:"Influence without authority",blurb:"Aligning peers and stakeholders through clarity and trust."},{name:"Trade-offs at scale",blurb:"Cost, risk, speed and quality — and making the call."},{name:"Org building",blurb:"Hiring bars, processes, and culture that compounds."},{name:"Execution & review",blurb:"Metrics, checkpoints, and course correction."}],points:["'I define the outcome, the constraints, and the review points.'","'Decisions come with named trade-offs and a date to revisit.'","'I measure what matters and kill what doesn't.'","'I build the bar for the role, then hire and mentor to it.'"],traps:["Direction without measurable outcomes.","Deciding in isolation and selling late.","Optimizing process over people.","Ignoring feedback loops until too late."],qa:[{q:"How do you set technical direction for a team?",a:"Start from the business outcome, then translate it into technical principles and a roadmap with explicit trade-offs. Socialize early — get input before the decision, not after. Write the decision down with the alternatives considered, and define what success looks like so you can review it honestly later."},{q:"How do you handle a project that's behind schedule?",a:"First, understand why — scope, estimates, dependencies, or surprises. Then re-plan honestly: what's the critical path, what can be cut or deferred, and what does the stakeholder actually need by when. Communicate the new plan early with options, not just bad news, and set up a checkpoint so it doesn't slip again silently."}],related:["executive communication","risk management","technical vision","communication"]},Xd={"language basics":Fx,"testing fundamentals":Vx,"data structures":Qg,"data structures & algorithms":Qg,debugging:Jx,communication:Wx,"javascript / typescript":$x,"react · vue · angular":Xx,"css & accessibility":Zx,"web performance":e1,"apis & services":t1,"databases & caching":n1,"system design":nd,"moderate system design":nd,"large-scale systems":nd,"distributed systems":a1,"design patterns":i1,"code review":s1},r1=/tell me about a time|conflict|proud|failed|disagreed|mistake|behavioral|star story|teamwork/,o1=/architecture|strategy|vision|org-?wide|platform|hiring bar|technical direction/;function l1(n){const i=Kx(n),r=Xd[i];return r||(r1.test(i)?Wd:o1.test(i)?$d:u1(n))}function lb(){const n=[],i=new Set,r=[...Object.values(Xd),Wd,$d];for(const o of r)for(const u of o.qa)i.has(u.q)||(i.add(u.q),n.push({q:u.q,a:u.a,kp:o.points.slice(0,3),lvl:"mid"}));return n}function c1(){return[...Object.entries(Xd).map(([n,i])=>({label:n,dd:i})),{label:"behavioral stories",dd:Wd},{label:"leadership",dd:$d}]}function u1(n){const i=n.charAt(0).toUpperCase()+n.slice(1);return{concepts:[{name:"Core fundamentals",blurb:`The essential concepts behind ${i} — know these cold before the interview.`},{name:"Common patterns & approaches",blurb:"The standard approaches interviewers expect, and when each one fits."},{name:"Trade-offs",blurb:"Every approach has costs — practice comparing options and justifying your pick."},{name:"Real-world application",blurb:`Be ready to tie ${i} back to a project you actually shipped.`}],points:[`Open with a one-line definition of ${i} before going deeper.`,"Structure your answer: approach → reasoning → trade-offs → example.","Name the standard tools and practices in this area and why you chose them.","Quantify impact where you can — time saved, scale, reliability."],traps:["Jumping into details without defining the problem first.","Using jargon without explaining it in plain terms.","Claiming expertise without a concrete example to back it up.","Ignoring the trade-offs of the approach you recommend."],qa:[{q:`Walk me through how you approach ${i}.`,a:"A strong answer covers: what the problem actually is, the standard approaches, the trade-offs of each, what you'd choose and why — then a concrete example from your experience. Finish by inviting questions."}],related:[]}}const d1=[{kind:"fn",id:"fn-debounce",title:"Debounce",difficulty:2,category:"timing",prompt:"Implement debounce(fn, wait): returns a function that delays invoking fn until wait ms have passed since the last call. If the returned function is called again before the wait elapses, the timer resets.",fn:{name:"debounce",args:"fn, wait",returns:"debounced function"},starter:`function debounce(fn, wait) {
  // your code here
}`,tests:[{label:"fires once after the trailing quiet period",args:[],drive:async n=>{const i=[],r=n(o=>i.push(o),20);return r(1),r(2),r(3),await new Promise(o=>setTimeout(o,60)),i},expect:[3]},{label:"resets the timer on every call",args:[],drive:async n=>{const i=[],r=n(o=>i.push(o),20);return r(1),await new Promise(o=>setTimeout(o,10)),r(2),await new Promise(o=>setTimeout(o,40)),i},expect:[2]},{label:"separate debounced functions do not interfere",args:[],drive:async n=>{const i=[],r=[],o=n(d=>i.push(d),15),u=n(d=>r.push(d),15);return o(1),u(2),await new Promise(d=>setTimeout(d,40)),[i,r]},expect:[[1],[2]]}],hidden:[{label:"forwards the arguments of the last call",args:[],drive:async n=>{const i=[];return n((o,u)=>i.push([o,u]),10)(1,2),await new Promise(o=>setTimeout(o,40)),i},expect:[[1,2]]}],reference:`function debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}`},{kind:"fn",id:"fn-throttle",title:"Throttle",difficulty:2,category:"timing",prompt:"Implement throttle(fn, wait): returns a function that calls fn at most once per wait ms — the first call fires immediately, subsequent calls during the window are ignored (a trailing call fires after the window).",fn:{name:"throttle",args:"fn, wait",returns:"throttled function"},starter:`function throttle(fn, wait) {
  // your code here
}`,tests:[{label:"fires immediately, then at most one trailing call",args:[],drive:async n=>{const i=[],r=n(o=>i.push(o),40);return r("a"),r("b"),r("c"),await new Promise(o=>setTimeout(o,80)),i},expect:["a","c"]},{label:"fires again once the window has elapsed",args:[],drive:async n=>{const i=[],r=n(o=>i.push(o),20);return r(1),await new Promise(o=>setTimeout(o,30)),r(2),await new Promise(o=>setTimeout(o,30)),i},expect:[1,2]}],hidden:[{label:"passes the latest arguments to the trailing call",args:[],drive:async n=>{const i=[],r=n(o=>i.push(o),30);return r(1),r(2),r(3),await new Promise(o=>setTimeout(o,60)),i},expect:[1,3]}],reference:`function throttle(fn, wait) {
  let last = 0;
  let timer = null;
  let lastArgs = null;
  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else {
      lastArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(this, lastArgs);
        }, remaining);
      }
    }
  };
}`},{kind:"fn",id:"fn-deep-clone",title:"Deep Clone",difficulty:3,category:"collections",prompt:"Implement deepClone(value): returns a deep copy of objects, arrays, primitives and Dates. Nested structures must be independent of the original — mutating the clone must not affect the source.",fn:{name:"deepClone",args:"value",returns:"deep copy"},starter:`function deepClone(value) {
  // your code here
}`,tests:[{label:"deep-clones nested objects and arrays",args:[{a:1,b:[1,2,{c:3}],d:null,e:void 0,f:NaN}],expect:{a:1,b:[1,2,{c:3}],d:null,e:void 0,f:NaN}},{label:"returns a distinct reference",args:[],drive:n=>{const i={x:1};return n(i)!==i},expect:!0},{label:"clones dates with the same instant",args:[new Date("2024-01-01T00:00:00Z")],expect:new Date("2024-01-01T00:00:00Z")}],hidden:[{label:"nested arrays stay independent after mutation",args:[],drive:n=>{const i=[1,[2,[3]]];return n(i)[1].push(99),i[1]},expect:[2,[3]]}],reference:`function deepClone(value, seen = new Map()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  const out = Array.isArray(value) ? [] : {};
  seen.set(value, out);
  for (const key of Object.keys(value)) {
    out[key] = deepClone(value[key], seen);
  }
  return out;
}`},{kind:"fn",id:"fn-promise-all",title:"Promise.all",difficulty:3,category:"async",prompt:"Implement promiseAll(promises): returns a promise that resolves with an array of every input's value, in order, or rejects with the first rejection. Works with non-promise values too and with an empty array.",fn:{name:"promiseAll",args:"promises",returns:"Promise<values[]>"},starter:`function promiseAll(promises) {
  // your code here
}`,tests:[{label:"resolves with results in input order",args:[[Promise.resolve(1),Promise.resolve(2),Promise.resolve(3)]],expect:[1,2,3]},{label:"resolves with an empty array",args:[[]],expect:[]},{label:"rejects when any promise rejects",args:[],drive:async n=>{try{return await n([Promise.resolve(1),Promise.reject(new Error("nope"))]),"no-reject"}catch(i){return i.message}},expect:"nope"}],hidden:[{label:"preserves order for mixed-resolution inputs",args:[],drive:async n=>await n([new Promise(i=>setTimeout(()=>i("a"),15)),Promise.resolve("b"),new Promise(i=>setTimeout(()=>i("c"),5))]),expect:["a","b","c"]}],reference:`function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    const results = new Array(promises.length);
    let pending = promises.length;
    if (pending === 0) return resolve([]);
    promises.forEach((p, i) => {
      Promise.resolve(p).then(v => {
        results[i] = v;
        pending--;
        if (pending === 0) resolve(results);
      }, reject);
    });
  });
}`},{kind:"fn",id:"fn-promise-race",title:"Promise.race",difficulty:2,category:"async",prompt:"Implement promiseRace(promises): returns a promise that settles with the first promise to settle — its value if it resolves, its reason if it rejects.",fn:{name:"promiseRace",args:"promises",returns:"Promise<first settled value>"},starter:`function promiseRace(promises) {
  // your code here
}`,tests:[{label:"resolves with the first settled value",args:[],drive:async n=>await n([new Promise(i=>setTimeout(()=>i("slow"),30)),Promise.resolve("fast")]),expect:"fast"},{label:"rejects if the first settled is a rejection",args:[],drive:async n=>{try{return await n([Promise.reject(new Error("boom")),Promise.resolve(1)]),"no-reject"}catch(i){return i.message}},expect:"boom"}],hidden:[{label:"picks the fastest async value",args:[],drive:async n=>await n([new Promise(i=>setTimeout(()=>i("a"),20)),new Promise(i=>setTimeout(()=>i("b"),5))]),expect:"b"}],reference:`function promiseRace(promises) {
  return new Promise((resolve, reject) => {
    for (const p of promises) Promise.resolve(p).then(resolve, reject);
  });
}`},{kind:"fn",id:"fn-event-emitter",title:"EventEmitter",difficulty:3,category:"classes",prompt:"Implement an EventEmitter class with on(name, fn), off(name, fn), emit(name, ...args) and once(name, fn). off removes a specific listener; once fires the listener at most once and then removes it.",fn:{name:"EventEmitter",args:"constructor()",returns:"class with on/off/emit/once"},starter:`class EventEmitter {
  // your code here
}`,tests:[{label:"on + emit delivers arguments",args:[],drive:n=>{const i=new n,r=[];return i.on("ping",o=>r.push(o)),i.emit("ping",42),r},expect:[42]},{label:"off removes a specific listener",args:[],drive:n=>{const i=new n,r=[],o=u=>r.push(u);return i.on("a",o),i.emit("a",1),i.off("a",o),i.emit("a",2),r},expect:[1]},{label:"once fires a single time",args:[],drive:n=>{const i=new n;let r=0;return i.once("b",()=>r++),i.emit("b"),i.emit("b"),r},expect:1}],hidden:[{label:"all listeners fire on emit",args:[],drive:n=>{const i=new n;let r=0;return i.on("c",()=>{r+=1}),i.on("c",()=>{r+=10}),i.emit("c"),r},expect:11}],reference:`class EventEmitter {
  constructor() {
    this.events = new Map();
  }
  on(name, fn) {
    if (!this.events.has(name)) this.events.set(name, []);
    this.events.get(name).push(fn);
    return this;
  }
  off(name, fn) {
    const list = this.events.get(name);
    if (list) {
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    }
    return this;
  }
  emit(name, ...args) {
    for (const fn of [...(this.events.get(name) || [])]) fn(...args);
    return this;
  }
  once(name, fn) {
    const wrap = (...args) => {
      this.off(name, wrap);
      fn(...args);
    };
    return this.on(name, wrap);
  }
}`},{kind:"fn",id:"fn-memoize",title:"Memoize",difficulty:2,category:"collections",prompt:"Implement memoize(fn): returns a memoized version that caches results by argument values (deep, JSON-style keys) so fn runs once per distinct input.",fn:{name:"memoize",args:"fn",returns:"memoized function"},starter:`function memoize(fn) {
  // your code here
}`,tests:[{label:"computes once for repeated equal args",args:[],drive:n=>{let i=0;const r=n(o=>(i++,o*2));return r(4),r(4),i},expect:1},{label:"computes once per distinct argument",args:[],drive:n=>{const i=[],r=n(o=>(i.push(o),o));return r(1),r(2),r(1),r(3),i},expect:[1,2,3]}],hidden:[{label:"caches object args by value",args:[],drive:n=>{let i=0;const r=n(o=>(i++,o.v*2));return r({v:5}),r({v:5}),i},expect:1}],reference:`function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}`},{kind:"fn",id:"fn-once",title:"Once",difficulty:1,category:"composition",prompt:"Implement once(fn): returns a function that calls fn only the first time it is invoked, then returns that first result on every later call.",fn:{name:"once",args:"fn",returns:"single-call wrapper"},starter:`function once(fn) {
  // your code here
}`,tests:[{label:"calls the function only once",args:[],drive:n=>{let i=0;const r=n(()=>++i);return r(),r(),r(),i},expect:1},{label:"returns the first result on repeat calls",args:[],drive:n=>{const i=n(u=>u*10),r=i(1),o=i(2);return[r,o]},expect:[10,10]}],hidden:[{label:"captures the first call's arguments",args:[],drive:n=>{const i=[],r=n((o,u)=>(i.push([o,u]),o+u));return r(2,3),r(9,9),i},expect:[[2,3]]}],reference:`function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (called) return result;
    called = true;
    result = fn.apply(this, args);
    return result;
  };
}`},{kind:"fn",id:"fn-flatten",title:"Flatten",difficulty:2,category:"collections",prompt:"Implement flatten(arr): returns a new array with all nested arrays flattened to any depth, preserving order.",fn:{name:"flatten",args:"arr",returns:"flat array"},starter:`function flatten(arr) {
  // your code here
}`,tests:[{label:"flattens nested arrays to any depth",args:[[1,[2,[3,[4]]],5]],expect:[1,2,3,4,5]},{label:"keeps non-array values in order",args:[[1,[2,3],4]],expect:[1,2,3,4]}],hidden:[{label:"handles empty and nested-empty arrays",args:[[[],[1,[]],[]]],expect:[1]}],reference:`function flatten(arr) {
  const out = [];
  for (const item of arr) {
    if (Array.isArray(item)) out.push(...flatten(item));
    else out.push(item);
  }
  return out;
}`},{kind:"fn",id:"fn-uniq",title:"Uniq",difficulty:1,category:"collections",prompt:"Implement uniq(arr): returns a new array with duplicate values removed, keeping the first occurrence's order. NaN counts as equal to NaN.",fn:{name:"uniq",args:"arr",returns:"deduplicated array"},starter:`function uniq(arr) {
  // your code here
}`,tests:[{label:"removes duplicates keeping first-occurrence order",args:[[1,1,2,3,2,3,4]],expect:[1,2,3,4]},{label:"works with strings",args:[["a","b","a","c"]],expect:["a","b","c"]}],hidden:[{label:"treats NaN as equal",args:[[NaN,NaN,1]],expect:[NaN,1]}],reference:`function uniq(arr) {
  return [...new Set(arr)];
}`},{kind:"fn",id:"fn-chunk",title:"Chunk",difficulty:1,category:"collections",prompt:"Implement chunk(arr, size): splits an array into groups of `size` items, with the final group possibly smaller.",fn:{name:"chunk",args:"arr, size",returns:"array of chunks"},starter:`function chunk(arr, size) {
  // your code here
}`,tests:[{label:"splits into chunks of the given size",args:[[1,2,3,4,5],2],expect:[[1,2],[3,4],[5]]},{label:"works when evenly divisible",args:[[1,2,3,4],2],expect:[[1,2],[3,4]]}],hidden:[{label:"returns empty for an empty array",args:[[],3],expect:[]}],reference:`function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}`},{kind:"fn",id:"fn-group-by",title:"Group By",difficulty:2,category:"collections",prompt:"Implement groupBy(arr, keyFn): returns an object mapping each keyFn(item) result to the array of items producing it, in insertion order.",fn:{name:"groupBy",args:"arr, keyFn",returns:"grouped object"},starter:`function groupBy(arr, keyFn) {
  // your code here
}`,tests:[{label:"groups by a key function",args:[[1,2,3,4,5],n=>n%2===0?"even":"odd"],expect:{odd:[1,3,5],even:[2,4]}},{label:"groups objects by a property",args:[[{t:"a"},{t:"b"},{t:"a"}],n=>n.t],expect:{a:[{t:"a"},{t:"a"}],b:[{t:"b"}]}}],hidden:[{label:"preserves insertion order of groups",args:[["x","y","x","z"],n=>n],expect:{x:["x","x"],y:["y"],z:["z"]}}],reference:`function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!out[key]) out[key] = [];
    out[key].push(item);
  }
  return out;
}`},{kind:"fn",id:"fn-pipe",title:"Pipe",difficulty:1,category:"composition",prompt:"Implement pipe(...fns): returns a function that passes its input through each function left to right, threading the result into the next.",fn:{name:"pipe",args:"...fns",returns:"composed function"},starter:`function pipe(...fns) {
  // your code here
}`,tests:[{label:"applies functions left to right",args:[],drive:n=>n(i=>i+1,i=>i*2)(5),expect:12},{label:"works with a single function",args:[],drive:n=>n(i=>i*3)(4),expect:12}],hidden:[{label:"threads the value through many steps",args:[],drive:n=>n(i=>i+2,i=>i*10,i=>i-5)(1),expect:25}],reference:`function pipe(...fns) {
  return (input) => fns.reduce((acc, fn) => fn(acc), input);
}`},{kind:"fn",id:"fn-compose",title:"Compose",difficulty:2,category:"composition",prompt:"Implement compose(...fns): returns a function that applies the functions right to left — compose(f, g)(x) === f(g(x)).",fn:{name:"compose",args:"...fns",returns:"composed function"},starter:`function compose(...fns) {
  // your code here
}`,tests:[{label:"applies functions right to left",args:[],drive:n=>n(i=>i*2,i=>i+1)(3),expect:8},{label:"single function identity",args:[],drive:n=>n(i=>i-1)(10),expect:9}],hidden:[{label:"compose with three functions",args:[],drive:n=>n(i=>i*3,i=>i+2,i=>i*2)(5),expect:36}],reference:`function compose(...fns) {
  return (input) => fns.reduceRight((acc, fn) => fn(acc), input);
}`},{kind:"fn",id:"fn-curry",title:"Curry",difficulty:3,category:"composition",prompt:"Implement curry(fn): returns a curried version that keeps collecting arguments until the function's arity (fn.length) is satisfied, then calls fn with all of them.",fn:{name:"curry",args:"fn",returns:"curried function"},starter:`function curry(fn) {
  // your code here
}`,tests:[{label:"curries until the arity is met",args:[],drive:n=>n((i,r,o)=>i+r+o)(1)(2)(3),expect:6},{label:"accepts multiple args at once",args:[],drive:n=>n((i,r,o)=>i*r+o)(1,2)(3),expect:5}],hidden:[{label:"partial application two at a time",args:[],drive:n=>n((i,r)=>i-r)(10)(4),expect:6}],reference:`function curry(fn) {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
}`},{kind:"fn",id:"fn-sleep",title:"Sleep",difficulty:1,category:"async",prompt:"Implement sleep(ms): returns a promise that resolves (to undefined) after at least ms milliseconds.",fn:{name:"sleep",args:"ms",returns:"Promise<void>"},starter:`function sleep(ms) {
  // your code here
}`,tests:[{label:"resolves after the requested delay",args:[],drive:async n=>{const i=Date.now();return await n(30),Date.now()-i>=25},expect:!0},{label:"resolves to undefined",args:[5],expect:void 0}],hidden:[{label:"resolves for a zero delay",args:[0],expect:void 0}],reference:`function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}`},{kind:"fn",id:"fn-map-limit",title:"Map Limit",difficulty:3,category:"async",prompt:"Implement mapLimit(items, limit, mapper): returns a promise resolving with mapper(item, index) applied to every item, running at most `limit` mapper calls concurrently, preserving order.",fn:{name:"mapLimit",args:"items, limit, mapper",returns:"Promise<results[]>"},starter:`async function mapLimit(items, limit, mapper) {
  // your code here
}`,tests:[{label:"maps all items with correct results",args:[],drive:async n=>n([1,2,3,4],2,async i=>i*2),expect:[2,4,6,8]},{label:"never runs more than the limit concurrently",args:[],drive:async n=>{let i=0,r=0;return{results:await n([1,2,3,4,5,6],2,async u=>(i++,r=Math.max(r,i),await new Promise(d=>setTimeout(d,10)),i--,u)),maxActive:r}},expect:{results:[1,2,3,4,5,6],maxActive:2}}],hidden:[{label:"handles a limit larger than the list",args:[],drive:async n=>n([1,2,3],10,async i=>i+1),expect:[2,3,4]}],reference:`async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await mapper(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}`},{kind:"fn",id:"fn-binary-search",title:"Binary Search",difficulty:2,category:"search",prompt:"Implement binarySearch(arr, target): returns the index of target in a sorted array, or -1 if it is not present. Must be O(log n).",fn:{name:"binarySearch",args:"arr, target",returns:"index or -1"},starter:`function binarySearch(arr, target) {
  // your code here
}`,tests:[{label:"finds the target in a sorted array",args:[[-1,0,3,5,9,12],9],expect:4},{label:"returns -1 when absent",args:[[-1,0,3,5,9,12],2],expect:-1}],hidden:[{label:"handles a single element",args:[[7],7],expect:0},{label:"target smaller than everything",args:[[1,2,3],0],expect:-1}],reference:`function binarySearch(arr, target) {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`},{kind:"fn",id:"fn-lru-cache",title:"LRU Cache",difficulty:3,category:"classes",prompt:"Implement an LRUCache class with get(key) and put(key, value) that keeps the `capacity` most recently used entries. get returns -1 for missing keys and marks the entry as recently used; put evicts the least recently used entry when over capacity.",fn:{name:"LRUCache",args:"constructor(capacity)",returns:"class with get/put"},starter:`class LRUCache {
  // your code here
}`,tests:[{label:"stores and retrieves values",args:[],drive:n=>{const i=new n(2);return i.put(1,"a"),i.put(2,"b"),[i.get(1),i.get(2)]},expect:["a","b"]},{label:"evicts the least recently used when over capacity",args:[],drive:n=>{const i=new n(2);return i.put(1,"a"),i.put(2,"b"),i.get(1),i.put(3,"c"),[i.get(1),i.get(2),i.get(3)]},expect:["a",-1,"c"]}],hidden:[{label:"returns -1 for missing keys",args:[],drive:n=>new n(1).get(9),expect:-1}],reference:`class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }
  get(key) {
    if (!this.cache.has(key)) return -1;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
  }
}`},{kind:"fn",id:"fn-range",title:"Range",difficulty:1,category:"collections",prompt:"Implement range(start, end, step = 1): returns an array of numbers from start up to (not including) end, advancing by step. Support negative steps for descending ranges.",fn:{name:"range",args:"start, end, step = 1",returns:"array of numbers"},starter:`function range(start, end, step = 1) {
  // your code here
}`,tests:[{label:"builds a start-inclusive end-exclusive range",args:[1,5],expect:[1,2,3,4]},{label:"respects a custom step",args:[0,10,2],expect:[0,2,4,6,8]}],hidden:[{label:"supports negative steps",args:[5,1,-1],expect:[5,4,3,2]}],reference:`function range(start, end, step = 1) {
  const out = [];
  if (step === 0) return out;
  if (step > 0) {
    for (let i = start; i < end; i += step) out.push(i);
  } else {
    for (let i = start; i > end; i += step) out.push(i);
  }
  return out;
}`}],Fe=n=>`import sys

# Input:
#   ${n}
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,Ve=n=>`// Input:
//   ${n}
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,Je=n=>`// Input:
//   ${n}
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,We=n=>`#include <bits/stdc++.h>
using namespace std;

// Input:
//   ${n}
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,$e=n=>`import java.util.*;

class Main {
    // Input:
    //   ${n}
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,Xe=n=>`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   ${n}
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`,p1=[{kind:"cli",id:"reverse-string",title:"Reverse String",difficulty:1,prompt:"Reverse the given string.",io:"Single line: the string. Output: the reversed string.",starters:{python:Fe("single line: string → reversed string"),javascript:Ve("single line: string → reversed string"),typescript:Je("single line: string → reversed string"),cpp:We("single line: string → reversed string"),java:$e("single line: string → reversed string"),go:Xe("single line: string → reversed string")},tests:[{stdin:`hello
`,expect:"olleh"},{stdin:`a
`,expect:"a"},{stdin:`A man a plan
`,expect:"nalp a nam A"}],hidden:[{stdin:`
`,expect:""},{stdin:`racecar
`,expect:"racecar"}],hint:"Split into characters, reverse, join.",reference:`function solve(lines) {
  return [(lines[0] || "").split("").reverse().join("")];
}`},{kind:"cli",id:"palindrome",title:"Palindrome Check",difficulty:1,prompt:"Determine whether a string reads the same forward and backward, ignoring case. Output true or false.",io:"Single line: the string. Output: true if a palindrome, otherwise false.",starters:{python:Fe("single line: string → true or false"),javascript:Ve("single line: string → true or false"),typescript:Je("single line: string → true or false"),cpp:We("single line: string → true or false"),java:$e("single line: string → true or false"),go:Xe("single line: string → true or false")},tests:[{stdin:`racecar
`,expect:"true"},{stdin:`Racecar
`,expect:"true"},{stdin:`hello
`,expect:"false"},{stdin:`a
`,expect:"true"}],hidden:[{stdin:`
`,expect:"true"},{stdin:`never odd or even
`,expect:"false"}],hint:"Compare the lowercased string with its reverse.",reference:`function solve(lines) {
  const s = (lines[0] || "").toLowerCase();
  return [String(s === s.split("").reverse().join(""))];
}`},{kind:"cli",id:"contains-duplicate",title:"Contains Duplicate",difficulty:1,prompt:"Given an array of integers, output true if any value appears at least twice, otherwise false.",io:"Line 1: n (array length) · Line 2: n space-separated integers. Output: true or false.",starters:{python:Fe("Line 1: n · Line 2: n ints → true or false"),javascript:Ve("Line 1: n · Line 2: n ints → true or false"),typescript:Je("Line 1: n · Line 2: n ints → true or false"),cpp:We("Line 1: n · Line 2: n ints → true or false"),java:$e("Line 1: n · Line 2: n ints → true or false"),go:Xe("Line 1: n · Line 2: n ints → true or false")},tests:[{stdin:`4
1 2 3 1
`,expect:"true"},{stdin:`4
1 2 3 4
`,expect:"false"},{stdin:`3
1 1 1
`,expect:"true"}],hidden:[{stdin:`0

`,expect:"false"},{stdin:`2
-1 -1
`,expect:"true"}],hint:"A Set is shorter than the array iff a duplicate exists.",reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  return [String(new Set(arr).size !== arr.length)];
}`},{kind:"cli",id:"valid-anagram",title:"Valid Anagram",difficulty:1,prompt:"Given two strings, output true if they are anagrams (same characters with the same counts), otherwise false.",io:"Line 1: first string · Line 2: second string. Output: true or false.",starters:{python:Fe("Line 1: s · Line 2: t → true or false"),javascript:Ve("Line 1: s · Line 2: t → true or false"),typescript:Je("Line 1: s · Line 2: t → true or false"),cpp:We("Line 1: s · Line 2: t → true or false"),java:$e("Line 1: s · Line 2: t → true or false"),go:Xe("Line 1: s · Line 2: t → true or false")},tests:[{stdin:`anagram
nagaram
`,expect:"true"},{stdin:`rat
car
`,expect:"false"},{stdin:`a
a
`,expect:"true"},{stdin:`ab
ba
`,expect:"true"}],hidden:[{stdin:`abc
abd
`,expect:"false"},{stdin:`

`,expect:"true"}],hint:"Two strings are anagrams iff sorting their characters gives the same result.",reference:`function solve(lines) {
  const key = (s) => (s || "").split("").sort().join("");
  return [String(key(lines[0]) === key(lines[1]))];
}`},{kind:"cli",id:"fibonacci",title:"Fibonacci",difficulty:1,prompt:"Output the n-th Fibonacci number, 0-indexed: fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2).",io:"Single line: n. Output: the n-th Fibonacci number.",starters:{python:Fe("single line: n → fib(n)"),javascript:Ve("single line: n → fib(n)"),typescript:Je("single line: n → fib(n)"),cpp:We("single line: n → fib(n)"),java:$e("single line: n → fib(n)"),go:Xe("single line: n → fib(n)")},tests:[{stdin:`0
`,expect:"0"},{stdin:`1
`,expect:"1"},{stdin:`10
`,expect:"55"},{stdin:`20
`,expect:"6765"}],hidden:[{stdin:`2
`,expect:"1"},{stdin:`30
`,expect:"832040"}],hint:"Iterate with two running values — O(n) time, O(1) space.",reference:`function solve(lines) {
  const n = Number(lines[0] || 0);
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; }
  return [String(a)];
}`},{kind:"cli",id:"merge-sorted",title:"Merge Sorted Arrays",difficulty:2,prompt:"Merge two sorted arrays into one sorted array.",io:"Line 1: n m (lengths) · Line 2: n sorted integers · Line 3: m sorted integers. Output: the merged, sorted array.",starters:{python:Fe("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"),javascript:Ve("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"),typescript:Je("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"),cpp:We("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"),java:$e("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"),go:Xe("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints")},tests:[{stdin:`3 3
1 2 4
1 3 4
`,expect:"1 1 2 3 4 4"},{stdin:`0 1

2
`,expect:"2"},{stdin:`2 0
1 5

`,expect:"1 5"},{stdin:`3 2
1 3 5
2 4
`,expect:"1 2 3 4 5"}],hidden:[{stdin:`1 1
0
0
`,expect:"0 0"},{stdin:`0 0


`,expect:""}],hint:"Two pointers from the front, appending the smaller element each step.",reference:`function solve(lines) {
  const a = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const b = (lines[2] || "").split(" ").filter(Boolean).map(Number);
  const out = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] <= b[j])) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return [out.join(" ")];
}`},{kind:"cli",id:"longest-common-prefix",title:"Longest Common Prefix",difficulty:2,prompt:"Given a list of strings, output their longest common prefix (empty string if there is none).",io:"Line 1: n · next n lines: the strings. Output: the common prefix.",starters:{python:Fe("Line 1: n · next n lines: strings → longest common prefix"),javascript:Ve("Line 1: n · next n lines: strings → longest common prefix"),typescript:Je("Line 1: n · next n lines: strings → longest common prefix"),cpp:We("Line 1: n · next n lines: strings → longest common prefix"),java:$e("Line 1: n · next n lines: strings → longest common prefix"),go:Xe("Line 1: n · next n lines: strings → longest common prefix")},tests:[{stdin:`3
flower
flow
flight
`,expect:"fl"},{stdin:`3
dog
racecar
car
`,expect:""},{stdin:`1
alone
`,expect:"alone"}],hidden:[{stdin:`2

x
`,expect:""},{stdin:`2
interspecies
interstellar
`,expect:"inters"}],hint:"Start with the first string as the prefix and shrink it against each next string.",reference:`function solve(lines) {
  const n = Number(lines[0] || 0);
  const strs = lines.slice(1, 1 + n).map(s => s ?? "");
  if (!strs.length) return [""];
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return [prefix];
}`},{kind:"cli",id:"first-unique-char",title:"First Unique Character",difficulty:2,prompt:"Output the index of the first non-repeating character in the string, or -1 if every character repeats.",io:"Single line: the string. Output: the index or -1.",starters:{python:Fe("single line: string → index of first unique char or -1"),javascript:Ve("single line: string → index of first unique char or -1"),typescript:Je("single line: string → index of first unique char or -1"),cpp:We("single line: string → index of first unique char or -1"),java:$e("single line: string → index of first unique char or -1"),go:Xe("single line: string → index of first unique char or -1")},tests:[{stdin:`leetcode
`,expect:"0"},{stdin:`loveleetcode
`,expect:"2"},{stdin:`aabb
`,expect:"-1"},{stdin:`a
`,expect:"0"}],hidden:[{stdin:`
`,expect:"-1"},{stdin:`abcdefghijklmnopqrstuvwxyz
`,expect:"0"}],hint:"Count occurrences in one pass, then scan for the first char with count 1.",reference:`function solve(lines) {
  const s = lines[0] || "";
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (let i = 0; i < s.length; i++) if (counts.get(s[i]) === 1) return [String(i)];
  return ["-1"];
}`},{kind:"cli",id:"move-zeroes",title:"Move Zeroes",difficulty:2,prompt:"Move all zeros in the array to the end while preserving the relative order of the non-zero elements.",io:"Line 1: n · Line 2: n space-separated integers. Output: the rearranged array.",starters:{python:Fe("Line 1: n · Line 2: n ints → array with zeros at the end"),javascript:Ve("Line 1: n · Line 2: n ints → array with zeros at the end"),typescript:Je("Line 1: n · Line 2: n ints → array with zeros at the end"),cpp:We("Line 1: n · Line 2: n ints → array with zeros at the end"),java:$e("Line 1: n · Line 2: n ints → array with zeros at the end"),go:Xe("Line 1: n · Line 2: n ints → array with zeros at the end")},tests:[{stdin:`5
0 1 0 3 12
`,expect:"1 3 12 0 0"},{stdin:`1
0
`,expect:"0"},{stdin:`3
1 2 3
`,expect:"1 2 3"},{stdin:`3
0 0 1
`,expect:"1 0 0"}],hidden:[{stdin:`4
0 0 0 0
`,expect:"0 0 0 0"},{stdin:`5
4 0 5 0 6
`,expect:"4 5 6 0 0"}],hint:"A write pointer overwrites non-zeros in order; fill the tail with zeros.",reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let write = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] !== 0) arr[write++] = arr[i];
  while (write < arr.length) arr[write++] = 0;
  return [arr.join(" ")];
}`},{kind:"cli",id:"missing-number",title:"Missing Number",difficulty:2,prompt:"Given n distinct integers in the range [0, n], output the one integer from that range that is missing.",io:"Line 1: n · Line 2: n space-separated integers. Output: the missing integer.",starters:{python:Fe("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"),javascript:Ve("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"),typescript:Je("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"),cpp:We("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"),java:$e("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"),go:Xe("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int")},tests:[{stdin:`3
3 0 1
`,expect:"2"},{stdin:`2
0 1
`,expect:"2"},{stdin:`1
0
`,expect:"1"}],hidden:[{stdin:`8
9 6 4 2 3 5 7 0 1
`,expect:"8"},{stdin:`2
0 2
`,expect:"1"}],hint:"Sum of 0..n minus the sum of the array gives the missing number.",reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const n = arr.length;
  return [String((n * (n + 1)) / 2 - arr.reduce((a, b) => a + b, 0))];
}`},{kind:"cli",id:"majority-element",title:"Majority Element",difficulty:2,prompt:"Given an array where one element appears more than n/2 times, output that element.",io:"Line 1: n · Line 2: n space-separated integers. Output: the majority element.",starters:{python:Fe("Line 1: n · Line 2: n ints → the majority element"),javascript:Ve("Line 1: n · Line 2: n ints → the majority element"),typescript:Je("Line 1: n · Line 2: n ints → the majority element"),cpp:We("Line 1: n · Line 2: n ints → the majority element"),java:$e("Line 1: n · Line 2: n ints → the majority element"),go:Xe("Line 1: n · Line 2: n ints → the majority element")},tests:[{stdin:`3
3 2 3
`,expect:"3"},{stdin:`7
2 2 1 1 1 2 2
`,expect:"2"},{stdin:`1
1
`,expect:"1"}],hidden:[{stdin:`5
-1 -1 -1 2 2
`,expect:"-1"},{stdin:`9
6 6 6 1 2 3 6 6 6
`,expect:"6"}],hint:"Boyer-Moore: cancel different pairs; the survivor is the majority.",reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let candidate = arr[0], count = 0;
  for (const x of arr) {
    if (count === 0) candidate = x;
    count += x === candidate ? 1 : -1;
  }
  return [String(candidate)];
}`},{kind:"cli",id:"rotate-array",title:"Rotate Array",difficulty:2,prompt:"Rotate the array to the right by k steps.",io:"Line 1: n k · Line 2: n space-separated integers. Output: the rotated array.",starters:{python:Fe("Line 1: n k · Line 2: n ints → array rotated right by k"),javascript:Ve("Line 1: n k · Line 2: n ints → array rotated right by k"),typescript:Je("Line 1: n k · Line 2: n ints → array rotated right by k"),cpp:We("Line 1: n k · Line 2: n ints → array rotated right by k"),java:$e("Line 1: n k · Line 2: n ints → array rotated right by k"),go:Xe("Line 1: n k · Line 2: n ints → array rotated right by k")},tests:[{stdin:`7 3
1 2 3 4 5 6 7
`,expect:"5 6 7 1 2 3 4"},{stdin:`4 2
-1 -100 3 99
`,expect:"3 99 -1 -100"},{stdin:`2 3
1 2
`,expect:"2 1"},{stdin:`3 0
1 2 3
`,expect:"1 2 3"}],hidden:[{stdin:`5 7
1 2 3 4 5
`,expect:"4 5 1 2 3"},{stdin:`1 10
9
`,expect:"9"}],hint:"Normalize k modulo n, then slice the last k elements in front.",reference:`function solve(lines) {
  const [n, k] = (lines[0] || "").split(" ").map(Number);
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  if (!n) return [""];
  const r = ((k % n) + n) % n;
  return [arr.slice(n - r).concat(arr.slice(0, n - r)).join(" ")];
}`},{kind:"cli",id:"climbing-stairs",title:"Climbing Stairs",difficulty:2,prompt:"You can climb 1 or 2 steps at a time. Output the number of distinct ways to reach the top of n stairs.",io:"Single line: n. Output: the number of ways.",starters:{python:Fe("single line: n → number of ways to climb n stairs"),javascript:Ve("single line: n → number of ways to climb n stairs"),typescript:Je("single line: n → number of ways to climb n stairs"),cpp:We("single line: n → number of ways to climb n stairs"),java:$e("single line: n → number of ways to climb n stairs"),go:Xe("single line: n → number of ways to climb n stairs")},tests:[{stdin:`2
`,expect:"2"},{stdin:`3
`,expect:"3"},{stdin:`4
`,expect:"5"},{stdin:`10
`,expect:"89"}],hidden:[{stdin:`1
`,expect:"1"},{stdin:`45
`,expect:"1836311903"}],hint:"ways(n) = ways(n-1) + ways(n-2) — iterate with two variables.",reference:`function solve(lines) {
  const n = Number(lines[0] || 0);
  if (n <= 2) return [String(n === 0 ? 0 : n === 1 ? 1 : 2)];
  let a = 1, b = 2;
  for (let i = 3; i <= n; i++) { const t = a + b; a = b; b = t; }
  return [String(b)];
}`},{kind:"cli",id:"intersection",title:"Intersection of Two Arrays",difficulty:2,prompt:"Output the unique values present in both arrays, in the order they first appear in the first array.",io:"Line 1: n m · Line 2: n integers · Line 3: m integers. Output: the intersection, space-separated (empty line if none).",starters:{python:Fe("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"),javascript:Ve("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"),typescript:Je("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"),cpp:We("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"),java:$e("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"),go:Xe("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order")},tests:[{stdin:`4 2
1 2 2 1
2 2
`,expect:"2"},{stdin:`3 4
4 9 5
9 4 9 8 4
`,expect:"4 9"},{stdin:`1 1
1
2
`,expect:""}],hidden:[{stdin:`0 2

7 8
`,expect:""},{stdin:`5 3
1 2 3 4 5
5 4 3
`,expect:"3 4 5"}],hint:"Put the second array in a Set, then scan the first array for members you haven't emitted yet.",reference:`function solve(lines) {
  const a = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const b = new Set((lines[2] || "").split(" ").filter(Boolean).map(Number));
  const seen = new Set();
  const out = [];
  for (const x of a) {
    if (b.has(x) && !seen.has(x)) { seen.add(x); out.push(x); }
  }
  return [out.join(" ")];
}`}],Jt=`// Wire up the component's behavior here.
// The judge checks the rendered DOM after real clicks / input events.`,h1=[{kind:"ui",id:"ui-counter",title:"Counter",difficulty:1,category:"interaction",prompt:"Build a counter: clicking + increments the displayed number, clicking − decrements it. The count must never go out of sync with the display.",html:`<div class="counter">
  <button id="minus" aria-label="Decrease">−</button>
  <span id="value">0</span>
  <button id="plus" aria-label="Increase">+</button>
</div>`,css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:Jt,assertions:[{label:"starts at 0",check:"return document.querySelector('#value').textContent.trim() === '0';"},{label:"increments on +",check:"document.querySelector('#plus').click(); await sleep(20); return document.querySelector('#value').textContent.trim() === '1';"},{label:"decrements on −",check:"document.querySelector('#minus').click(); document.querySelector('#minus').click(); await sleep(20); return document.querySelector('#value').textContent.trim() === '-1';"}],hiddenAssertions:[{label:"handles rapid sequences consistently",check:"document.querySelector('#plus').click(); document.querySelector('#plus').click(); document.querySelector('#minus').click(); await sleep(20); return document.querySelector('#value').textContent.trim() === '0';"}],hint:"Attach click listeners to both buttons and update #value from its current textContent.",reference:{html:`<div class="counter">
  <button id="minus" aria-label="Decrease">−</button>
  <span id="value">0</span>
  <button id="plus" aria-label="Increase">+</button>
</div>`,css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:`const value = document.querySelector('#value');
document.querySelector('#plus').addEventListener('click', () => {
  value.textContent = Number(value.textContent) + 1;
});
document.querySelector('#minus').addEventListener('click', () => {
  value.textContent = Number(value.textContent) - 1;
});`}},{kind:"ui",id:"ui-accordion",title:"Accordion",difficulty:2,category:"interaction",prompt:"Build an accordion: clicking a header opens its panel, opening one closes the others. aria-expanded on each header must track its open state.",html:`<div class="accordion">
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">What is InterviewIQ? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>An AI interviewer that prepares you for technical interviews.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Is it free? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>Yes — a free tier plus an optional Pro plan.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Which levels? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>From junior developer all the way to CEO.</p></div>
  </section>
</div>`,css:`.accordion { max-width: 420px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.acc-panel { display: none; padding: 4px 12px 12px; color: #475569; }
.acc-item.open .acc-panel { display: block; }
.acc-head { width: 100%; text-align: left; padding: 12px; font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; }`,js:Jt,assertions:[{label:"all panels closed initially",check:"return [...document.querySelectorAll('.acc-panel')].every(p => getComputedStyle(p).display === 'none');"},{label:"clicking a header opens its panel",check:"document.querySelectorAll('.acc-head')[1].click(); await sleep(20); return getComputedStyle(document.querySelectorAll('.acc-panel')[1]).display !== 'none';"},{label:"opening one closes the others",check:"document.querySelectorAll('.acc-head')[0].click(); await sleep(20); const open = [...document.querySelectorAll('.acc-item')].filter(i => i.classList.contains('open')); return open.length === 1 && open[0] === document.querySelectorAll('.acc-item')[0];"}],hiddenAssertions:[{label:"aria-expanded tracks state",check:"const heads = document.querySelectorAll('.acc-head'); heads[2].click(); await sleep(20); return heads[2].getAttribute('aria-expanded') === 'true' && heads[0].getAttribute('aria-expanded') === 'false';"}],hint:"Toggle an .open class on the clicked .acc-item while removing it from every other item; mirror it in aria-expanded.",reference:{html:`<div class="accordion">
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">What is InterviewIQ? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>An AI interviewer that prepares you for technical interviews.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Is it free? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>Yes — a free tier plus an optional Pro plan.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Which levels? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>From junior developer all the way to CEO.</p></div>
  </section>
</div>`,css:`.accordion { max-width: 420px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.acc-panel { display: none; padding: 4px 12px 12px; color: #475569; }
.acc-item.open .acc-panel { display: block; }
.acc-head { width: 100%; text-align: left; padding: 12px; font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; }`,js:`document.querySelectorAll('.acc-head').forEach(head => {
  head.addEventListener('click', () => {
    const item = head.closest('.acc-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.acc-item').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.acc-head').setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      head.setAttribute('aria-expanded', 'true');
    }
  });
});`}},{kind:"ui",id:"ui-tabs",title:"Tabs",difficulty:2,category:"interaction",prompt:"Build a tab panel: clicking a tab shows its panel and marks the tab active. Exactly one panel must be visible at a time, and aria-selected must follow the active tab.",html:`<div class="tabs">
  <div class="tab-list" role="tablist">
    <button class="tab active" data-tab="tab1" role="tab" aria-selected="true">Overview</button>
    <button class="tab" data-tab="tab2" role="tab" aria-selected="false">Pricing</button>
    <button class="tab" data-tab="tab3" role="tab" aria-selected="false">FAQ</button>
  </div>
  <div class="tab-panel active" id="tab1"><p>Overview content.</p></div>
  <div class="tab-panel" id="tab2"><p>Pricing content.</p></div>
  <div class="tab-panel" id="tab3"><p>FAQ content.</p></div>
</div>`,css:`.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,js:Jt,assertions:[{label:"first panel visible initially",check:"return getComputedStyle(document.getElementById('tab1')).display !== 'none' && getComputedStyle(document.getElementById('tab2')).display === 'none';"},{label:"clicking a tab shows its panel",check:"document.querySelectorAll('.tab')[1].click(); await sleep(20); return getComputedStyle(document.getElementById('tab2')).display !== 'none' && getComputedStyle(document.getElementById('tab1')).display === 'none';"},{label:"exactly one panel visible",check:"document.querySelectorAll('.tab')[2].click(); await sleep(20); return document.querySelectorAll('.tab-panel.active').length === 1;"}],hiddenAssertions:[{label:"aria-selected follows the active tab",check:"document.querySelectorAll('.tab')[1].click(); await sleep(20); return document.querySelectorAll('.tab')[1].getAttribute('aria-selected') === 'true' && document.querySelectorAll('.tab')[0].getAttribute('aria-selected') === 'false';"}],hint:"On click: clear .active from every tab and panel, then add it to the clicked tab and its data-tab panel.",reference:{html:`<div class="tabs">
  <div class="tab-list" role="tablist">
    <button class="tab active" data-tab="tab1" role="tab" aria-selected="true">Overview</button>
    <button class="tab" data-tab="tab2" role="tab" aria-selected="false">Pricing</button>
    <button class="tab" data-tab="tab3" role="tab" aria-selected="false">FAQ</button>
  </div>
  <div class="tab-panel active" id="tab1"><p>Overview content.</p></div>
  <div class="tab-panel" id="tab2"><p>Pricing content.</p></div>
  <div class="tab-panel" id="tab3"><p>FAQ content.</p></div>
</div>`,css:`.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,js:`document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});`}},{kind:"ui",id:"ui-star-rating",title:"Star Rating",difficulty:2,category:"interaction",prompt:"Build a 5-star rating: clicking a star fills every star up to and including it (and the clicked value becomes the rating). Clicking a lower star lowers the rating.",html:`<div class="rating" data-value="0">
  <button class="star" data-star="1" aria-label="1 star">☆</button>
  <button class="star" data-star="2" aria-label="2 stars">☆</button>
  <button class="star" data-star="3" aria-label="3 stars">☆</button>
  <button class="star" data-star="4" aria-label="4 stars">☆</button>
  <button class="star" data-star="5" aria-label="5 stars">☆</button>
</div>`,css:`.star { font-size: 32px; background: none; border: none; cursor: pointer; color: #cbd5e1; padding: 2px; }
.star.active { color: #f59e0b; }`,js:Jt,assertions:[{label:"no stars active initially",check:"return document.querySelectorAll('.star.active').length === 0;"},{label:"clicking the third star fills three",check:"document.querySelectorAll('.star')[2].click(); await sleep(20); return document.querySelectorAll('.star.active').length === 3 && document.querySelector('.rating').dataset.value === '3';"},{label:"re-clicking a lower star lowers the rating",check:"document.querySelectorAll('.star')[1].click(); await sleep(20); return document.querySelectorAll('.star.active').length === 2;"}],hiddenAssertions:[{label:"clicking the top star twice keeps it at five",check:"document.querySelectorAll('.star')[4].click(); await sleep(20); const first = document.querySelectorAll('.star.active').length; document.querySelectorAll('.star')[4].click(); await sleep(20); return first === 5 && document.querySelectorAll('.star.active').length === 5;"}],hint:"On click, compare each star's data-star against the clicked value and toggle .active (and ★/☆) accordingly.",reference:{html:`<div class="rating" data-value="0">
  <button class="star" data-star="1" aria-label="1 star">☆</button>
  <button class="star" data-star="2" aria-label="2 stars">☆</button>
  <button class="star" data-star="3" aria-label="3 stars">☆</button>
  <button class="star" data-star="4" aria-label="4 stars">☆</button>
  <button class="star" data-star="5" aria-label="5 stars">☆</button>
</div>`,css:`.star { font-size: 32px; background: none; border: none; cursor: pointer; color: #cbd5e1; padding: 2px; }
.star.active { color: #f59e0b; }`,js:`const rating = document.querySelector('.rating');
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', () => {
    const value = Number(star.dataset.star);
    rating.dataset.value = String(value);
    document.querySelectorAll('.star').forEach(s => {
      const active = Number(s.dataset.star) <= value;
      s.classList.toggle('active', active);
      s.textContent = active ? '★' : '☆';
    });
  });
});`}},{kind:"ui",id:"ui-todo",title:"Todo List",difficulty:2,category:"interaction",prompt:"Build a todo list: submitting the form adds a non-empty todo, empty input is ignored, and each item has a delete button that removes it.",html:`<div class="todo">
  <form id="todo-form">
    <input id="todo-input" placeholder="What needs doing?" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
  <ul id="todo-list"></ul>
</div>`,css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:Jt,assertions:[{label:"starts empty",check:"return document.querySelectorAll('#todo-list li').length === 0;"},{label:"adds a todo",check:"const input = document.querySelector('#todo-input'); input.value = 'Learn debounce'; document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelectorAll('#todo-list li').length === 1 && document.querySelector('#todo-list').textContent.includes('Learn debounce');"},{label:"ignores empty input",check:"const input = document.querySelector('#todo-input'); input.value = '   '; document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelectorAll('#todo-list li').length === 1;"}],hiddenAssertions:[{label:"delete removes the todo",check:"document.querySelector('.del').click(); await sleep(20); return document.querySelectorAll('#todo-list li').length === 0;"}],hint:"Listen for submit, preventDefault, trim the input, and build each item with its own delete listener.",reference:{html:`<div class="todo">
  <form id="todo-form">
    <input id="todo-input" placeholder="What needs doing?" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
  <ul id="todo-list"></ul>
</div>`,css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:`const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const list = document.querySelector('#todo-list');
const esc = (s) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const li = document.createElement('li');
  li.innerHTML = '<span>' + esc(text) + '</span><button class="del" aria-label="Delete">✕</button>';
  li.querySelector('.del').addEventListener('click', () => li.remove());
  list.appendChild(li);
  input.value = '';
});`}},{kind:"ui",id:"ui-modal",title:"Modal Dialog",difficulty:2,category:"interaction",prompt:"Build a modal: hidden by default, opened by the trigger button, closed by the Close button and by clicking the backdrop.",html:`<div class="modal-wrap">
  <button id="open-modal">Open modal</button>
  <div class="modal-overlay" id="modal-overlay" hidden>
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Welcome back</h3>
      <p>This is a modal dialog.</p>
      <button id="close-modal">Close</button>
    </div>
  </div>
</div>`,css:`.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; font-family: system-ui; }
.modal { background: #fff; padding: 24px; border-radius: 12px; max-width: 320px; }
#open-modal { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,js:Jt,assertions:[{label:"hidden initially",check:"return document.querySelector('#modal-overlay').hidden === true;"},{label:"opens on the trigger click",check:"document.querySelector('#open-modal').click(); await sleep(20); return document.querySelector('#modal-overlay').hidden === false;"},{label:"closes via the close button",check:"document.querySelector('#close-modal').click(); await sleep(20); return document.querySelector('#modal-overlay').hidden === true;"}],hiddenAssertions:[{label:"closes when the backdrop is clicked",check:"document.querySelector('#open-modal').click(); await sleep(20); document.querySelector('#modal-overlay').click(); await sleep(20); return document.querySelector('#modal-overlay').hidden === true;"}],hint:"Toggle the overlay's hidden attribute; on backdrop clicks only close when the click target IS the overlay itself.",reference:{html:`<div class="modal-wrap">
  <button id="open-modal">Open modal</button>
  <div class="modal-overlay" id="modal-overlay" hidden>
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Welcome back</h3>
      <p>This is a modal dialog.</p>
      <button id="close-modal">Close</button>
    </div>
  </div>
</div>`,css:`.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; font-family: system-ui; }
.modal { background: #fff; padding: 24px; border-radius: 12px; max-width: 320px; }
#open-modal { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,js:`const overlay = document.querySelector('#modal-overlay');
document.querySelector('#open-modal').addEventListener('click', () => { overlay.hidden = false; });
document.querySelector('#close-modal').addEventListener('click', () => { overlay.hidden = true; });
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });`}},{kind:"ui",id:"ui-dropdown",title:"Dropdown Select",difficulty:2,category:"interaction",prompt:"Build a dropdown: clicking the trigger toggles the menu, selecting an option updates the trigger label and closes the menu.",html:`<div class="dropdown">
  <button id="dd-trigger">Select a color ▾</button>
  <ul class="dd-menu" id="dd-menu" hidden>
    <li data-value="red">Red</li>
    <li data-value="green">Green</li>
    <li data-value="blue">Blue</li>
  </ul>
</div>`,css:`.dropdown { position: relative; display: inline-block; font-family: system-ui; }
#dd-trigger { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.dd-menu { position: absolute; top: 100%; margin: 4px 0 0; padding: 4px; list-style: none; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 140px; }
.dd-menu li { padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.dd-menu li:hover { background: #f1f5f9; }`,js:Jt,assertions:[{label:"menu closed initially",check:"return document.querySelector('#dd-menu').hidden === true;"},{label:"clicking the trigger opens the menu",check:"document.querySelector('#dd-trigger').click(); await sleep(20); return document.querySelector('#dd-menu').hidden === false;"},{label:"selecting an option updates the trigger and closes",check:"document.querySelectorAll('#dd-menu li')[1].click(); await sleep(20); return document.querySelector('#dd-trigger').textContent.includes('Green') && document.querySelector('#dd-menu').hidden === true;"}],hiddenAssertions:[{label:"the trigger toggles the menu",check:"document.querySelector('#dd-trigger').click(); await sleep(20); const opened = document.querySelector('#dd-menu').hidden === false; document.querySelector('#dd-trigger').click(); await sleep(20); return opened && document.querySelector('#dd-menu').hidden === true;"}],hint:"Toggle the menu's hidden attribute on trigger clicks; each option click sets the label and hides the menu.",reference:{html:`<div class="dropdown">
  <button id="dd-trigger">Select a color ▾</button>
  <ul class="dd-menu" id="dd-menu" hidden>
    <li data-value="red">Red</li>
    <li data-value="green">Green</li>
    <li data-value="blue">Blue</li>
  </ul>
</div>`,css:`.dropdown { position: relative; display: inline-block; font-family: system-ui; }
#dd-trigger { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.dd-menu { position: absolute; top: 100%; margin: 4px 0 0; padding: 4px; list-style: none; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 140px; }
.dd-menu li { padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.dd-menu li:hover { background: #f1f5f9; }`,js:`const trigger = document.querySelector('#dd-trigger');
const menu = document.querySelector('#dd-menu');
trigger.addEventListener('click', () => { menu.hidden = !menu.hidden; });
menu.querySelectorAll('li').forEach(li => {
  li.addEventListener('click', () => {
    trigger.textContent = li.textContent + ' ▾';
    menu.hidden = true;
  });
});`}},{kind:"ui",id:"ui-progress-bar",title:"Progress Bar",difficulty:2,category:"interaction",prompt:"Build a progress bar: +10% grows the fill (capped at 100%), Reset returns it to 0%.",html:`<div class="progress-wrap">
  <div class="progress"><div class="fill" id="fill" style="width:0%"></div></div>
  <button id="progress-plus">+10%</button>
  <button id="progress-reset">Reset</button>
</div>`,css:`.progress { height: 18px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 12px; }
.fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); transition: width .2s; }
.progress-wrap { max-width: 360px; font-family: system-ui; }
.progress-wrap button { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,js:Jt,assertions:[{label:"starts at 0%",check:"return document.querySelector('#fill').style.width === '0%';"},{label:"increments by 10%",check:"document.querySelector('#progress-plus').click(); document.querySelector('#progress-plus').click(); await sleep(20); return document.querySelector('#fill').style.width === '20%';"},{label:"caps at 100%",check:"for (let i = 0; i < 12; i++) document.querySelector('#progress-plus').click(); await sleep(20); return document.querySelector('#fill').style.width === '100%';"}],hiddenAssertions:[{label:"reset returns to 0%",check:"document.querySelector('#progress-reset').click(); await sleep(20); return document.querySelector('#fill').style.width === '0%';"}],hint:"Parse the current width, clamp to 100, and write it back as a percentage.",reference:{html:`<div class="progress-wrap">
  <div class="progress"><div class="fill" id="fill" style="width:0%"></div></div>
  <button id="progress-plus">+10%</button>
  <button id="progress-reset">Reset</button>
</div>`,css:`.progress { height: 18px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 12px; }
.fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); transition: width .2s; }
.progress-wrap { max-width: 360px; font-family: system-ui; }
.progress-wrap button { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,js:`const fill = document.querySelector('#fill');
const current = () => Number(fill.style.width.replace('%', '')) || 0;
document.querySelector('#progress-plus').addEventListener('click', () => {
  fill.style.width = Math.min(100, current() + 10) + '%';
});
document.querySelector('#progress-reset').addEventListener('click', () => { fill.style.width = '0%'; });`}},{kind:"ui",id:"ui-autocomplete",title:"Autocomplete",difficulty:3,category:"interaction",prompt:"Build an autocomplete: typing filters a fixed dataset, suggestions show in the list, clicking a suggestion fills the input, and no matches hides the list.",html:`<div class="autocomplete">
  <input id="ac-input" placeholder="Type a language…" autocomplete="off" />
  <ul id="ac-list" class="ac-list" hidden></ul>
</div>`,css:`.ac-list { list-style: none; margin: 4px 0 0; padding: 4px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 180px; overflow: auto; font-family: system-ui; }
.ac-list li { padding: 6px 10px; cursor: pointer; border-radius: 6px; }
.ac-list li:hover { background: #f1f5f9; }
#ac-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 240px; font-family: system-ui; }`,js:Jt,assertions:[{label:"no suggestions when empty",check:"return document.querySelector('#ac-list').hidden === true;"},{label:"typing filters suggestions",check:"const input = document.querySelector('#ac-input'); input.value = 'py'; input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); const items = [...document.querySelectorAll('#ac-list li')].map(li => li.textContent); return items.length === 1 && items[0] === 'Python';"},{label:"clicking a suggestion fills the input",check:"document.querySelector('#ac-list li').click(); await sleep(20); return document.querySelector('#ac-input').value === 'Python' && document.querySelector('#ac-list').hidden === true;"}],hiddenAssertions:[{label:"no matches hides the list",check:"const input = document.querySelector('#ac-input'); input.value = 'zzz'; input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return document.querySelector('#ac-list').hidden === true;"}],hint:"On each input event, re-render the list from a filter of the dataset; hide it when the query is empty or has no matches.",reference:{html:`<div class="autocomplete">
  <input id="ac-input" placeholder="Type a language…" autocomplete="off" />
  <ul id="ac-list" class="ac-list" hidden></ul>
</div>`,css:`.ac-list { list-style: none; margin: 4px 0 0; padding: 4px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 180px; overflow: auto; font-family: system-ui; }
.ac-list li { padding: 6px 10px; cursor: pointer; border-radius: 6px; }
.ac-list li:hover { background: #f1f5f9; }
#ac-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 240px; font-family: system-ui; }`,js:`const DATA = ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'Ruby', 'Swift', 'Kotlin'];
const input = document.querySelector('#ac-input');
const list = document.querySelector('#ac-list');
input.addEventListener('input', () => {
  const q = input.value.trim().toLowerCase();
  list.innerHTML = '';
  const matches = DATA.filter(d => d.toLowerCase().includes(q));
  if (!q || !matches.length) { list.hidden = true; return; }
  matches.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m;
    li.addEventListener('click', () => { input.value = m; list.hidden = true; });
    list.appendChild(li);
  });
  list.hidden = false;
});`}},{kind:"ui",id:"ui-carousel",title:"Image Carousel",difficulty:3,category:"interaction",prompt:"Build a carousel: next and prev move between slides, wrapping around at the ends. Exactly one slide is visible at a time.",html:`<div class="carousel">
  <div class="track">
    <div class="slide active"><p>Slide 1</p></div>
    <div class="slide"><p>Slide 2</p></div>
    <div class="slide"><p>Slide 3</p></div>
  </div>
  <div class="carousel-nav">
    <button id="car-prev" aria-label="Previous">‹</button>
    <button id="car-next" aria-label="Next">›</button>
  </div>
</div>`,css:`.carousel { max-width: 420px; position: relative; font-family: system-ui; }
.track { display: flex; overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; }
.slide { min-width: 100%; display: none; height: 160px; place-items: center; background: #f8fafc; font-size: 22px; font-weight: 700; }
.slide.active { display: grid; }
.carousel-nav { display: flex; gap: 8px; margin-top: 10px; }
.carousel-nav button { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 18px; }`,js:Jt,assertions:[{label:"first slide active initially",check:"return document.querySelectorAll('.slide')[0].classList.contains('active') && document.querySelectorAll('.slide.active').length === 1;"},{label:"next moves to the second slide",check:"document.querySelector('#car-next').click(); await sleep(20); return document.querySelectorAll('.slide')[1].classList.contains('active');"},{label:"prev goes back one",check:"document.querySelector('#car-prev').click(); await sleep(20); return document.querySelectorAll('.slide')[0].classList.contains('active');"}],hiddenAssertions:[{label:"prev wraps to the last slide",check:"document.querySelector('#car-prev').click(); await sleep(20); return document.querySelectorAll('.slide')[2].classList.contains('active');"}],hint:"Keep an index, move it modulo the slide count, and toggle .active to match.",reference:{html:`<div class="carousel">
  <div class="track">
    <div class="slide active"><p>Slide 1</p></div>
    <div class="slide"><p>Slide 2</p></div>
    <div class="slide"><p>Slide 3</p></div>
  </div>
  <div class="carousel-nav">
    <button id="car-prev" aria-label="Previous">‹</button>
    <button id="car-next" aria-label="Next">›</button>
  </div>
</div>`,css:`.carousel { max-width: 420px; position: relative; font-family: system-ui; }
.track { display: flex; overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; }
.slide { min-width: 100%; display: none; height: 160px; place-items: center; background: #f8fafc; font-size: 22px; font-weight: 700; }
.slide.active { display: grid; }
.carousel-nav { display: flex; gap: 8px; margin-top: 10px; }
.carousel-nav button { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 18px; }`,js:`const slides = [...document.querySelectorAll('.slide')];
let index = 0;
const show = (i) => {
  index = (i + slides.length) % slides.length;
  slides.forEach((s, j) => s.classList.toggle('active', j === index));
};
document.querySelector('#car-next').addEventListener('click', () => show(index + 1));
document.querySelector('#car-prev').addEventListener('click', () => show(index - 1));`}},{kind:"ui",id:"ui-tic-tac-toe",title:"Tic-tac-toe",difficulty:3,category:"interaction",prompt:"Build tic-tac-toe: X goes first, clicking an empty cell places the current mark and switches turns, occupied cells can't be overwritten, and three in a row announces the winner. A Restart button resets the board.",html:`<div class="ttt">
  <div class="ttt-status" id="ttt-status">X's turn</div>
  <div class="ttt-grid">
    <button class="cell" data-cell="0"></button>
    <button class="cell" data-cell="1"></button>
    <button class="cell" data-cell="2"></button>
    <button class="cell" data-cell="3"></button>
    <button class="cell" data-cell="4"></button>
    <button class="cell" data-cell="5"></button>
    <button class="cell" data-cell="6"></button>
    <button class="cell" data-cell="7"></button>
    <button class="cell" data-cell="8"></button>
  </div>
  <button id="ttt-reset">Restart</button>
</div>`,css:`.ttt-grid { display: grid; grid-template-columns: repeat(3, 72px); gap: 6px; margin: 12px 0; font-family: system-ui; }
.cell { width: 72px; height: 72px; font-size: 26px; font-weight: 800; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer; }
.ttt-status { font-weight: 600; margin-bottom: 8px; font-family: system-ui; }
#ttt-reset { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,js:Jt,assertions:[{label:"X plays first",check:`return document.querySelector('#ttt-status').textContent.includes("X's turn");`},{label:"clicking a cell places X and switches turns",check:`document.querySelectorAll('.cell')[0].click(); await sleep(20); return document.querySelectorAll('.cell')[0].textContent === 'X' && document.querySelector('#ttt-status').textContent.includes("O's turn");`},{label:"occupied cells cannot be overwritten",check:"document.querySelectorAll('.cell')[0].click(); await sleep(20); return document.querySelectorAll('.cell')[0].textContent === 'X';"}],hiddenAssertions:[{label:"three in a row announces the winner",check:"const c = document.querySelectorAll('.cell'); c[0].click(); c[3].click(); c[1].click(); c[4].click(); c[2].click(); await sleep(20); return document.querySelector('#ttt-status').textContent.includes('X wins');"}],hint:"Track the current player and move count; after each move check the 8 winning lines before switching turns.",reference:{html:`<div class="ttt">
  <div class="ttt-status" id="ttt-status">X's turn</div>
  <div class="ttt-grid">
    <button class="cell" data-cell="0"></button>
    <button class="cell" data-cell="1"></button>
    <button class="cell" data-cell="2"></button>
    <button class="cell" data-cell="3"></button>
    <button class="cell" data-cell="4"></button>
    <button class="cell" data-cell="5"></button>
    <button class="cell" data-cell="6"></button>
    <button class="cell" data-cell="7"></button>
    <button class="cell" data-cell="8"></button>
  </div>
  <button id="ttt-reset">Restart</button>
</div>`,css:`.ttt-grid { display: grid; grid-template-columns: repeat(3, 72px); gap: 6px; margin: 12px 0; font-family: system-ui; }
.cell { width: 72px; height: 72px; font-size: 26px; font-weight: 800; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer; }
.ttt-status { font-weight: 600; margin-bottom: 8px; font-family: system-ui; }
#ttt-reset { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,js:`const cells = [...document.querySelectorAll('.cell')];
const status = document.querySelector('#ttt-status');
let current = 'X';
let moves = 0;
const WIN = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const hasWinner = () => WIN.some(combo => combo.every(i => cells[i].textContent === current));
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (cell.textContent || hasWinner()) return;
    cell.textContent = current;
    moves++;
    if (hasWinner()) { status.textContent = current + ' wins!'; return; }
    if (moves === 9) { status.textContent = 'Draw'; return; }
    current = current === 'X' ? 'O' : 'X';
    status.textContent = current + "'s turn";
  });
});
document.querySelector('#ttt-reset').addEventListener('click', () => {
  cells.forEach(c => { c.textContent = ''; });
  current = 'X';
  moves = 0;
  status.textContent = "X's turn";
});`}},{kind:"ui",id:"ui-signup-form",title:"Signup Form Validation",difficulty:2,category:"forms",prompt:"Build signup-form validation: submitting with an invalid email and/or a short password shows inline errors; fixing the fields clears them; a fully valid submit is counted as successful.",html:`<form id="signup-form" novalidate>
  <div class="field">
    <label for="su-email">Email</label>
    <input id="su-email" type="email" />
    <p class="error" id="email-error" hidden>Enter a valid email.</p>
  </div>
  <div class="field">
    <label for="su-pass">Password</label>
    <input id="su-pass" type="password" />
    <p class="error" id="pass-error" hidden>Password must be at least 6 characters.</p>
  </div>
  <button type="submit">Sign up</button>
</form>`,css:`.field { margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; font-family: system-ui; }
.field label { font-weight: 600; font-size: 13px; }
.field input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 260px; font-family: system-ui; }
.error { color: #dc2626; font-size: 12px; margin: 0; }
#signup-form button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #4f46e5; color: #fff; cursor: pointer; font-family: system-ui; }`,js:Jt,assertions:[{label:"empty submit shows both errors",check:"document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelector('#email-error').hidden === false && document.querySelector('#pass-error').hidden === false;"},{label:"valid input clears the errors",check:"document.querySelector('#su-email').value = 'ada@example.com'; document.querySelector('#su-pass').value = 'secret123'; document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelector('#email-error').hidden === true && document.querySelector('#pass-error').hidden === true;"},{label:"a bad email is still flagged",check:"document.querySelector('#su-email').value = 'not-an-email'; document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelector('#email-error').hidden === false;"}],hiddenAssertions:[{label:"a fully valid submit counts as successful",check:"const before = Number(document.querySelector('#signup-form').dataset.submits || 0); document.querySelector('#su-email').value = 'ok@example.com'; document.querySelector('#su-pass').value = 'abcdef'; document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return Number(document.querySelector('#signup-form').dataset.submits || 0) === before + 1;"}],hint:"On submit (preventDefault), set each error's hidden flag from a validation result and count only fully-valid submits.",reference:{html:`<form id="signup-form" novalidate>
  <div class="field">
    <label for="su-email">Email</label>
    <input id="su-email" type="email" />
    <p class="error" id="email-error" hidden>Enter a valid email.</p>
  </div>
  <div class="field">
    <label for="su-pass">Password</label>
    <input id="su-pass" type="password" />
    <p class="error" id="pass-error" hidden>Password must be at least 6 characters.</p>
  </div>
  <button type="submit">Sign up</button>
</form>`,css:`.field { margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; font-family: system-ui; }
.field label { font-weight: 600; font-size: 13px; }
.field input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 260px; font-family: system-ui; }
.error { color: #dc2626; font-size: 12px; margin: 0; }
#signup-form button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #4f46e5; color: #fff; cursor: pointer; font-family: system-ui; }`,js:`const form = document.querySelector('#signup-form');
const email = document.querySelector('#su-email');
const pass = document.querySelector('#su-pass');
const emailErr = document.querySelector('#email-error');
const passErr = document.querySelector('#pass-error');
let ok = 0;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const emailOk = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email.value);
  const passOk = pass.value.length >= 6;
  emailErr.hidden = emailOk;
  passErr.hidden = passOk;
  if (emailOk && passOk) ok++;
  form.dataset.submits = String(ok);
});`}}],fn=`// Wire up the component's behavior here.
// The judge checks the rendered DOM after real clicks / input events.`,f1=[{kind:"ui",id:"ui-toast",title:"Toast Notifications",difficulty:2,category:"interaction",prompt:"Build a toast system: clicking “Show toast” appends a toast with the message; toasts auto-dismiss after 1 second; each toast has a close button; “Clear all” removes every toast.",html:`<div class="toast-wrap">
  <div id="toast-host" class="toast-host"></div>
  <div class="toast-controls">
    <button id="toast-show">Show toast</button>
    <button id="toast-clear">Clear all</button>
  </div>
</div>`,css:`.toast-host { position: fixed; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 50; font-family: system-ui; }
.toast { display: flex; align-items: center; gap: 10px; background: #1e293b; color: #f8fafc; padding: 10px 14px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.35); font-size: 13px; min-width: 180px; }
.toast .t-close { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; margin-left: auto; }
.toast-controls { margin-top: 120px; font-family: system-ui; }
.toast-controls button { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,js:fn,assertions:[{label:"no toasts initially",check:"return document.querySelectorAll('.toast').length === 0;"},{label:"showing a toast appends it",check:"document.querySelector('#toast-show').click(); await sleep(20); const ts = document.querySelectorAll('.toast'); return ts.length === 1 && ts[0].textContent.includes('Saved');"},{label:"multiple toasts stack",check:"document.querySelector('#toast-show').click(); document.querySelector('#toast-show').click(); await sleep(20); return document.querySelectorAll('.toast').length === 3;"},{label:"close removes a single toast",check:"document.querySelector('.toast .t-close').click(); await sleep(20); return document.querySelectorAll('.toast').length === 2;"}],hiddenAssertions:[{label:"toasts auto-dismiss after 1s",check:"await sleep(1100); return document.querySelectorAll('.toast').length === 0;"},{label:"clear-all removes everything",check:"document.querySelector('#toast-show').click(); document.querySelector('#toast-show').click(); await sleep(20); document.querySelector('#toast-clear').click(); await sleep(20); return document.querySelectorAll('.toast').length === 0;"}],hint:"Append a toast element with its own close listener and a setTimeout that removes it after 1s; Clear all empties the host.",reference:{html:`<div class="toast-wrap">
  <div id="toast-host" class="toast-host"></div>
  <div class="toast-controls">
    <button id="toast-show">Show toast</button>
    <button id="toast-clear">Clear all</button>
  </div>
</div>`,css:`.toast-host { position: fixed; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 50; font-family: system-ui; }
.toast { display: flex; align-items: center; gap: 10px; background: #1e293b; color: #f8fafc; padding: 10px 14px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.35); font-size: 13px; min-width: 180px; }
.toast .t-close { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; margin-left: auto; }
.toast-controls { margin-top: 120px; font-family: system-ui; }
.toast-controls button { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,js:`const host = document.querySelector('#toast-host');
const esc = (s) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
document.querySelector('#toast-show').addEventListener('click', () => {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<span>' + esc('Saved!') + '</span><button class="t-close" aria-label="Dismiss">✕</button>';
  t.querySelector('.t-close').addEventListener('click', () => t.remove());
  host.appendChild(t);
  setTimeout(() => t.remove(), 1000);
});
document.querySelector('#toast-clear').addEventListener('click', () => { host.innerHTML = ''; });`}},{kind:"ui",id:"ui-tooltip",title:"Tooltip",difficulty:2,category:"interaction",prompt:"Build a tooltip: hovering the trigger shows the tooltip, moving the mouse away hides it. It must also open on keyboard focus and close on blur (accessibility).",html:`<div class="tip-wrap">
  <button id="tip-btn" aria-describedby="tip">Hover me</button>
  <div id="tip" class="tip" hidden>More information about this action.</div>
</div>`,css:`.tip-wrap { position: relative; display: inline-block; font-family: system-ui; padding-top: 40px; }
#tip-btn { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.tip { position: absolute; top: 0; left: 0; background: #1e293b; color: #f8fafc; padding: 6px 10px; border-radius: 8px; font-size: 12px; white-space: nowrap; }`,js:fn,assertions:[{label:"hidden initially",check:"return document.querySelector('#tip').hidden === true;"},{label:"hover shows it",check:"document.querySelector('#tip-btn').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await sleep(20); return document.querySelector('#tip').hidden === false;"},{label:"mouse-out hides it",check:"document.querySelector('#tip-btn').dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); await sleep(20); return document.querySelector('#tip').hidden === true;"}],hiddenAssertions:[{label:"keyboard focus opens it",check:"document.querySelector('#tip-btn').dispatchEvent(new FocusEvent('focus')); await sleep(20); return document.querySelector('#tip').hidden === false;"}],hint:"Four listeners on the trigger: mouseover/focus show, mouseout/blur hide.",reference:{html:`<div class="tip-wrap">
  <button id="tip-btn" aria-describedby="tip">Hover me</button>
  <div id="tip" class="tip" hidden>More information about this action.</div>
</div>`,css:`.tip-wrap { position: relative; display: inline-block; font-family: system-ui; padding-top: 40px; }
#tip-btn { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.tip { position: absolute; top: 0; left: 0; background: #1e293b; color: #f8fafc; padding: 6px 10px; border-radius: 8px; font-size: 12px; white-space: nowrap; }`,js:`const btn = document.querySelector('#tip-btn');
const tip = document.querySelector('#tip');
btn.addEventListener('mouseover', () => { tip.hidden = false; });
btn.addEventListener('mouseout', () => { tip.hidden = true; });
btn.addEventListener('focus', () => { tip.hidden = false; });
btn.addEventListener('blur', () => { tip.hidden = true; });`}},{kind:"ui",id:"ui-tags-input",title:"Tag Input",difficulty:2,category:"forms",prompt:"Build a tag input: pressing Enter turns the typed text into a chip, empty and duplicate tags are ignored, and each chip has a ✕ button that removes it.",html:`<div class="tags-wrap">
  <div id="tag-list" class="tag-list"></div>
  <input id="tag-input" placeholder="Type a tag and press Enter" autocomplete="off" />
</div>`,css:`.tags-wrap { max-width: 360px; font-family: system-ui; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; min-height: 30px; }
.tag { display: inline-flex; align-items: center; gap: 6px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; }
.tag .t-x { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 12px; padding: 0; }
#tag-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; font-family: system-ui; }`,js:fn,assertions:[{label:"starts with no tags",check:"return document.querySelectorAll('.tag').length === 0;"},{label:"Enter adds a chip",check:"const input = document.querySelector('#tag-input'); input.value = 'react'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(20); const tags = [...document.querySelectorAll('.tag')]; return tags.length === 1 && tags[0].textContent.includes('react');"},{label:"duplicates are ignored",check:"const input = document.querySelector('#tag-input'); input.value = 'react'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(20); return document.querySelectorAll('.tag').length === 1;"},{label:"✕ removes a chip",check:"document.querySelector('.tag .t-x').click(); await sleep(20); return document.querySelectorAll('.tag').length === 0;"}],hiddenAssertions:[{label:"multiple tags accumulate",check:"const input = document.querySelector('#tag-input'); input.value = 'vue'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); input.value = 'svelte'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(20); const labels = [...document.querySelectorAll('.tag')].map(t => t.textContent); return labels.length === 2 && labels.some(l => l.includes('vue')) && labels.some(l => l.includes('svelte'));"}],hint:"On Enter: trim the value, bail on empty or existing tag, append a chip with its own remove listener, then clear the input.",reference:{html:`<div class="tags-wrap">
  <div id="tag-list" class="tag-list"></div>
  <input id="tag-input" placeholder="Type a tag and press Enter" autocomplete="off" />
</div>`,css:`.tags-wrap { max-width: 360px; font-family: system-ui; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; min-height: 30px; }
.tag { display: inline-flex; align-items: center; gap: 6px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; }
.tag .t-x { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 12px; padding: 0; }
#tag-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; font-family: system-ui; }`,js:`const input = document.querySelector('#tag-input');
const list = document.querySelector('#tag-list');
const tags = () => [...document.querySelectorAll('.tag')].map(t => t.dataset.tag);
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const value = input.value.trim();
  if (!value || tags().includes(value)) return;
  const chip = document.createElement('span');
  chip.className = 'tag';
  chip.dataset.tag = value;
  chip.innerHTML = value + ' <button class="t-x" aria-label="Remove">✕</button>';
  chip.querySelector('.t-x').addEventListener('click', () => chip.remove());
  list.appendChild(chip);
  input.value = '';
});`}},{kind:"ui",id:"ui-stepper",title:"Multi-step Wizard",difficulty:2,category:"forms",prompt:"Build a 3-step wizard: Next advances (blocked on step 1 until the name field is filled), Back returns to the previous step, and reaching the last step shows the summary panel. The indicator must show the current step.",html:`<div class="stepper">
  <div class="step-indicator" data-step="1">Step <span id="step-num">1</span> of 3</div>
  <div class="step-panel" data-step="1">
    <label for="s-input">Your name</label>
    <input id="s-input" placeholder="Ada Lovelace" autocomplete="off" />
  </div>
  <div class="step-panel" data-step="2">
    <p>Pick a focus area.</p>
    <select id="s-focus"><option>Frontend</option><option>Backend</option><option>Full-stack</option></select>
  </div>
  <div class="step-panel" data-step="3">
    <p class="stepper-done">🎉 You're all set — review and finish.</p>
  </div>
  <div class="stepper-nav">
    <button id="back">Back</button>
    <button id="next">Next</button>
  </div>
</div>`,css:`.stepper { max-width: 380px; font-family: system-ui; }
.step-indicator { font-weight: 700; margin-bottom: 12px; font-size: 13px; color: #6366f1; }
.step-panel { display: none; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 12px; min-height: 90px; }
.step-panel[data-step="1"] { display: block; }
#s-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; margin-top: 6px; font-family: system-ui; }
.stepper-nav { display: flex; gap: 8px; }
.stepper-nav button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,js:fn,assertions:[{label:"step 1 visible initially",check:`return getComputedStyle(document.querySelector('.step-panel[data-step="1"]')).display !== 'none' && getComputedStyle(document.querySelector('.step-panel[data-step="2"]')).display === 'none';`},{label:"Next is blocked without a name",check:`document.querySelector('#next').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="1"]')).display !== 'none' && document.querySelector('#step-num').textContent.trim() === '1';`},{label:"a valid name advances",check:`document.querySelector('#s-input').value = 'Ada'; document.querySelector('#next').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="2"]')).display !== 'none' && document.querySelector('#step-num').textContent.trim() === '2';`},{label:"Back returns to step 1",check:`document.querySelector('#back').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="1"]')).display !== 'none';`}],hiddenAssertions:[{label:"reaching the last step shows the summary",check:`document.querySelector('#s-input').value = 'Ada'; document.querySelector('#next').click(); document.querySelector('#next').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="3"]')).display !== 'none' && document.querySelector('#step-num').textContent.trim() === '3';`}],hint:"Keep a step index; Next validates the name on step 1, moves the index, and toggles panel display + the indicator number.",reference:{html:`<div class="stepper">
  <div class="step-indicator" data-step="1">Step <span id="step-num">1</span> of 3</div>
  <div class="step-panel" data-step="1">
    <label for="s-input">Your name</label>
    <input id="s-input" placeholder="Ada Lovelace" autocomplete="off" />
  </div>
  <div class="step-panel" data-step="2">
    <p>Pick a focus area.</p>
    <select id="s-focus"><option>Frontend</option><option>Backend</option><option>Full-stack</option></select>
  </div>
  <div class="step-panel" data-step="3">
    <p class="stepper-done">🎉 You're all set — review and finish.</p>
  </div>
  <div class="stepper-nav">
    <button id="back">Back</button>
    <button id="next">Next</button>
  </div>
</div>`,css:`.stepper { max-width: 380px; font-family: system-ui; }
.step-indicator { font-weight: 700; margin-bottom: 12px; font-size: 13px; color: #6366f1; }
.step-panel { display: none; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 12px; min-height: 90px; }
.step-panel[data-step="1"] { display: block; }
#s-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; margin-top: 6px; font-family: system-ui; }
.stepper-nav { display: flex; gap: 8px; }
.stepper-nav button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,js:`const panels = [...document.querySelectorAll('.step-panel')];
const input = document.querySelector('#s-input');
let step = 0;
const show = () => {
  panels.forEach((p, i) => { p.style.display = i === step ? 'block' : 'none'; });
  document.querySelector('#step-num').textContent = String(step + 1);
  document.querySelector('.step-indicator').dataset.step = String(step + 1);
  document.querySelector('#back').disabled = step === 0;
  document.querySelector('#next').textContent = step === panels.length - 1 ? 'Finish' : 'Next';
};
document.querySelector('#next').addEventListener('click', () => {
  if (step === 0 && !input.value.trim()) return;
  if (step < panels.length - 1) step++;
  show();
});
document.querySelector('#back').addEventListener('click', () => {
  if (step > 0) step--;
  show();
});
show();`}},{kind:"ui",id:"ui-otp-input",title:"OTP Input",difficulty:2,category:"forms",prompt:"Build a 4-digit OTP input: typing a digit fills the current box and moves focus to the next, Backspace on an empty box moves focus back, and the full code is written to #otp-wrap's data-code attribute.",html:`<div id="otp-wrap" class="otp-wrap" data-code="">
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 1" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 2" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 3" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 4" />
</div>`,css:`.otp-wrap { display: flex; gap: 10px; font-family: system-ui; }
.otp { width: 52px; height: 56px; text-align: center; font-size: 22px; font-weight: 700; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; }`,js:fn,assertions:[{label:"all boxes start empty",check:"return [...document.querySelectorAll('.otp')].every(i => i.value === '');"},{label:"typing fills a box and advances focus",check:"const boxes = document.querySelectorAll('.otp'); boxes[0].value = '1'; boxes[0].dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return boxes[0].value === '1' && document.activeElement === boxes[1];"},{label:"the full code is collected",check:"const boxes = document.querySelectorAll('.otp'); boxes.forEach((b, i) => { b.value = String(i + 1); b.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(20); return document.querySelector('#otp-wrap').dataset.code === '1234';"}],hiddenAssertions:[{label:"backspace on an empty box moves back",check:"const boxes = document.querySelectorAll('.otp'); boxes[0].value = ''; boxes[1].value = ''; boxes[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })); await sleep(20); return document.activeElement === boxes[0];"}],hint:"On input: keep one digit, focus the next box, and recompute data-code from all boxes. On Backspace of an empty box, focus the previous one.",reference:{html:`<div id="otp-wrap" class="otp-wrap" data-code="">
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 1" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 2" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 3" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 4" />
</div>`,css:`.otp-wrap { display: flex; gap: 10px; font-family: system-ui; }
.otp { width: 52px; height: 56px; text-align: center; font-size: 22px; font-weight: 700; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; }`,js:`const wrap = document.querySelector('#otp-wrap');
const boxes = [...document.querySelectorAll('.otp')];
boxes.forEach((box, i) => {
  box.addEventListener('input', () => {
    box.value = box.value.replace(/\\D/g, '').slice(0, 1);
    if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
    wrap.dataset.code = boxes.map(b => b.value).join('');
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
  });
});`}},{kind:"ui",id:"ui-drag-drop",title:"Drag-and-drop Sortable List",difficulty:3,category:"interaction",prompt:"Build a sortable list using HTML5 drag-and-drop: dragging an item and dropping it onto another moves it to that position (inserted before the drop target). The dragged item gets a .dragging class while being dragged, removed on dragend.",html:`<ul id="dd-list" class="dd-list">
  <li class="dd-item" draggable="true" data-id="A">Item A</li>
  <li class="dd-item" draggable="true" data-id="B">Item B</li>
  <li class="dd-item" draggable="true" data-id="C">Item C</li>
  <li class="dd-item" draggable="true" data-id="D">Item D</li>
</ul>`,css:`.dd-list { list-style: none; padding: 0; margin: 0; max-width: 320px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.dd-item { padding: 12px 14px; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; cursor: grab; }
.dd-item.dragging { opacity: .5; border-style: dashed; }`,js:fn,assertions:[{label:"starts in order A B C D",check:"return [...document.querySelectorAll('.dd-item')].map(li => li.dataset.id).join(',') === 'A,B,C,D';"},{label:"dragging A onto C reorders",check:`const order = () => [...document.querySelectorAll('.dd-item')].map(li => li.dataset.id);
const dt = { effectAllowed: 'move', _d: {}, setData(k, v) { this._d[k] = v; }, getData(k) { return this._d[k] || ''; } };
const fire = (el, type) => { let e; try { e = new DragEvent(type, { bubbles: true, cancelable: true }); } catch { e = new Event(type, { bubbles: true, cancelable: true }); } Object.defineProperty(e, 'dataTransfer', { value: dt }); el.dispatchEvent(e); };
const items = document.querySelectorAll('.dd-item');
fire(items[0], 'dragstart');
fire(items[2], 'dragover');
fire(items[2], 'drop');
fire(items[0], 'dragend');
await sleep(20);
return order().join(',') === 'B,A,C,D';`}],hiddenAssertions:[{label:"dragging C onto A moves it to the front",check:`const order = () => [...document.querySelectorAll('.dd-item')].map(li => li.dataset.id);
const dt = { effectAllowed: 'move', _d: {}, setData(k, v) { this._d[k] = v; }, getData(k) { return this._d[k] || ''; } };
const fire = (el, type) => { let e; try { e = new DragEvent(type, { bubbles: true, cancelable: true }); } catch { e = new Event(type, { bubbles: true, cancelable: true }); } Object.defineProperty(e, 'dataTransfer', { value: dt }); el.dispatchEvent(e); };
const from = [...document.querySelectorAll('.dd-item')].find(li => li.dataset.id === 'C');
const to = [...document.querySelectorAll('.dd-item')].find(li => li.dataset.id === 'A');
fire(from, 'dragstart');
fire(to, 'dragover');
fire(to, 'drop');
fire(from, 'dragend');
await sleep(20);
return order().join(',') === 'B,C,A,D' && !document.querySelector('.dd-item.dragging');`}],hint:"On dragstart store the dragged element + setData; on dragover preventDefault (required for drop); on drop insertBefore(dragged, target); on dragend clear the .dragging class.",reference:{html:`<ul id="dd-list" class="dd-list">
  <li class="dd-item" draggable="true" data-id="A">Item A</li>
  <li class="dd-item" draggable="true" data-id="B">Item B</li>
  <li class="dd-item" draggable="true" data-id="C">Item C</li>
  <li class="dd-item" draggable="true" data-id="D">Item D</li>
</ul>`,css:`.dd-list { list-style: none; padding: 0; margin: 0; max-width: 320px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.dd-item { padding: 12px 14px; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; cursor: grab; }
.dd-item.dragging { opacity: .5; border-style: dashed; }`,js:`let dragged = null;
document.querySelectorAll('.dd-item').forEach(item => {
  item.addEventListener('dragstart', (e) => {
    dragged = item;
    item.classList.add('dragging');
    e.dataTransfer.setData('text/plain', item.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  item.addEventListener('dragover', (e) => { e.preventDefault(); });
  item.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragged || dragged === item) return;
    item.parentNode.insertBefore(dragged, item);
  });
  item.addEventListener('dragend', () => {
    if (dragged) dragged.classList.remove('dragging');
    dragged = null;
  });
});`}},{kind:"ui",id:"ui-virtual-list",title:"Virtualized List",difficulty:3,category:"performance",prompt:"Build a virtualized list: render 1000 items but keep only the visible window in the DOM (≤ 15 rows). Rows are 24px tall in a 200px viewport. Scrolling must re-render the window, and the total must be exposed in #vlist's data-total.",html:'<div id="vlist" class="vlist" style="height:200px;overflow:auto;position:relative"></div>',css:`.vlist { max-width: 360px; border: 1px solid #cbd5e1; border-radius: 10px; font-family: system-ui; }
.row { position: absolute; left: 0; right: 0; padding: 0 12px; display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; box-sizing: border-box; }`,js:fn,assertions:[{label:"DOM stays bounded and starts at row 0",check:"const rows = document.querySelectorAll('#vlist .row'); return rows.length > 0 && rows.length <= 15 && rows[0].dataset.index === '0' && document.querySelector('#vlist').dataset.total === '1000';"},{label:"scrolling moves the visible window",check:"const list = document.querySelector('#vlist'); list.scrollTop = 480; list.dispatchEvent(new Event('scroll')); await sleep(20); const rows = document.querySelectorAll('#vlist .row'); const first = Number(rows[0].dataset.index); return rows.length <= 15 && first >= 10 && first <= 60;"}],hiddenAssertions:[{label:"near the end the last rows render",check:"const list = document.querySelector('#vlist'); list.scrollTop = 23800; list.dispatchEvent(new Event('scroll')); await sleep(20); const rows = document.querySelectorAll('#vlist .row'); const last = Number(rows[rows.length - 1].dataset.index); return rows.length <= 15 && last >= 990;"}],hint:"On init and scroll: compute start = floor(scrollTop / 24) − 2, render only start..start+visible, position each row at top = i * 24.",reference:{html:'<div id="vlist" class="vlist" style="height:200px;overflow:auto;position:relative"></div>',css:`.vlist { max-width: 360px; border: 1px solid #cbd5e1; border-radius: 10px; font-family: system-ui; }
.row { position: absolute; left: 0; right: 0; padding: 0 12px; display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; box-sizing: border-box; }`,js:`const list = document.getElementById('vlist');
const TOTAL = 1000, ROW = 24, BUFFER = 2;
list.dataset.total = String(TOTAL);
const render = () => {
  const start = Math.max(0, Math.floor(list.scrollTop / ROW) - BUFFER);
  const visible = Math.ceil(200 / ROW) + BUFFER * 2;
  const end = Math.min(TOTAL, start + visible);
  list.innerHTML = '';
  for (let i = start; i < end; i++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.index = String(i);
    row.style.cssText = 'position:absolute;top:' + (i * ROW) + 'px;height:' + ROW + 'px;';
    row.textContent = 'Row ' + i;
    list.appendChild(row);
  }
};
list.addEventListener('scroll', render);
render();`}},{kind:"ui",id:"ui-countdown",title:"Countdown Timer",difficulty:2,category:"interaction",prompt:"Build a countdown timer starting at 5 seconds: Start begins counting down by one each second (display never goes below 0), Pause freezes it, Reset returns it to 5.",html:`<div class="cd-wrap">
  <div id="cd-display" class="cd-display">5</div>
  <div class="cd-controls">
    <button id="cd-start">Start</button>
    <button id="cd-pause">Pause</button>
    <button id="cd-reset">Reset</button>
  </div>
</div>`,css:`.cd-wrap { text-align: center; font-family: system-ui; }
.cd-display { font-size: 56px; font-weight: 800; font-variant-numeric: tabular-nums; margin-bottom: 12px; }
.cd-controls { display: flex; gap: 8px; justify-content: center; }
.cd-controls button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,js:fn,assertions:[{label:"starts at 5",check:"return document.querySelector('#cd-display').textContent.trim() === '5';"},{label:"Start counts down",check:"document.querySelector('#cd-start').click(); await sleep(1200); return Number(document.querySelector('#cd-display').textContent.trim()) < 5;"},{label:"Pause freezes the countdown",check:"document.querySelector('#cd-pause').click(); const v = Number(document.querySelector('#cd-display').textContent.trim()); await sleep(1000); return Number(document.querySelector('#cd-display').textContent.trim()) === v;"}],hiddenAssertions:[{label:"Reset returns to 5",check:"document.querySelector('#cd-reset').click(); await sleep(20); return document.querySelector('#cd-display').textContent.trim() === '5';"}],hint:"setInterval decrements every second while running; Pause clears the interval; Reset clears it and restores 5.",reference:{html:`<div class="cd-wrap">
  <div id="cd-display" class="cd-display">5</div>
  <div class="cd-controls">
    <button id="cd-start">Start</button>
    <button id="cd-pause">Pause</button>
    <button id="cd-reset">Reset</button>
  </div>
</div>`,css:`.cd-wrap { text-align: center; font-family: system-ui; }
.cd-display { font-size: 56px; font-weight: 800; font-variant-numeric: tabular-nums; margin-bottom: 12px; }
.cd-controls { display: flex; gap: 8px; justify-content: center; }
.cd-controls button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,js:`const display = document.querySelector('#cd-display');
let seconds = 5, timer = null;
const render = () => { display.textContent = String(seconds); };
document.querySelector('#cd-start').addEventListener('click', () => {
  if (timer) return;
  timer = setInterval(() => {
    seconds = Math.max(0, seconds - 1);
    render();
    if (seconds === 0) { clearInterval(timer); timer = null; }
  }, 1000);
});
document.querySelector('#cd-pause').addEventListener('click', () => { clearInterval(timer); timer = null; });
document.querySelector('#cd-reset').addEventListener('click', () => { clearInterval(timer); timer = null; seconds = 5; render(); });
render();`}},{kind:"ui",id:"ui-theme-toggle",title:"Theme Toggle",difficulty:1,category:"interaction",prompt:"Build a light/dark theme toggle: clicking the button toggles the .dark class on <body>, persists the choice to localStorage (key: theme, values light/dark — the judge sandbox blocks storage, so keep it best-effort), and reflects the state in the button's aria-pressed and data-theme attributes.",html:`<div class="theme-wrap">
  <button id="theme-btn" aria-pressed="false">🌙 Dark mode</button>
  <p class="theme-note">The page should switch between light and dark when toggled.</p>
</div>`,css:`.theme-wrap { font-family: system-ui; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 320px; }
#theme-btn { padding: 10px 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; cursor: pointer; font-weight: 700; font-family: system-ui; }
body.dark { background: #0f172a; }
body.dark .theme-wrap { border-color: #334155; }
body.dark .theme-note { color: #e2e8f0; }`,js:fn,assertions:[{label:"starts in light mode",check:"return !document.body.classList.contains('dark');"},{label:"clicking toggles to dark",check:"document.querySelector('#theme-btn').click(); await sleep(20); return document.body.classList.contains('dark') && document.querySelector('#theme-btn').getAttribute('aria-pressed') === 'true';"},{label:"clicking again returns to light",check:"document.querySelector('#theme-btn').click(); await sleep(20); return !document.body.classList.contains('dark') && document.querySelector('#theme-btn').getAttribute('aria-pressed') === 'false';"}],hiddenAssertions:[{label:"the state is tracked on the button",check:"document.querySelector('#theme-btn').click(); await sleep(20); return document.querySelector('#theme-btn').dataset.theme === 'dark' && document.body.classList.contains('dark');"}],hint:"Toggle the body class, mirror it in aria-pressed and localStorage on every click.",reference:{html:`<div class="theme-wrap">
  <button id="theme-btn" aria-pressed="false">🌙 Dark mode</button>
  <p class="theme-note">The page should switch between light and dark when toggled.</p>
</div>`,css:`.theme-wrap { font-family: system-ui; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 320px; }
#theme-btn { padding: 10px 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; cursor: pointer; font-weight: 700; font-family: system-ui; }
body.dark { background: #0f172a; }
body.dark .theme-wrap { border-color: #334155; }
body.dark .theme-note { color: #e2e8f0; }`,js:`const btn = document.querySelector('#theme-btn');
const save = (v) => { try { localStorage.setItem('theme', v); } catch { /* opaque-origin sandbox has no storage — best-effort */ } };
const apply = (dark) => {
  document.body.classList.toggle('dark', dark);
  btn.setAttribute('aria-pressed', String(dark));
  btn.dataset.theme = dark ? 'dark' : 'light';
  btn.textContent = dark ? '☀️ Light mode' : '🌙 Dark mode';
  save(dark ? 'dark' : 'light');
};
try { apply(localStorage.getItem('theme') === 'dark'); } catch { apply(false); }
btn.addEventListener('click', () => apply(!document.body.classList.contains('dark')));`}},{kind:"ui",id:"ui-slider",title:"Range Slider",difficulty:2,category:"forms",prompt:"Build a range slider: dragging (or changing) the slider updates the fill bar width to the same percentage and shows the numeric value in the label.",html:`<div class="slider-wrap">
  <div class="slider-track"><div id="s-fill" class="slider-fill" style="width:0%"></div></div>
  <input id="range" type="range" min="0" max="100" value="0" />
  <div class="slider-value">Value: <span id="s-val">0</span></div>
</div>`,css:`.slider-wrap { max-width: 340px; font-family: system-ui; }
.slider-track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.slider-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); }
#range { width: 100%; margin: 12px 0 6px; }
.slider-value { font-size: 13px; font-weight: 700; }`,js:fn,assertions:[{label:"starts at 0",check:"return document.querySelector('#s-val').textContent.trim() === '0' && document.querySelector('#s-fill').style.width === '0%';"},{label:"moving the slider updates fill + label",check:"const range = document.querySelector('#range'); range.value = '60'; range.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return document.querySelector('#s-val').textContent.trim() === '60' && document.querySelector('#s-fill').style.width === '60%';"}],hiddenAssertions:[{label:"maxing out fills the bar",check:"const range = document.querySelector('#range'); range.value = '100'; range.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return document.querySelector('#s-fill').style.width === '100%';"}],hint:"Listen for the input event and write range.value into both the fill width and the label.",reference:{html:`<div class="slider-wrap">
  <div class="slider-track"><div id="s-fill" class="slider-fill" style="width:0%"></div></div>
  <input id="range" type="range" min="0" max="100" value="0" />
  <div class="slider-value">Value: <span id="s-val">0</span></div>
</div>`,css:`.slider-wrap { max-width: 340px; font-family: system-ui; }
.slider-track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.slider-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); }
#range { width: 100%; margin: 12px 0 6px; }
.slider-value { font-size: 13px; font-weight: 700; }`,js:`const range = document.querySelector('#range');
const fill = document.querySelector('#s-fill');
const val = document.querySelector('#s-val');
const update = () => { fill.style.width = range.value + '%'; val.textContent = range.value; };
range.addEventListener('input', update);
update();`}}],rr=`// Wire up the component's behavior here.
// The judge checks the rendered DOM after real clicks / input events.`,ad=[{url:"https://unpkg.com/react@18.3.1/umd/react.production.min.js",global:"React"},{url:"https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",global:"ReactDOM"}],Kg=[{url:"https://unpkg.com/vue@3.4.38/dist/vue.global.prod.js",global:"Vue"}],m1=[{kind:"ui",id:"ui-react-counter",title:"React Counter",difficulty:2,category:"react",libs:ad,prompt:"Build a counter with React: clicking + increments the displayed number, clicking − decrements it. Use React.createElement (no JSX) and mount into #root with ReactDOM.createRoot.",html:'<div id="root"></div>',css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:rr,assertions:[{label:"starts at 0",check:"return document.querySelector('#value').textContent.trim() === '0';"},{label:"increments on +",check:"document.querySelector('#plus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '1';"},{label:"decrements on −",check:"document.querySelector('#minus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '-1';"}],hiddenAssertions:[{label:"rapid sequences stay consistent",check:"document.querySelector('#plus').click(); document.querySelector('#plus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '0';"}],hint:"Use useState for the count and pass onClick handlers that update it; React re-renders the span automatically.",reference:{html:'<div id="root"></div>',css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:`function Counter() {
  const [count, setCount] = React.useState(0);
  return React.createElement("div", { className: "counter" },
    React.createElement("button", { id: "minus", onClick: () => setCount(c => c - 1) }, "−"),
    React.createElement("span", { id: "value" }, count),
    React.createElement("button", { id: "plus", onClick: () => setCount(c => c + 1) }, "+")
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Counter));`}},{kind:"ui",id:"ui-react-todo",title:"React Todo List",difficulty:3,category:"react",libs:ad,prompt:"Build a todo list with React: submitting the form adds a non-empty todo, empty input is ignored, and each item has a delete button that removes it. Use React.createElement and useState.",html:'<div id="root"></div>',css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:rr,assertions:[{label:"starts empty",check:"return document.querySelectorAll('#todo-list li').length === 0;"},{label:"submit adds a todo",check:`const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, 'Learn React'); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1 && document.querySelector('#todo-list').textContent.includes('Learn React');`},{label:"empty input is ignored",check:`const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, '   '); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1;`}],hiddenAssertions:[{label:"delete removes an item",check:"document.querySelector('.del').click(); await sleep(30); return document.querySelectorAll('#todo-list li').length === 0;"}],hint:"Keep items in state; onSubmit prevents default, trims the input, appends, and clears the text field. Each item's delete handler filters by index.",reference:{html:'<div id="root"></div>',css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:`function App() {
  const [items, setItems] = React.useState([]);
  const [text, setText] = React.useState("");
  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setItems([...items, t]);
    setText("");
  };
  const del = (i) => setItems(items.filter((_, j) => j !== i));
  return React.createElement("div", { className: "todo" },
    React.createElement("form", { id: "todo-form", onSubmit: add },
      React.createElement("input", { id: "todo-input", value: text, onChange: (e) => setText(e.target.value), placeholder: "What needs doing?" }),
      React.createElement("button", { type: "submit" }, "Add")),
    React.createElement("ul", { id: "todo-list" },
      items.map((it, i) =>
        React.createElement("li", { key: i },
          React.createElement("span", null, it),
          React.createElement("button", { className: "del", onClick: () => del(i) }, "✕"))))
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));`}},{kind:"ui",id:"ui-react-tabs",title:"React Tabs",difficulty:2,category:"react",libs:ad,prompt:"Build a tab panel with React: clicking a tab shows its panel and marks it active; aria-selected must follow. Exactly one panel is visible at a time. Use React.createElement and useState.",html:'<div id="root"></div>',css:`.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,js:rr,assertions:[{label:"first panel visible initially",check:"return getComputedStyle(document.getElementById('tab1')).display !== 'none' && getComputedStyle(document.getElementById('tab2')).display === 'none';"},{label:"clicking a tab shows its panel",check:"document.querySelectorAll('.tab')[1].click(); await sleep(30); return getComputedStyle(document.getElementById('tab2')).display !== 'none' && getComputedStyle(document.getElementById('tab1')).display === 'none';"},{label:"exactly one panel active",check:"document.querySelectorAll('.tab')[2].click(); await sleep(30); return document.querySelectorAll('.tab-panel.active').length === 1;"}],hiddenAssertions:[{label:"aria-selected follows the active tab",check:"document.querySelectorAll('.tab')[1].click(); await sleep(30); return document.querySelectorAll('.tab')[1].getAttribute('aria-selected') === 'true' && document.querySelectorAll('.tab')[0].getAttribute('aria-selected') === 'false';"}],hint:"Track the active tab id in state; each tab button sets it, and class + aria-selected derive from it.",reference:{html:'<div id="root"></div>',css:`.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,js:`const PANELS = [
  { id: "tab1", label: "Overview" },
  { id: "tab2", label: "Pricing" },
  { id: "tab3", label: "FAQ" }
];
function Tabs() {
  const [active, setActive] = React.useState("tab1");
  return React.createElement("div", { className: "tabs" },
    React.createElement("div", { className: "tab-list", role: "tablist" },
      PANELS.map(p =>
        React.createElement("button", {
          key: p.id, className: "tab" + (active === p.id ? " active" : ""), "data-tab": p.id, role: "tab",
          "aria-selected": String(active === p.id),
          onClick: () => setActive(p.id)
        }, p.label))),
    PANELS.map(p =>
      React.createElement("div", { key: p.id, id: p.id, className: "tab-panel" + (active === p.id ? " active" : "") },
        React.createElement("p", null, p.label + " content.")))
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Tabs));`}},{kind:"ui",id:"ui-vue-counter",title:"Vue Counter",difficulty:2,category:"vue",libs:Kg,prompt:"Build a counter with Vue 3: clicking + increments the displayed number, clicking − decrements it. Use createApp with a template and data() state, then mount into #root.",html:'<div id="root"></div>',css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:rr,assertions:[{label:"starts at 0",check:"return document.querySelector('#value').textContent.trim() === '0';"},{label:"increments on +",check:"document.querySelector('#plus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '1';"},{label:"decrements on −",check:"document.querySelector('#minus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '-1';"}],hiddenAssertions:[{label:"rapid sequences stay consistent",check:"document.querySelector('#plus').click(); document.querySelector('#plus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '0';"}],hint:"data() returns the count, methods mutate it, and the template renders {{ count }} with @click handlers.",reference:{html:'<div id="root"></div>',css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:`Vue.createApp({
  data() { return { count: 0 }; },
  methods: {
    inc() { this.count += 1; },
    dec() { this.count -= 1; }
  },
  template: '<div class="counter">' +
    '<button id="minus" @click="dec">−</button>' +
    '<span id="value">{{ count }}</span>' +
    '<button id="plus" @click="inc">+</button>' +
  '</div>'
}).mount("#root");`}},{kind:"ui",id:"ui-vue-todo",title:"Vue Todo List",difficulty:3,category:"vue",libs:Kg,prompt:"Build a todo list with Vue 3: submitting the form adds a non-empty todo (empty input ignored), and each item has a delete button. Use createApp, v-model and v-for.",html:'<div id="root"></div>',css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:rr,assertions:[{label:"starts empty",check:"return document.querySelectorAll('#todo-list li').length === 0;"},{label:"submit adds a todo",check:`const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, 'Learn Vue'); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1 && document.querySelector('#todo-list').textContent.includes('Learn Vue');`},{label:"empty input is ignored",check:`const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, '   '); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1;`}],hiddenAssertions:[{label:"delete removes an item",check:"document.querySelector('.del').click(); await sleep(30); return document.querySelectorAll('#todo-list li').length === 0;"}],hint:"v-model binds the input; the submit handler trims, pushes to items, and clears the field; v-for renders each item with a del(i) button.",reference:{html:'<div id="root"></div>',css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:`Vue.createApp({
  data() { return { text: "", items: [] }; },
  methods: {
    add() {
      const t = this.text.trim();
      if (!t) return;
      this.items.push(t);
      this.text = "";
    },
    del(i) { this.items.splice(i, 1); }
  },
  template: '<div class="todo">' +
    '<form id="todo-form" @submit.prevent="add">' +
      '<input id="todo-input" v-model="text" placeholder="What needs doing?" />' +
      '<button type="submit">Add</button>' +
    '</form>' +
    '<ul id="todo-list">' +
      '<li v-for="(it, i) in items" :key="i"><span>{{ it }}</span><button class="del" @click="del(i)">✕</button></li>' +
    '</ul>' +
  '</div>'
}).mount("#root");`}}],g1=[{kind:"cli",id:"basic-calculator-ii",title:"Basic Calculator II",difficulty:2,prompt:"You are tasked with implementing a basic calculator that can evaluate simple expressions containing non-negative integers, addition (+), subtraction (-), multiplication (*), and division (/). The input is a string representing the expression, and you need to return the result as an integer. The expression is guaranteed to be valid and will not contain any parentheses. Note that integer division should truncate towards zero.",io:`input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"`,starters:{python:`import sys

# Input:
#   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`3+2*2
`,expect:"7"},{stdin:` 3/2 
`,expect:"1"},{stdin:` 3+5 / 2 
`,expect:"5"},{stdin:`14-3/2
`,expect:"13"},{stdin:`2*3+4*5
`,expect:"26"}],hidden:[{stdin:`10/2*3
`,expect:"15"},{stdin:`5-2*3+4
`,expect:"3"},{stdin:`1+1+1+1
`,expect:"4"}],hint:"Consider using a stack to handle the operations and maintain the order of precedence.",reference:`function solve(lines) {
  const out = [];
  const expression = lines[0];
  const tokens = expression.match(/\\d+|[+\\-*/]/g);
  let stack = [];
  let currentNum = 0;
  let operation = '+';

  for (let token of tokens) {
    if (!isNaN(token)) {
      currentNum = parseInt(token);
    }
    if (isNaN(token) || token === tokens[tokens.length - 1]) {
      if (operation === '+') stack.push(currentNum);
      else if (operation === '-') stack.push(-currentNum);
      else if (operation === '*') stack.push(stack.pop() * currentNum);
      else if (operation === '/') stack.push(Math.trunc(stack.pop() / currentNum));
      operation = token;
      currentNum = 0;
    }
  }

  out.push(stack.reduce((a, b) => a + b, 0).toString());
  return out;
}`,pattern:"stack"},{kind:"cli",id:"can-place-flowers",title:"Can Place Flowers",difficulty:2,prompt:"You have a flowerbed represented as an array where 0 means empty and 1 means a flower is planted. You want to plant a new flower in the flowerbed without violating the no-adjacent-flowers rule. Given the flowerbed and the number of new flowers you want to plant, determine if you can plant all of them. Return 'true' if you can plant all flowers, otherwise return 'false'.",io:`Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true`,starters:{python:`import sys

# Input:
#   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1,0,0,0,1]
1
`,expect:"true"},{stdin:`[1,0,0,0,1]
2
`,expect:"false"},{stdin:`[0,0,1,0,0]
2
`,expect:"true"},{stdin:`[0,0,0,0,0]
3
`,expect:"true"},{stdin:`[1,0,0,0,1]
0
`,expect:"true"}],hidden:[{stdin:`[0,0,0,0,0]
5
`,expect:"false"},{stdin:`[0,1,0,0,0,1,0]
1
`,expect:"true"},{stdin:`[1,0,0,1,0,0,1]
1
`,expect:"false"}],hint:"Consider the conditions for planting a flower carefully.",reference:"function solve(lines) { const flowerbed = JSON.parse(lines[0]); const n = parseInt(lines[1]); let count = 0; for (let i = 0; i < flowerbed.length; i++) { if (flowerbed[i] === 0 && (i === 0 || flowerbed[i - 1] === 0) && (i === flowerbed.length - 1 || flowerbed[i + 1] === 0)) { flowerbed[i] = 1; count++; } } return [count >= n ? 'true' : 'false']; }",pattern:"greedy"},{kind:"cli",id:"construct-k-palindrome-strings",title:"Construct K Palindrome Strings",difficulty:2,prompt:"Given a string `s` and an integer `k`, determine if it is possible to construct `k` palindrome strings using all characters of `s`. Each palindrome string must use the characters from `s` without any leftover characters. A palindrome reads the same forwards and backwards. Return 'YES' if it's possible, otherwise return 'NO'.",io:`YES
NO
YES
NO`,starters:{python:`import sys

# Input:
#   YES
NO
YES
NO
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   YES
NO
YES
NO
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   YES
NO
YES
NO
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   YES
NO
YES
NO
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   YES
NO
YES
NO
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   YES
NO
YES
NO
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`aabb
2
`,expect:"YES"},{stdin:`abc
2
`,expect:"NO"},{stdin:`aaaabbbb
3
`,expect:"YES"},{stdin:`abcdefg
1
`,expect:"NO"}],hidden:[{stdin:`aabbcc
3
`,expect:"YES"},{stdin:`xyz
2
`,expect:"NO"}],hint:"Count character frequencies and check the number of odd counts against k.",reference:`function solve(lines) {
  const out = [];
  const [s, k] = lines;
  const charCount = {};
  for (const char of s) {
    charCount[char] = (charCount[char] || 0) + 1;
  }
  const oddCount = Object.values(charCount).filter(count => count % 2 !== 0).length;
  out.push(oddCount <= k ? 'YES' : 'NO');
  return out;
}`,pattern:"hash-map"},{kind:"cli",id:"dot-product-of-two-sparse-vectors",title:"Dot Product of Two Sparse Vectors",difficulty:2,prompt:`You are given two sparse vectors represented as arrays of integers. Each vector contains non-negative integers, where a value of zero indicates the absence of a corresponding dimension. Your task is to compute the dot product of these two vectors. The dot product is defined as the sum of the products of the corresponding entries of the two sequences. If the vectors are of different lengths, consider the shorter length for the calculation. Return the result as a single integer.

For example, given vectors [1, 0, 0, 2] and [0, 3, 0, 4], the dot product is 0*1 + 3*0 + 0*0 + 4*2 = 8.`,io:`8
0`,starters:{python:`import sys

# Input:
#   8
0
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   8
0
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   8
0
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   8
0
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   8
0
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   8
0
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1, 0, 0, 2]
[0, 3, 0, 4]
`,expect:`8
`},{stdin:`[0, 0, 0]
[0, 0, 0]
`,expect:`0
`},{stdin:`[1, 2, 3]
[4, 5, 6]
`,expect:`32
`},{stdin:`[1, 2, 0, 0]
[0, 0, 0, 3]
`,expect:`0
`}],hidden:[{stdin:`[0, 1, 0, 0, 5]
[0, 0, 2, 3, 0]
`,expect:`0
`},{stdin:`[1, 2, 3, 4]
[0, 0, 0, 0]
`,expect:`0
`}],hint:"Consider only the minimum length of the two vectors for the dot product calculation.",reference:`function solve(lines) {
  const out = [];
  const vec1 = JSON.parse(lines[0]);
  const vec2 = JSON.parse(lines[1]);
  const minLength = Math.min(vec1.length, vec2.length);
  let dotProduct = 0;
  for (let i = 0; i < minLength; i++) {
    dotProduct += vec1[i] * vec2[i];
  }
  out.push(dotProduct.toString());
  return out;
}`,pattern:"mixed"},{kind:"cli",id:"first-bad-version",title:"First Bad Version",difficulty:2,prompt:"You are given a function that checks if a version is bad. The versions are numbered from 1 to n. You need to find the first bad version among them. Implement a function that takes the total number of versions and returns the first bad version. The first bad version is defined as the lowest numbered version that is bad. You can assume that there is at least one bad version.",io:`1
2
3
4
5`,starters:{python:`import sys

# Input:
#   1
2
3
4
5
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   1
2
3
4
5
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   1
2
3
4
5
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   1
2
3
4
5
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   1
2
3
4
5
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   1
2
3
4
5
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`5
4
`,expect:"4"},{stdin:`10
6
`,expect:"6"},{stdin:`7
3
`,expect:"3"},{stdin:`1
1
`,expect:"1"}],hidden:[{stdin:`100
50
`,expect:"50"},{stdin:`20
15
`,expect:"15"}],hint:"Use binary search to efficiently find the first bad version.",reference:`function solve(lines) {
  const n = parseInt(lines[0]);
  const badVersion = parseInt(lines[1]);
  return [badVersion.toString()];
}`,pattern:"binary-search"},{kind:"cli",id:"first-missing-positive",title:"First Missing Positive",difficulty:3,prompt:"Given an array of integers, find the smallest positive integer that is not present in the array. The solution should run in O(n) time and use O(1) space. You may assume the array contains no duplicates and can be of any length, including empty.",io:`3
1
2
4
5
6`,starters:{python:`import sys

# Input:
#   3
1
2
4
5
6
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
1
2
4
5
6
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
1
2
4
5
6
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
1
2
4
5
6
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
1
2
4
5
6
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
1
2
4
5
6
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[3, 4, -1, 1]
`,expect:"2"},{stdin:`[1, 2, 0]
`,expect:"3"},{stdin:`[-1, -2, -3]
`,expect:"1"},{stdin:`[7, 8, 9, 11, 12]
`,expect:"1"},{stdin:`[1, 2, 3, 4, 5]
`,expect:"6"}],hidden:[{stdin:`[1, 2, 3, 5, 6, 7, 8, 9, 10]
`,expect:"4"},{stdin:`[2, 3, 4, 5, 6]
`,expect:"1"},{stdin:`[1, 1, 1, 1, 1]
`,expect:"2"}],hint:"Consider using the array indices to place numbers in their correct positions.",reference:`function solve(lines) {
  const out = [];
  const nums = lines[0].slice(1, -1).split(',').map(Number);
  const n = nums.length;
  for (let i = 0; i < n; i++) {
    while (nums[i] > 0 && nums[i] <= n && nums[nums[i] - 1] !== nums[i]) {
      const temp = nums[i];
      nums[i] = nums[temp - 1];
      nums[temp - 1] = temp;
    }
  }
  for (let i = 0; i < n; i++) {
    if (nums[i] !== i + 1) {
      out.push(i + 1);
      return out;
    }
  }
  out.push(n + 1);
  return out;
}`,pattern:"hash-map"},{kind:"cli",id:"flatten-2d-vector",title:"Flatten 2D Vector",difficulty:2,prompt:"You are given a 2D grid of integers where each row may have a different number of columns. Your task is to flatten this grid into a single list of integers. The order of elements in the flattened list should follow the row-major order, meaning you traverse each row from left to right before moving to the next row. Implement a function that takes this grid as input and returns the flattened list as output.",io:`Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:`,starters:{python:`import sys

# Input:
#   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[[1,2,3],[4,5],[6]]
`,expect:`1
2
3
4
5
6
`},{stdin:`[[7,8],[9]]
`,expect:`7
8
9
`},{stdin:`[[],[1,2]]
`,expect:`1
2
`},{stdin:`[[10]]
`,expect:`10
`},{stdin:`[[],[]]
`,expect:""}],hidden:[{stdin:`[[1,2,3,4],[5,6],[7,8,9]]
`,expect:`1
2
3
4
5
6
7
8
9
`},{stdin:`[[0,0],[0,0],[0,0]]
`,expect:`0
0
0
0
0
0
`},{stdin:`[[1],[2],[3],[4],[5]]
`,expect:`1
2
3
4
5
`}],hint:"Think about how to iterate through each row and then each column to collect the numbers.",reference:`function solve(lines) {
  const out = [];
  const grid = JSON.parse(lines[0]);
  for (const row of grid) {
    for (const num of row) {
      out.push(num);
    }
  }
  return out;
}`,pattern:"mixed"},{kind:"cli",id:"generate-parentheses",title:"Generate Parentheses",difficulty:2,prompt:'Given an integer n, generate all combinations of well-formed parentheses of length 2n. Each combination should be unique and in lexicographical order. For example, if n = 3, the valid combinations are: "((()))", "(()())", "(())()", "()(())", and "()()()". Return the combinations as an array of strings.',io:`((()))
(()())
(())()
()(())
()()()`,starters:{python:`import sys

# Input:
#   ((()))
(()())
(())()
()(())
()()()
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   ((()))
(()())
(())()
()(())
()()()
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   ((()))
(()())
(())()
()(())
()()()
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   ((()))
(()())
(())()
()(())
()()()
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   ((()))
(()())
(())()
()(())
()()()
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   ((()))
(()())
(())()
()(())
()()()
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`3
`,expect:`((()))
(()())
(())()
()(())
()()()`},{stdin:`2
`,expect:`(())
()()`},{stdin:`1
`,expect:"()"}],hidden:[{stdin:`4
`,expect:`(((())))
((()()))
((())())
((()))()
(()(()))
(()()())
(()())()
(())(())
(())()()
()((()))
()(()())
()(())()
()()(())
()()()()`}],hint:"Use a recursive approach to build combinations while ensuring valid parentheses.",reference:`function solve(lines) {
  const n = parseInt(lines[0]);
  const out = [];
  function generate(p, left, right) {
    if (left === 0 && right === 0) {
      out.push(p);
      return;
    }
    if (left > 0) generate(p + '(', left - 1, right);
    if (right > left) generate(p + ')', left, right - 1);
  }
  generate('', n, n);
  return out;
}`,pattern:"backtracking"},{kind:"cli",id:"happy-number",title:"Happy Number",difficulty:2,prompt:"A happy number is defined by the following process: starting with any positive integer, replace the number by the sum of the squares of its digits, and repeat the process until the number equals 1 (where it will stay), or it loops endlessly in a cycle that does not include 1. Write a function to determine if a given number is a happy number.",io:`Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.`,starters:{python:`import sys

# Input:
#   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:"19",expect:"True"},{stdin:"2",expect:"False"},{stdin:"7",expect:"True"},{stdin:"4",expect:"False"}],hidden:[{stdin:"1",expect:"True"},{stdin:"16",expect:"False"}],hint:"Use a set to track seen numbers to detect cycles.",reference:`function solve(lines) {
  const out = [];
  const isHappy = (n) => {
    const seen = new Set();
    while (n !== 1 && !seen.has(n)) {
      seen.add(n);
      n = n.toString().split('').reduce((sum, digit) => sum + Math.pow(parseInt(digit), 2), 0);
    }
    return n === 1;
  };
  const n = parseInt(lines[0]);
  out.push(isHappy(n) ? 'True' : 'False');
  return out;
}`,pattern:"hash-map"},{kind:"cli",id:"intersection-of-two-linked-lists",title:"Intersection of Two Linked Lists",difficulty:2,prompt:"You are given two singly linked lists. Write a function to determine the node at which the two lists intersect. If they do not intersect, return null. The linked lists are represented as arrays of integers, where the last element of the first list points to the first element of the second list if they intersect. Otherwise, the last element of the first list points to null. Your task is to find the intersection node's value or return 'null' if there is no intersection.",io:`input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3`,starters:{python:`import sys

# Input:
#   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1, 2, 3, 4, 5]
[6, 7, 8]
`,expect:"null"},{stdin:`[1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
`,expect:"3"},{stdin:`[1, 2, 3]
[4, 5, 6, 3]
`,expect:"3"},{stdin:`[1, 2]
[3, 4]
`,expect:"null"},{stdin:`[1, 2, 3, 4]
[5, 6, 3, 4]
`,expect:"3"}],hidden:[{stdin:`[1, 2, 3, 4, 5]
[6, 7, 8, 4, 5]
`,expect:"4"},{stdin:`[1, 2]
[2]
`,expect:"2"}],hint:"Use a set to track nodes from the first list and check for intersections in the second.",reference:`function solve(lines) {
  const out = [];
  const list1 = lines[0].slice(1, -1).split(',').map(Number);
  const list2 = lines[1].slice(1, -1).split(',').map(Number);
  const set = new Set(list1);
  for (const num of list2) {
    if (set.has(num)) {
      out.push(num);
      return out;
    }
  }
  out.push('null');
  return out;
}`,pattern:"hash-map"},{kind:"cli",id:"kth-largest-element-in-an-array",title:"Kth Largest Element in an Array",difficulty:2,prompt:"You are given an array of integers and an integer k. Your task is to find the k-th largest element in the array. Note that it is the k-th largest element in the sorted order, not the k-th distinct element. If k is greater than the number of elements in the array, return -1. The array can contain duplicate elements. Implement a function that reads the input and returns the k-th largest element as specified.",io:`Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.`,starters:{python:`import sys

# Input:
#   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`5
3 2 1 5 6
2
`,expect:"5"},{stdin:`3
1 2 3
1
`,expect:"3"},{stdin:`6
3 2 3 1 2 4
4
`,expect:"2"},{stdin:`4
1 1 1 1
1
`,expect:"1"}],hidden:[{stdin:`10
5 3 8 6 2 7 4 1 9 10
5
`,expect:"6"},{stdin:`7
1 2 3 4 5 6 7
8
`,expect:"-1"}],hint:"Sort the array and access the k-th largest element directly.",reference:`function solve(lines) {
    const n = parseInt(lines[0]);
    const arr = lines[1].split(' ').map(Number);
    const k = parseInt(lines[2]);
    arr.sort((a, b) => b - a);
    return [k <= n ? arr[k - 1].toString() : '-1'];
}`,pattern:"sorting"},{kind:"cli",id:"letter-combinations-of-a-phone-number",title:"Letter Combinations of a Phone Number",difficulty:2,prompt:"Given a string of digits from 2 to 9, return all possible letter combinations that the number could represent based on the mapping of digits to letters on a phone keypad. Each digit maps to a set of letters as follows: 2 -> 'abc', 3 -> 'def', 4 -> 'ghi', 5 -> 'jkl', 6 -> 'mno', 7 -> 'pqrs', 8 -> 'tuv', 9 -> 'wxyz'. The output should be in lexicographical order. If the input string is empty, return an empty list.",io:`abc
def
abc
def`,starters:{python:`import sys

# Input:
#   abc
def
abc
def
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   abc
def
abc
def
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   abc
def
abc
def
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   abc
def
abc
def
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   abc
def
abc
def
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   abc
def
abc
def
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`23
`,expect:`ad
ae
af
bd
be
bf
cd
ce
cf
`},{stdin:`2
`,expect:`a
b
c
`},{stdin:`79
`,expect:`pw
px
py
pz
qw
qx
qy
qz
rw
rx
ry
rz
sw
sx
sy
sz
`},{stdin:`
`,expect:""}],hidden:[{stdin:`7
`,expect:`p
q
r
s
`},{stdin:`234
`,expect:`adg
adh
adi
aeg
aeh
aei
afg
afh
afi
bdg
bdh
bdi
beg
beh
bei
bfg
bfh
bfi
cdg
cdh
cdi
ceg
ceh
cei
cfg
cfh
cfi
`}],hint:"Consider using backtracking to explore all combinations of letters.",reference:`function solve(lines) {
  const out = [];
  const digitToLetters = {
    '2': 'abc', '3': 'def', '4': 'ghi', '5': 'jkl',
    '6': 'mno', '7': 'pqrs', '8': 'tuv', '9': 'wxyz'
  };
  const digits = lines[0];
  if (!digits) return out;
  const combinations = [];
  const backtrack = (index, path) => {
    if (index === digits.length) {
      combinations.push(path);
      return;
    }
    const letters = digitToLetters[digits[index]];
    for (const letter of letters) {
      backtrack(index + 1, path + letter);
    }
  };
  backtrack(0, '');
  out.push(...combinations.sort());
  return out;
}`,pattern:"backtracking"},{kind:"cli",id:"linked-list-cycle",title:"Linked List Cycle",difficulty:2,prompt:"You are given a linked list represented by an array of integers, where the last element points to the index of an element in the list, forming a cycle if it points to a valid index. Your task is to determine if the linked list has a cycle. If the last element is -1, it indicates that there is no cycle. Return 'True' if there is a cycle, otherwise return 'False'.",io:`True
False
False`,starters:{python:`import sys

# Input:
#   True
False
False
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   True
False
False
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   True
False
False
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   True
False
False
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   True
False
False
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   True
False
False
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1, 2, 3, 4, 5]
-1
`,expect:"False"},{stdin:`[1, 2, 3, 4, 5]
2
`,expect:"True"},{stdin:`[1, 2, 3]
0
`,expect:"True"},{stdin:`[1]
-1
`,expect:"False"}],hidden:[{stdin:`[1, 2, 3, 4]
3
`,expect:"True"},{stdin:`[1, 2]
1
`,expect:"True"},{stdin:`[1, 2, 3, 4, 5]
4
`,expect:"True"}],hint:"Use a set to track visited nodes and check for cycles as you traverse.",reference:`function solve(lines) {
  const out = [];
  const list = lines[0].slice(1, -1).split(',').map(Number);
  const pos = Number(lines[1]);
  const visited = new Set();
  let currentIndex = 0;
  while (currentIndex !== -1) {
    if (visited.has(currentIndex)) {
      out.push('True');
      return out;
    }
    visited.add(currentIndex);
    currentIndex = pos === -1 ? -1 : list[currentIndex];
  }
  out.push('False');
  return out;
}`,pattern:"hash-map"},{kind:"cli",id:"longest-palindromic-substring",title:"Longest Palindromic Substring",difficulty:2,prompt:`Given a string, find the longest substring that is a palindrome. A palindrome reads the same forwards and backwards. If there are multiple longest palindromic substrings, return the first one found. The input string will have a length between 1 and 1000 characters. 

For example, in the string "babad", the longest palindromic substring is "bab" or "aba". 

Implement a function that takes the string as input and returns the longest palindromic substring.`,io:"aba",starters:{python:`import sys

# Input:
#   aba
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   aba
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   aba
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   aba
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   aba
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   aba
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`babad
`,expect:`bab
`},{stdin:`cbbd
`,expect:`bb
`},{stdin:`a
`,expect:`a
`},{stdin:`racecar
`,expect:`racecar
`}],hidden:[{stdin:`abcdefg
`,expect:`a
`},{stdin:`abccba
`,expect:`abccba
`}],hint:"Consider expanding around potential centers of the palindrome.",reference:`function solve(lines) {
  const out = [];
  const s = lines[0];
  let longest = '';

  for (let i = 0; i < s.length; i++) {
    for (let j = i; j < s.length; j++) {
      const substring = s.slice(i, j + 1);
      if (isPalindrome(substring) && substring.length > longest.length) {
        longest = substring;
      }
    }
  }

  out.push(longest);
  return out;
}

function isPalindrome(str) {
  return str === str.split('').reverse().join('');
}`,pattern:"dynamic-programming"},{kind:"cli",id:"longest-substring-without-repeating-characters",title:"Longest Substring Without Repeating Characters",difficulty:2,prompt:'Given a string, find the length of the longest substring that contains at most two distinct characters. For example, in the string "eceba", the longest substring with at most two distinct characters is "ece", which has a length of 3. Your task is to implement a function that returns this length for any given input string.',io:`3
5
4
2
6`,starters:{python:`import sys

# Input:
#   3
5
4
2
6
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
5
4
2
6
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
5
4
2
6
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
5
4
2
6
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
5
4
2
6
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
5
4
2
6
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`eceba
`,expect:"3"},{stdin:`ccaabbb
`,expect:"5"},{stdin:`abcabcabc
`,expect:"2"},{stdin:`aa
`,expect:"2"}],hidden:[{stdin:`aabbcc
`,expect:"4"},{stdin:`abaccc
`,expect:"4"},{stdin:`abcde
`,expect:"2"}],hint:"Use a sliding window approach to track distinct characters.",reference:`function solve(lines) {
    const s = lines[0];
    let left = 0, right = 0;
    const charMap = {};
    let maxLength = 0;

    while (right < s.length) {
        charMap[s[right]] = (charMap[s[right]] || 0) + 1;

        while (Object.keys(charMap).length > 2) {
            charMap[s[left]]--;
            if (charMap[s[left]] === 0) delete charMap[s[left]];
            left++;
        }

        maxLength = Math.max(maxLength, right - left + 1);
        right++;
    }

    return [maxLength.toString()];
}`,pattern:"sliding-window"},{kind:"cli",id:"median-of-two-sorted-arrays",title:"Median of Two Sorted Arrays",difficulty:3,prompt:"You are given two sorted arrays of integers, `array1` and `array2`. Your task is to find the median of the combined sorted array formed by merging both arrays. The median is defined as the middle value when the total number of elements is odd, or the average of the two middle values when the total number of elements is even. Implement a function that efficiently computes the median without fully merging the arrays. The input arrays may have different lengths.\n\nFunction Signature: `function solve(lines)`",io:`3
2
4`,starters:{python:`import sys

# Input:
#   3
2
4
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
2
4
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
2
4
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
2
4
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
2
4
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
2
4
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1, 3]
[2]
`,expect:`2
`},{stdin:`[1, 2]
[3, 4]
`,expect:`2.5
`},{stdin:`[0, 0]
[0, 0]
`,expect:`0
`},{stdin:`[]
[1]
`,expect:`1
`},{stdin:`[2]
[]
`,expect:`2
`}],hidden:[{stdin:`[1, 3, 8]
[7, 9, 10, 11]
`,expect:`8
`},{stdin:`[1, 2, 3, 4, 5]
[6, 7, 8, 9, 10]
`,expect:`5.5
`}],hint:"Consider using binary search to optimize the merging process.",reference:`function solve(lines) {
  const out = [];
  const array1 = JSON.parse(lines[0]);
  const array2 = JSON.parse(lines[1]);
  const merged = [...array1, ...array2].sort((a, b) => a - b);
  const len = merged.length;
  if (len % 2 === 1) {
    out.push(merged[Math.floor(len / 2)].toString());
  } else {
    const mid1 = merged[len / 2 - 1];
    const mid2 = merged[len / 2];
    out.push(((mid1 + mid2) / 2).toString());
  }
  return out;
}`,pattern:"binary-search"},{kind:"cli",id:"meeting-rooms-ii",title:"Meeting Rooms II",difficulty:2,prompt:`You are given a list of meeting time intervals, where each interval is represented as a pair of integers [start, end]. Your task is to determine the minimum number of meeting rooms required to accommodate all the meetings without overlap. Each meeting room can only hold one meeting at a time. If a meeting ends at the same time another meeting starts, they can use the same room. 

Write a function that takes a list of intervals and returns the minimum number of meeting rooms needed.`,io:`3
1
0
2
2`,starters:{python:`import sys

# Input:
#   3
1
0
2
2
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
1
0
2
2
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
1
0
2
2
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
1
0
2
2
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
1
0
2
2
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
1
0
2
2
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[[0, 30], [5, 10], [15, 20]]
`,expect:`2
`},{stdin:`[[7, 10], [2, 4]]
`,expect:`1
`},{stdin:`[[1, 2], [2, 3], [3, 4]]
`,expect:`1
`},{stdin:`[[0, 5], [5, 10], [10, 15]]
`,expect:`1
`}],hidden:[{stdin:`[[1, 5], [2, 6], [3, 7], [4, 8]]
`,expect:`4
`},{stdin:`[[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]
`,expect:`1
`}],hint:"Consider sorting the start and end times of the meetings.",reference:`function solve(lines) {
  const out = [];
  const intervals = JSON.parse(lines[0]);
  const startTimes = intervals.map(interval => interval[0]).sort((a, b) => a - b);
  const endTimes = intervals.map(interval => interval[1]).sort((a, b) => a - b);

  let roomCount = 0, endIndex = 0;
  for (let startIndex = 0; startIndex < intervals.length; startIndex++) {
    if (startTimes[startIndex] >= endTimes[endIndex]) {
      endIndex++;
    } else {
      roomCount++;
    }
  }
  out.push(roomCount);
  return out;
}`,pattern:"greedy"},{kind:"cli",id:"merge-intervals",title:"Merge Intervals",difficulty:2,prompt:`You are given a list of intervals where each interval is represented as a pair of integers [start, end]. Your task is to merge all overlapping intervals and return a list of the merged intervals in ascending order of their start times. If two intervals overlap, they should be combined into one. The output should maintain the same format as the input intervals. 

For example, given intervals [[1,3],[2,6],[8,10],[15,18]], the merged intervals would be [[1,6],[8,10],[15,18]].`,io:`1 6
8 10
15 18`,starters:{python:`import sys

# Input:
#   1 6
8 10
15 18
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   1 6
8 10
15 18
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   1 6
8 10
15 18
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   1 6
8 10
15 18
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   1 6
8 10
15 18
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   1 6
8 10
15 18
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[[1,3],[2,6],[8,10],[15,18]]
`,expect:`1 6
8 10
15 18`},{stdin:`[[1,4],[4,5]]
`,expect:"1 5"},{stdin:`[[1,2],[3,4],[5,6]]
`,expect:`1 2
3 4
5 6`},{stdin:`[[1,10],[2,3],[4,5],[6,7],[8,9]]
`,expect:"1 10"},{stdin:`[[1,2],[2,3],[3,4],[4,5]]
`,expect:"1 5"}],hidden:[{stdin:`[[1,3],[2,4],[5,7],[6,8]]
`,expect:`1 4
5 8`},{stdin:`[[1,2],[3,5],[4,6],[7,8],[9,10]]
`,expect:`1 2
3 6
7 8
9 10`}],hint:"Sort intervals by start time and merge overlapping ones.",reference:`function solve(lines) {
  const intervals = JSON.parse(lines[0]);
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const interval of intervals) {
    if (merged.length === 0 || merged[merged.length - 1][1] < interval[0]) {
      merged.push(interval);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], interval[1]);
    }
  }
  return merged.map(interval => interval.join(' '));
}`,pattern:"interval"},{kind:"cli",id:"merge-k-sorted-lists",title:"Merge k Sorted Lists",difficulty:3,prompt:"You are given an array of k sorted linked lists. Merge all the linked lists into one sorted linked list and return it. Each linked list is represented as an array of integers. The output should be a single sorted array containing all the elements from the k linked lists. The input will contain at least one linked list and at most 100 linked lists, with each list containing up to 1000 integers. All integers are in the range of -10^6 to 10^6.",io:`3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000`,starters:{python:`import sys

# Input:
#   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[[1,4,5],[1,3,4],[2,6]]
`,expect:`1
1
2
3
4
4
5
6
`},{stdin:`[[2,6],[1,3,5],[4]]
`,expect:`1
2
3
4
5
6
`},{stdin:`[[10,20,30],[5,15,25],[1,2,3]]
`,expect:`1
2
3
5
10
15
20
25
30
`},{stdin:`[[7,8,9],[1,2,3],[4,5,6]]
`,expect:`1
2
3
4
5
6
7
8
9
`},{stdin:`[[1],[2],[3],[4],[5]]
`,expect:`1
2
3
4
5
`}],hidden:[{stdin:`[[1,2,3],[4,5,6],[7,8,9]]
`,expect:`1
2
3
4
5
6
7
8
9
`},{stdin:`[[10,20],[15,25],[5,30]]
`,expect:`5
10
15
20
25
30
`},{stdin:`[[100],[200],[300],[400],[500]]
`,expect:`100
200
300
400
500
`}],hint:"Consider using a min-heap to efficiently merge the lists.",reference:`function solve(lines) {
  const lists = JSON.parse(lines[0]);
  const merged = [];
  lists.forEach(list => merged.push(...list));
  merged.sort((a, b) => a - b);
  return merged.map(String);
}`,pattern:"heap"},{kind:"cli",id:"mini-parser",title:"Mini Parser",difficulty:2,prompt:"You are tasked with parsing a nested list structure represented as a string. Each element in the list can be an integer or another nested list. Your goal is to convert this string representation into a nested list of integers. The string will be formatted such that integers are separated by commas and nested lists are enclosed in brackets. For example, the string '[1,2,[3,4,[5]]]' should be converted to the nested list structure [[1,2],[3,4,[5]]]. Write a function that takes this string as input and returns the corresponding nested list.",io:`Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5`,starters:{python:`import sys

# Input:
#   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1,2,[3,4,[5]]]
`,expect:`1
2
3
4
5`},{stdin:`[10,[20,30],40]
`,expect:`10
20
30
40`},{stdin:`[[],[1,[2,[3]]]]
`,expect:`1
2
3`},{stdin:`[1,[2,3],[4,[5,6]]]
`,expect:`1
2
3
4
5
6`}],hidden:[{stdin:`[[[1,2],3],4]
`,expect:`1
2
3
4`},{stdin:`[1,[2,[3,[4,[5]]]]]
`,expect:`1
2
3
4
5`}],hint:"Consider using a stack to manage nested lists while parsing the string.",reference:`function solve(lines) {
  const out = [];
  const parseList = (str) => {
    let stack = [];
    let current = [];
    let num = '';
    for (let char of str) {
      if (char === '[') {
        stack.push(current);
        current = [];
      } else if (char === ']') {
        if (num) {
          current.push(parseInt(num));
          num = '';
        }
        const last = stack.pop();
        last.push(current);
        current = last;
      } else if (char === ',') {
        if (num) {
          current.push(parseInt(num));
          num = '';
        }
      } else {
        num += char;
      }
    }
    return current;
  };
  const nestedList = parseList(lines[0].trim());
  const flatten = (list) => {
    for (let item of list) {
      if (Array.isArray(item)) {
        flatten(item);
      } else {
        out.push(item);
      }
    }
  };
  flatten(nestedList);
  return out;
}`,pattern:"stack"},{kind:"cli",id:"minimum-add-to-make-parentheses-valid",title:"Minimum Add to Make Parentheses Valid",difficulty:2,prompt:'You are given a string consisting of parentheses, and your task is to determine the minimum number of parentheses that need to be added to make the string valid. A valid string is one where every opening parenthesis has a corresponding closing parenthesis and they are correctly nested. For example, the string "(()" is valid, while the string "())(" is not. Your function should return the minimum number of parentheses needed to make the input string valid.',io:"2",starters:{python:`import sys

# Input:
#   2
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   2
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   2
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   2
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   2
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   2
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`())(
`,expect:`2
`},{stdin:`((
`,expect:`2
`},{stdin:`())
`,expect:`1
`},{stdin:`()()()
`,expect:`0
`},{stdin:`((()))
`,expect:`0
`}],hidden:[{stdin:`()(
`,expect:`1
`},{stdin:`())())(
`,expect:`3
`}],hint:"Count unmatched parentheses to find how many need to be added.",reference:`function solve(lines) {
  const out = [];
  let open = 0;
  let close = 0;
  for (let char of lines[0]) {
    if (char === '(') {
      open++;
    } else if (char === ')') {
      if (open > 0) {
        open--;
      } else {
        close++;
      }
    }
  }
  out.push((open + close).toString());
  return out;
}`,pattern:"string"},{kind:"cli",id:"product-of-array-except-self",title:"Product of Array Except Self",difficulty:2,prompt:"Given an array of integers, return an array such that each element at index i of the output array is the product of all the numbers in the input array except the number at i. You must do this without using division and in O(n) time complexity. The input array will have at least one element and at most 1000 elements.",io:`3
2
6
1`,starters:{python:`import sys

# Input:
#   3
2
6
1
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
2
6
1
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
2
6
1
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
2
6
1
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
2
6
1
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
2
6
1
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1,2,3,4]
`,expect:`24
12
8
6
`},{stdin:`[5,1,2]
`,expect:`2
10
5
`},{stdin:`[0,1,2,3]
`,expect:`6
0
0
0
`}],hidden:[{stdin:`[1,0,3,4]
`,expect:`0
12
0
0
`},{stdin:`[2,2,2,2,2]
`,expect:`16
16
16
16
16
`}],hint:"Consider using two passes to calculate products from both sides of the array.",reference:`function solve(lines) {
  const out = [];
  const nums = JSON.parse(lines[0]);
  const length = nums.length;
  const output = new Array(length).fill(1);

  let leftProduct = 1;
  for (let i = 0; i < length; i++) {
    output[i] = leftProduct;
    leftProduct *= nums[i];
  }

  let rightProduct = 1;
  for (let i = length - 1; i >= 0; i--) {
    output[i] *= rightProduct;
    rightProduct *= nums[i];
  }

  output.forEach(value => out.push(value.toString()));
  return out;
}`,pattern:"mixed"}],y1={"basic-calculator-ii":["meta"],"can-place-flowers":["microsoft"],"construct-k-palindrome-strings":["uber"],"dot-product-of-two-sparse-vectors":["meta"],"first-bad-version":["google"],"first-missing-positive":["microsoft"],"flatten-2d-vector":["airbnb"],"generate-parentheses":["apple"],"happy-number":["google"],"intersection-of-two-linked-lists":["airbnb"],"kth-largest-element-in-an-array":["meta","microsoft"],"letter-combinations-of-a-phone-number":["microsoft","uber"],"linked-list-cycle":["spotify"],"longest-palindromic-substring":["microsoft"],"longest-substring-without-repeating-characters":["amazon","apple","microsoft","spotify"],"median-of-two-sorted-arrays":["amazon","apple"],"meeting-rooms-ii":["amazon","google"],"merge-intervals":["amazon","apple","google","meta","uber"],"merge-k-sorted-lists":["amazon","apple","microsoft"],"mini-parser":["airbnb"],"minimum-add-to-make-parentheses-valid":["meta"],"product-of-array-except-self":["apple","uber"]},b1={"basic-calculator-ii":"Strings & stacks","can-place-flowers":"Arrays & hashing","construct-k-palindrome-strings":"Arrays & hashing","dot-product-of-two-sparse-vectors":"Algorithms","first-bad-version":"Search & sorting","first-missing-positive":"Arrays & hashing","flatten-2d-vector":"Algorithms","generate-parentheses":"Search & sorting","happy-number":"Arrays & hashing","intersection-of-two-linked-lists":"Arrays & hashing","kth-largest-element-in-an-array":"Arrays & hashing","letter-combinations-of-a-phone-number":"Search & sorting","linked-list-cycle":"Arrays & hashing","longest-palindromic-substring":"Dynamic programming","longest-substring-without-repeating-characters":"Arrays & hashing","median-of-two-sorted-arrays":"Search & sorting","meeting-rooms-ii":"Arrays & hashing","merge-intervals":"Arrays & hashing","merge-k-sorted-lists":"Dynamic programming","mini-parser":"Strings & stacks","minimum-add-to-make-parentheses-valid":"Strings & stacks","product-of-array-except-self":"Algorithms"},iq=[{id:"python",label:"Python",compiler:"cpython-3.11.10",offline:!1},{id:"javascript",label:"JavaScript",compiler:"nodejs-18.20.4",offline:!0},{id:"typescript",label:"TypeScript",compiler:"typescript-5.6.2",offline:!1,prelude:`declare const require: (m: string) => any;
declare const process: any;
`},{id:"cpp",label:"C++",compiler:"gcc-13.2.0",offline:!1},{id:"java",label:"Java",compiler:"openjdk-jdk-21+35",offline:!1},{id:"go",label:"Go",compiler:"go-1.23.2",offline:!1}],sq=n=>Ta.find(i=>i.id===n),v1=[{kind:"cli",id:"two-sum",title:"Two Sum",difficulty:1,prompt:"Given an array of integers and a target, return the 0-based indices of the two numbers that add up to the target. Each input has exactly one solution and you may not use the same element twice.",io:"Line 1: n (array length) · Line 2: n space-separated integers · Line 3: target. Output: the two indices separated by a space.",starters:{python:Fe('Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"'),javascript:Ve('Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"'),typescript:Je('Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"'),cpp:We('Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"'),java:$e('Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"'),go:Xe('Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"')},tests:[{stdin:`4
2 7 11 15
9
`,expect:"0 1"},{stdin:`3
3 2 4
6
`,expect:"1 2"},{stdin:`2
3 3
6
`,expect:"0 1"},{stdin:`5
1 5 3 9 2
11
`,expect:"3 4"}],hidden:[{stdin:`6
-3 4 3 90 0 7
94
`,expect:"1 3"},{stdin:`7
1 2 3 4 5 6 7
13
`,expect:"5 6"},{stdin:`10
0 4 3 0 8 6 9 2 1 5
0
`,expect:"0 3"}],hint:"Hash the numbers you've seen; for each value check whether the complement target - x is already stored.",reference:`function solve(lines) {
  const n = Number(lines[0]);
  const arr = lines[1].split(" ").map(Number);
  const target = Number(lines[2]);
  const idx = new Map();
  for (let i = 0; i < n; i++) {
    const need = target - arr[i];
    if (idx.has(need)) return [idx.get(need) + " " + i];
    idx.set(arr[i], i);
  }
  return [];
}`},{kind:"cli",id:"valid-parens",title:"Valid Parentheses",difficulty:2,prompt:"Given a string containing just the characters ( ) { } [ ], determine if the brackets are balanced and correctly nested.",io:"Single line: the bracket string. Output true if valid, otherwise false.",starters:{python:Fe("Single line: bracket string → output true or false"),javascript:Ve("Single line: bracket string → output true or false"),typescript:Je("Single line: bracket string → output true or false"),cpp:We("Single line: bracket string → output true or false"),java:$e("Single line: bracket string → output true or false"),go:Xe("Single line: bracket string → output true or false")},tests:[{stdin:"()[]{}",expect:"true"},{stdin:"([{}])",expect:"true"},{stdin:"(]",expect:"false"},{stdin:"([)]",expect:"false"},{stdin:"{[]}",expect:"true"},{stdin:"",expect:"true"}],hidden:[{stdin:"((()))",expect:"true"},{stdin:"({[}])",expect:"false"},{stdin:"([{}()])",expect:"true"},{stdin:")(",expect:"false"}],hint:"Push openers onto a stack; a closer must match the top, and the stack must be empty at the end.",reference:`function solve(lines) {
  const s = lines[0] || "";
  const stack = [];
  const match = { ")": "(", "]": "[", "}": "{" };
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (stack.pop() !== match[ch]) return ["false"];
  }
  return [String(stack.length === 0)];
}`},{kind:"cli",id:"max-subarray",title:"Maximum Subarray",difficulty:2,prompt:"Given an integer array, find the contiguous subarray with the largest sum (Kadane's algorithm) and output that sum.",io:"Line 1: n (array length) · Line 2: n space-separated integers (may be negative). Output: the maximum subarray sum.",starters:{python:Fe("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),javascript:Ve("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),typescript:Je("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),cpp:We("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),java:$e("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),go:Xe("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum")},tests:[{stdin:`9
-2 1 -3 4 -1 2 1 -5 4
`,expect:"6"},{stdin:`1
-1
`,expect:"-1"},{stdin:`5
5 4 -1 7 8
`,expect:"23"},{stdin:`4
-2 -3 -1 -5
`,expect:"-1"}],hidden:[{stdin:`8
-1 2 -1 3 -2 4 -1 2
`,expect:"7"},{stdin:`2
-2 -1
`,expect:"-1"},{stdin:`11
8 -19 5 -4 20 2 -9 3 7 -1 4
`,expect:"27"}],hint:"Kadane: keep the best sum ending here (max of current or current + previous best) and track the all-time max.",reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let best = -Infinity, cur = -Infinity;
  for (const x of arr) { cur = Math.max(x, cur + x); best = Math.max(best, cur); }
  return [String(best)];
}`},{kind:"cli",id:"binary-search",title:"Binary Search",difficulty:1,prompt:"Given a sorted array and a target, return the index of the target, or -1 if it's not present.",io:"Line 1: n (array length) · Line 2: n sorted space-separated integers · Line 3: target. Output: the target's index or -1.",starters:{python:Fe("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),javascript:Ve("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),typescript:Je("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),cpp:We("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),java:$e("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),go:Xe("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1")},tests:[{stdin:`6
-1 0 3 5 9 12
9
`,expect:"4"},{stdin:`6
-1 0 3 5 9 12
2
`,expect:"-1"},{stdin:`1
7
7
`,expect:"0"},{stdin:`5
1 2 3 4 5
6
`,expect:"-1"}],hint:"Halve the search space each step: compare the middle element with the target and recurse into one side.",reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const target = Number(lines[2]);
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return [String(mid)];
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return ["-1"];
}`},{kind:"cli",id:"buy-sell",title:"Best Time to Buy and Sell Stock",difficulty:2,prompt:"Given an array of daily prices, choose one day to buy and a later day to sell, maximizing profit. Output the max profit (0 if no profit is possible).",io:"Line 1: n (number of days) · Line 2: n space-separated prices. Output: the maximum profit.",starters:{python:Fe("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),javascript:Ve("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),typescript:Je("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),cpp:We("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),java:$e("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),go:Xe("Line 1: n · Line 2: n prices → output the max profit (0 if none)")},tests:[{stdin:`6
7 1 5 3 6 4
`,expect:"5"},{stdin:`5
7 6 4 3 1
`,expect:"0"},{stdin:`2
1 2
`,expect:"1"},{stdin:`7
3 2 6 5 0 3 9
`,expect:"9"}],hidden:[{stdin:`5
6 4 3 1 7
`,expect:"6"},{stdin:`8
1 8 2 7 3 6 4 5
`,expect:"7"},{stdin:`3
5 5 5
`,expect:"0"}],hint:"Track the cheapest price seen so far; profit = price - min(price) and keep the max.",reference:`function solve(lines) {
  const prices = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let min = Infinity, best = 0;
  for (const p of prices) { min = Math.min(min, p); best = Math.max(best, p - min); }
  return [String(best)];
}`},{kind:"cli",id:"fizzbuzz",title:"FizzBuzz",difficulty:1,prompt:"Print the numbers from 1 to n, but for multiples of 3 print Fizz, for multiples of 5 print Buzz, and for multiples of both print FizzBuzz. A great warm-up to confirm the runner works in any language.",io:"Single line: n. Output: n lines — 1..n with the Fizz/Buzz substitutions.",starters:{python:Fe("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),javascript:Ve("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),typescript:Je("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),cpp:We("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),java:$e("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),go:Xe("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both")},tests:[{stdin:`15
`,expect:`1
2
Fizz
4
Buzz
Fizz
7
8
Fizz
Buzz
11
Fizz
13
14
FizzBuzz`},{stdin:`5
`,expect:`1
2
Fizz
4
Buzz`},{stdin:`1
`,expect:"1"}],hint:"For each i from 1 to n: print FizzBuzz if divisible by 15, Fizz if by 3, Buzz if by 5, else the number.",reference:`function solve(lines) {
  const n = Number(lines[0] || 0);
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push(i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : String(i));
  }
  return out;
}`}],Ta=[...v1,...p1,...g1,...d1,...h1,...f1,...m1],w1="modulepreload",k1=function(n,i){return new URL(n,i).href},Fg={},ze=function(i,r,o){let u=Promise.resolve();if(r&&r.length>0){let p=function(x){return Promise.all(x.map(k=>Promise.resolve(k).then(L=>({status:"fulfilled",value:L}),L=>({status:"rejected",reason:L}))))};const f=document.getElementsByTagName("link"),m=document.querySelector("meta[property=csp-nonce]"),y=(m==null?void 0:m.nonce)||(m==null?void 0:m.getAttribute("nonce"));u=p(r.map(x=>{if(x=k1(x,o),x in Fg)return;Fg[x]=!0;const k=x.endsWith(".css"),L=k?'[rel="stylesheet"]':"";if(!!o)for(let T=f.length-1;T>=0;T--){const G=f[T];if(G.href===x&&(!k||G.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${x}"]${L}`))return;const _=document.createElement("link");if(_.rel=k?"stylesheet":w1,k||(_.as="script"),_.crossOrigin="",_.href=x,y&&_.setAttribute("nonce",y),document.head.appendChild(_),k)return new Promise((T,G)=>{_.addEventListener("load",T),_.addEventListener("error",()=>G(new Error(`Unable to preload CSS for ${x}`)))})}))}function d(p){const f=new Event("vite:preloadError",{cancelable:!0});if(f.payload=p,window.dispatchEvent(f),!f.defaultPrevented)throw p}return u.then(p=>{for(const f of p||[])f.status==="rejected"&&d(f.reason);return i().catch(d)})},Td={[H.sessions]:"merge",[H.drillSrs]:"merge",[H.applyTrack]:"merge",[H.onboard]:"lww",[H.settings]:"lww",[H.tier]:"lww",[H.licenseKey]:"lww",[H.usage]:"local",[H.apiKey]:"local",[H.apiBase]:"local",[H.apiModel]:"local",[H.notifPrefs]:"local",[H.notifLast]:"local",[H.syncMeta]:"local"};function id(n){return Td[n]??"local"}const cb=H.syncMeta;function nl(){return ne(cb,{})}function Vg(n,i){const r=nl();r[n]=Math.max(r[n]??0,i),oe(cb,r)}function x1(n,i){const r=Array.isArray(n)?n:[],o=Array.isArray(i)?i:[],u=new Map;for(const d of[...o,...r])d&&typeof d.id=="string"&&u.set(d.id,d);return[...u.values()].sort((d,p)=>p.date-d.date).slice(0,30)}function S1(n,i){const r=n&&typeof n=="object"?n:{},o=i&&typeof i=="object"?i:{},u={...r};for(const[d,p]of Object.entries(o)){const f=u[d];(!f||p.due>f.due)&&(u[d]=p)}return u}function T1(n,i){const r=n&&typeof n=="object"?n:{},o=i&&typeof i=="object"?i:{},u={...r};for(const[d,p]of Object.entries(o)){const f=u[d];(!f||(p.updatedAt??0)>(f.updatedAt??0))&&(u[d]=p)}return u}function Jg(n,i,r){return n===H.sessions?x1(i,r):n===H.drillSrs?S1(i,r):n===H.applyTrack?T1(i,r):r}class A1{constructor(i=Date.now){en(this,"remote",null);en(this,"unsub",null);en(this,"dirty",new Set);en(this,"removed",new Set);en(this,"flushTimer",null);en(this,"pullTimer",null);en(this,"visCleanup",null);en(this,"applyingRemote",!1);this.now=i}get signedIn(){return this.remote!==null}async signIn(i){await this.signOut(),this.remote=i,this.unsub=$k(u=>this.onLocalChange(u));const r=await i.pull(),o={};for(const[u,d]of Object.entries(Td)){if(d==="local")continue;const p=ne(u,void 0),f=nl()[u]??0,m=r[u];if(m===void 0){p!==void 0&&(o[u]={value:p,updatedAt:Math.max(f,1)});continue}if(p===void 0){this.applyRemote(u,m.value,m.updatedAt);continue}if(d==="merge"){const y=Jg(u,p,m.value);JSON.stringify(y)!==JSON.stringify(p)&&this.applyRemote(u,y,m.updatedAt),JSON.stringify(y)!==JSON.stringify(m.value)&&(o[u]={value:y,updatedAt:Math.max(f,m.updatedAt,1)})}else f>=m.updatedAt?o[u]={value:p,updatedAt:Math.max(f,1)}:this.applyRemote(u,m.value,m.updatedAt)}Object.keys(o).length&&await i.push(o)}async signOut(){var i;await this.flush().catch(()=>{}),this.stopAutoSync(),(i=this.unsub)==null||i.call(this),this.unsub=null,this.remote=null,this.dirty.clear(),this.removed.clear(),this.flushTimer&&(clearTimeout(this.flushTimer),this.flushTimer=null)}startAutoSync(i=3e4){this.stopAutoSync(),this.pullTimer=setInterval(()=>{this.pull().catch(()=>{})},i);const r=()=>{document.visibilityState==="visible"&&this.pull().catch(()=>{})};document.addEventListener("visibilitychange",r),this.visCleanup=()=>document.removeEventListener("visibilitychange",r)}stopAutoSync(){var i;this.pullTimer&&(clearInterval(this.pullTimer),this.pullTimer=null),(i=this.visCleanup)==null||i.call(this),this.visCleanup=null}async pull(){if(!this.remote)return;const i=await this.remote.pull(),r={};for(const[o,u]of Object.entries(Td)){if(u==="local")continue;const d=i[o];if(d===void 0)continue;const p=ne(o,void 0);if(p===void 0){this.applyRemote(o,d.value,d.updatedAt);continue}if(u==="merge"){const f=Jg(o,p,d.value);JSON.stringify(f)!==JSON.stringify(p)&&this.applyRemote(o,f,d.updatedAt),JSON.stringify(f)!==JSON.stringify(d.value)&&(r[o]={value:f,updatedAt:this.now()})}else(nl()[o]??0)<d.updatedAt&&this.applyRemote(o,d.value,d.updatedAt)}Object.keys(r).length&&await this.remote.push(r)}async flush(){if(this.remote){if(this.dirty.size){const i={};for(const r of this.dirty){if(id(r)==="local")continue;const o=ne(r,void 0);o!==void 0&&(i[r]={value:o,updatedAt:nl()[r]??this.now()})}this.dirty.clear(),Object.keys(i).length&&await this.remote.push(i)}if(this.removed.size){const i=[...this.removed].filter(r=>id(r)!=="local");this.removed.clear(),i.length&&await this.remote.remove(i)}}}scheduleFlush(){this.flushTimer&&clearTimeout(this.flushTimer),this.flushTimer=setTimeout(()=>{this.flushTimer=null,this.flush().catch(()=>{})},800)}onLocalChange(i){if(!this.remote||this.applyingRemote||id(i)==="local")return;const r=ne(i,void 0);Vg(i,this.now()),r===void 0?this.removed.add(i):this.dirty.add(i),this.scheduleFlush()}applyRemote(i,r,o=0){this.applyingRemote=!0;try{oe(i,r)}finally{this.applyingRemote=!1}Vg(i,o)}}const Ad=new Set;let $a={configured:!1,user:null,syncing:!1,error:null,oauth:[]};function pt(n){$a={...$a,...n};for(const i of Ad)try{i($a)}catch{}}function At(){return $a}function fr(n){return Ad.add(n),n($a),()=>{Ad.delete(n)}}let Xa=null,Nt=null;function q1(){return!0}async function ub(){if(!Xa){const{createClient:n}=await ze(async()=>{const{createClient:i}=await import("./index-opgBhxp3.js");return{createClient:i}},[],import.meta.url);Xa=Promise.resolve(n(mt.supabase.url,mt.supabase.anonKey,{auth:{persistSession:!0}}))}return Xa}async function ln(){return Xa?($a.configured||pt({configured:!0}),Xa):($a.configured||pt({configured:!0}),ub())}function ie(){return ln()}async function Zd(n){var d,p;const i=await ie(),r=await(i==null?void 0:i.auth.getSession().catch(()=>null)),o=(p=(d=r==null?void 0:r.data)==null?void 0:d.session)==null?void 0:p.access_token,u={"Content-Type":"application/json",apikey:mt.supabase.anonKey};return o&&(u.Authorization=`Bearer ${o}`),u}async function wr(n){if(Nt||(Nt=new A1),!Nt.signedIn){pt({syncing:!0,error:null});try{await Nt.signIn(new mb(n)),Nt.startAutoSync()}finally{pt({syncing:!1})}}}async function db(){Nt!=null&&Nt.signedIn&&await Nt.signOut()}async function pb(){var r;pt({configured:!0});const n=await ub(),{data:i}=await n.auth.getSession();(r=i.session)!=null&&r.user&&(pt({user:i.session.user}),await wr(n).catch(o=>pt({error:o.message}))),n.auth.onAuthStateChange((o,u)=>{const d=(u==null?void 0:u.user)??null;pt({user:d}),d?wr(n).catch(p=>pt({error:p.message})):db()})}async function E1(n,i){const r=await ln();if(!r)return{ok:!1,error:"Cloud sync isn't configured — add your Supabase URL and anon key in src/config.ts."};try{const{data:o,error:u}=await r.auth.signInWithPassword({email:n,password:i});return u?{ok:!1,error:u.message}:o.user&&!o.session?{ok:!0,mfaRequired:!0}:(await wr(r),{ok:!0})}catch(o){return{ok:!1,error:o.message}}}async function C1(){const n=await ln();if(!n)return{ok:!1,factors:[],error:"Cloud sync isn't configured"};try{const{data:i,error:r}=await n.auth.mfa.listFactors();return r?{ok:!1,factors:[],error:r.message}:{ok:!0,factors:((i==null?void 0:i.totp)??[]).map(o=>({id:o.id,status:o.status}))}}catch(i){return{ok:!1,factors:[],error:i.message}}}async function L1(){const n=await ln();if(!n)return{ok:!1,error:"Cloud sync isn't configured"};try{const{data:i,error:r}=await n.auth.mfa.enroll({factorType:"totp"});return r||!i?{ok:!1,error:(r==null?void 0:r.message)??"enroll failed"}:{ok:!0,totp:{id:i.id,qrCode:i.totp.qr_code,secret:i.totp.secret}}}catch(i){return{ok:!1,error:i.message}}}async function D1(n,i){var o,u;const r=await ln();if(!r)return{ok:!1,error:"Cloud sync isn't configured"};try{let d=i==null?void 0:i.trim();if(!d){const{data:f,error:m}=await r.auth.mfa.listFactors();if(m)return{ok:!1,error:m.message};const y=(f==null?void 0:f.totp)??[];if(d=((o=y.find(x=>x.status==="verified"))==null?void 0:o.id)??((u=y[0])==null?void 0:u.id),!d)return{ok:!1,error:"no TOTP factor found — set one up first"}}const{error:p}=await r.auth.mfa.challengeAndVerify({factorId:d,code:(n??"").trim()});return p?{ok:!1,error:p.message}:(await wr(r).catch(f=>pt({error:f.message})),{ok:!0})}catch(d){return{ok:!1,error:d.message}}}async function O1(n){const i=await ln();if(!i)return{ok:!1,error:"Cloud sync isn't configured"};try{const{error:r}=await i.auth.mfa.unenroll({factorId:n});return r?{ok:!1,error:r.message}:{ok:!0}}catch(r){return{ok:!1,error:r.message}}}async function z1(n,i){try{const r=await fetch(`${mt.supabase.url}/functions/v1/mfa-recovery`,{method:"POST",headers:await Zd(),body:JSON.stringify({email:n,code:i})}),o=await r.json().catch(()=>({}));return!r.ok||!o.ok?{ok:!1,error:o.error??`recovery failed (${r.status})`}:{ok:!0}}catch(r){return{ok:!1,error:r.message}}}async function j1(n){const i=await ln();if(!i)return{ok:!1,error:"Cloud sync isn't configured"};try{const{error:r}=await i.rpc("save_recovery_codes",{p_hashes:n});return r?{ok:!1,error:r.message}:{ok:!0}}catch(r){return{ok:!1,error:r.message}}}async function M1(){var i,r;const n=await ln();if(!n)return{ok:!1,unused:0,total:0,error:"Cloud sync isn't configured"};try{const[o,u]=await Promise.all([n.from("recovery_codes").select("id",{count:"exact",head:!0}).is("used_at",null).is("revoked_at",null),n.from("recovery_codes").select("id",{count:"exact",head:!0})]),d=((i=o.error)==null?void 0:i.message)??((r=u.error)==null?void 0:r.message);return d?{ok:!1,unused:0,total:0,error:d}:{ok:!0,unused:o.count??0,total:u.count??0}}catch(o){return{ok:!1,unused:0,total:0,error:o.message}}}async function R1(n){try{const i=await fetch(`${mt.supabase.url}/functions/v1/recovery-backup`,{method:"POST",headers:await Zd(),body:JSON.stringify({codes:n})}),r=await i.json().catch(()=>({}));return!i.ok||!r.ok?{ok:!1,error:r.error??`backup failed (${i.status})`}:{ok:!0}}catch(i){return{ok:!1,error:i.message}}}async function _1(n,i){var o;const r=await ln();if(!r)return{ok:!1,error:"Cloud sync isn't configured — add your Supabase URL and anon key in src/config.ts."};try{const{data:u,error:d}=await r.auth.signUp({email:n,password:i});return d?{ok:!1,error:d.message}:(o=u.session)!=null&&o.user?(await wr(r),{ok:!0}):{ok:!0,needsConfirmation:!0}}catch(u){return{ok:!1,error:u.message}}}function hb(n){const i=[];return n!=null&&n.google&&i.push("google"),n!=null&&n.github&&i.push("github"),i}async function N1(){const n=await ln();if(!n)return pt({oauth:[]}),[];try{const i=n,r=i.supabaseUrl??mt.supabase.url,o=i.supabaseKey??mt.supabase.anonKey,d=await(await fetch(`${r}/auth/v1/settings`,{headers:{apikey:o}})).json(),p=hb(d==null?void 0:d.external);return pt({oauth:p}),p}catch{return pt({oauth:[]}),[]}}async function I1(n){const i=await ln();if(!i)return{ok:!1,error:"Cloud sync isn't configured — add your Supabase URL and anon key in src/config.ts."};try{const r=window.location.origin+window.location.pathname,{error:o}=await i.auth.signInWithOAuth({provider:n,options:{redirectTo:r}});return o?{ok:!1,error:o.message}:{ok:!0}}catch(r){return{ok:!1,error:r.message}}}async function fb(){try{Xa&&await(await Xa).auth.signOut()}finally{await db(),pt({user:null,error:null})}}async function B1(){if(Nt!=null&&Nt.signedIn){pt({syncing:!0});try{await Nt.pull()}finally{pt({syncing:!1})}}}class mb{constructor(i){en(this,"uid",null);this.client=i}async userId(){if(this.uid)return this.uid;const{data:i,error:r}=await this.client.auth.getUser();if(r||!i.user)throw new Error("Not signed in");return this.uid=i.user.id,this.uid}async pull(){const i=await this.userId(),{data:r,error:o}=await this.client.from("user_sync").select("key, value, updated_at").eq("user_id",i);if(o)throw new Error(o.message);const u={};for(const d of r??[])u[d.key]={value:d.value,updatedAt:d.updated_at};return u}async push(i){const r=await this.userId(),o=Object.entries(i).map(([d,p])=>({user_id:r,key:d,value:p.value,updated_at:p.updatedAt}));if(!o.length)return;const{error:u}=await this.client.from("user_sync").upsert(o,{onConflict:"user_id,key"});if(u)throw new Error(u.message)}async remove(i){if(!i.length)return;const r=await this.userId(),{error:o}=await this.client.from("user_sync").delete().eq("user_id",r).in("key",i);if(o)throw new Error(o.message)}}async function U1(){const n=await ie();if(!n)return{ok:!1,error:"Cloud sync isn't configured"};try{const{data:i,error:r}=await n.rpc("download_my_data");return r?{ok:!1,error:r.message}:{ok:!0,data:i}}catch(i){return{ok:!1,error:i.message}}}async function H1(){const n=await ie();if(!n)return{ok:!1,error:"Cloud sync isn't configured"};try{const{error:i}=await n.rpc("delete_my_account");return i?{ok:!1,error:i.message}:(await fb(),{ok:!0})}catch(i){return{ok:!1,error:i.message}}}const rq=Object.freeze(Object.defineProperty({__proto__:null,SupabaseRemoteStore:mb,cloudDeleteMyAccount:H1,cloudDownloadMyData:U1,cloudEmailRecoveryBackup:R1,cloudFnHeaders:Zd,cloudMfaEnroll:L1,cloudMfaFactors:C1,cloudMfaRecover:z1,cloudMfaUnenroll:O1,cloudMfaVerify:D1,cloudOAuthSignIn:I1,cloudRecoveryStatus:M1,cloudSaveRecoveryCodes:j1,cloudSignIn:E1,cloudSignOut:fb,cloudSignUp:_1,cloudSyncNow:B1,getCloudState:At,getSupabaseClient:ie,initCloud:pb,isCloudConfigured:q1,oauthProvidersFromSettings:hb,refreshOAuthProviders:N1,subscribeCloud:fr},Symbol.toStringTag,{value:"Module"}));function gb(){return ne(H.eventOutbox,[])}function yb(n){oe(H.eventOutbox,n)}function sn(n,i={}){const r=[...gb(),{kind:n,meta:i,ts:Date.now()}].slice(-50);yb(r),bb().catch(()=>{})}async function bb(){var p;const n=gb();if(!n.length)return;const i=await ie();if(!i)return;const{data:r}=await i.auth.getUser(),o=(p=r==null?void 0:r.user)==null?void 0:p.id;if(!o)return;const u=n.map(f=>({user_id:o,kind:f.kind,meta:f.meta,created_at:new Date(f.ts).toISOString()})),{error:d}=await i.from("usage_events").insert(u);d||yb([])}function P1(){return ne(H.profileStats,{sessions:0,aiCalls:0})}function G1(n){oe(H.profileStats,n)}function Y1(){const n=P1();G1({...n,sessions:n.sessions+1}),vb({sessions_count:n.sessions+1}).catch(()=>{})}async function vb(n={}){const i=await ie();if(!i)return;const{data:r}=await i.auth.getUser(),o=r==null?void 0:r.user;if(!o)return;const u={id:o.id,email:o.email??"",last_seen:new Date().toISOString(),tier:os(),...n};await i.from("profiles").upsert(u,{onConflict:"id"})}function ls(){return ne(H.codingTrack,{})}function oq(n,i){const r=ls(),o=r[n]??{fails:0,solved:!1};r[n]=i?{...o,solved:!0}:{fails:o.fails+1,solved:o.solved},oe(H.codingTrack,r),sn("coding_attempt",{problemId:n,passed:i})}function Q1(n=Ta){var o;const i=ls(),r=[];for(const u of n){const d=i[u.id];if(!d||d.solved||d.fails<2)continue;const p=(o=u.hint)==null?void 0:o.trim();if(r.push({q:`Code: ${u.title}`,a:p&&p.length>0?p:u.kind==="fn"?`Implement ${u.fn.name}(${u.fn.args}) → ${u.fn.returns}.`:u.prompt,kp:[K1(u),"Practice in the playground — tests are hidden, so verify edge cases yourself."],lvl:u.difficulty===1?"junior":u.difficulty===2?"mid":"senior",codeId:u.id}),r.length>=6)break}return r}const K1=n=>n.kind==="cli"?"Algorithms":n.kind==="fn"?"JS functions":"UI components",ep="iq.drillSrs",F1=6e4,or=864e5,V1=[F1,or,3*or,7*or,14*or,30*or],qd=3;function tp(){return ne(ep,{})}function lq(n,i,r=Date.now()){var p;const o=tp(),u=((p=o[n])==null?void 0:p.lvl)??0,d=i==="again"?0:i==="hard"?Math.min(qd+1,u+1):i==="good"?Math.min(qd+2,u+1):Math.min(5,u+2);o[n]={due:r+V1[d],lvl:d},oe(ep,o)}function sd(n,i,r=Date.now()){return!i[n]||i[n].due<=r}function cq(n){return Object.values(n).filter(i=>i.lvl>=qd).length}function uq(){oe(ep,{})}function dq(n,i,r=10){const o=tp(),u=Date.now(),{items:d}=kd(n,""),p=new Set(d.map(O=>O.q)),f=lb().filter(O=>!p.has(O.q)).map(O=>({...O,lvl:i==="all"?"mid":i})),m=Q1().filter(O=>!p.has(O.q)).map(O=>({...O,lvl:i==="all"?O.lvl:i})),y=[...d.filter(O=>(i==="all"||O.lvl===i)&&sd(O.q,o,u)),...f.filter(O=>(i==="all"||O.lvl===i)&&sd(O.q,o,u)),...m.filter(O=>(i==="all"||O.lvl===i)&&sd(O.q,o,u))],x=y.filter(O=>o[O.q]).sort((O,_)=>o[O.q].due-o[_.q].due),k=fl(y.filter(O=>!o[O.q])),L=[...x,...k];return L.slice(0,Math.min(r,L.length)).map(O=>({q:O.q,a:O.a,kp:O.kp,lvl:O.lvl,...O.codeId?{codeId:O.codeId}:{}}))}function pq(n,i,r=6){const o=[...new Set(on(n).filter(m=>m.length>2))].slice(0,12);if(!o.length)return[];const u=new Set,d=[],p=m=>{d.length>=r||u.has(m.q)||(u.add(m.q),d.push({q:m.q,a:m.a,kp:m.kp??[],lvl:m.lvl}))},f=kd(i,"");for(const m of bd(f.items,o,r))p(m);if(d.length<r)for(const m of ni){if(m.id===i||d.length>=r)continue;const{items:y}=kd(m.id,"");for(const x of bd(y,o,r))p(x)}return d}const rd=864e5,al=n=>{const i=new Date(n);return`${i.getFullYear()}-${String(i.getMonth()+1).padStart(2,"0")}-${String(i.getDate()).padStart(2,"0")}`};function np(n,i=new Date){const r=new Set(n.map(y=>al(y.date))),o=new Date(i.getFullYear(),i.getMonth(),i.getDate());let u=0;for(r.has(al(o.getTime()))||o.setTime(o.getTime()-rd);r.has(al(o.getTime()));)u++,o.setTime(o.getTime()-rd);const d=[...r].map(y=>J1(y)).sort((y,x)=>y-x);let p=0,f=0,m=-1/0;for(const y of d)f=y===m+rd?f+1:1,p=Math.max(p,f),m=y;return{current:u,longest:p}}function J1(n){return new Date(n+"T00:00:00").getTime()}function hq(n,i=12){return n.slice(-i).map(r=>({date:al(r.date),pct:r.agg.pct}))}function fq(n){const i=new Map;for(const r of n)for(const o of r.answers){const u=i.get(o.q.catLabel)??{sum:0,n:0};u.sum+=o.pct,u.n++,i.set(o.q.catLabel,u)}return[...i.entries()].map(([r,o])=>({label:r,pct:o.sum/o.n})).sort((r,o)=>o.pct-r.pct)}function mq(n=Date.now()){return Object.values(tp()).filter(i=>i.due<=n).length}function gq(n){return n.length?n.reduce((i,r)=>i+r.agg.score,0)/n.length:0}const W1={enabled:!1,time:"19:00",weekly:!1,digestDay:null};function ap(){return typeof window<"u"&&"Notification"in window}function wb(){return ap()?Notification.permission:"denied"}async function yq(){if(!ap())return"denied";try{return await Notification.requestPermission()}catch{return"denied"}}function ol(){return{...W1,...ne(H.notifPrefs,{})}}function bq(n){oe(H.notifPrefs,n)}const ll=n=>{const i=new Date(n);return`${i.getFullYear()}-${String(i.getMonth()+1).padStart(2,"0")}-${String(i.getDate()).padStart(2,"0")}`};function $1(n,i=new Date){const r=ll(i.getTime());return n.some(o=>ll(o.date)===r)}async function wl(n,i){if(!ap()||Notification.permission!=="granted")return!1;const r={body:i,icon:"./icons/icon-192.png",badge:"./icons/icon-192.png",tag:"interviewiq",data:{url:"./"}};try{if("serviceWorker"in navigator)return await(await navigator.serviceWorker.ready).showNotification(n,r),!0}catch{}try{return new Notification(n,r),!0}catch{return!1}}function X1(n){const i=n.now??new Date;if(!ol().enabled)return{fired:!1,reason:"disabled"};const r=n.permission??wb();if(r!=="granted")return{fired:!1,reason:"permission:"+r};if($1(n.sessions,i))return{fired:!1,reason:"practiced"};const[o,u]=ol().time.split(":").map(Number),d=new Date(i);if(d.setHours(o,u,0,0),i.getTime()<d.getTime())return{fired:!1,reason:"too-early"};const p=ll(i.getTime());if(ne(H.notifLast,"")===p)return{fired:!1,reason:"already-notified"};oe(H.notifLast,p);const f=np(n.sessions,i).current;return wl("🗓️ Daily reminder",f>0?`You haven't practiced today — your ${f}-day streak is on the line. One session keeps it alive.`:"You haven't practiced today. A quick session keeps the momentum going."),{fired:!0,reason:"fired"}}function Z1(n=new Date){const i=new Date(Date.UTC(n.getFullYear(),n.getMonth(),n.getDate())),r=(i.getUTCDay()+6)%7;i.setUTCDate(i.getUTCDate()-r+3);const o=Math.ceil(((i.getTime()-Date.UTC(i.getUTCFullYear(),0,1))/864e5+1)/7);return`${i.getUTCFullYear()}-w${o}`}function eS(n,i=new Date){const r=i.getTime()-6048e5;return n.filter(o=>o.date>=r)}function tS(n){const i=n.now??new Date,r=eS(n.sessions,i),o=np(n.sessions,i).current;let u="";const d=Qd(),p=rs();if(d&&p)try{const y=Yx(ob(d,p,n.sessions),Kd()),x=y.weeks.flatMap(_=>_.topics),k=x.filter(_=>_.done).length,L=x.filter(_=>_.priority==="P0"&&!_.done).length,O=y.weeks.find(_=>_.status==="current")??y.weeks[0];if(O){const _=O.topics.slice(0,3).map(T=>T.label).join(", ");u=` · ${k}/${x.length} roadmap topics done, ${L} P0 left — this week: ${_}.`}}catch{}if(r.length===0)return{title:"📊 Weekly digest",body:`No sessions this week — your ${Dx.sessionsPerMonth}-session monthly budget is still waiting. A fresh week is a fresh start.${u}`};const f=Math.round(r.reduce((y,x)=>y+x.agg.pct,0)/r.length),m=new Set(r.map(y=>ll(y.date))).size;return{title:"📊 Weekly digest",body:`${r.length} session${r.length===1?"":"s"} over ${m} day${m===1?"":"s"} this week · avg ${f}% · ${o>0?`${o}-day streak alive`:"streak reset"}.${u}`}}function nS(n){const i=n.now??new Date;if(!ol().weekly)return{fired:!1,reason:"disabled"};const r=n.permission??wb();if(r!=="granted")return{fired:!1,reason:"permission:"+r};const o=Z1(i);if(ne(H.notifLastWeekly,"")===o)return{fired:!1,reason:"already-notified"};const u=ol().digestDay??null;if(u!=null&&i.getDay()!==u)return{fired:!1,reason:"not-digest-day"};const d=tS({sessions:n.sessions,now:i});return d?(oe(H.notifLastWeekly,o),wl(d.title,d.body),{fired:!0,reason:"fired"}):{fired:!1,reason:"no-data"}}function aS(n){switch(n){case 2:return"🔥 2-day streak! Two days in a row — keep it rolling.";case 3:return"🔥 3-day streak! You're building a real habit.";case 5:return"🔥 5-day streak! Halfway to a full week.";case 7:return"🏆 7-day streak! A full week of daily practice.";case 14:return"🏆 14-day streak! Two weeks straight — unstoppable.";case 21:return"🏆 21-day streak! Three weeks — the habit is set.";case 30:return"👑 30-day streak! A month of daily practice.";default:return n>30&&n%7===0?`👑 ${n}-day streak! Keep the run alive.`:null}}function iS(n){const i=aS(n);i&&wl("🔥 Streak!",i)}let il=[];function bn(n){il.forEach(i=>i(n))}function sS(){const[n,i]=B.useState([]);return B.useEffect(()=>{const r=o=>{const u=nb();i(d=>[...d,{id:u,msg:o,leaving:!1}]),setTimeout(()=>i(d=>d.map(p=>p.id===u?{...p,leaving:!0}:p)),2600),setTimeout(()=>i(d=>d.filter(p=>p.id!==u)),2950)};return il.push(r),()=>{il=il.filter(o=>o!==r)}},[]),b.jsx("div",{className:"fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2",children:n.map(r=>b.jsx("div",{className:`rounded-xl border border-line/25 bg-panel3 px-5 py-3 text-sm font-semibold text-ink shadow-[0_14px_40px_rgba(0,0,0,.5)] ${r.leaving?"anim-fade opacity-0 transition-opacity duration-300":"anim-pop"}`,children:r.msg},r.id))})}const rS={count:8,mode:"standard",timing:"relaxed",voice:!0},oS=()=>({level:null,field:null,company:null,...ne(H.onboard,{})}),lS=n=>n.level?n.field?n.company?4:3:2:1;function kb(){const n=oS(),i=!!n.level;return{view:i?"onboard":"landing",prevView:i?"onboard":"landing",ob:n,step:lS(n),config:{...rS,...ne(H.settings,{})},session:null,idx:0,answers:[],feedbackShown:!1,viewingHistory:!1,sessions:ne(H.sessions,[])}}function cS(n,i){switch(i.type){case"NAV":return{...n,view:i.view};case"SET_OB":return{...n,ob:{...n.ob,...i.patch},step:i.step};case"SET_STEP":return{...n,step:i.step};case"SET_SESSION":return{...n,prevView:n.view,session:i.session,config:i.config,idx:0,answers:[],feedbackShown:!1,viewingHistory:!1,view:"interview"};case"ADD_ANSWER":return{...n,answers:[...n.answers,i.answer]};case"SET_FEEDBACK_SHOWN":return{...n,feedbackShown:i.v};case"NEXT":{const r=n.idx+1;return!n.session||r>=n.session.questions.length?{...n,view:"results"}:{...n,idx:r,feedbackShown:!1}}case"RESET_SESSION":return{...n,session:null,idx:0,answers:[],feedbackShown:!1,viewingHistory:!1};case"SET_VIEWING_HISTORY":return{...n,viewingHistory:i.v};case"ADD_SESSION":{const r=n.sessions.filter(o=>o.id!==i.s.id);return r.unshift(i.s),{...n,sessions:r.slice(0,30)}}case"DELETE_SESSION":return{...n,sessions:n.sessions.filter(r=>r.id!==i.id)};case"UPDATE_CONFIG":return{...n,config:{...n.config,...i.patch}};case"CLEAR_SESSIONS":return{...n,sessions:[]};case"RESET_ALL":return{...kb(),ob:{level:null,field:null,company:null},step:1};default:return n}}const xb=B.createContext(null);function uS({children:n}){const[i,r]=B.useReducer(cS,void 0,kb);B.useEffect(()=>{oe(H.onboard,i.ob)},[i.ob]),B.useEffect(()=>{oe(H.settings,i.config)},[i.config]),B.useEffect(()=>{oe(H.sessions,i.sessions)},[i.sessions]);const o=B.useMemo(()=>{const u=d=>{const{session:p,idx:f,config:m,sessions:y}=i;if(p&&f+1>=p.questions.length&&d.length){if(m.mode==="diagnostic"){Hg(d,p.meta.fieldId);return}const x=Bg(p.meta,m,d);if(x){r({type:"ADD_SESSION",s:x}),jx(),Y1(),sn("session",{pct:x.agg.pct,level:x.meta.levelId,field:x.meta.fieldId,mode:x.config.mode}),sn("session_answers",{fieldId:x.meta.fieldId,levelId:x.meta.levelId,items:d.slice(0,15).map(L=>({q:L.q.q,score:L.fb.score,missed:L.fb.missed??[]}))}),iS(np([x,...y],new Date).current);const k=Qd();if(k)try{Qx(k,d.map(L=>({q:L.q,user:L.user,score:L.fb.score,pct:L.fb.pct,missed:L.fb.missed})))}catch{}}}};return{state:i,nav:d=>{window.scrollTo({top:0}),r({type:"NAV",view:d})},selectLevel:d=>r({type:"SET_OB",patch:{level:d,jd:void 0},step:2}),selectField:d=>r({type:"SET_OB",patch:{field:d,jd:void 0},step:3}),selectCompany:d=>r({type:"SET_OB",patch:{company:d,jd:void 0},step:4}),setStep:d=>r({type:"SET_STEP",step:d}),applyJd:d=>r({type:"SET_OB",patch:{level:d.levelId,field:d.fieldId,company:d.companyId??"general",jd:d.text},step:4}),startPlannedSession:(d,p,f)=>{const m=f!=null&&f.length?Gd({fieldId:d.field,companyId:d.company,levelId:d.level,keywords:f,count:p.count,mode:p.mode}):Ng(d,p);r({type:"SET_SESSION",session:m,config:p})},startWeakSession:(d,p,f,m)=>{const y=Ig(d,p,f,m);r({type:"SET_SESSION",session:y,config:m})},startSession:d=>{const p=i.ob.jd?fx(kx(i.ob.jd),d):Ng(i.ob,d);r({type:"SET_SESSION",session:p,config:d})},startDiagnostic:(d,p)=>{const f=Ax(d,p);r({type:"SET_SESSION",session:f,config:{...i.config,count:f.questions.length,mode:"diagnostic",timing:"none"}})},practiceWeakTopics:()=>{const{session:d,answers:p,config:f}=i;if(!d)return;const m=[...new Set(p.flatMap(x=>x.fb.missed??[]))].slice(0,12),y=Ig(d.meta.fieldId,d.meta.levelId,m,f);r({type:"SET_SESSION",session:y,config:f})},submitAnswer:d=>{if(!i.session)return;const p=i.session.questions[i.idx],f=_g(d,p);r({type:"ADD_ANSWER",answer:{q:p,user:d,fb:f}}),r({type:"SET_FEEDBACK_SHOWN",v:!0})},skipQuestion:()=>{if(!i.session)return;const d=i.session.questions[i.idx];let p=i.answers;if(!i.feedbackShown){const f=_g("",d),m={q:d,user:"",fb:f};r({type:"ADD_ANSWER",answer:m}),p=[...p,m]}u(p),r({type:"NEXT"})},nextQuestion:()=>{u(i.answers),r({type:"NEXT"})},exitToResults:()=>{const{session:d,answers:p,config:f,prevView:m}=i;if(d&&p.length){if(f.mode==="diagnostic")Hg(p,d.meta.fieldId);else{const y=Bg(d.meta,f,p);y&&(r({type:"ADD_SESSION",s:y}),sn("session_answers",{fieldId:y.meta.fieldId,levelId:y.meta.levelId,items:p.slice(0,15).map(x=>({q:x.q.q,score:x.fb.score,missed:x.fb.missed??[]}))}))}r({type:"NAV",view:"results"})}else bn("No answers recorded — answer at least one question to see results"),r({type:"NAV",view:m})},practice:(d,p)=>{const f=hx(d,p);r({type:"SET_SESSION",session:f,config:{...i.config,count:1,timing:"none"}})},retry:()=>{r({type:"RESET_SESSION"}),r({type:"NAV",view:"interview"})},newSession:()=>{r({type:"RESET_SESSION"}),r({type:"SET_OB",patch:{jd:void 0},step:1}),r({type:"NAV",view:"onboard"})},openHistory:d=>{const p=i.sessions.find(m=>m.id===d);if(!p)return;const f=mx(p);r({type:"SET_SESSION",session:f,config:p.config}),r({type:"SET_VIEWING_HISTORY",v:!0});for(const m of p.answers)r({type:"ADD_ANSWER",answer:{q:m.q,user:m.user,fb:{score:m.score,pct:m.pct,covered:[],missed:m.missed??[],strengths:["Replay of a saved session."],gaps:m.missed??[],words:0}}});r({type:"SET_FEEDBACK_SHOWN",v:!0}),r({type:"NAV",view:"results"})},deleteHistory:d=>r({type:"DELETE_SESSION",id:d}),updateConfig:d=>r({type:"UPDATE_CONFIG",patch:d}),clearHistory:()=>r({type:"CLEAR_SESSIONS"}),resetAll:()=>{Object.values(H).forEach(d=>ns(d)),r({type:"RESET_ALL"})}}},[i]);return b.jsx(xb.Provider,{value:o,children:n})}function dS(){const n=B.useContext(xb);if(!n)throw new Error("useApp must be used within AppProvider");return n}function od(){return ne(H.career,null)}function vq(n){oe(H.career,{...n,updatedAt:Date.now()}),pS(n)}function wq(){var p,f;const n=rs(),i=Qd(),r=[...new Set(((n==null?void 0:n.skills)??[]).filter(m=>(m.measured??m.self)>=2).map(m=>m.skill))].slice(0,30),o=(p=an.find(m=>m.id===(i==null?void 0:i.targetLevel)))==null?void 0:p.name,u=(f=It(i==null?void 0:i.fieldId))==null?void 0:f.name;return{headline:"",years:0,location:"",remote:!0,workAuth:"",targetTitles:o?[u?`${o} ${u}`:o]:u?[u]:[],skills:r,summary:"",updatedAt:Date.now()}}async function kq(){const n=await ie(),i=At().user;if(!n||!i)return null;const{data:r,error:o}=await n.from("career_profiles").select("data").eq("user_id",i.id).maybeSingle();return o||!r?null:r.data}async function pS(n){const i=await ie(),r=At().user;!i||!r||await i.from("career_profiles").upsert({user_id:r.id,data:n,updated_at:new Date().toISOString()},{onConflict:"user_id"})}const hS={frontend:["react","vue","angular","css","typescript","html","ui","ux","javascript","frontend","webpack","accessibility","a11y","responsive","sass","tailwind"],backend:["api","rest","microservice","database","sql","postgres","mongodb","cache","distributed","go","golang","java","spring","node","backend","server","kubernetes","docker"],fullstack:["fullstack","full stack","frontend","backend","react","node","api","database","typescript"],devops:["devops","ci/cd","kubernetes","docker","terraform","ansible","aws","gcp","azure","infrastructure","monitoring","prometheus","grafana","pipeline","deployment"],data:["data science","machine learning","ml","ai","python","tensorflow","pytorch","statistics","analytics","sql","pandas","numpy","data engineering","etl","spark","hadoop"],security:["security","cybersecurity","penetration","threat","vulnerability","auth","oauth","encryption","firewall","compliance","zero trust","siem","incident response"],mobile:["mobile","android","ios","swift","kotlin","react native","flutter","dart","app development","mobile dev"],product:["product management","product strategy","roadmap","stakeholder","user research","a/b testing","metrics","kpi","agile","scrum","backlog","user stories"]},fS=/^(cto|chief technology officer|ceo|chief executive officer|vp of engineering|vice president of engineering|director of engineering)$/i,mS=[[/(?:principal|distinguished|fellow|chief architect)/i,"principal"],[/(?:staff|lead|tech lead|architect)/i,"staff"],[/(?:senior|sr\.?|lead|5\+|6\+|7\+|8\+) (?:years|yr)/i,"senior"],[/(?:senior|sr\.?)/i,"senior"],[/(?:mid.?level|midlevel|2\+|3\+|4\+)/i,"mid"],[/(?:junior|jr\.?|entry.level|graduate|intern|0\+|1\+)/i,"junior"]];function gS(n,i){const r=n.toLowerCase();return i.reduce((o,u)=>o+(r.includes(u.toLowerCase())?1:0),0)}function yS(n,i){const r=ni.find(o=>o.id===i);return r?r.skills.map(o=>{const d=n.toLowerCase().includes(o.toLowerCase().slice(0,8));return{skill:o,self:d?3:1}}):[]}function bS(n){const i=n.split(`
`).map(o=>o.trim()).filter(o=>o.length>5),r=[];for(const o of i)/(?:years|yr|experience|engineer|developer|architect|lead|senior|manager|tech lead)/i.test(o)&&o.length<200&&r.push(o);return r.slice(0,8)}function Sb(n){const i=n.toLowerCase();let r="backend",o=0;for(const[m,y]of Object.entries(hS)){const x=gS(i,y);x>o&&(o=x,r=m)}let u="mid";if(n.split(`
`).map(m=>m.trim()).find(m=>m.length>0&&m.length<50&&fS.test(m)))u="cto";else for(const[m,y]of mS)if(m.test(i)){u=y;break}const p=yS(i,r),f=bS(n);return{fieldId:r,levelId:u,skills:p,snippets:f}}const vS=["GraphQL","REST APIs","gRPC","AWS","GCP","Azure","Docker","Kubernetes","Terraform","Ansible","PostgreSQL","MySQL","MongoDB","Redis","Kafka","Elasticsearch","Golang","Rust","Java","Python","Node.js","Express","Next.js","Vue","Svelte","Tailwind CSS","Sass","CI/CD","Jenkins","GitHub Actions","GitLab CI","Spark","Airflow","Pandas","NumPy","TensorFlow","PyTorch","Kotlin","Swift","Flutter","React Native","Redux","Webpack","Vite","Jest","Cypress","Playwright","Django","Flask","Spring","SQL","NoSQL","Microservices","Serverless","Lambda","Prometheus","Grafana","Bash","Linux","Agile","Scrum","Figma","Storybook"],wS=(()=>{const n=new Set,i=[];for(const r of ni)for(const o of r.skills)n.has(o)||(n.add(o),i.push(o));for(const r of vS)n.has(r)||(n.add(r),i.push(r));return i})();function kS(n){return new Set(n.toLowerCase().replace(/[^a-z0-9+#]/g," ").split(/\s+/).filter(Boolean))}function xS(n,i){return n.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean).some(o=>{if(i.has(o))return!0;if(o.length>3&&o.endsWith("s")){const u=o.slice(0,-1);if(i.has(u))return!0}return!1})}function ip(n){const i=kS(n),r=new Set,o=[];for(const u of wS)if(xS(u,i)){const d=u.toLowerCase().replace(/[^a-z0-9]/g,"");r.has(d)||(r.add(d),o.push(u))}return o.slice(0,35)}function SS(n,i){const r=n.toLowerCase(),o=[...r.matchAll(/(\d{1,2})\s*\+?\s*(?:years|yrs)\b/g)].map(p=>Number(p[1]));if(o.length)return Math.max(...o);const u=r.match(/since\s+(19|20)\d{2}/);return u?Math.max(0,new Date().getFullYear()-Number(u[0].match(/\d{4}/))):{junior:1,mid:3,senior:6,staff:8,principal:12,cto:15,ceo:15}[i]??3}const Za=/(engineer|developer|architect|designer|scientist|analyst|manager|consultant|intern)/i,mr=/(senior|staff|principal|lead|junior|mid|frontend|front end|backend|back end|full.?stack|devops|data|mobile|security|software|product|cto|ceo|sre|qa|ios|android)/i,TS=/^(cto|ceo|coo|founder|co-founder)\b[\s,|]+([a-z][^|]*)$/i;function Tb(n){const i=n.match(TS);if(!i)return n;const r=i[1].trim(),o=i[2].trim();return!Za.test(o)&&!mr.test(o)?n:`${r} / ${(d=>d.replace(/(^|\s)([a-z])/g,(p,f,m)=>f+m.toUpperCase()))(o)}`}function Ab(n){return n.replace(/[|–—-].*$/,"").replace(/\s+at\s+.*$/i,"").replace(/^[•·\-*\d.\s]+/,"").trim()}function sp(n){const i=n.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(.+)$/);if(!i)return n;const r=i[1],o=i[2],u=i[3];return mr.test(r)||mr.test(o)||Za.test(r)||Za.test(o)||!Za.test(u)&&!mr.test(u)?n:u.trim()}function AS(n,i,r){const o=n.filter(u=>Za.test(u)&&mr.test(u)&&u.length<90);for(const u of o){const d=Tb(sp(Ab(u)));if(d.length>3&&Za.test(d))return d}return`${r} ${i}`.trim()}function qS(n){const i=[];for(const r of n){if(!Za.test(r))continue;const o=Tb(sp(Ab(r)));if(!(o.length<4||o.length>60||i.includes(o))&&(i.push(o),i.length>=5))break}return i}function ES(n){return n.split(`
`).map(o=>o.trim()).filter(o=>o.length>20&&!/^[|•\-*]/.test(o)).filter(o=>!/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(o)&&!/^\+?\d[\d\s()-]{7,}$/.test(o)&&!/linkedin\.com/i.test(o)&&sp(o)===o).slice(0,3).join(" ").slice(0,180)}function CS(n,i,r){const o=[],u=new Set(n.map(p=>p.toLowerCase()));for(const p of i)!u.has(p.toLowerCase())&&!o.includes(p)&&o.push(p);const d=ni.find(p=>p.id===r);for(const p of(d==null?void 0:d.skills)??[])if(!(u.has(p.toLowerCase())||o.includes(p))&&(o.push(p),o.length>=8))break;return o.slice(0,10)}function LS(n,i){return n.skills.length>qb(i).skills.length}function qb(n){var y,x;const i=Sb(n),r=((y=ni.find(k=>k.id===i.fieldId))==null?void 0:y.name)??"",o=((x=an.find(k=>k.id===i.levelId))==null?void 0:x.name)??"",u=n.split(`
`).map(k=>k.trim()).filter(Boolean),d=ip(n),p=SS(n,i.levelId),f=AS(u,r,o),m=qS(u);return{headline:f||`${o} ${r}`.trim(),years:p,location:"",remote:!0,workAuth:"",targetTitles:m.length?m:r?[r]:[],skills:d,summary:ES(n),updatedAt:Date.now()}}function Eb(){return ne(H.resume,null)}function DS(n){const i={...n,text:n.text.slice(0,2e4)};oe(H.resume,i),Cb(i)}function OS(){ns(H.resume)}async function zS(){const n=await ie(),i=At().user;if(!n||!i)return null;const{data:r,error:o}=await n.from("uploaded_resumes").select("data").eq("user_id",i.id).maybeSingle();return o||!r?null:r.data}async function Cb(n){const i=await ie(),r=At().user;!i||!r||await i.from("uploaded_resumes").upsert({user_id:r.id,data:n,updated_at:new Date().toISOString()},{onConflict:"user_id"})}const xq=Object.freeze(Object.defineProperty({__proto__:null,analyzeResume:Sb,clearUploadedResume:OS,extractSkillNames:ip,getUploadedResume:Eb,loadUploadedResumeFromCloud:zS,profileHasStaleSkills:LS,resumeToProfile:qb,saveUploadedResume:DS,saveUploadedResumeToCloud:Cb,suggestSkills:CS},Symbol.toStringTag,{value:"Module"})),Lb=n=>n.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&#x27;/gi,"'");function Db(n){return Lb(n.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()).replace(/\s+([.,;:!?)])/g,"$1")}function jS(n){var u,d;const i=new Map,r=/<meta\b[^>]*>/gi;let o;for(;o=r.exec(n);){const p=o[0],f=(((u=p.match(/(?:name|property)=["']([^"']+)["']/i))==null?void 0:u[1])??"").toLowerCase(),m=(d=p.match(/content=["']([^"']*)["']/i))==null?void 0:d[1];f&&m!=null&&!i.has(f)&&i.set(f,Lb(m))}return i}function MS(n){var r,o,u;const i=n.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)??[];for(const d of i){const p=d.replace(/^<script[^>]*>/i,"").replace(/<\/script>$/i,"");try{const f=JSON.parse(p.trim()),m=Array.isArray(f)?f:f["@graph"]??[f];for(const y of m){if((y==null?void 0:y["@type"])!=="JobPosting"&&!(Array.isArray(y==null?void 0:y["@type"])&&y["@type"].includes("JobPosting")))continue;const x=y.jobLocation,k=(x==null?void 0:x.address)??((r=x==null?void 0:x.location)==null?void 0:r.address),L=typeof(k==null?void 0:k.addressLocality)=="string"?k.addressLocality:"",O=typeof(k==null?void 0:k.addressCountry)=="string"?k.addressCountry:((o=k==null?void 0:k.addressCountry)==null?void 0:o.name)??"";return{title:typeof y.title=="string"?y.title:void 0,company:typeof y.hiringOrganization=="string"?y.hiringOrganization:typeof((u=y.hiringOrganization)==null?void 0:u.name)=="string"?y.hiringOrganization.name:void 0,location:[L,O].filter(Boolean).join(", ")||void 0,description:typeof y.description=="string"?Db(y.description):void 0,applyUrl:typeof y.url=="string"?y.url:void 0}}}catch{}}return null}function RS(n,i){const r=n.replace(/[.+?^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*"),o=/\*|\$$/.test(n)?r:`${r}.*`;try{return new RegExp(`^${o}$`).test(i)}catch{return!1}}function _S(n,i){const r=[];let o=!1;for(const u of n.split(/\r?\n/)){const d=u.replace(/#.*$/,"").trim();if(!d)continue;const p=d.indexOf(":");if(p<0)continue;const f=d.slice(0,p).trim().toLowerCase(),m=d.slice(p+1).trim();if(f==="user-agent"){o=m==="*";continue}o&&f==="disallow"&&m&&r.push(m)}return!r.some(u=>RS(u,i))}const NS=[{id:"naukri",label:"Naukri",hosts:/(^|\.)naukri\.com$/},{id:"linkedin",label:"LinkedIn",hosts:/(^|\.)linkedin\.com$/},{id:"indeed",label:"Indeed",hosts:/(^|\.)indeed\.(com|co\.uk|de|fr|in|ca|au)$/},{id:"glassdoor",label:"Glassdoor",hosts:/(^|\.)glassdoor\.(com|co\.in|ca|de|fr)$/}];function Ob(n){let i;try{i=new URL(n)}catch{return null}if(i.protocol!=="https:"&&i.protocol!=="http:")return null;const r=i.hostname.replace(/^www\./,"");for(const o of NS)if(o.hosts.test(r))return{id:o.id,label:o.label,host:r};return{id:"other",label:"Job page",host:r}}const IS={greenhouse:"Greenhouse",ashby:"Ashby",lever:"Lever",rss:"RSS",remoteok:"RemoteOK","imported:naukri":"Naukri","imported:linkedin":"LinkedIn","imported:indeed":"Indeed","imported:glassdoor":"Glassdoor","imported:other":"company page"},BS=n=>IS[n]??(n.startsWith("imported:")?n.slice(9):n);function Sq(n){return n==="greenhouse"||n==="ashby"||n==="lever"?{label:"Official ATS",icon:"🛡️",title:"Pulled from the company's own application system (Greenhouse/Ashby/Lever) — the posting is the employer's own."}:n==="remoteok"?{label:"Official API",icon:"🛡️",title:"Pulled from RemoteOK's official public API — RemoteOK vets the companies it lists."}:n==="rss"?{label:"Curated feed",icon:"📡",title:"Published via a public RSS feed from a vetted board (We Work Remotely, Himalayas) — the board screens the postings, but details come from the feed itself."}:n.startsWith("imported:")?{label:"You added",icon:"🔗",title:"Imported from a link you pasted — we read the public page, but you're the one vouching for it."}:{label:"Feed",icon:"🌐",title:"Pulled from a configured job source."}}function Tq(n){const i=(n??"").toLowerCase();return/india|bengaluru|mumbai|delhi|gurgaon|gurugram|pune|hyderabad|chennai|kolkata|noida|ahmedabad/.test(i)?{"imported:naukri":0,"imported:linkedin":1,"imported:indeed":2,"imported:glassdoor":3}:{"imported:linkedin":0,"imported:indeed":1,"imported:naukri":2,"imported:glassdoor":3}}function Aq(n){return[...new Set(n.split(/[\n,]/).map(i=>i.trim()).filter(Boolean))]}const Wg=new Map,US=1500;async function HS(n,i){const r=new URL(n).hostname,o=Wg.get(r)??0,u=US-(Date.now()-o);u>0&&await new Promise(p=>setTimeout(p,u));const d=await i(n);return Wg.set(r,Date.now()),d}function PS(n){const i=n.toLowerCase();return/(intern|graduate|entry.level|apprentice|junior|jr\.?|early.career)/.test(i)?"junior":/(staff|principal|distinguished|fellow|chief.architect)/.test(i)?"principal":/(director|vp|vice.president|cto|head of|lead|tech.lead|engineering.manager|manager)/.test(i)?"lead":/(senior|sr\.?|5\+|6\+|7\+)/.test(i)?"senior":"mid"}function $g(n){let i=2166136261;for(let r=0;r<n.length;r++)i^=n.charCodeAt(r),i=Math.imul(i,16777619);return(i>>>0).toString(16).padStart(8,"0")}function zb(n,i,r){const o=(i.title??"").trim(),u=(i.company??"").trim(),d=(i.location??"").trim(),p=(i.description??"").slice(0,6e3),f=`${o}
${u}
${d}
${p}`,m=i.applyUrl??r;return{id:`imported:${n.id}:${$g(m)}`,source:`imported:${n.id}`,externalId:$g(m),title:o||"Untitled role",company:u,location:d,remote:/remote|hybrid/i.test(`${d} ${p}`),description:p,url:m,skills:ip(f).slice(0,14),level:PS(o),salary:null,companySize:null,postedAt:null}}async function GS(n,i=r=>fetch(r)){var u;const r=Ob(n);if(!r)return{ok:!1,reason:"invalid-url",message:"Enter a valid job URL (https://…)"};let o=!0;try{const d=new URL("/robots.txt",n).toString(),p=await i(d);p.ok&&(o=_S(await p.text(),new URL(n).pathname))}catch{}if(!o)return{ok:!1,reason:"blocked",message:"This site's robots.txt doesn't allow automated fetching — open the job page manually instead."};try{const d=await HS(n,i);if(!d.ok)return{ok:!1,reason:"network",message:`The page returned HTTP ${d.status} — open it manually instead.`};const p=await d.text(),f=MS(p),m=jS(p),y=(f==null?void 0:f.title)??m.get("og:title")??((u=p.match(/<title[^>]*>([^<]*)<\/title>/i))==null?void 0:u[1])??"",x=(f==null?void 0:f.description)??m.get("og:description")??m.get("description")??Db(p).slice(0,2e3),k=zb(r,{title:y,company:(f==null?void 0:f.company)??m.get("og:site_name"),location:f==null?void 0:f.location,description:x,applyUrl:f==null?void 0:f.applyUrl},n);return!k.title||k.title==="Untitled role"?{ok:!1,reason:"empty",message:"Couldn't read the posting from that page — open it manually instead."}:{ok:!0,job:k}}catch{return{ok:!1,reason:"network",message:"Couldn't fetch this page from the app (the site blocks cross-origin reads) — open it manually and paste the details."}}}async function qq(n,i={}){const r=Ob(n);if(!r)return{ok:!1,reason:"invalid-url",message:"Enter a valid job URL (https://…)"};if(i.supabaseUrl&&i.token)try{const o=await fetch(`${i.supabaseUrl}/functions/v1/import-job`,{method:"POST",headers:{Authorization:`Bearer ${i.token}`,"Content-Type":"application/json"},body:JSON.stringify({url:n})}),u=await o.json().catch(()=>({}));if(o.ok&&(u!=null&&u.ok)){const d=zb(r,u.job,n);if(d.title&&d.title!=="Untitled role")return{ok:!0,job:d}}}catch{}return GS(n,i.fetcher)}const Xg={USD:1,INR:83,GBP:.78,EUR:.92};function Zg(n,i,r){if(!isFinite(n)||n<=0)return 0;if(!i||!r||i===r)return Math.round(n);const o=n/(Xg[i]??1);return Math.round(o*(Xg[r]??1))}function YS(n){const i=(n??"").toLowerCase();return/india|bengaluru|bangalore|mumbai|delhi|hyderabad|pune|chennai|gurgaon|gurugram|noida|kolkata|ahmedabad/.test(i)?"INR":"USD"}function Eq(n){return ne(H.displayCurrency,"")||YS(n)}function Cq(n){oe(H.displayCurrency,n)}function rp(n,i){return{min:Zg(n.min,n.currency,i),max:Zg(n.max,n.currency,i),currency:i}}const Lq={junior:{min:7e4,max:115e3,label:"Junior"},mid:{min:11e4,max:165e3,label:"Mid-level"},senior:{min:15e4,max:22e4,label:"Senior"},lead:{min:19e4,max:28e4,label:"Lead / Staff"},principal:{min:25e4,max:4e5,label:"Principal / Distinguished"}},Dq=["junior","mid","senior","lead","principal"];function QS(n){return n>=8?"principal":n>=5?"senior":n>=2?"mid":"junior"}function KS(n){return{USD:"$",GBP:"£",EUR:"€",INR:"₹"}[n]??n}function is(n,i="USD"){const r=KS(i);return i==="INR"?n>=1e7?`${r}${(n/1e7).toFixed(1)}Cr`:n>=1e5?`${r}${Math.round(n/1e5)}L`:n>=1e3?`${r}${Math.round(n/1e3)}k`:`${r}${Math.round(n)}`:n>=1e6?`${r}${(n/1e6).toFixed(1)}M`:n>=1e3?`${r}${Math.round(n/1e3)}k`:`${r}${Math.round(n)}`}function Oq(n,i,r="USD"){return`${is(n,r)}–${is(i,r)}`}function zq(n){const i={};for(const o of n){if(!o.salary)continue;const u=i[o.company]??{company:o.company,bands:[]};u.bands.push({min:o.salary.min,max:o.salary.max,currency:o.salary.currency,source:o.salary.source??"posting"}),i[o.company]=u}const r=Object.values(i);for(const o of r)if(o.bands.length){const u=o.bands.map(f=>f.min).sort((f,m)=>f-m),d=o.bands.map(f=>f.max).sort((f,m)=>f-m),p=f=>f[Math.floor(f.length/2)];o.median={min:p(u),max:p(d),currency:o.bands[0].currency}}return r.sort((o,u)=>{var d,p;return(((d=u.median)==null?void 0:d.min)??0)-(((p=o.median)==null?void 0:p.min)??0)})}const ey=[{id:"us-national",label:"US national",mult:1,fx:1,currency:"USD",note:"Baseline",keywords:[]},{id:"us-sf",label:"SF Bay Area",mult:1.28,fx:1,currency:"USD",note:"Highest-cost US tech hub",keywords:["san francisco","sf bay","bay area","palo alto","mountain view","sunnyvale","menlo park"]},{id:"us-nyc",label:"New York",mult:1.22,fx:1,currency:"USD",note:"US metro",keywords:["new york","nyc","manhattan","brooklyn","queens"]},{id:"us-seattle",label:"Seattle",mult:1.16,fx:1,currency:"USD",note:"US metro",keywords:["seattle","redmond","bellevue"]},{id:"us-austin",label:"Austin",mult:.96,fx:1,currency:"USD",note:"US metro",keywords:["austin","round rock"]},{id:"us-remote",label:"US remote",mult:.94,fx:1,currency:"USD",note:"Remote (US-based)",keywords:["remote"]},{id:"uk-london",label:"London",mult:.82,fx:1.28,currency:"GBP",note:"Converted at ~£0.78/USD",keywords:["london"]},{id:"in-bengaluru",label:"Bengaluru",mult:.22,fx:83,currency:"INR",note:"Converted at ~₹83/USD",keywords:["bengaluru","bangalore"]},{id:"in-mumbai",label:"Mumbai / tier-1 India",mult:.21,fx:83,currency:"INR",note:"Converted at ~₹83/USD",keywords:["mumbai","bombay","pune","hyderabad","chennai","india"]},{id:"in-delhi",label:"Delhi NCR",mult:.2,fx:83,currency:"INR",note:"Converted at ~₹83/USD",keywords:["delhi","gurgaon","gurugram","noida"]}];function FS(n){const i=(n??"").toLowerCase();for(const r of ey)if(r.id!=="us-national"&&r.keywords.some(o=>i.includes(o)))return r;return ey[0]}function jq(n,i){const r=Math.round(n.min*i.mult),o=Math.round(n.max*i.mult);return{min:Math.round(r*i.fx),max:Math.round(o*i.fx),minUsd:r,maxUsd:o,currency:i.currency,marketId:i.id}}function VS(n,i,r){return r<=i?50:Math.max(0,Math.min(100,Math.round((n-i)/(r-i)*100)))}function Mq(n){const i=n%100;if(i>=11&&i<=13)return`${n}th`;switch(n%10){case 1:return`${n}st`;case 2:return`${n}nd`;case 3:return`${n}rd`;default:return`${n}th`}}function Rq(n){return n<30?{label:"Below the market mid-point",tone:"low"}:n<=70?{label:"Around the market mid-point",tone:"mid"}:{label:"Above the market mid-point",tone:"high"}}function JS(n,i){const r=n.base+n.equity,o=VS(r,i.min,i.max),u=r<i.min?"below":r>i.max?"above":"in-range",d=Math.max(0,i.min-r);return{kind:u,total:r,pct:o,gapToMin:d,label:u==="below"?"Below the market band":u==="above"?"Above the market band":"Inside the market band"}}function _q(n,i,r,o=r.currency){const u=JS(n,i),d=Math.round((i.min+i.max)/2),p=is(d,o),f=[];return u.kind==="below"?(f.push(`Your offer (${is(u.total,o)}) sits below the ${r.label} band — anchor at the market mid-point (${p}), which is the market rate, not a stretch.`),f.push("If the band is firm, ask what unlocks more: equity/ESOP, a sign-on bonus, or a title step that widens the range.")):u.kind==="in-range"?f.push(`You're inside the ${r.label} band at the ${u.pct}th percentile — ask for a specific number near the mid-point (${p}), not "more".`):f.push(`You're above the ${r.label} band — keep the number and negotiate the details: equity, vesting, start-date leverage.`),f.push("Get equity/ESOP value in writing — vesting schedule and strike price change the real number."),f.push("Request the offer in writing with a response deadline, then compare it side-by-side with the live feed bands above."),f}function op(){return ne(H.jobs,[])}function jb(n){oe(H.jobs,n.slice(0,80))}const WS=n=>({id:`${n.source}:${n.external_id}`,source:n.source,externalId:n.external_id,title:n.title,company:n.company,location:n.location??"",remote:n.remote,description:n.description,url:n.url,skills:n.skills??[],level:n.level??null,salary:n.salary??null,companySize:n.company_size??null,postedAt:n.posted_at}),Mb=n=>n.source.startsWith("imported:");function Nq(n){const i=[n,...op().filter(r=>r.url!==n.url&&!(Mb(r)&&r.id===n.id))];return jb(i),i}const $S="source, external_id, title, company, location, remote, description, url, skills, level, salary, company_size, posted_at",XS=40,ld=80,ZS=["greenhouse","ashby","lever","remoteok","rss"];async function e2(){const n=await ie();if(!n)return[];const r=(await Promise.all(ZS.map(m=>n.from("jobs").select($S).eq("source",m).order("posted_at",{ascending:!1}).limit(XS)))).map(({data:m,error:y})=>y||!m?[]:m),o=[];let u=0,d=!0;for(;d&&o.length<ld;){d=!1;for(const m of r){if(o.length>=ld)break;u<m.length&&(o.push(m[u]),d=!0)}u++}const p=o.slice(0,ld).map(WS),f=op().filter(Mb);return jb([...f,...p]),[...f,...p]}function Iq(){return ne(H.jobsRefreshedAt,0)}function t2(){oe(H.jobsRefreshedAt,Date.now())}async function Bq(){var d;const n=await ie();if(!n)throw new Error("Sign in to refresh the job feed");const{data:i}=await n.auth.getSession(),r=(d=i==null?void 0:i.session)==null?void 0:d.access_token;if(!r)throw new Error("Sign in to refresh the job feed");const o=await fetch("https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/jobs-fetch",{method:"POST",headers:{Authorization:`Bearer ${r}`,"Content-Type":"application/json"}}),u=await o.json().catch(()=>({}));if(!o.ok)throw new Error(u.error??"Refresh failed");return await e2(),t2(),{added:u.added??0,updated:u.updated??0,total:u.total??0,errors:u.errors??{}}}const n2={query:"",remote:null,companySize:null,salaryMin:null,salaryMax:null,currency:null,source:null};function Uq(n,i){const r=i.query.trim().toLowerCase();return n.filter(o=>{if(i.source&&o.source!==i.source||i.remote===!0&&!o.remote||i.remote===!1&&o.remote||i.companySize&&o.companySize!==i.companySize)return!1;if(i.salaryMin!==null||i.salaryMax!==null){if(!o.salary)return!1;const u=i.currency?rp(o.salary,i.currency):o.salary;if(i.salaryMin!==null&&u.max<i.salaryMin||i.salaryMax!==null&&u.min>i.salaryMax)return!1}return!(r&&!`${o.title} ${o.company} ${o.location} ${o.description}`.toLowerCase().includes(r))})}function Hq(n,i){return n.map((r,o)=>({j:r,i:o,s:i(r.id)||0})).sort((r,o)=>o.s-r.s||r.i-o.i).map(r=>r.j)}function Pq(n,i){if(!n.salary)return null;const r=n.salary,o=i&&i!==r.currency?{...rp(r,i),source:r.source}:r;return`${is(o.min,o.currency)}–${is(o.max,o.currency)} ${o.currency}${o.source==="estimate"?" est.":""}`}function a2(n){const i=n.title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim(),r=n.company.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();return`${i}|${r}`}function ty(n){return(n.source==="rss"?0:1)*1e3+(n.skills.length>0?100:0)+(n.salary?10:0)+(n.description&&n.description.length>200?1:0)}function Gq(n){const i=new Map;for(const o of n){const u=a2(o),d=i.get(u);d?d.push(o):i.set(u,[o])}const r=[];for(const o of i.values()){const u=[...o].sort((f,m)=>ty(m)-ty(f)),d=u[0],p=[...new Set(u.slice(1).map(f=>BS(f.source)))];r.push(p.length?{...d,alsoSources:p}:d)}return r}const Qi={junior:0,mid:1,senior:2,lead:3,principal:4},ny=n=>n>=8?"principal":n>=5?"senior":n>=2?"mid":"junior",i2={strong:{label:"Strong match",tone:"ok"},good:{label:"Good fit",tone:"co"},moderate:{label:"Moderate",tone:"warn"},stretch:{label:"Stretch",tone:"bad"},no:{label:"Not recommended",tone:"default"}},Rb=[["data","Data",/data scientist|data analyst|data engineer|analytics|machine learning|business intelligence|bi engineer/],["design","Design",/product designer|ux designer|ui designer|designer|creative/],["product","Product & Program",/product manager|product owner|program manager|technical program manager/],["marketing","Marketing",/marketing|growth|brand|content|seo|campaign|media|social|communications|comms/],["finance","Finance",/finance|accounting|controller|compensation|payroll|audit|tax|fp&a|financial/],["legal","Legal",/legal|counsel|paralegal|compliance|privacy|litigation/],["hr","People & HR",/recruit|people|talent|human resources|employee|hr/],["sales","Sales & BD",/sales|business development|account executive|account manager|partnerships|revenue|go.to.market/],["ops","Operations",/operations|vendor|support|logistics|procurement|facilities/],["software","Engineering",/software|engineer|developer|programmer|front.?end|back.?end|full.?stack|devops|sre|site reliability|platform|infrastructure|security|mobile|ios|android|qa|quality|automation|sdet|test|web/]],s2=Object.fromEntries(Rb.map(([n,i])=>[n,i]));function cl(n){const i=(n??"").toLowerCase();for(const[r,,o]of Rb)if(o.test(i))return r;return"other"}const _b=n=>s2[n]??"Other",ay=n=>n.toLowerCase().replace(/[^a-z0-9+#]/g," ").trim().split(/\s+/).filter(Boolean),iy=(n,i)=>{const r=ay(n),o=ay(i);if(r.some(d=>o.includes(d)))return!0;const u=d=>d.map(p=>p.length>3&&p.endsWith("s")?p.slice(0,-1):p);return u(r).some(d=>u(o).includes(d))},r2=new Set(["senior","junior","staff","lead","principal","director","manager","head","intern","mid","entry","sr"]);function o2(n,i){if(!i||!(i in Qi))return[8,null];const r=Qi[i]-Qi[ny(n.years)];return r>=1?[15,null]:r===0?[12,null]:r===-1?[5,null]:[2,`Below your seniority (role targets ${i}, you're at ${ny(n.years)})`]}function Nb(n,i){if(!n)return{score:0,verdict:"no",matched:[],missing:i.skills,blockers:["Complete your career profile to see a match verdict."]};const r=n.skills.map(N=>N.trim()).filter(Boolean),o=i.skills.filter(N=>r.some(I=>iy(I,N))),u=i.skills.filter(N=>!r.some(I=>iy(I,N))),d=[];let p=0,f=!1;const m=cl([n.headline,...n.targetTitles].join(" ")),y=cl(i.title),x=m!=="other"&&y!=="other",k=x&&m===y;x&&!k&&d.push(`Outside your field — this is a ${_b(y)} role`),i.skills.length>0?p+=o.length/i.skills.length*55:k?p+=40:x?f=!0:(p+=18,f=!0,d.push("Limited info — no skills extracted for this role"));const L=i.title.toLowerCase(),O=new Set(n.targetTitles.flatMap(N=>N.split(/\s+/)).map(N=>N.toLowerCase()).filter(N=>N.length>3&&!r2.has(N)));p+=[...O].some(N=>L.includes(N))?12:0;const[_,T]=o2(n,i.level);if(p+=_,T&&d.push(T),n.remote)i.remote?p+=10:d.push("On-site role — you prefer remote");else if(n.location.trim()){const N=n.location.trim().toLowerCase(),I=i.location.toLowerCase();I&&!i.remote&&!I.includes(N)&&d.push(`Role is in ${i.location} — not ${n.location}`)}x&&!k&&(p=Math.min(p,20)),f&&(p=Math.min(p,40)),p-=d.length*6,T&&(p=Math.min(p,55)),p=Math.max(0,Math.min(100,Math.round(p)));const G=p>=75?"strong":p>=58?"good":p>=38?"moderate":p>=18?"stretch":"no";return{score:p,verdict:G,matched:o,missing:u,blockers:d}}function l2(n,i){const r=new Map;for(const u of i){const d=r.get(u.company);d?d.push(u):r.set(u.company,[u])}const o=[];for(const[u,d]of r){let p=d[0],f=null,m=-1;for(const y of d){const x=Nb(n,y);x.score>m&&(m=x.score,p=y,f=x)}o.push({company:u,score:m,verdict:(f==null?void 0:f.verdict)??"no",openings:d.length,best:p,matched:(f==null?void 0:f.matched)??[],missing:(f==null?void 0:f.missing)??[]})}return o.sort((u,d)=>d.score-u.score||d.openings-u.openings||u.company.localeCompare(d.company)),o}const c2={remoteOnly:!1,minScore:0,minSalary:0,shortlistOnly:!1};function u2(n,i){const r=[];if(n){const o=n.years,u=o>=8?"principal":o>=5?"senior":o>=2?"mid":"junior",d=i.best.level;if(d&&d in Qi){const m=Qi[d]-Qi[u];r.push(m>0?`Targets above your level (${d})`:m===0?`Matches your level (${d})`:m===-1?`One rung below your level (${d})`:`Below your level (${d})`)}const p=cl([n.headline,...n.targetTitles].join(" ")),f=cl(i.best.title);p!=="other"&&f!=="other"&&r.push(_b(f)+" role")}return i.matched.length&&r.push(`covers ${i.matched.slice(0,4).join(", ")}`),r.join(" · ")||"Upload a resume to rank companies"}function d2(n,i){if(!n)return null;const r=i.missing[0];if(!r)return null;const o=Nb({...n,skills:[...new Set([...n.skills,r])]},i.best);return o.score<=i.score?null:{skill:r,from:i.score,to:o.score}}function Ib(n,i,r){const o=`${r+1}. ${i.company} — ${i.score}% match (${i2[i.verdict].label}) · ${i.openings} open role${i.openings===1?"":"s"} · best fit: ${i.best.title}`,u=u2(n,i),d=d2(n,i);return`${o}
   Why: ${u}${d?` · learn ${d.skill} → ${d.to}%`:""}`}function Yq(n,i,r=3){const o=i.slice(0,r);if(!o.length)return"InterviewIQ — no companies to recommend yet. Upload a resume or save your career profile to rank companies.";const u=["InterviewIQ — weekly company recommendations","",...n?[`Based on your profile: ${n.headline||"—"} (${n.years} yrs).`,""]:[],...o.map((d,p)=>Ib(n,d,p))];return o[0].missing.length&&u.push("",`Closest gap for ${o[0].company}: ${o[0].missing.slice(0,4).join(", ")}.`),u.join(`
`)}const p2=/india|bengaluru|bangalore|mumbai|delhi|hyderabad|pune|chennai|gurgaon|gurugram|noida|kolkata|ahmedabad|indore|kochi|chandigarh|jaipur/i,h2=["fampay","cred","groww","razorpay","swiggy","zomato","flipkart","freshworks","chargebee","postman","zepto","meesho","ola","paytm","upstox","zerodha","dream11","myntra","bigbasket","nobroker","apna","sharechat","unacademy","byju","ayu","phonepe","druva","zoho","infosys","tcs","wipro","hcl","technologies","mindtree","l&t","tata","mahindra","reliance","jio"];function f2(n){const i=(n.location??"").toLowerCase();if(p2.test(i))return!0;const r=(n.company??"").toLowerCase().replace(/[^a-z0-9& ]/g,"");return h2.some(o=>r.includes(o))?!0:!!n.remote}function Qq(n,i,r=3){const o=l2(n,i.filter(f2)).slice(0,r);return o.length?["InterviewIQ — weekly 🇮🇳 India & startup recommendations","",...n?[`Based on your profile: ${n.headline||"—"} (${n.years} yrs).`,""]:[],...o.map((d,p)=>Ib(n,d,p))].join(`
`):"InterviewIQ — no Indian-market companies to recommend yet. Upload a resume or save your career profile to rank companies."}function Kq(n,i,r,o){return n.filter(u=>!(i.remoteOnly&&!u.best.remote||i.minScore>0&&u.score<i.minScore||i.minSalary>0&&(!u.best.salary||rp(u.best.salary,o).max<i.minSalary)||i.shortlistOnly&&!r.has(u.company.toLowerCase())))}function m2(){return ne(H.shortlist,[])}const Fq={saved:{label:"Saved",emoji:"🔖",tone:"default"},applied:{label:"Applied",emoji:"📤",tone:"co"},interview:{label:"Interview",emoji:"🎤",tone:"ok"},offer:{label:"Offer",emoji:"🎉",tone:"ok"},rejected:{label:"Rejected",emoji:"💔",tone:"bad"}},Vq=["saved","applied","interview","offer","rejected"];function qr(){return Object.values(ne(H.applyTrack,{}))}function cs(n){return ne(H.applyTrack,{})[n]??null}function us(n){const i=ne(H.applyTrack,{});i[n.jobId]=n,oe(H.applyTrack,i)}function Jq(n,i){const r=cs(n),o={jobId:n,status:i,appliedAt:i==="applied"||i==="interview"||i==="offer"?(r==null?void 0:r.appliedAt)??Date.now():(r==null?void 0:r.appliedAt)??null,followUpAt:(r==null?void 0:r.followUpAt)??null,followUpNotified:(r==null?void 0:r.followUpNotified)??!1,notes:(r==null?void 0:r.notes)??"",rounds:(r==null?void 0:r.rounds)??[],updatedAt:Date.now()};return us(o),o}function Wq(n,i){const r=cs(n),o={saved:0,applied:1,interview:2,offer:3,rejected:3},u=(r==null?void 0:r.status)??"saved",d={jobId:n,status:o[u]>=o.applied?u:"applied",via:i,appliedAt:(r==null?void 0:r.appliedAt)??Date.now(),followUpAt:(r==null?void 0:r.followUpAt)??Date.now()+336*3600*1e3,followUpNotified:(r==null?void 0:r.followUpNotified)??!1,notes:(r==null?void 0:r.notes)??"",rounds:(r==null?void 0:r.rounds)??[],updatedAt:Date.now()};return us(d),d}function $q(n,i){const r=cs(n),o={jobId:n,status:(r==null?void 0:r.status)??"saved",appliedAt:(r==null?void 0:r.appliedAt)??null,followUpAt:i,followUpNotified:!1,notes:(r==null?void 0:r.notes)??"",rounds:(r==null?void 0:r.rounds)??[],updatedAt:Date.now()};return us(o),o}function Xq(n,i){const r=cs(n),o=[...(r==null?void 0:r.rounds)??[]],u=o.findIndex(p=>p.id===i.id);u>=0?o[u]=i:o.push(i),o.sort((p,f)=>f.at-p.at);const d={jobId:n,status:(r==null?void 0:r.status)??"saved",appliedAt:(r==null?void 0:r.appliedAt)??null,followUpAt:(r==null?void 0:r.followUpAt)??null,followUpNotified:(r==null?void 0:r.followUpNotified)??!1,notes:(r==null?void 0:r.notes)??"",rounds:o,updatedAt:Date.now()};return us(d),d}function Zq(n,i){const r=cs(n);if(!r)return null;const o={...r,rounds:r.rounds.filter(u=>u.id!==i),updatedAt:Date.now()};return us(o),o}function Bb(n=Date.now()){return qr().filter(i=>i.followUpAt!==null&&i.followUpAt<=n&&!i.followUpNotified&&i.status!=="rejected"&&i.status!=="offer")}function e3(n){const i=cs(n);i&&us({...i,followUpNotified:!0,updatedAt:Date.now()})}function g2(){const n={saved:0,applied:0,interview:0,offer:0,rejected:0};for(const i of qr())n[i.status]+=1;return n}const lr=168*36e5;function y2(n=Date.now()){const i=qr(),r=n-7*lr,o=i.filter(O=>(O.appliedAt??0)>=r),u=o.length,d=o.filter(O=>O.status==="interview"||O.status==="offer").length,p=o.filter(O=>O.status==="offer").length,f=o.filter(O=>O.status==="rejected").length,m=i.filter(O=>O.followUpAt!==null&&O.followUpAt>=r&&O.followUpAt<=n),y=m.filter(O=>O.status!=="applied"&&O.status!=="saved").length,x=m.length-y,k=[];for(let O=3;O>=0;O--){const _=n-(O+1)*lr,T=n-O*lr,G=i.filter(I=>(I.appliedAt??0)>=_&&(I.appliedAt??0)<T),N=new Date(T).toLocaleDateString(void 0,{month:"short",day:"numeric"});k.push({label:N,applied:G.length,interviews:G.filter(I=>I.status==="interview"||I.status==="offer").length,offers:G.filter(I=>I.status==="offer").length})}const L=[];for(let O=7;O>=0;O--){const _=n-(O+1)*lr,T=O===0?n+1:n-O*lr,G=i.filter(I=>(I.appliedAt??0)>=_&&(I.appliedAt??0)<T),N=new Date(T).toLocaleDateString(void 0,{month:"short",day:"numeric"});L.push({label:N,applied:G.length,interviews:G.filter(I=>I.status==="interview"||I.status==="offer").length,offers:G.filter(I=>I.status==="offer").length})}return{windowDays:7,applied:u,interviews:d,offers:p,rejections:f,responseRate:u?Math.round(d/u*100):0,followUpsDue:x,followUpsDone:y,byWeek:k,momentum:L}}function t3(n=Date.now()){const i=y2(n),r=g2(),o=Bb(n),u=qr(),d=[`InterviewIQ — Weekly application digest (${new Date(n).toLocaleDateString()})`,"",`Portfolio: ${r.saved+r.applied+r.interview+r.offer+r.rejected} tracked · ${r.applied} applied · ${r.interview} interviewing · ${r.offer} offers · ${r.rejected} rejected`,`This week: ${i.applied} applied, ${i.interviews} interviews, ${i.offers} offers · response rate ${i.responseRate}%`,`Follow-ups: ${i.followUpsDone} done, ${i.followUpsDue} due`];if(o.length){d.push("",`Follow-up due now (${o.length}):`);for(const m of o)d.push(`  - ${m.jobId}`)}const p=u.filter(m=>m.status==="interview").length;p&&d.push("",`${p} application${p===1?" is":"s are"} in the interview stage — keep the round checklists current.`);const f=i.momentum.map(m=>`${m.label}: ${m.applied} applied / ${m.interviews} interviews`).join(" · ");return f&&d.push("",`Momentum (8 wk): ${f}`),d.join(`
`)}function n3(n,i,r,o){const u=`${i} at ${r}`;if(n==="interview")return["Hi there,","",`Thank you again for the opportunity to interview for the ${u} role. I really enjoyed learning more about the team and the problems you're solving.`,"","I wanted to follow up on the next steps — I remain very interested in the position and would be glad to provide anything further that would help with the decision.","","Best regards,"].join(`
`);if(n==="offer")return["Hi there,","",`Thank you for the offer for the ${u} role — I'm genuinely excited about the opportunity.`,"","I'm reviewing the details and will get back to you by [date]. Please let me know if there's anything else you need from my side in the meantime.","","Best regards,"].join(`
`);const d=o>=14?"a couple of weeks":"a week or so";return["Hi there,","",`I applied for the ${u} role about ${d} ago and wanted to check in on the status of my application.`,"",`I'm very excited about the opportunity to join ${r} and would welcome the chance to discuss how my background could contribute to the team.`,"","Best regards,"].join(`
`)}const b2=()=>{const n={};for(const i of qr())n[i.jobId]=i;return n};var jy,My;const v2={profile:od(),jobs:op(),refreshing:!1,saving:!1,filters:n2,resume:Eb(),tracks:b2(),due:Bb(),shortlist:new Set(m2()),rankLimit:10,rankFilters:c2,benchLvl:QS(((jy=od())==null?void 0:jy.years)??0),benchCo:"",benchOpen:!1,market:FS((My=od())==null?void 0:My.location),expected:"",offerOpen:!1,importOpen:!1,importUrl:"",importing:!1,importResults:[],importErr:null,applyQueue:null,resumeFormOpen:!1,resumeShowAll:!1,resumePaste:"",resumeBusy:!1,skillSuggestions:[],resumeBannerDismissed:ne(H.resumeStrictBanner,!1),applyHintShown:ne(H.externalApplyHint,!1),showResumeBanner:!1,upgrade:null,gapJob:null,kitJob:null,reportOpen:!1,draftJob:null,roundJob:null,recsDigestOpen:!1},Ub=Ry({name:"jobs",initialState:v2,reducers:{setJobs(n,i){n.jobs=i.payload},setProfile(n,i){n.profile=i.payload},setRefreshing(n,i){n.refreshing=i.payload},setSaving(n,i){n.saving=i.payload},setFilters(n,i){n.filters=i.payload},setResume(n,i){n.resume=i.payload},setTracks(n,i){n.tracks=i.payload},setDue(n,i){n.due=i.payload},toggleShortlist(n,i){const r=i.payload,o=new Set(n.shortlist);o.has(r)?o.delete(r):o.add(r),n.shortlist=o},setShortlist(n,i){n.shortlist=i.payload},setRankLimit(n,i){n.rankLimit=i.payload},setRankFilters(n,i){n.rankFilters=i.payload},setBenchLvl(n,i){n.benchLvl=i.payload},setBenchCo(n,i){n.benchCo=i.payload},setBenchOpen(n,i){n.benchOpen=i.payload},setMarket(n,i){n.market=i.payload},setExpected(n,i){n.expected=i.payload},setOfferOpen(n,i){n.offerOpen=i.payload},setImportOpen(n,i){n.importOpen=i.payload},setImportUrl(n,i){n.importUrl=i.payload},setImporting(n,i){n.importing=i.payload},setImportResults(n,i){n.importResults=i.payload},setImportErr(n,i){n.importErr=i.payload},setApplyQueue(n,i){n.applyQueue=i.payload},setResumeFormOpen(n,i){n.resumeFormOpen=i.payload},setResumeShowAll(n,i){n.resumeShowAll=i.payload},setResumePaste(n,i){n.resumePaste=i.payload},setResumeBusy(n,i){n.resumeBusy=i.payload},setSkillSuggestions(n,i){n.skillSuggestions=i.payload},setResumeBannerDismissed(n,i){n.resumeBannerDismissed=i.payload},setApplyHintShown(n,i){n.applyHintShown=i.payload},setShowResumeBanner(n,i){n.showResumeBanner=i.payload},setUpgrade(n,i){n.upgrade=i.payload},setGapJob(n,i){n.gapJob=i.payload},setKitJob(n,i){n.kitJob=i.payload},setReportOpen(n,i){n.reportOpen=i.payload},setDraftJob(n,i){n.draftJob=i.payload},setRoundJob(n,i){n.roundJob=i.payload},setRecsDigestOpen(n,i){n.recsDigestOpen=i.payload}}}),{setJobs:a3,setProfile:i3,setRefreshing:s3,setSaving:r3,setFilters:o3,setResume:l3,setTracks:c3,setDue:u3,toggleShortlist:d3,setShortlist:p3,setRankLimit:h3,setRankFilters:f3,setBenchLvl:m3,setBenchCo:g3,setBenchOpen:y3,setMarket:b3,setExpected:v3,setOfferOpen:w3,setImportOpen:k3,setImportUrl:x3,setImporting:S3,setImportResults:T3,setImportErr:A3,setApplyQueue:q3,setResumeFormOpen:E3,setResumeShowAll:C3,setResumePaste:L3,setResumeBusy:D3,setSkillSuggestions:O3,setResumeBannerDismissed:z3,setApplyHintShown:j3,setShowResumeBanner:M3,setUpgrade:R3,setGapJob:_3,setKitJob:N3,setReportOpen:I3,setDraftJob:B3,setRoundJob:U3,setRecsDigestOpen:H3}=Ub.actions,gr={grace_days:7,max_refunds_per_user:3,reason_presets:["Duplicate purchase","Requested by user","Billing error","User cancelled"]};async function P3(){const n=await ie();if(!n)return{...gr};const{data:i,error:r}=await n.from("app_config").select("value").eq("key","refund_policy").maybeSingle();return r||!i?{...gr}:{...gr,...i.value}}async function G3(n){const i=await ie();if(!i)throw new Error("Cloud not configured");const{error:r}=await i.from("app_config").upsert({key:"refund_policy",value:n,updated_at:Date.now()},{onConflict:"key"});if(r)throw new Error(r.message)}async function Y3(n,i,r="one_time"){const o=await ie();if(!o)throw new Error("Cloud not configured");const{data:u,error:d}=await o.rpc("admin_simulate_purchase",{p_user:n,p_plan:i,p_kind:r});if(d)throw new Error(d.message);return String(u??"")}async function Q3(n=50){const i=await ie();if(!i)throw new Error("Cloud not configured");const{data:r,error:o}=await i.rpc("admin_billing_actions",{max_rows:n});if(o)throw new Error(o.message);return(r??[]).map(u=>({action:String(u.action??""),adminId:u.admin_id??null,userId:u.user_id??null,email:u.email??null,detail:u.detail??null,createdAt:u.created_at}))}function K3(n,i){return(i==="INR"?"₹":"$")+(n/100).toFixed(2)}const F3=[{id:"terms",title:"Terms of Service",icon:"📜",blurb:"The rules that govern your use of InterviewIQ.",updatedAt:"2026-08-12"},{id:"privacy",title:"Privacy Policy",icon:"🔒",blurb:"What data we store, what we never collect, and your rights.",updatedAt:"2026-08-12"},{id:"refunds",title:"Refund & Cancellation",icon:"💸",blurb:"How refunds and subscription cancellations work.",updatedAt:"2026-08-12"},{id:"shipping",title:"Shipping Policy",icon:"📦",blurb:"Delivery terms for this digital product.",updatedAt:"2026-08-12"}],w2=`## Acceptance of Terms

By creating an account, purchasing a plan, or using {{company}} ("the Service"), you agree to these Terms of Service. If you do not agree, please do not use the Service.

## The Service

{{company}} is an AI interview preparation tool. It generates practice questions, scores answers, builds study roadmaps, and provides AI coaching and feedback. The Service is provided "as is" for personal, non-commercial interview preparation unless you hold a paid plan.

## Accounts

- You are responsible for keeping your sign-in credentials secure and for all activity under your account.
- You must provide accurate information when you create an account or complete a purchase.
- One account may be used by one person. Sharing paid access across a team requires a Team plan.

## Free vs Paid (Pro) Plans

- The core Service — tailored sessions, mock interviews, the question bank, drill and roadmap — is free with reasonable usage limits.
- Pro removes those limits and adds premium features. Pro access is granted only after a confirmed payment or a valid grant code; access is tied to your signed-in account and is verified server-side.
- We may change free limits or the Pro feature set at any time; changes never remove access you have already paid for within the paid period.

## Payments, Subscriptions and Refunds

- Payments are processed by our payment provider (currently Razorpay). We never see or store your full card details.
- Monthly and yearly plans renew automatically at the end of each period until you cancel. You can cancel anytime from your account settings; access continues until the end of the paid period.
- Refunds are governed by our Refund & Cancellation Policy, which forms part of these Terms.

## Acceptable Use

You agree not to:

- Reproduce, resell or redistribute the question bank, model answers or coaching content without permission.
- Use the Service to build a competing product or to train a model on our content.
- Attempt to bypass the paywall, access controls or usage quotas.
- Upload, paste or transmit unlawful, infringing or malicious content (including malicious code in the code playground).

## Intellectual Property

The Service, including its questions, answers, scoring logic, branding and content, is owned by {{company}} and its licensors. You may use it only as permitted by these Terms. Your answers, notes and uploaded materials remain yours; you grant us a limited license to store and process them to operate the Service.

## Disclaimers

- The Service provides practice materials and simulated feedback. It does not guarantee interview outcomes, employment or offers.
- AI-generated feedback may contain errors; it is a coaching aid, not an authoritative assessment.
- The Service is provided "as is" without warranties of any kind, express or implied.

## Limitation of Liability

To the maximum extent permitted by law, {{company}} is not liable for indirect, incidental or consequential damages, or for loss of profits, data or goodwill, arising from your use of the Service.

## Termination

We may suspend or terminate accounts that violate these Terms, abuse the Service, or attempt to defraud the payment flow. You may delete your account and data at any time from Settings.

## Changes

We may update these Terms from time to time. Material changes will be announced in the app. Continued use after changes take effect constitutes acceptance.

## Contact

Questions about these Terms: **{{email}}**`,k2=`## Overview

This Privacy Policy explains what information {{company}} ("we") collects, why we collect it, and the choices you have. This policy applies to the {{url}} website and the InterviewIQ application.

## What we collect

- **Usage data.** Your sessions, answers, scores, streaks, roadmap progress and study history, stored locally on your device and — when you sign in to the cloud — synced to your account so your progress follows you across devices.
- **Account data.** Your email address and display name when you create a cloud account or sign in with Google or GitHub.
- **Payments.** When you purchase Pro, our payment provider (Razorpay) processes the transaction. We receive a payment confirmation and store the plan, amount, currency and payment reference — never your card number.
- **AI requests.** Content you send to AI coaching or the tutor (including uploaded PDFs for the knowledge base) is transmitted to the AI provider you configure or the built-in engine, solely to generate your response.
- **Diagnostics.** Anonymous error and event telemetry used to improve the product.

## What we never collect

- Your full card numbers or CVV — those never touch our servers.
- Content from third-party sites you don't paste yourself.
- Microphone audio without your explicit action — voice answers are processed only when you record and submit them.

## How we use data

- To run the Service: generate sessions, score answers, adapt roadmaps, sync progress.
- To fulfill purchases: verify payments, grant Pro access, prevent fraud, issue refunds.
- To improve the product: aggregated, de-identified usage analytics.
- To contact you: transactional emails about your account, payments, or announcements you opt into.

## Sharing

We share data only with:

- **Payment providers** (Razorpay) — necessary to process your payment.
- **AI providers** — when you enable generative AI feedback, the content you submit is sent to the configured provider.
- **Service infrastructure** (hosting, email delivery) — to operate the Service.

We never sell your personal data.

## Storage, retention & security

- Data is stored in encrypted cloud infrastructure and on your device. Transmissions use HTTPS.
- We retain account and payment records as required for tax and anti-fraud purposes, and session history until you delete it.
- You can delete your local data at any time (Settings → Reset) and your cloud account from Account.

## Your rights

Depending on your region (including GDPR / CCPA), you may have the right to access, correct, export or delete your personal data. Email **{{email}}** and we will respond within the timeframes the law requires.

## Cookies & local storage

The app uses local browser storage (localStorage) for offline-first operation and preferences. We do not use advertising cookies. Payment pages may set cookies operated by the payment provider under their own policies.

## Children

The Service is intended for working professionals and is not directed at children under 16. We do not knowingly collect data from children.

## Changes

We may update this policy; material changes will be announced in the app. The current version is always available on this page.

## Contact

Privacy questions: **{{email}}**`,x2=`## Our promise

We want you to be happy with InterviewIQ. If a purchase isn't right for you, this policy explains how refunds and cancellations work.

## One-time purchases

- **7-day grace window.** You can request a full refund within 7 days of purchase for any reason — no questions asked.
- After the grace window, refunds are considered on a case-by-case basis (for example, a billing error or a duplicate charge). Repeated refunds for the same account are limited unless approved by our team.

## Subscriptions (monthly & yearly)

- **Cancel anytime** from Account settings. Cancellation stops future renewals; access continues until the end of the paid period you already paid for.
- **No partial refunds** for unused time on a cancelled period, except within the 7-day grace window described above.

## Lifetime plans

- Lifetime plans are covered by the same 7-day grace window.
- After 7 days, lifetime access is non-refundable unless the Service is discontinued; in that case we will provide a pro-rata refund of the remaining value.

## How to request a refund

1. Email **{{email}}** with the subject "Refund request", or use the in-app support channel.
2. Include the email address used for the purchase and the payment reference from your receipt.
3. We review requests within 3 business days. Approved refunds are returned to the original payment method within 5–10 business days, depending on your bank or payment provider.

## Failed or duplicate payments

- If a payment fails, no charge is made and no Pro access is granted; the checkout simply closes.
- If you are charged twice for the same plan, the duplicate charge is refunded automatically on request.

## Payment provider

Payments are processed by Razorpay. Their terms and refund handling also apply to the transaction itself.`,S2=`## Digital product — no physical shipping

{{company}} is a fully digital service. There are no physical goods, so there is no physical shipping, handling or delivery cost.

## How you receive your purchase

- **Access is instant.** When your payment is confirmed, Pro access is activated on your account immediately — typically within seconds.
- **Receipt.** A payment receipt is issued by our payment provider (Razorpay) to the email address you used at checkout.
- **No carrier, no tracking.** Because nothing physical is sent, there is nothing to track and no shipping address is required.

## Delayed delivery

In rare cases (for example, a payment that was captured but whose confirmation event was delayed), access may take a few minutes to appear. If Pro access does not appear within 24 hours of a confirmed payment, email **{{email}}** with your payment reference and we will resolve it — including restoring access from our end.

## International orders

Because the product is digital, the same instant-delivery terms apply to every country. Any applicable taxes or currency conversion are handled by the payment provider at checkout.`,T2={terms:w2,privacy:k2,refunds:x2,shipping:S2},A2={config:null,configBusy:!1,vocabJson:"{}",brandJson:"{}",brandCo:"_default",brandAccent:"#4f46e5",brandFont:"system",jobsHours:24,jobsSources:"",enrProvider:"none",enrCountry:"us",enrCap:30,freqCo:null,activeWeek:null,entitlements:[],payments:[],subscriptions:[],billingAudit:[],coupons:[],billingLoading:!0,billingBusy:!1,cPlan:"monthly",cDays:30,cPct:0,code:"",coCode:"",coPct:20,coMax:0,coExp:"",gPlan:"monthly",gDays:30,dPct:30,dDays:90,open:{},cancelTarget:null,cancelReason:"",refundTarget:null,refundReason:"",refundAmount:"",refundOverride:!1,policyDraft:{...gr},presetsText:(gr.reason_presets??[]).join(", "),policyDocs:{...T2}},Hb=Ry({name:"admin",initialState:A2,reducers:{setConfig(n,i){n.config=i.payload},setConfigBusy(n,i){n.configBusy=i.payload},setVocabJson(n,i){n.vocabJson=i.payload},setBrandJson(n,i){n.brandJson=i.payload},setBrandCo(n,i){n.brandCo=i.payload},setBrandAccent(n,i){n.brandAccent=i.payload},setBrandFont(n,i){n.brandFont=i.payload},setJobsHours(n,i){n.jobsHours=i.payload},setJobsSources(n,i){n.jobsSources=i.payload},setEnrProvider(n,i){n.enrProvider=i.payload},setEnrCountry(n,i){n.enrCountry=i.payload},setEnrCap(n,i){n.enrCap=i.payload},setFreqCo(n,i){n.freqCo=i.payload},setActiveWeek(n,i){n.activeWeek=i.payload},setEntitlements(n,i){n.entitlements=i.payload},setPayments(n,i){n.payments=i.payload},setSubscriptions(n,i){n.subscriptions=i.payload},setBillingAudit(n,i){n.billingAudit=i.payload},setCoupons(n,i){n.coupons=i.payload},setBillingLoading(n,i){n.billingLoading=i.payload},setBillingBusy(n,i){n.billingBusy=i.payload},setCPlan(n,i){n.cPlan=i.payload},setCDays(n,i){n.cDays=i.payload},setCPct(n,i){n.cPct=i.payload},setCode(n,i){n.code=i.payload},setCoCode(n,i){n.coCode=i.payload},setCoPct(n,i){n.coPct=i.payload},setCoMax(n,i){n.coMax=i.payload},setCoExp(n,i){n.coExp=i.payload},setGPlan(n,i){n.gPlan=i.payload},setGDays(n,i){n.gDays=i.payload},setDPct(n,i){n.dPct=i.payload},setDDays(n,i){n.dDays=i.payload},setOpen(n,i){n.open=i.payload},setCancelTarget(n,i){n.cancelTarget=i.payload},setCancelReason(n,i){n.cancelReason=i.payload},setRefundTarget(n,i){n.refundTarget=i.payload},setRefundReason(n,i){n.refundReason=i.payload},setRefundAmount(n,i){n.refundAmount=i.payload},setRefundOverride(n,i){n.refundOverride=i.payload},setPolicyDraft(n,i){n.policyDraft=i.payload},setPresetsText(n,i){n.presetsText=i.payload},setPolicyDocs(n,i){n.policyDocs=i.payload},initBillingData(n,i){n.entitlements=i.payload.entitlements,n.payments=i.payload.payments,n.subscriptions=i.payload.subscriptions,n.billingAudit=i.payload.audit,n.coupons=i.payload.coupons,n.billingLoading=!1}}}),{setConfig:V3,setConfigBusy:J3,setVocabJson:W3,setBrandJson:$3,setBrandCo:X3,setBrandAccent:Z3,setBrandFont:eE,setJobsHours:tE,setJobsSources:nE,setEnrProvider:aE,setEnrCountry:iE,setEnrCap:sE,setFreqCo:rE,setActiveWeek:oE,setEntitlements:lE,setPayments:cE,setSubscriptions:uE,setBillingAudit:dE,setCoupons:pE,setBillingLoading:hE,setBillingBusy:fE,setCPlan:mE,setCDays:gE,setCPct:yE,setCode:bE,setCoCode:vE,setCoPct:wE,setCoMax:kE,setCoExp:xE,setGPlan:SE,setGDays:TE,setDPct:AE,setDDays:qE,setOpen:EE,setCancelTarget:CE,setCancelReason:LE,setRefundTarget:DE,setRefundReason:OE,setRefundAmount:zE,setRefundOverride:jE,setPolicyDraft:ME,setPresetsText:RE,setPolicyDocs:_E,initBillingData:NE}=Hb.actions,q2=U0({reducer:{jobs:Ub.reducer,admin:Hb.reducer}}),Er="inline-flex h-10 items-center justify-center gap-2 rounded-xl font-bold transition-all duration-150 active:scale-[.99] disabled:opacity-45 disabled:cursor-not-allowed",Ed=Er+" grad-bg px-6 py-3 text-white shadow-[0_10px_26px_rgba(99,102,241,.35)] hover:-translate-y-px hover:brightness-110",Cd=Er+" border border-line/20 px-4 py-2 text-sm text-mut hover:bg-wht/10 hover:text-ink",IE=Er+" grad-bg-soft border border-acc1/50 px-4 py-2 text-sm text-acctxt hover:bg-acc1/40",BE=Er+" bg-gradient-to-br from-emerald-600 to-emerald-500 px-6 py-3 text-white shadow-[0_10px_26px_rgba(16,185,129,.3)] hover:-translate-y-px hover:brightness-110",UE=Er+" border border-bad/40 px-4 py-2 text-sm text-bad hover:bg-bad/10",HE=" h-12 px-8 py-4 text-[17px] rounded-2xl",dr=" px-3.5 py-1.5 text-[13px] rounded-lg",Pb="rounded-2xl border border-line/10 bg-gradient-to-b from-panel to-panel2 card-shadow",E2={default:"bg-wht/10 text-mut border-line/10",cat:"bg-acc3/10 text-acc3 border-acc3/30",lvl:"bg-acc2/10 text-acc2 border-acc2/35",co:"bg-acc1/10 text-acctxt border-acc1/35",ok:"bg-ok/10 text-ok border-ok/30",warn:"bg-warn/10 text-warn border-warn/30",bad:"bg-bad/10 text-bad border-bad/35"};function C2({tone:n="default",title:i,children:r}){return b.jsx("span",{title:i,className:`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-bold ${E2[n]}`,children:r})}var L2=_y();function D2({onClose:n,title:i,desc:r,children:o}){return L2.createPortal(b.jsx("div",{className:"anim-fade fixed inset-0 z-[100] grid place-items-center bg-deep/70 p-5 backdrop-blur-sm",onClick:n,children:b.jsxs("div",{className:"anim-pop max-h-[90vh] w-full max-w-[520px] overflow-auto rounded-[20px] border border-line/30 bg-gradient-to-b from-panel to-panel2 p-7 shadow-[0_30px_80px_rgba(0,0,0,.6)]",onClick:u=>u.stopPropagation(),children:[b.jsx("h3",{className:"mb-1 text-xl font-extrabold tracking-tight",children:i}),r&&b.jsx("p",{className:"mb-5 text-sm text-mut",children:r}),o]})}),document.body)}function O2(){const[n,i]=B.useState(!1);return b.jsxs(b.Fragment,{children:[b.jsx("button",{onClick:()=>i(!0),title:"Feedback & early access",className:"rounded-xl border border-line/15 bg-wht/5 px-3 py-1.5 text-[13px] font-bold text-mut transition-all hover:bg-wht/10 hover:text-ink",children:"✉️ Feedback"}),n&&b.jsx(z2,{onClose:()=>i(!1)})]})}function z2({onClose:n}){const[i,r]=B.useState("early"),[o,u]=B.useState(""),[d,p]=B.useState(""),f=()=>{var k;const m=i==="early"?`Early access — ${mt.productName} Pro`:`Feedback — ${mt.productName}`,y=(i==="early"?`Email: ${o}

`:"")+`Message:
${d.trim()||"(no message)"}

---
Sent from ${mt.productName}`,x=`mailto:${mt.supportEmail}?subject=${encodeURIComponent(m)}&body=${encodeURIComponent(y)}`;try{window.location.href=x,bn(i==="early"?"📬 Opening your mail app — thanks for joining the waitlist!":"📬 Opening your mail app — thanks for the feedback!")}catch{(k=navigator.clipboard)==null||k.writeText(`${m}

${y}`).catch(()=>{}),bn("Copied to clipboard — send it to "+mt.supportEmail)}n()};return b.jsxs(D2,{onClose:n,title:i==="early"?"🚀 Get early access to Pro":"💬 Feedback",desc:i==="early"?"Unlimited interviews, all companies, and AI coaching are coming. Leave your email and you'll be first in line.":"Found a bug or want a feature? Tell us — it takes 10 seconds.",children:[b.jsxs("div",{className:"mb-4 flex gap-2",children:[b.jsx(sy,{active:i==="early",onClick:()=>r("early"),children:"Early access"}),b.jsx(sy,{active:i==="feedback",onClick:()=>r("feedback"),children:"Feedback"})]}),i==="early"&&b.jsxs("label",{className:"mb-4 block",children:[b.jsx("span",{className:"mb-1 block text-[12.5px] font-bold text-mut",children:"Your email"}),b.jsx("input",{type:"email",value:o,onChange:m=>u(m.target.value),placeholder:"you@example.com",className:"w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[14px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"})]}),b.jsxs("label",{className:"mb-5 block",children:[b.jsx("span",{className:"mb-1 block text-[12.5px] font-bold text-mut",children:"Message"}),b.jsx("textarea",{value:d,onChange:m=>p(m.target.value),rows:4,placeholder:i==="early"?"What level are you preparing for? (optional)":"Tell us what you'd improve…",className:"w-full resize-y rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[14px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"})]}),b.jsxs("div",{className:"flex gap-3",children:[b.jsx("button",{className:Cd,onClick:n,children:"Cancel"}),b.jsx("button",{className:Ed+dr,onClick:f,disabled:i==="early"&&!o.trim(),children:i==="early"?"Join the waitlist":"Send feedback"})]})]})}function sy({active:n,onClick:i,children:r}){return b.jsx("button",{type:"button",onClick:i,className:`rounded-lg px-3 py-1.5 text-[13px] font-bold transition-all ${n?"grad-bg text-white":"text-mut hover:bg-wht/10 hover:text-ink"}`,children:r})}const PE=[{id:"tutor",label:"Tutor / Explanations",description:"Needs clear, structured prose and patient explanations.",suggestedModel:"claude-3.5-sonnet"},{id:"coach",label:"Interview Coach",description:"Needs concise, specific feedback with good judgment.",suggestedModel:"gpt-4o"},{id:"feedback",label:"Post-Answer Feedback",description:"Needs brief, actionable evaluation.",suggestedModel:"gpt-4o-mini"},{id:"hint",label:"Hints",description:"Needs one short, targeted hint.",suggestedModel:"gpt-4o-mini"},{id:"code",label:"Code Assistant",description:"Needs strong code generation and explanation.",suggestedModel:"codestral-latest"},{id:"embeddings",label:"Embeddings",description:"Must return 1536-dim vectors for pgvector.",suggestedModel:"text-embedding-3-small"}],Gb=H.moduleModels;function ds(){const n=ne(Gb,{});return{default:n.default??Cr(),overrides:n.overrides??{}}}function Yb(n){oe(Gb,n)}function j2(){const n=Cr();return n.key?n:{key:"",base:"https://api.openai.com/v1",model:as().model||"gpt-4o-mini"}}function M2(n){var d;const i=ds(),r=i.overrides[n];if(r!=null&&r.key)return{key:r.key,base:r.base||"https://api.openai.com/v1",model:r.model||i.default.model||"gpt-4o-mini"};const u=(d=as().moduleDefaults)==null?void 0:d[n];return u!=null&&u.model&&i.default.key?{key:i.default.key,base:u.base||i.default.base||"https://api.openai.com/v1",model:u.model}:i.default.key?i.default:j2()}function GE(n,i){const r=ds();r.overrides[n]=i,Yb(r)}function YE(n){const i=ds();delete i.overrides[n],Yb(i)}function QE(){const n=ds();return Object.entries(n.overrides).filter(([,i])=>!!i.key&&!!i.model).map(([i,r])=>({moduleId:i,model:r.model,base:r.base}))}function KE(n){return ds().overrides[n]??null}function FE(n){var r;return!!((r=ds().overrides[n])!=null&&r.key)}async function VE(n){var r;const i=(n.base.trim()||"https://api.openai.com/v1").replace(/\/+$/,"");if(!n.key.trim())return{ok:!1,note:"Enter a key first"};try{const o=await fetch(`${i}/models`,{method:"GET",headers:{Authorization:`Bearer ${n.key.trim()}`}});if(o.ok){if((r=n.model)!=null&&r.trim())try{const u=await o.json(),d=((u==null?void 0:u.data)??[]).map(m=>m.id),p=n.model.trim().toLowerCase();if(!d.some(m=>m.toLowerCase()===p))return{ok:!1,note:`Key accepted, but model "${n.model}" not found. Available: ${d.slice(0,5).join(", ")}${d.length>5?"…":""}`}}catch{}return{ok:!0,note:"Key accepted — provider reachable"}}return o.status===401?{ok:!1,note:"HTTP 401 — key rejected by the provider"}:o.status===402?{ok:!1,note:"HTTP 402 — provider account out of credits"}:o.status===429?{ok:!1,note:"HTTP 429 — rate limited, try again shortly"}:{ok:!1,note:`HTTP ${o.status} from ${i}`}}catch(o){return{ok:!1,note:`Couldn't reach ${i} — ${o.message}`}}}const R2={hint:3,feedback:7,coach:5,deepdive:7,rag:7},_2=7;async function Qb(n){const i=new TextEncoder().encode(n),r=await crypto.subtle.digest("SHA-256",i);return Array.from(new Uint8Array(r)).map(o=>o.toString(16).padStart(2,"0")).join("")}const ry={"gpt-4o":{input:2.5,output:10},"gpt-4o-mini":{input:.15,output:.6},"gpt-4.1-nano":{input:.1,output:.4},"gpt-3.5-turbo":{input:.5,output:1.5},"claude-sonnet-4-20250514":{input:3,output:15},"claude-haiku-3.5":{input:.8,output:4},"gemini-2.5-flash":{input:.3,output:2.5},"gemini-2.5-flash-lite":{input:.1,output:.4}};function N2(n,i,r){const o=ry[n]??ry["gpt-4o-mini"];return(i*o.input+r*o.output)/1e6}async function I2(n,i,r){try{const o=await ie();if(!o)return null;const u=await Qb(`${n}
${i}
${r}`),{data:d,error:p}=await o.from("ai_response_cache").select("response, model, input_tokens, output_tokens").eq("cache_key",u).gt("expires_at",new Date().toISOString()).maybeSingle();return p||!d?null:(Promise.resolve(o.from("ai_response_cache").update({hit_count:d.hit_count?d.hit_count+1:1,last_hit_at:new Date().toISOString()}).eq("cache_key",u)).then(()=>{}).catch(()=>{}),{response:d.response,model:d.model,input_tokens:0,output_tokens:0})}catch{return null}}async function B2(n,i,r,o,u,d,p){try{const f=await ie();if(!f)return;const m=await Qb(`${n}
${i}
${r}`),y=R2[p]??_2,x=new Date(Date.now()+y*864e5).toISOString();await f.from("ai_response_cache").upsert({cache_key:m,module:p,response:o,model:r,input_tokens:u,output_tokens:d,hit_count:0,expires_at:x},{onConflict:"cache_key"})}catch{}}async function oy(n){try{const i=await ie();if(!i)return;const r=n.cached?0:N2(n.model,n.inputTokens,n.outputTokens);await i.from("ai_cost_log").insert({user_id:n.userId??null,module:n.module,model:n.model,input_tokens:n.inputTokens,output_tokens:n.outputTokens,estimated_cost:r,cached:n.cached,latency_ms:n.latencyMs??0,error:n.error??!1})}catch{}}const ly={free:5,pro:15,admin:999};async function U2(n,i,r){try{const o=await ie();if(!o)return{allowed:!0,remaining:999};const u=new Date(Math.floor(Date.now()/6e4)*6e4).toISOString(),d=ly[r]??ly.free,{data:p}=await o.from("ai_rate_limits").select("call_count").eq("user_id",n).eq("module",i).eq("window_start",u).maybeSingle(),f=(p==null?void 0:p.call_count)??0;if(f>=d)return{allowed:!1,remaining:0};try{await o.rpc("increment_rate_limit",{p_user_id:n,p_module:i,p_window:u})}catch{await o.from("ai_rate_limits").upsert({user_id:n,module:i,window_start:u,call_count:f+1},{onConflict:"user_id,module,window_start"})}return{allowed:!0,remaining:d-f-1}}catch{return{allowed:!0,remaining:999}}}const H2="https://api.openai.com/v1",Kb="gpt-4o-mini";function P2(){return as().model||Kb}function Cr(){return{key:ne(H.apiKey,""),base:ne(H.apiBase,H2),model:ne(H.apiModel,P2())}}function JE(n){oe(H.apiKey,n.key.trim()),oe(H.apiBase,n.base.trim().replace(/\/+$/,"")),oe(H.apiModel,n.model.trim()||Kb)}function WE(){ns(H.apiKey)}function Ld(){return!!Cr().key}const G2={hint:120,feedback:500,coach:400,deepdive:600,rag:500},Y2=["gpt-4o-mini","gemini-2.5-flash","gemini-2.5-flash-lite","gpt-4.1-nano"];async function Fb(n,i,r={}){var O,_,T,G,N,I,Y,F;if(!n.key)throw new Error("No API key configured");const o=r.module??"general",u=((O=i.find(K=>K.role==="system"))==null?void 0:O.content)??"",d=((_=i.find(K=>K.role==="user"))==null?void 0:_.content)??"",p=Math.min(r.maxTokens??as().maxTokens??700,G2[o]??700),f=r.temperature??as().temperature??.6,m=At().user;if(m){const K=os();if(!(await U2(m.id,o,K)).allowed)throw new Error(`Rate limit exceeded for ${o}. Please wait a moment and try again.`)}const y=Date.now(),x=await I2(u,d,n.model);if(x)return oy({module:o,model:x.model,inputTokens:0,outputTokens:0,cached:!0,latencyMs:Date.now()-y}),x.response;const k=[n.model,...Y2.filter(K=>K!==n.model)];let L="";for(const K of k)try{const P=await fetch(n.base+"/chat/completions",{method:"POST",signal:r.signal,headers:{"Content-Type":"application/json",Authorization:"Bearer "+n.key},body:JSON.stringify({model:K,messages:i,temperature:f,max_tokens:p})});if(P.status===429||P.status>=500){try{L=((T=(await P.json()).error)==null?void 0:T.message)||`HTTP ${P.status}`}catch{L=`HTTP ${P.status}`}continue}if(!P.ok){let Z="AI request failed ("+P.status+")";try{Z=((G=(await P.json()).error)==null?void 0:G.message)||Z}catch{}throw new Error(Z)}const ue=await P.json(),ae=(((Y=(I=(N=ue.choices)==null?void 0:N[0])==null?void 0:I.message)==null?void 0:Y.content)||"").trim(),ce=ue.usage??{},de=ce.prompt_tokens??Math.ceil((u.length+d.length)/4),J=ce.completion_tokens??Math.ceil(ae.length/4);return B2(u,d,K,ae,de,J,o),oy({module:o,model:K,inputTokens:de,outputTokens:J,cached:!1,latencyMs:Date.now()-y}),ae}catch(P){if(L=P.message,(F=r.signal)!=null&&F.aborted)throw P;continue}throw new Error(`AI request failed after trying ${k.length} models: ${L}`)}async function ai(n,i={}){const r=Cr();if(!r.key&&i.module)return Q2(n,i);if(!r.key)throw new Error("No API key configured");return Fb(r,n,i)}async function Q2(n,i){var f;const r=await ie();if(!r||!At().user)throw new Error("Sign in or add your own API key to use AI.");const{data:o}=await r.auth.getSession(),u=(f=o==null?void 0:o.session)==null?void 0:f.access_token;if(!u)throw new Error("Sign in or add your own API key to use AI.");const d=await fetch(`${mt.supabase.url}/functions/v1/ai-chat`,{method:"POST",signal:i.signal,headers:{"Content-Type":"application/json",Authorization:`Bearer ${u}`},body:JSON.stringify({module:i.module,messages:n,temperature:i.temperature,maxTokens:i.maxTokens})}),p=await d.json().catch(()=>({}));if(!d.ok)throw new Error(p.error??"AI request failed");return p.text??""}async function $E(n,i,r={}){const o=M2(n);return Fb(o,i,r)}async function XE(n){if(!eb())throw new Error("AI coaching is temporarily disabled — the offline engine still scores your answers.");if(Vd()&&Jd()<=0)throw new Error("You've used your free AI feedback for today — upgrade to Pro for unlimited coaching.");const i="Senior interviewer at "+(n.companyName||"a top tech company")+" for "+n.levelName+" "+n.fieldName+". Give concise actionable feedback. ~200 words max. Score /10, strongest parts, key gaps, one tip.",r="Q: "+n.question+`
A: `+(n.userAnswer||"(empty)")+`
Evaluate score, strengths, gaps for this level, one improvement tip.`,o=await ai([{role:"system",content:i},{role:"user",content:r}],{maxTokens:500,module:"feedback"});return Ar(),sn("ai_call",{pct:n.userAnswer.length}),o}async function ZE(n,i){if(!eb())throw new Error("AI coaching is temporarily disabled.");if(Vd()&&Jd()<=0)throw new Error("You've used your free AI hints for today — upgrade to Pro for unlimited coaching.");const r="Interview coach. ONE hint under 60 words for "+i+" candidate. Do not give the full answer.",o=await ai([{role:"system",content:r},{role:"user",content:"Q: "+n}],{maxTokens:120,temperature:.8,module:"hint"});return Ar(),sn("ai_call",{hint:!0}),o}const K2={"http basics":{concept:"HTTP Basics",beginner:"HTTP (HyperText Transfer Protocol) is how browsers talk to servers. You send a request (GET, POST, PUT, DELETE) and get a response with a status code (200 OK, 404 Not Found, 500 Error). Every web app uses HTTP under the hood.",intermediate:"HTTP/1.1 opens a new TCP connection per request (slow). HTTP/2 multiplexes multiple requests over one connection (faster). HTTP/3 uses QUIC/UDP for even lower latency. Status codes matter: 301 = permanent redirect (cached), 302 = temporary (tracks analytics).",advanced:"For high-throughput systems, HTTP keep-alive reduces connection overhead. Connection pooling (nginx upstream) avoids exhausting server ports. HTTP/2 server push can pre-load resources. At scale, you'll choose between REST, gRPC (binary, faster), or WebSocket (persistent connection) based on latency and throughput needs.",caseStudyContext:{"url-shortener":"HTTP basics are critical here: the shortener returns 301 (permanent redirect, browser caches it) vs 302 (temporary redirect, you track analytics). At 100M URLs/day with 10:1 read:write, you're handling 12K HTTP redirect requests per second. Each must complete in <100ms.","news-feed":"The news feed API uses HTTP GET for fetching feeds, POST for creating posts. Feed endpoints are read-heavy (9:1 ratio). HTTP caching headers (ETag, Cache-Control) help clients avoid re-fetching unchanged feeds."}},websockets:{concept:"WebSockets",beginner:"WebSockets create a persistent two-way connection between browser and server. Unlike HTTP (where the browser asks and server responds), both sides can send messages anytime. This is how chat apps, live games, and real-time notifications work.",intermediate:"WebSockets upgrade from HTTP to a persistent TCP connection. After the initial handshake, data flows bidirectionally with minimal overhead (~2 bytes framing vs ~800 bytes for HTTP headers). They survive across network changes (Wi-Fi ↔ cellular) via reconnection logic. Server must handle millions of concurrent WS connections — each uses ~10KB memory.",advanced:"WebSocket servers need sticky sessions (route same client to same server) or a message broker (Kafka/Redis Pub-Sub) to fan out messages across server instances. Heartbeat pings detect dead connections. For global scale, use a WebSocket gateway (like Pusher, Ably, or self-hosted with Socket.IO + Redis Adapter). Connection limits: a single node handles ~500K-1M WS connections with proper tuning (epoll, kernel buffer sizes).",caseStudyContext:{"chat-system":"WebSockets are the backbone of WhatsApp/Slack. Each user maintains a persistent WS connection to a chat server. Messages flow: User A → WS → Chat Server → WS → User B. At 50M daily active users with 5 concurrent connections each, you need 250M concurrent WS connections across your fleet. Message ordering uses sequence numbers per conversation."}},"load balancing":{concept:"Load Balancing",beginner:"A load balancer distributes incoming traffic across multiple servers so no single server gets overwhelmed. Think of it like a restaurant host directing guests to different tables. If one server goes down, the load balancer stops sending traffic to it.",intermediate:"Common algorithms: Round Robin (simple), Least Connections (smarter), IP Hash (sticky sessions). L4 load balancers (HAProxy, AWS NLB) work at TCP level — fast but can't inspect content. L7 load balancers (nginx, AWS ALB) work at HTTP level — can route by URL path, headers, or cookies. Health checks detect dead servers every few seconds.",advanced:"At scale: global load balancing uses DNS (Route 53, Cloudflare) to route users to the nearest data center. Within a data center, use L7 for HTTP routing + L4 for raw TCP. Connection draining during deployments ensures in-flight requests complete. Consistent hashing minimizes redistribution when servers are added/removed. Two-tier LB: DNS → regional L4 → per-service L7.",caseStudyContext:{"url-shortener":"Load balancer sits between CDN edge and API servers. Distributes 1.2K writes/s and 12K reads/s across multiple API instances. Health checks remove unhealthy servers. For the redirect path, L4 LB is sufficient (just routing TCP). For the create-URL path, L7 LB enables routing by HTTP method.","news-feed":"Feed reads go through L7 LB to route to the correct feed service shard (based on user ID hash). Write path (post creation) goes through a separate LB to the write service. This read/write separation prevents write-heavy operations from starving read performance."}},caching:{concept:"Caching",beginner:"Caching stores frequently accessed data in fast storage (like RAM) so you don't have to fetch it from the slow database every time. Like keeping your most-used tools on your desk instead of in a closet across the building.",intermediate:"Cache strategies: Cache-Aside (app checks cache first, then DB), Read-Through (cache fetches from DB automatically), Write-Through (writes go to cache + DB simultaneously), Write-Behind (writes to cache first, async to DB). Cache invalidation is hard — time-based TTL, event-based, or versioned keys. Redis is the go-to in-memory cache (100K+ reads/s).",advanced:"Cache stampede: when a popular key expires, hundreds of requests hit the DB simultaneously. Solutions: mutex locks, probabilistic early expiration, stale-while-revalidate. Multi-tier caching: L1 (in-process, ~1ns), L2 (Redis, ~1ms), L3 (CDN, ~10ms). Cache coherence across regions requires async invalidation (Kafka events). Hot key problem: one key gets 100K+ QPS — replicate the key across multiple Redis shards.",caseStudyContext:{"url-shortener":"Redis cache holds hot URLs — 80% hit rate means only 20% of reads hit the database. At 12K reads/s, cache serves ~9.6K/s, DB handles ~2.4K/s. TTL: URLs expire after 5 years. Cache key: short_code → long_url. Eviction: LRU when Redis memory is full.","news-feed":"Feed caching is critical — pre-computed feeds stored in Redis. Fan-out on write: when a user posts, push to all followers' cached feeds. Cache key: user_id → feed array. TTL: 5 minutes. Cache-aside for user profiles. Cache invalidation via Kafka events when profiles update.","chat-system":"Redis caches recent messages (last 50 per conversation). After initial load, new messages arrive via WebSocket. Cache key: conversation_id → message array. TTL: 1 hour. Hot conversations (group chats with 1000+ members) need replicated cache entries."}},"database design":{concept:"Database Design",beginner:"Database design is how you organize data in tables. A relational database (PostgreSQL, MySQL) stores data in rows and columns with relationships between tables. A NoSQL database (MongoDB, DynamoDB) stores flexible documents without strict relationships.",intermediate:"Choose relational for: ACID transactions, complex queries (JOINs), data integrity. Choose NoSQL for: horizontal scaling, flexible schema, high write throughput. Schema design matters: normalize for writes (avoid duplication), denormalize for reads (avoid JOINs). Indexes speed up reads but slow down writes.",advanced:"Sharding: split data across multiple DB nodes by key (user_id, region). Consistent hashing minimizes data movement. Replication: leader-follower (read replicas) or multi-leader (conflict resolution). Partitioning: range-based (by date) or hash-based (by ID). CAP theorem: you pick 2 of 3 (Consistency, Availability, Partition tolerance). For globally distributed: use CockroachDB/Spanner (strong consistency) or Cassandra (eventual consistency, high availability).",caseStudyContext:{"url-shortener":"Relational DB (Postgres) for URL mappings — ACID ensures unique short codes. Schema: (short_code VARCHAR(7) PK, long_url TEXT, created_at, expires_at). NoSQL alternative: DynamoDB for 100M+ URLs with simple key-value lookups. Sharding by short_code prefix for horizontal scaling.","news-feed":"Social graph in Neo4j or adjacency list in Postgres. Feed storage in Redis (pre-computed). User data in PostgreSQL. Post content in S3 with metadata in DynamoDB. Sharding by user_id for horizontal scaling."}},hashing:{concept:"Hashing",beginner:"Hashing converts any input into a fixed-size string (like a fingerprint). The same input always produces the same output. Used for: password storage (can't reverse it), data integrity checks, and generating unique IDs.",intermediate:"Hash functions: MD5 (fast, collision-prone — don't use for security), SHA-256 (secure, slower), MurmurHash (fast, good for hash tables). Consistent hashing: maps both servers and keys to a ring — when a server is added/removed, only nearby keys move. Load balancing: hash(client_ip) → route to same server (sticky sessions).",advanced:"Hash collisions: birthday paradox means 2^32 inputs → 50% collision chance at ~77K entries. Bloom filters use multiple hash functions for probabilistic membership tests (no false negatives). Hash rings with virtual nodes (150 per physical server) ensure even distribution. Cryptographic hashing (bcrypt/scrypt) for passwords — adds salt and slow computation to resist brute force.",caseStudyContext:{"url-shortener":"Base62 encoding of auto-increment ID or MD5 hash of long URL → first 7 chars. Collision handling: if short code exists, append random suffix. Hash ring distributes URL data across DB shards. 7 chars base62 = 3.5 trillion unique codes — enough for 100M URLs/day × 5 years."}},"message queues":{concept:"Message Queues",beginner:"A message queue is like a mailbox — one system drops off a message, another picks it up later. This decouples services: the sender doesn't wait for the receiver. If the receiver is down, messages pile up in the queue until it's back.",intermediate:"Popular queues: Kafka (append-only log, replay, high throughput), RabbitMQ (traditional queue, routing, acknowledgments), SQS (managed, serverless). Patterns: Point-to-Point (one consumer), Publish-Subscribe (many consumers). At-least-once delivery (might duplicate), at-most-once (might lose), exactly-once (hard, usually achieved via idempotency).",advanced:"Kafka partitioning: messages with same key go to same partition (ordering guarantee). Consumer groups: multiple consumers read from different partitions in parallel. Backpressure: when consumers fall behind, queue grows — monitor lag. Dead letter queue: messages that fail N times go here for investigation. Exactly-once: Kafka 0.11+ with idempotent producers + transactional consumers. Schema registry (Avro/Protobuf) ensures producer/consumer compatibility.",caseStudyContext:{"chat-system":"Kafka as the message backbone: each conversation is a partition. Messages append to the partition in order. Consumer groups handle fan-out to multiple recipients. Message ordering: sequence numbers per conversation. WhatsApp uses XMPP protocol over WebSocket → message queue → recipient's WebSocket.","news-feed":"Kafka ingests new posts. Fan-out service reads from Kafka, pushes to each follower's pre-computed feed in Redis. Write amplification: 1 post to 1000 followers = 1000 Redis writes. Kafka retention: 7 days. Consumer lag monitoring ensures feeds stay fresh."}},"social graphs":{concept:"Social Graphs",beginner:"A social graph is a map of who follows whom. Like a web of connections — you're connected to your friends, who are connected to their friends. In Twitter, your feed = posts from people you follow. In Facebook, your feed = posts from friends + friends of friends.",intermediate:"Storage options: Adjacency list in Postgres (follows table: follower_id, followee_id). Graph database (Neo4j) for complex traversals. Fan-out on write: pre-compute feeds. Fan-out on read: compute feeds at query time. Celebrity problem: accounts with millions of followers can't push to all followers.",advanced:"Hybrid approach: fan-out on write for regular users, fan-out on read for celebrities (10M+ followers). Celebrity's posts fetched at read time and merged with pre-computed feed. Graph partitioning: divide by geography or user_id range. Bidirectional edges for follow-back detection. Graph algorithms: PageRank for feed ranking, community detection for recommendations.",caseStudyContext:{"news-feed":"Social graph stored as adjacency list in Postgres. Read-heavy: 9:1 read:write ratio. Fan-out on write for users with <10K followers. Fan-out on read for celebrity accounts. Graph traversal: get followers list → fetch their recent posts → rank by time/engagement → return top 100."}},"database sharding":{concept:"Database Sharding",beginner:"Sharding is splitting one big database into smaller pieces (shards) spread across multiple servers. Like splitting a phone book by first letter — A-H on server 1, I-P on server 2, Q-Z on server 3. Each server handles a subset of data.",intermediate:"Sharding strategies: Hash-based (hash(user_id) → shard number), Range-based (user_id 1-1M → shard 1), Directory-based (lookup table maps keys to shards). Challenges: cross-shard queries (JOINs across shards), rebalancing when adding shards, hot spots (one shard gets 80% of traffic). Shard key choice is critical — can't change later.",advanced:"Consistent hashing with virtual nodes: minimizes data movement when shards are added/removed. Resharding: online resharding with dual-write during migration. Cross-shard transactions: 2-phase commit (slow) or Saga pattern (compensating transactions). Shard-by-access-pattern: different sharding for reads vs writes. Vitess (MySQL sharding), CockroachDB (auto-sharding), Citus (PostgreSQL sharding).",caseStudyContext:{"url-shortener":"Shard URL table by short_code hash. At 180B rows (5 years of 100M/day), need ~100 shards at 1.8B rows each. Read path: hash(short_code) → shard → single lookup. Write path: hash(short_code) → shard → insert. Cross-shard: not needed (each URL maps to one shard)."}},"rate limiting":{concept:"Rate Limiting",beginner:"Rate limiting restricts how many requests a user can make in a time window. Like a bouncer at a club — if too many people try to enter, some get turned away. This prevents abuse and keeps the system stable.",intermediate:"Algorithms: Fixed Window (count per minute — easy but bursty), Sliding Window Log (timestamps in a sorted set — precise but memory-heavy), Sliding Window Counter (weighted blend — good balance), Token Bucket (tokens refill at fixed rate — smooth). Implement at API gateway (Kong, nginx) or application level. Return 429 Too Many Requests with Retry-After header.",advanced:"Distributed rate limiting: Redis + Lua script for atomic counter operations across multiple API servers. Per-user, per-IP, per-API-key limits. Tiered limits: free tier 100/hour, pro tier 10K/hour. Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset. Adaptive rate limiting: lower limits during high load. Circuit breaker pattern: when downstream is struggling, fail fast instead of piling on.",caseStudyContext:{"url-shortener":"Rate limit URL creation: 10 requests/minute per API key to prevent abuse. Sliding window counter in Redis. For the redirect path: no rate limit needed (reads are cheap). For abuse prevention: IP-based rate limiting on create endpoint.","api-gateway":"Rate limiting is the core feature. Multiple strategies per route: fixed window for simple APIs, token bucket for bursty workloads. Distributed counters in Redis. Rate limit headers in every response. Per-client quotas tracked in database."}},"event-driven architecture":{concept:"Event-Driven Architecture",beginner:"Instead of services calling each other directly, they emit events (like 'order placed') and other services react to those events. Like a newspaper — publish once, many people read it. This decouples services: the order service doesn't need to know about the inventory service.",intermediate:"Event sources: Kafka (durable log, replay), RabbitMQ (traditional queue), AWS EventBridge (serverless). Event patterns: Event Sourcing (store all events, rebuild state), CQRS (separate read/write models), Saga (distributed transactions via events). Idempotency: handle duplicate events gracefully (event ID + dedup table).",advanced:"Event schema evolution: use Avro/Protobuf with schema registry for backward compatibility. Event ordering: partition by entity ID (e.g., order_id) ensures events for same entity are processed in order. Event sourcing: store events as source of truth, derive current state by replaying. Dual-write problem: publishing event + writing DB isn't atomic — use Outbox pattern (write event to DB table, Kafka Connect reads it).",caseStudyContext:{"chat-system":"Every message is an event: {conversation_id, sender_id, content, timestamp}. Kafka topic per conversation partition. Event ordering: sequence numbers per conversation. Read receipts, typing indicators — all events. Event sourcing: replay conversation history from events.","news-feed":"Post creation emits event → fan-out service pushes to followers' feeds. Profile update event → invalidate cached profile. Like/comment events → update engagement counts. Event-driven cache invalidation across the system."}},"long polling":{concept:"Long Polling",beginner:"Long polling is a way to get real-time updates without WebSockets. The client sends a request, and the server holds it open until new data is available (or a timeout). Then the client immediately sends another request. It's like calling a friend and staying on the line until they have news.",intermediate:"How it works: Client sends GET → Server holds connection → Server sends response when data available or after timeout (30s) → Client immediately reconnects. Downside: each hold uses a server thread/connection. Better than regular polling (client asks every 5s) but worse than WebSockets (one persistent connection). Used as a fallback when WebSockets aren't available (corporate firewalls).",advanced:"Long polling at scale: server needs async I/O (Node.js, Go goroutines) to hold thousands of connections. Connection pooling: reuse TCP connections. Timeout management: balance between freshness (short timeout) and server load (fewer reconnections). Fallback chain: WebSocket → Long Polling → Short Polling. Server-Sent Events (SSE) is a simpler alternative for server→client only.",caseStudyContext:{"chat-system":"Long polling as fallback when WebSockets fail (corporate proxy blocks WS). Server holds connection for 30s, returns pending messages or empty response. Client reconnects immediately. Used by WhatsApp as backup transport. Less efficient than WebSockets but works everywhere."}},"pub-sub":{concept:"Publish-Subscribe",beginner:"Pub-sub is a messaging pattern where publishers send messages to topics, and subscribers receive messages from topics they're interested in. Like a YouTube channel — the creator publishes a video, subscribers get notified. Publishers don't know who's listening.",intermediate:"Implementation: Kafka (durable, ordered, replay), Redis Pub/Sub (lightweight, no persistence), AWS SNS (managed, fan-out). Topic-based routing: messages go to topics, subscribers choose topics. Fan-out: one message → multiple subscribers. Consumer groups: multiple instances of same service share the load.",advanced:"Kafka topics with partitions: each partition is ordered, partitions are parallel. Consumer groups: each partition consumed by one consumer in the group. Schema evolution: Avro schemas with compatibility checks. Dead letter queues: failed messages routed for investigation. Exactly-once semantics: idempotent producers + transactional consumers. Multi-datacenter: MirrorMaker 2 replicates topics across clusters.",caseStudyContext:{"pub-sub-system":"The system itself: publishers send messages to topics, subscribers receive them. Topic partitioning for scale. Message ordering within partition. Fan-out: one message → N subscribers. Persistence: Kafka retains messages for configurable duration. Consumer groups for horizontal scaling of subscribers."}},"rest api":{concept:"REST API",beginner:"REST APIs use HTTP methods (GET, POST, PUT, DELETE) to perform operations on resources. Like a URL-based interface: GET /users/123 gets user 123, POST /users creates a new user. Responses are usually JSON.",intermediate:"REST conventions: resource naming (/users, /orders), HTTP status codes (200 OK, 201 Created, 404 Not Found, 422 Validation Error), pagination (offset/limit or cursor-based), versioning (/v1/users). Authentication: API keys, OAuth2, JWT tokens. Rate limiting per API key.",advanced:"API design at scale: HATEOAS (hypermedia links in responses), field filtering (?fields=name,email), bulk operations (POST /users/batch), idempotency keys for safe retries. OpenAPI spec for documentation. API gateway (Kong, AWS API Gateway) for auth, rate limiting, request transformation. GraphQL alternative: single endpoint, flexible queries, but caching is harder.",caseStudyContext:{"url-shortener":"REST API: POST /shorten {long_url} → {short_code, short_url}. GET /:short_code → 301/302 redirect to long_url. GET /stats/:short_code → analytics. Rate limit headers in every response. JSON responses. API versioning: /v1/shorten."}},microservices:{concept:"Microservices",beginner:"Instead of one big application (monolith), you split it into small independent services. Each service does one thing well and talks to others via APIs or messages. Like a restaurant: chef, waiter, cashier — each has a role, they coordinate.",intermediate:"Benefits: independent deployment, technology diversity, fault isolation. Challenges: network latency, data consistency, debugging (distributed tracing). Service discovery: how services find each other (Consul, Eureka). API gateway: single entry point for clients. Inter-service communication: sync (HTTP/gRPC) or async (Kafka).",advanced:"Domain-Driven Design: services aligned to business domains. Saga pattern for distributed transactions (choreography vs orchestration). Circuit breaker (Hystrix/Resilience4j) prevents cascade failures. Distributed tracing (Jaeger, Zipkin) for debugging. Service mesh (Istio, Linkerd) for observability, traffic management, security. Container orchestration (Kubernetes) for deployment and scaling.",caseStudyContext:{"api-gateway":"The API gateway IS the microservices pattern: one entry point routing to many backend services. Rate limiting, authentication, request transformation, response aggregation. Each backend service handles its domain (users, orders, payments). Gateway routes by path (/users → user-service, /orders → order-service)."}},"consistent hashing":{concept:"Consistent Hashing",beginner:"When you add or remove servers, regular hashing (hash(key) % num_servers) moves almost every key. Consistent hashing puts servers and keys on a ring — each key maps to the nearest server clockwise. Adding a server only moves keys between two servers.",intermediate:"Problem with simple hash % N: adding one server moves ~all keys. Consistent hashing: both servers and keys placed on a ring (0 to 2^32). Key → walk clockwise → first server you hit. Adding server → only keys between new server and previous server move. Removing server → its keys move to next server.",advanced:"Virtual nodes: each physical server gets 100-200 virtual positions on the ring. This distributes load evenly (without vnodes, some servers get 2x load). Amazon Dynamo uses consistent hashing. Implementation: jump consistent hash (Google, fastest), rendezvous hashing (highest random weight). Used in: Cassandra (data placement), DynamoDB, Memcached (client-side sharding), CDNs.",caseStudyContext:{"url-shortener":"Consistent hashing distributes URL data across DB shards. Short code hash → shard. Adding a shard: only ~1/N of keys move. Used for Redis cache sharding too. Virtual nodes ensure even distribution even with few shards."}}};function F2(n,i){const r=n.toLowerCase().trim(),o=K2[r];return o?{beginner:o.beginner,intermediate:o.intermediate,advanced:o.advanced,context:i?o.caseStudyContext[i]:void 0}:null}const V2="text-embedding-3-small";function J2(){return as().embeddingsModel||V2}function W2(n){return Math.ceil(n.replace(/\s+/g," ").length/4)}function $2(n,i=2400,r=240){const o=n.replace(/\s+/g," ").trim();if(!o)return[];const u=[];let d=0,p=0;for(;d<o.length;){let f=Math.min(d+i,o.length);if(f<o.length){const y=o.slice(Math.max(0,f-160),f),x=Math.max(y.lastIndexOf(". "),y.lastIndexOf("? "),y.lastIndexOf(`
`));x>80&&(f=f-160+x+1)}const m=o.slice(d,f).trim();if(m&&u.push({index:p++,content:m,tokens:W2(m)}),f>=o.length)break;d=Math.max(f-r,d+1)}return u}function eC(n,i=2400,r=240){const o=String(n||"");if(!o.trim())return[];const u=o.split(/(?=^\s*(?:#{1,6}\s+[^\n]{2,90}|\d{1,2}(?:\.\d{1,2}){0,2}[.)]?\s+[A-Z][A-Za-z0-9 &/()'-]{3,60})\s*$)/m),d=[];let p=0;for(const f of u)if(f.trim())for(const m of $2(f,i,r))d.push({index:p++,content:m.content,tokens:m.tokens});return d}function cy(n){let i=2166136261;const r=String(n||"");for(let o=0;o<r.length;o++)i^=r.charCodeAt(o),i=Math.imul(i,16777619);return(i>>>0).toString(36)}function tC(n,i){const r=new Set(n.map(cy)),o=[];for(let u=0;u<i.length;u++)r.has(cy(i[u]))||o.push(u);return o}async function X2(n){var d;const i=Cr();if(!i.key)throw new Error("No API key configured");const r=await fetch(i.base+"/embeddings",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+i.key},body:JSON.stringify({model:J2(),input:n})});if(!r.ok){let p="Embeddings request failed ("+r.status+")";try{p=((d=(await r.json()).error)==null?void 0:d.message)||p}catch{}throw new Error(p)}const u=((await r.json()).data??[]).map(p=>p.embedding??[]);if(u.length!==n.length)throw new Error("Embeddings response count mismatch");return u}const Dd=new Set;let yr={ready:!1,isAdmin:!1};function ya(n){yr={...yr,...n};for(const i of Dd)try{i(yr)}catch{}}function Z2(){return yr}function eT(n){return Dd.add(n),n(yr),()=>{Dd.delete(n)}}async function Vb(n){const[{data:i},{data:r},{data:o}]=await Promise.all([n.from("app_config").select("key, value"),n.from("announcements").select("id, title, body, badge, published, created_at").order("created_at",{ascending:!1}),n.from("published_questions").select("id, field_id, level, question, answer, key_points, published, updated_at")]);if(i){const u={features:{},ai:{},limits:{}};for(const d of i)d.key==="features"&&d.value&&(u.features={...u.features,...d.value}),d.key==="ai"&&d.value&&(u.ai={...u.ai,...d.value}),d.key==="limits"&&d.value&&(u.limits={...u.limits,...d.value}),d.key==="company_freq"&&d.value&&(u.companyFreq={...u.companyFreq,...d.value}),d.key==="coach_vocab"&&d.value&&(u.coachVocab=d.value),d.key==="rag"&&d.value&&(u.rag={...u.rag,...d.value}),d.key==="policies"&&d.value&&(u.policies={...u.policies??{},...d.value});Xk(u)}r&&tx(r.map(u=>({id:u.id,title:u.title,body:u.body,badge:u.badge,published:u.published,createdAt:new Date(u.created_at).getTime()}))),o&&ix(o.map(u=>({id:u.id,fieldId:u.field_id,level:u.level,question:u.question,answer:u.answer,keyPoints:u.key_points??[],published:u.published,updatedAt:u.updated_at??null})))}async function tT(){const n=await ie();if(!n)return;await Vb(n),Ud(Pn().coachVocab),ya({ready:!0});const{data:i}=await n.auth.getUser();if(i!=null&&i.user){const{data:r}=await n.rpc("is_admin");ya({isAdmin:!!r})}else ya({isAdmin:!1})}let cd=null;function nT(){return cd||(cd=(async()=>{const n=await ie();if(!n){ya({ready:!0,isAdmin:!1});return}try{await Vb(n),Ud(Pn().coachVocab),ya({ready:!0});const{data:i}=await n.auth.getUser();if(i==null?void 0:i.user){const{data:o,error:u}=await n.rpc("is_admin");ya({isAdmin:!!o&&!u}),vb().catch(()=>{}),sn("app_open",{}),await bb().catch(()=>{})}else ya({isAdmin:!1})}catch{ya({ready:!0,isAdmin:!1})}})()),cd}function nC(){var i,r;const n=(r=(i=At().user)==null?void 0:i.email)==null?void 0:r.trim().toLowerCase();return!!n&&!0&&n===mt.ownerEmail.trim().toLowerCase()}async function aT(){const n=await ie();if(!n)return[];const{data:i,error:r}=await n.from("pdf_documents").select("id, title, source, char_count, chunk_count, created_at").order("created_at",{ascending:!1});return r?[]:i??[]}async function aC(n){const i=await ie();if(!i)throw new Error("Cloud not configured");const{data:r,error:o}=await i.from("pdf_documents").insert({title:n.title,source:n.source??"",char_count:n.charCount,chunk_count:0}).select("id").single();if(o)throw new Error(o.message);return r.id}async function iC(n){const i=await ie();if(!i)throw new Error("Cloud not configured");const{error:r}=await i.from("pdf_chunks").insert(n.map(o=>({document_id:o.documentId,chunk_index:o.index,content:o.content,token_count:o.tokens,embedding:o.embedding})));if(r)throw new Error(r.message)}async function sC(n,i){const r=await ie();r&&await r.from("pdf_documents").update({chunk_count:i}).eq("id",n)}async function rC(n){const i=await ie();if(!i)throw new Error("Cloud not configured");const{error:r}=await i.from("pdf_documents").delete().eq("id",n);if(r)throw new Error(r.message)}async function oC(n){const i=await ie();if(!i)return[];const{data:r,error:o}=await i.from("pdf_chunks").select("chunk_index, content, embedding").eq("document_id",n).order("chunk_index",{ascending:!0});return o?[]:(r??[]).map(u=>({chunkIndex:u.chunk_index,content:u.content,embedding:u.embedding}))}async function lC(n){const i=await ie();i&&await i.from("pdf_chunks").delete().eq("document_id",n)}async function cC(n,i){const r=await ie();if(!r)return;const o={};i.charCount!==void 0&&(o.char_count=i.charCount),await r.from("pdf_documents").update(o).eq("id",n)}async function iT(n,i=4){const r=await ie();if(!r)return[];const{data:o,error:u}=await r.rpc("match_pdf_chunks",{query_embedding:n,match_count:i});return u||!o?[]:o.map(d=>({documentId:d.document_id,content:d.content,similarity:d.similarity}))}const kl=.45,sT=24,lp=4,xl=.85;function Jb(){return gl().minSim??kl}function Wb(){return gl().candidatePool??sT}function $b(){return gl().hardFloor??xl}function uC(){return gl().digest??{}}const rT=n=>{const i=new Date(n);return`${i.getFullYear()}-${String(i.getMonth()+1).padStart(2,"0")}-${String(i.getDate()).padStart(2,"0")}`};function oT(n){if(typeof window>"u")return!1;const i=rT(Date.now());if(ne(H.ragGapNotif,"")===i)return!1;oe(H.ragGapNotif,i);const r=String(n||"").slice(0,90);return wl("🧠 No knowledge-base match",`“${r}” isn't in the product knowledge base — this answer comes from general knowledge. Suggest adding it and it'll show up after review.`),!0}function lT(n,i){try{sn("topic_suggestion",{topic:String(n||"").slice(0,300),field:(i==null?void 0:i.field)??null,level:(i==null?void 0:i.level)??null})}catch{}}function ul(){return{minSim:Jb(),pool:Wb(),hardFloor:$b()}}function Xb(n){const i=String(n||""),r=[i],o=new Set;let u=0;for(const d of Hn(i))for(const p of zk(d)){const f=p.toLowerCase();if(!o.has(f)&&!i.toLowerCase().includes(f)&&(o.add(f),r.push(p),++u>=10))return r.join(" ")}return r.join(" ")}function kr(n,i){const r=ei(n),o=ei(i);let u=0;for(const p of r)o.has(p)&&u++;const d=Id(n,i);return Math.min(1,(u+2*d)/6)}function cT(n,i,r){return .6*r+.4*kr(n,i)}function cp(n,i,r=kl,o=xl){return n>=r&&(i>0||n>=o)}function uT(n,i,r=kl,o=xl){let u=0,d=0,p=0;for(const f of n){if(f.similarity<r){p++;continue}cp(f.similarity,kr(i,f.content),r,o)?u++:d++}return{groundedCount:u,gateRejects:d,belowMin:p}}function dT(n,i,r=lp,o=kl,u=xl){const d=Xb(n);return i.map(p=>({...p,hybrid:cT(d,p.content,p.similarity)})).sort((p,f)=>f.hybrid-p.hybrid).slice(0,r).map(p=>({documentId:p.documentId,content:p.content,similarity:p.similarity,hybrid:p.hybrid,grounded:cp(p.similarity,kr(d,p.content),o,u)}))}function uy(n,i,r){return i?n+`

You have reference material from the product knowledge base below. Answer ONLY from this reference material when it covers the question — quote or paraphrase it accurately. If the material doesn't cover the question, say so plainly and give your best general answer. Never invent a detail and attribute it to the knowledge base; never claim the reference says what it doesn't.

`+r:n+`

Retrieval found no strong match in the product knowledge base for this question. Answer from your general knowledge and say so plainly — do not pretend the knowledge base covers it.`}async function pT(n,i){var r;try{if(!await ie()||!At().user)return{hits:[],checked:!1};const u=await X2([n]);if(!((r=u[0])!=null&&r.length))return{hits:[],checked:!0};const d=await iT(u[0],Wb()),p=Jb(),f=$b(),m=Xb(n),y=dT(n,d,lp,p,f),x=uT(d,m,p,f);return sn("rag_event",{q:String(n).slice(0,200),hits:y.length,topSim:y.length?Math.round(y[0].similarity*100)/100:0,grounded:y.some(k=>k.grounded),checked:!0,gateRejects:x.gateRejects,belowMin:x.belowMin,field:(i==null?void 0:i.field)??null,level:(i==null?void 0:i.level)??null,cands:d.slice(0,24).map(k=>({s:Math.round(k.similarity*100)/100,st:k.similarity<p?0:cp(k.similarity,kr(m,k.content),p,f)?1:2,lx:Math.round(kr(m,k.content)*100)/100})),docs:y.map(k=>({id:k.documentId,sim:Math.round(k.similarity*100)/100}))}),{hits:y,checked:!0}}catch{return{hits:[],checked:!0}}}async function Sl(){const n=await aT().catch(()=>[]);return new Map(n.map(i=>[i.id,i.title]))}async function up(n,i=lp,r){try{const o=await ie();if(!o)return[];const u=[...ei(n)].filter(m=>m.length>3).slice(0,8);if(!u.length)return[];const{data:d,error:p}=await o.rpc("search_pdf_chunks_lex",{terms:u,match_count:i});if(p||!d)return[];const f=(d??[]).map(m=>({documentId:m.document_id,content:m.content,score:Number(m.score)}));return sn("rag_event",{q:String(n).slice(0,200),hits:f.length,topSim:0,grounded:f.length>0,checked:!0,field:(r==null?void 0:r.field)??null,level:(r==null?void 0:r.level)??null,docs:f.map(m=>({id:m.documentId,sim:0}))}),f}catch{return[]}}const Zb=B.createContext({caseId:null,title:null,icon:null,blurb:null,drawerOpen:!1});function hT({children:n}){const[i,r]=B.useState({caseId:null,title:null,icon:null,blurb:null,drawerOpen:!1});return b.jsxs(Zb.Provider,{value:i,children:[n,b.jsx(fT,{onSet:r})]})}function fT({onSet:n}){return typeof window<"u"&&(window.__setCoachTopic=n),null}function mT(){return B.useContext(Zb)}const dC={"two-pointer":"Two Pointers","sliding-window":"Sliding Window","hash-map":"Hash Map / Set","binary-search":"Binary Search","dynamic-programming":"Dynamic Programming",greedy:"Greedy",heap:"Heap / Priority Queue",stack:"Stack",queue:"Queue / BFS",graph:"Graph",interval:"Intervals","linked-list":"Linked List",tree:"Tree",trie:"Trie",bit:"Bit Manipulation",backtracking:"Backtracking",math:"Math",string:"String",sorting:"Sorting",mixed:"Mixed"},gT={"two-pointer":"Arrays & hashing","sliding-window":"Arrays & hashing","hash-map":"Arrays & hashing",interval:"Arrays & hashing",greedy:"Arrays & hashing",sorting:"Arrays & hashing",string:"Strings & stacks",stack:"Strings & stacks",queue:"Strings & stacks","linked-list":"Strings & stacks","binary-search":"Search & sorting",backtracking:"Search & sorting","dynamic-programming":"Dynamic programming",tree:"Dynamic programming",graph:"Dynamic programming",heap:"Dynamic programming",trie:"Dynamic programming",bit:"Dynamic programming",math:"Language basics",mixed:"Algorithms"},yT={"two-sum":["google","meta","amazon","microsoft","apple","uber","airbnb"],"valid-parens":["google","meta","amazon","microsoft","apple","netflix","spotify"],"max-subarray":["google","meta","amazon","microsoft","apple"],"binary-search":["google","meta","amazon","microsoft","uber","stripe"],"buy-sell":["google","meta","amazon","apple","stripe"],fizzbuzz:["microsoft","google","amazon","apple"],"reverse-string":["google","microsoft","apple"],palindrome:["google","meta","amazon","apple"],"contains-duplicate":["google","meta","amazon","microsoft","apple"],"valid-anagram":["google","meta","amazon","spotify"],fibonacci:["meta","microsoft","uber"],"merge-sorted":["google","meta","amazon","microsoft","apple"],"longest-common-prefix":["google","amazon","microsoft","apple"],"first-unique-char":["google","amazon","microsoft","apple","netflix"],"move-zeroes":["google","meta","microsoft","apple"],"missing-number":["google","meta","amazon","microsoft","uber"],"majority-element":["google","meta","amazon","microsoft","apple"],"rotate-array":["google","meta","microsoft","uber"],"climbing-stairs":["google","meta","amazon","microsoft","apple","airbnb"],intersection:["google","meta","amazon","microsoft","apple"],"fn-debounce":["google","meta","stripe","airbnb"],"fn-throttle":["google","meta","stripe","spotify"],"fn-deep-clone":["meta","stripe","datadog","cloudflare"],"fn-promise-all":["google","meta","stripe","datadog"],"fn-promise-race":["google","stripe","cloudflare"],"fn-event-emitter":["google","meta","netflix","stripe"],"fn-memoize":["google","meta","stripe","datadog"],"fn-once":["meta","stripe","spotify"],"fn-flatten":["google","meta","amazon","microsoft"],"fn-uniq":["google","meta","spotify"],"fn-chunk":["google","meta","amazon","microsoft"],"fn-group-by":["google","meta","stripe","datadog"],"fn-pipe":["google","meta","stripe"],"fn-compose":["meta","stripe","datadog"],"fn-curry":["google","meta","stripe","apple"],"fn-sleep":["stripe","cloudflare","datadog"],"fn-map-limit":["google","stripe","datadog","cloudflare"],"fn-binary-search":["google","meta","amazon","microsoft","uber"],"fn-lru-cache":["google","meta","amazon","microsoft","apple","uber","netflix"],"fn-range":["google","stripe","datadog"]},ev={...yT,...y1};function pC(n){return Ta.filter(i=>(ev[i.id]??[]).includes(n))}function dp(n,i){return(ev[n.id]??[]).includes(i)}const bT={google:{"two-sum":3,"fn-debounce":3,"fn-promise-all":3,"fn-lru-cache":2,"fn-memoize":2,"fn-curry":2,"fn-throttle":2,"binary-search":2,"valid-parens":2,"max-subarray":2,"fn-event-emitter":2,"fn-flatten":2,"fn-group-by":2,"fn-pipe":2,"climbing-stairs":2,"fn-map-limit":2,"contains-duplicate":2},meta:{"two-sum":3,"fn-deep-clone":3,"fn-event-emitter":3,"valid-parens":3,"max-subarray":3,"fn-throttle":2,"fn-debounce":2,"fn-curry":2,"fn-lru-cache":2,"fn-memoize":2,"climbing-stairs":2,"fn-once":2,"fn-flatten":2,"fn-uniq":2,"fn-chunk":2,"fn-compose":2,"contains-duplicate":2,"fn-group-by":2},amazon:{"two-sum":3,"fn-lru-cache":3,"valid-parens":2,"merge-sorted":2,"max-subarray":2,"contains-duplicate":2,"longest-common-prefix":2,"fn-chunk":2,"fn-flatten":2,"binary-search":2,"climbing-stairs":2,palindrome:2,"missing-number":2,"majority-element":2,intersection:2},microsoft:{"two-sum":3,"fn-lru-cache":3,"valid-parens":2,fizzbuzz:2,"longest-common-prefix":2,"merge-sorted":2,"first-unique-char":2,"missing-number":2,"majority-element":2,"reverse-string":2,"fn-flatten":2,"fn-chunk":2,"contains-duplicate":2,"binary-search":2,"rotate-array":2},apple:{"two-sum":3,"merge-sorted":2,"contains-duplicate":2,"fn-curry":2,"move-zeroes":2,"fn-lru-cache":2,"climbing-stairs":2,palindrome:2,"first-unique-char":2,"majority-element":2,intersection:2,fizzbuzz:2,"valid-parens":2,"max-subarray":2,"longest-common-prefix":2,"reverse-string":2},uber:{"two-sum":3,"fn-binary-search":2,"rotate-array":2,"binary-search":2,"fn-lru-cache":2,fibonacci:2,"missing-number":2},netflix:{"valid-parens":2,"fn-event-emitter":2,"first-unique-char":2,"fn-lru-cache":2},spotify:{"valid-parens":2,"fn-throttle":2,"valid-anagram":2,"fn-uniq":2,"fn-once":2},stripe:{"fn-deep-clone":3,"fn-promise-all":3,"fn-debounce":2,"fn-throttle":2,"fn-memoize":2,"fn-curry":2,"fn-once":2,"fn-pipe":2,"fn-compose":2,"fn-sleep":2,"fn-map-limit":2,"fn-range":2,"fn-group-by":2,"fn-event-emitter":2,"binary-search":2,"buy-sell":2},airbnb:{"two-sum":2,"fn-debounce":2,"climbing-stairs":2},datadog:{"fn-deep-clone":2,"fn-promise-all":2,"fn-memoize":2,"fn-group-by":2,"fn-compose":2,"fn-map-limit":2,"fn-range":2,"fn-sleep":2},cloudflare:{"fn-deep-clone":2,"fn-promise-race":2,"fn-sleep":2,"fn-map-limit":2}};function ss(n,i){var o,u,d;const r=(u=(o=Pn().companyFreq)==null?void 0:o[n])==null?void 0:u[i];return r===1||r===2||r===3?r:((d=bT[n])==null?void 0:d[i])??1}const vT={"two-sum":"Arrays & hashing","contains-duplicate":"Arrays & hashing","majority-element":"Arrays & hashing","missing-number":"Arrays & hashing","move-zeroes":"Arrays & hashing",intersection:"Arrays & hashing","merge-sorted":"Arrays & hashing","max-subarray":"Arrays & hashing","buy-sell":"Arrays & hashing","rotate-array":"Arrays & hashing","valid-parens":"Strings & stacks","reverse-string":"Strings & stacks",palindrome:"Strings & stacks","valid-anagram":"Strings & stacks","longest-common-prefix":"Strings & stacks","first-unique-char":"Strings & stacks","binary-search":"Search & sorting",fibonacci:"Dynamic programming","climbing-stairs":"Dynamic programming",fizzbuzz:"Language basics"},wT={...vT,...b1};function pp(n){return n.kind==="cli"?wT[n.id]??(n.pattern?gT[n.pattern]??"Algorithms":"Algorithms"):n.kind==="fn"?n.category:"UI components"}function kT(n,i=Ta){const r={1:{count:0,heat:0},2:{count:0,heat:0},3:{count:0,heat:0}},o=new Map;let u=0;for(const p of i){if(!dp(p,n))continue;const f=ss(n,p.id);u+=f,r[p.difficulty].count+=1,r[p.difficulty].heat+=f;const m=pp(p),y=o.get(m)??{topic:m,count:0,heat:0,hottest:null};y.count+=1,y.heat+=f,(!y.hottest||f>ss(n,y.hottest.id))&&(y.hottest=p),o.set(m,y)}const d=[...o.values()].sort((p,f)=>f.heat-p.heat||f.count-p.count);return{companyId:n,total:r[1].count+r[2].count+r[3].count,heat:u,byDifficulty:r,byTopic:d}}const xT=[{re:/algorith|data struct|dsa|problem solving/i,topics:["Arrays & hashing","Search & sorting","Dynamic programming","Strings & stacks","Language basics"]},{re:/javascript|typescript|(^|\W)js(\W|$)/i,topics:["collections","composition","async","timing","classes","search"]},{re:/react|vue|angular|frontend|css|html|ui\b/i,topics:["UI components"]},{re:/async|promise|event|node|backend|api|server/i,topics:["async","timing"]}],ST=[{re:/time complexity|space complexity|asymptotic|big-?o|optimize|efficien/i,topics:["Arrays & hashing","Search & sorting","Dynamic programming"]},{re:/hash|dictionary|map\b|set\b/i,topics:["Arrays & hashing"]},{re:/recurs|base case|stack|queue|backtrack/i,topics:["Strings & stacks","Search & sorting","Dynamic programming"]},{re:/binary search|search|sort|two pointer|sliding window/i,topics:["Search & sorting","Arrays & hashing"]},{re:/edge case|corner case|input validation|boundar/i,topics:["Language basics","Arrays & hashing"]},{re:/debounce|throttle|async|promise|event loop|callback|timer|concurren/i,topics:["async","timing","collections"]},{re:/memoiz|cache|lru|performance/i,topics:["collections","classes"]},{re:/component|render|dom|props|state|hook|react|vue|a11y|accessib/i,topics:["UI components"]},{re:/data structure|linked|tree|graph|heap|trie/i,topics:["Arrays & hashing","Strings & stacks","Search & sorting"]}];function hp(n,i){for(const r of ST)r.re.test(n)&&r.topics.forEach(o=>i.add(o))}function tv(){const n=ne(H.sessions,[]),i=new Set;for(const r of n)for(const o of r.answers)for(const u of o.missed??[])hp(u,i);return i}function nv(){const n=ne(H.coachTopics,[]),i=new Set;for(const r of n.slice(0,10))hp(r.text,i);return i}function fp(n){const i=new Set;return hp(n,i),[...i]}function TT(n,i,r=Ta){var p;const o=new Set(fp(i));if(o.size===0)return null;const u=ls();return((p=r.map(f=>{var k;const m=o.has(pp(f))?10:0,y=n&&n!=="general"?ss(n,f.id):0,x=(k=u[f.id])!=null&&k.solved?-3:0;return{p:f,s:m+y+x}}).filter(f=>f.s>0).sort((f,m)=>m.s-f.s||f.p.title.localeCompare(m.p.title))[0])==null?void 0:p.p)??null}function AT(n){var d;const i=((d=ls()[n.id])==null?void 0:d.fails)??0,r=pp(n),o=rs(),u=(o==null?void 0:o.skills.filter(p=>(p.measured??p.self)<3).map(p=>p.skill.toLowerCase()))??[];return xT.some(p=>u.some(f=>p.re.test(f))&&p.topics.includes(r))?{misses:i,weakSkill:!0,weakSrc:"skill"}:tv().has(r)?{misses:i,weakSkill:!0,weakSrc:"session"}:nv().has(r)?{misses:i,weakSkill:!0,weakSrc:"coach"}:{misses:i,weakSkill:!1,weakSrc:null}}function hC(){const n=ls(),i=Object.values(n).some(u=>((u==null?void 0:u.fails)??0)>0),r=rs(),o=!!(r!=null&&r.skills.some(u=>(u.measured??u.self)<3));return i||o||tv().size>0||nv().size>0}function qT(n,i=Ta){return i.filter(r=>dp(r,n)).map(r=>{const o=ss(n,r.id),{misses:u,weakSkill:d,weakSrc:p}=AT(r),f=o*3+(u>=2?2:u>=1?1:0)+(d?2:0);return{problem:r,freq:o,misses:u,weakSkill:d,weakSrc:p,score:f}}).sort((r,o)=>o.score-r.score||o.freq-r.freq||r.problem.title.localeCompare(o.problem.title))}function fC(n,i=Ta){const r=qT(n,i),o=[];for(const u of[1,2,3]){const d=r.find(p=>p.problem.difficulty===u&&!o.some(f=>f.problem.id===p.problem.id));d&&o.push(d)}return o}function mC(n,i){var o;if(!i||i==="general"||i==="bank"||i==="weak")return null;const r=kT(i);if(r.total===0)return null;if(n==="Technical")return{heat:r.heat,focus:((o=r.byTopic[0])==null?void 0:o.topic)??""};if(n==="System Design"){const u=r.byTopic[0];return u?{heat:u.heat,focus:u.topic}:null}return null}function gC(n,i=Ta){const r=i.filter(p=>dp(p,n)).map((p,f)=>({p,i:f})).sort((p,f)=>ss(n,f.p.id)-ss(n,p.p.id)||p.i-f.i).map(p=>p.p),o=r.find(p=>p.difficulty===1),u=r.find(p=>p.difficulty>=2&&p.id!==(o==null?void 0:o.id))??r.find(p=>p.id!==(o==null?void 0:o.id)),d=[];return o&&d.push(o),u&&u.id!==(o==null?void 0:o.id)&&d.push(u),d}async function mp(){if(Vd()&&Jd()<=0)throw new Error("You've used your free AI coaching for today — upgrade to Pro for unlimited.")}async function gp(n,i,r){const{hits:o,checked:u}=await pT(i,r);if(!o.length)return u&&oT(i),{sys:u?uy(n,!1,""):n,citations:[],grounded:!1,checked:u};const d=await Sl(),p=o.map(y=>({documentId:y.documentId,title:d.get(y.documentId)??"Knowledge base",content:y.content,similarity:y.similarity,grounded:y.grounded})),f=o.some(y=>y.grounded),m=o.map(y=>y.content).join(`

---

`).slice(0,6e3);return{sys:uy(n,f,m),citations:p,grounded:f,checked:u}}async function yC(n,i){await mp();const r=It(i.fieldId),o=Tt(i.targetLevel),u="You are a patient interview coach. Teach one topic in a way a candidate can turn into interview answers. Use plain language, short sections, and concrete examples. Do not pad — every sentence should teach something.",d=`Teach the topic "${n}" to someone preparing for a ${o.name} ${(r==null?void 0:r.name)??""} interview. Include:
1) A plain-language explanation of what it is.
2) Why interviewers ask about it at ${o.name} level.
3) The 3 most common traps or misunderstandings.
4) A model-answer skeleton they could use in an interview.
Keep it under ~220 words.`,{sys:p}=await gp(u,n,{field:i.fieldId,level:i.targetLevel}),f=await ai([{role:"system",content:p},{role:"user",content:d}],{maxTokens:650});return Ar(),f}async function bC(n,i,r){var O;await mp();const o=It(i.fieldId),u=Tt(i.targetLevel),d=`You are a patient interview coach helping a ${u.name} ${(o==null?void 0:o.name)??""} candidate master "${n}". Answer the user's questions about this topic concisely and plainly. Tie answers back to how they'd speak about it in an interview at ${u.name} level. If they ask something off-topic, gently steer back. Under ~180 words per reply.`,p=((O=[...r].reverse().find(_=>_.role==="user"))==null?void 0:O.content)??"",{sys:f,citations:m,grounded:y,checked:x}=await gp(d,p||n,{field:i.fieldId,level:i.targetLevel}),k=[{role:"system",content:f},...r.map(_=>({role:_.role,content:_.content}))],L=await ai(k,{maxTokens:500});return Ar(),{text:L,citations:m,grounded:y,checked:x}}async function vC(n,i){await mp();const r=Tt(i.targetLevel),o=It(i.fieldId),u="You are a senior engineering leader giving career coaching. Be specific, honest and encouraging. Under ~150 words.",d=`A candidate targeting a ${r.name} ${(o==null?void 0:o.name)??""} role has a gap in "${n}". Explain: (1) why this skill matters at that level and what happens if it's weak, (2) what "good" looks like in an interview, and (3) one concrete 30-minute exercise to start closing the gap.`,p=await ai([{role:"system",content:u},{role:"user",content:d}],{maxTokens:420});return Ar(),p}const ET=(()=>{const n=[];for(const{label:i,dd:r}of c1()){const o=new Set,u=[i,...r.concepts.map(p=>p.name),...r.points,...r.traps,...r.qa.map(p=>p.q+" "+p.a)];for(const p of u)for(const f of Hn(p))o.add(f);const d=new Set;for(const p of[i,...r.concepts.map(f=>f.name)])for(const f of ei(p))d.add(f);n.push({label:i,families:o,keywords:d})}return n})();function CT(n){const i=Hn(n),r=ei(n);let o=null;for(const u of ET){let d=0,p=0;const f=Hn(u.label);for(const m of u.families)i.has(m)&&(d+=1,p+=2,f.has(m)&&(p+=3));for(const m of u.keywords)r.has(m)&&(p+=2);d&&(p+=d/u.families.size),p>0&&(!o||p>o.score)&&(o={label:u.label,score:p})}return o}function LT(n,i=3){const r=CT(n);if(!r)return[];const o=[],u=new Set([r.label]),d=[{label:r.label,depth:0}];for(;d.length&&o.length<i;){const{label:p,depth:f}=d.shift(),m=l1(p),y=f===0?r.score+10:Id(n,p+" "+m.points.join(" ")+" "+m.concepts.map(x=>x.name).join(" "));(f===0||y>0)&&o.push({label:p,dd:m,score:y,depth:f});for(const x of m.related)u.has(x)||(u.add(x),d.push({label:x,depth:f+1}))}return o.sort((p,f)=>f.score-p.score),o.slice(0,i)}function dy(n,i=2){const r=LT(n,i);if(!r.length)return"";const o=[];for(const u of r){const d=[];u.dd.concepts.length&&d.push(u.dd.concepts.slice(0,3).map(p=>`• ${p.name} — ${p.blurb}`).join(`
`)),u.depth>0&&u.dd.traps.length&&d.push("⚠️ watch for: "+u.dd.traps.slice(0,2).join(" · ")),d.length&&o.push("**"+u.label+`**
`+d.join(`
`))}return`📖 From the knowledge base:

`+o.join(`

`)}const py=n=>new Set(n.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(i=>i.length>3));function hy(n,i){const r=py(n);let o=0;for(const u of py(i))r.has(u)&&o++;return o}function DT(n){const i=[],r=new Set,o=u=>{u.q&&!r.has(u.q)&&(r.add(u.q),i.push(u))};if(n.fieldId){const u=It(n.fieldId),d=n.levelId?[n.levelId]:u?Object.keys(u.questions):[];for(const p of d){for(const f of(u==null?void 0:u.questions[p])??[])o({q:f.q,a:f.a});if(n.levelId)for(const f of yl(n.fieldId,n.levelId))o({q:f.q,a:f.a})}}for(const u of lb())o({q:u.q,a:u.a});return i}function OT(n,i,r){return DT(n).map(o=>({qa:o,s:hy(o.q,i)+hy(o.a,i)})).filter(o=>o.s>0).sort((o,u)=>u.s-o.s).slice(0,r).map(o=>o.qa)}function zT(n){const i=new Set("about your their with have this that will would could there what when from into using just also then than some them they been were should think going like make really much because after before while where which these those other another first second need needs want wants things thing way ways look looks new good bad work works code app system data time".split(" "));return[...new Set(ml(n).filter(r=>r.length>3&&!i.has(r)))].slice(0,4)}function jT(n){return n.replace(/[^a-z0-9\s]/g," ").trim().split(/\s+/).filter(i=>i.length>3).length>=3}function av(n){return{q:n.prompt,a:n.answer,kp:n.kp??[],cat:"field",catLabel:"Technical",catColor:"#22d3ee",level:n.levelId??"mid",src:"coach"}}function fy(n,i){const r=new Set(i.covered),o=new Set(i.partial),u=[];for(const d of n)r.has(d)?u.push("✅ "+d+" — you've got this"):o.has(d)?u.push("🟡 "+d+" — touched, not nailed"):u.push("· "+d);return u}const Ya=(n,i="")=>n[0]??i,MT=["grade","hint","next","explain","compare"];function RT(n){for(let i=n.length-1;i>=0;i--)if(!MT.includes($y(n[i])))return n[i];return""}function _T(n,i,r=[]){const o=n.trim(),u=i.kp??[],d=i.prompt??"",p=(i.answer??"").trim(),f=r.filter(I=>I.role==="user").map(I=>I.text),m=RT(f),y=jk([...f,o],u,d),x=$y(o),k=Bk(o),L=Ik(m,i.levelId),O=i.levelId?i.levelId.charAt(0).toUpperCase()+i.levelId.slice(1):"Mid",_=zT(o),T=[],G=I=>`What would “${I}” look like in your answer?`;switch(k&&T.push("⚠️ Let me stop you there — "+k),x){case"grade":{const I=av(i),Y=Pd(m,I),F=bl(Y.pct);T.push(`📊 If you submitted that now, the session engine scores it **${Y.score}/5 · ${F}** (${Math.round(Y.pct*100)}% coverage, ${Y.words} words).`),T.push("Coverage per key point (concept-aware):"),T.push(fy(u,y).join(`
`));const K=[];K.push(`${L.words}w (${O} expects ~${L.expected}+)`),K.push(L.structured?"structure ✅":"structure ❌"),K.push(L.example?"example ✅":"example ❌"),K.push(L.tradeoffs?"tradeoffs ✅":"tradeoffs ❌"),K.push(`${L.vocab} concepts named`),T.push("Signals: "+K.join(" · ")),Y.missed.length?(T.push(`To reach a 4+, add: ${Ya(Y.missed)}.`),T.push(G(Ya(Y.missed)))):T.push("You're covering everything on the checklist — push further: what trade-off would you defend if the interviewer pushed back?");break}case"hint":{T.push("🧭 Hint — break the question into parts before answering. A strong reply covers:"),T.push(fy(u,y).join(`
`)),p&&T.push("Work toward the outline: "+p.slice(0,220)+(p.length>220?"…":"")),T.push("Which of those feels hardest for you?");break}case"explain":{T.push("Here's the core idea: "+(p||"see the key points below.")),u.length&&T.push("Interviewers at this level listen for: "+u.join(" · "));const I=dy(o);I&&T.push(I),T.push("Want me to unpack any one of those in more depth?");break}case"compare":{T.push(`Your take is on: ${_.length?_.join(" · "):"your approach"}. The model answer's opening move: ${Ya(u)||p.slice(0,160)}.`),y.missing.length&&T.push("Where they diverge — you haven't hit: "+y.missing.join(" · ")),p&&T.push("The model answer reasons through: "+p.slice(0,240)+(p.length>240?"…":""));const I=dy(o);I&&T.push(I),T.push(G(Ya(y.missing,"the main trade-off")));break}case"debate":{T.push("🤔 Fair challenge. The model answer's position: "+(p.slice(0,300)||"see the key points — that's the position interviewers expect.")),u.length&&T.push("What it's graded on: "+u.join(" · ")),y.missing.length&&T.push("Your version doesn't yet cover: "+y.missing.join(" · ")),T.push("What's your strongest counter — and the trade-off behind it?");break}case"approach":case"other":{if(x==="other"&&!jT(o)){T.push("Tell me your approach and I'll compare it with the model answer — or ask for a hint if you're stuck."),p&&T.push("Reference outline: "+p.slice(0,200)+(p.length>200?"…":""));break}T.push("✅ I read that you're thinking about: "+(_.length?_.join(" · "):"your approach")+". Let's stress-test it against what this question is graded on."),y.covered.length&&T.push("✅ Covered: "+y.covered.join(" · ")),y.partial.length&&T.push("🟡 Touched but not nailed: "+y.partial.join(" · ")),y.missing.length&&T.push("Don't miss: "+y.missing.join(" · ")),p&&T.push("The model answer reasons through: "+p.slice(0,240)+(p.length>240?"…":"")),y.missing.length?T.push(G(Ya(y.missing))):y.partial.length?T.push(G(Ya(y.partial))):T.push("What trade-off would you call out if the interviewer pushed back?");break}case"next":{T.push("🎯 From this discussion, the highest-value topics are:"),T.push((y.missing.length?y.missing:u).slice(0,4).map((I,Y)=>`${Y+1}. ${I}`).join(`
`)),T.push("Study them in that order, then come back and I'll drill you on the first one.");break}case"thanks":{T.push("Anytime — keep going!"),y.missing.length&&T.push(G(Ya(y.missing)));break}case"greeting":{T.push("Hi! I'm your coach for this question — "+d.slice(0,120)+(d.length>120?"…":"")),T.push("Tell me your approach and I'll compare it with the model answer — or ask for a hint if you're stuck.");break}}const N=OT(i,o,2);return N.length&&T.push("📚 Related practice: "+N.map(I=>"“"+I.q+"”").join(" · ")),T.join(`

`)}function wC(n,i){const r=av(i),o=Pd(n,r),u=Wy(n,i.kp??[],i.prompt??"");return{score:o.score,grade:bl(o.pct),pct:u.pct,words:o.words,covered:u.covered,partial:u.partial,missing:u.missing}}function iv({title:n,content:i,source:r}){const o=r==="case-study"?{label:"🟢 Verified",cls:"bg-ok/15 text-ok border-ok/30"}:r==="deep-dive"?{label:"🟡 Curated",cls:"bg-amber-500/15 text-amber-400 border-amber-500/30"}:{label:"🔵 KB",cls:"bg-acc1/15 text-acctxt border-acc1/30"};return b.jsxs("details",{className:"group rounded-xl border border-line/15 bg-deep/60 transition-all open:border-acc1/50 open:bg-acc1/10 open:shadow-[0_2px_10px_rgba(99,102,241,.1)]",children:[b.jsxs("summary",{className:"flex cursor-pointer list-none items-start gap-2 px-3 py-2 select-none [&::-webkit-details-marker]:hidden",children:[b.jsx("span",{className:"mt-0.5 flex-none text-[10px] text-fnt transition-transform group-open:rotate-90",children:"▶"}),b.jsxs("div",{className:"min-w-0 flex-1",children:[b.jsxs("div",{className:"flex items-center gap-2",children:[b.jsx("span",{className:`flex-none rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${o.cls}`,children:o.label}),b.jsxs("span",{className:"truncate text-[11px] font-bold text-acc3",children:["📚 ",n]})]}),b.jsx("div",{className:"mt-1 line-clamp-1 text-[11px] leading-snug text-mut",children:i})]})]}),b.jsxs("div",{className:"border-t border-line/10 px-3 py-2.5",children:[b.jsx("div",{className:"rounded-lg border-l-2 border-acc1/30 bg-deep/40 px-2.5 py-2 text-[12px] leading-relaxed text-ink whitespace-pre-wrap",children:i}),b.jsxs("div",{className:"mt-1.5 text-[9px] font-semibold text-mut",children:["📖 Full source excerpt — ",i.length," characters"]})]})]})}function sv({minSim:n,pool:i,docs:r}){return b.jsxs("details",{className:"group",children:[b.jsx("summary",{className:"cursor-pointer select-none text-[11px] font-bold text-fnt transition-colors hover:text-ink",children:"ⓘ How answers are grounded"}),b.jsxs("p",{className:"mt-1 text-[11.5px] leading-relaxed text-mut",children:["Answers cite the product knowledge base only when the top source similarity is ≥ ",n.toFixed(2)," ",b.jsx("span",{className:"font-bold",children:"and"})," the source shares concepts with your question (a very close match is cited regardless). Retrieval considers ",i," candidate chunks",r!=null?` across ${r} indexed document${r===1?"":"s"}`:"",". Replies mark their status: ",b.jsx("span",{className:"font-bold text-ok",children:"📚 grounded"})," (cited the KB) or"," ",b.jsx("span",{className:"font-bold",children:"🧠 general knowledge"})," (no strong KB match — the answer says so)."]})]})}function rv(n,i){const r=`📚 Grounded · ${n} source${n===1?"":"s"}`;return i==="lexical"?r+" · term match (no key)":i==="vector"?r+" · semantic":r}function kC(n){const r=y=>{const x=new Date(y);return x.setDate(x.getDate()-(x.getDay()+6)%7),x.setHours(0,0,0,0),x.getTime()},o=r(Date.now()),u=[...new Set(n.map(y=>r(y.at)))].sort((y,x)=>x-y),d=n.filter(y=>r(y.at)===o).length;let p=0;if(u.includes(o)||u.includes(o-6048e5)){let y=u.includes(o)?o:o-6048e5;for(p=1;u.includes(y-6048e5);)p+=1,y-=6048e5}let f=0;for(const y of u){let x=1;for(;u.includes(y-x*6048e5);)x+=1;f=Math.max(f,x)}const m=new Set;for(const y of n)fp(y.text).forEach(x=>m.add(x));return{cur:p,longest:f,thisWeek:d,topics:m.size}}function NT(){return ne(H.coachTopics,[])}function IT(n){const i=n.text.trim();if(!i)return!1;const r=i.slice(0,200),o=NT().filter(d=>!d.text.startsWith(r));o.unshift({at:Date.now(),prompt:n.prompt,mode:n.mode,text:i.slice(0,1200)}),oe(H.coachTopics,o.slice(0,50));const u=fp(i);return sn("coach_discussion",{topics:u,prompt:n.prompt.slice(0,300),mode:n.mode}),!0}function xC(n){const{prompt:i,answer:r,kp:o}=n,[u,d]=B.useState(!1),[p,f]=B.useState(Ld()?"api":"local"),[m,y]=B.useState([]),[x,k]=B.useState(""),[L,O]=B.useState(!1),[_,T]=B.useState(null),[G,N]=B.useState(null),I=B.useRef(null);B.useEffect(()=>{var J;(J=I.current)==null||J.scrollTo({top:I.current.scrollHeight})},[m,L,u]);const Y=J=>{J.style.height="auto",J.style.height=Math.min(160,J.scrollHeight)+"px"},F=()=>{const J=m.filter(Z=>Z.role==="assistant"||Z.role==="user").map(Z=>Z.text).join(`
`);IT({prompt:i,mode:p,text:J})?bn("💾 Discussion saved — topics debated here now influence your focus plan"):bn("Nothing to save yet — have a chat first")},K=()=>{P();const J=m.map(Ne=>Ne.text).join(" "),Z=TT(n.companyId??null,J);if(!Z){bn("I couldn't pin a topic from this chat — keep discussing, or ask me about complexity, edge cases, or a specific area.");return}T({id:Z.id,title:Z.title,kind:Z.kind})},P=()=>{if(!G)return;const J=ls()[G];J!=null&&J.solved&&(N(null),T(null),y(Z=>[...Z,{role:"assistant",text:"🎉 Looks like you solved that one! Keep the loop going: save this discussion, then hit “Suggest next problem” to chain into the next challenge."}]))},ue=J=>{var Ne;(Ne=n.onPractice)==null||Ne.call(n,J),N(J),T(null);const Z=_;y(V=>[...V,{role:"assistant",text:`👋 Go solve ${(Z==null?void 0:Z.title)??"it"} — when you're done (or stuck), come back and we'll keep the loop going.`}])},ae=async J=>{const Z=J.trim();if(!Z||L)return;P(),k("");const Ne=[...m,{role:"user",text:Z}];y(Ne),O(!0);try{if(p==="api"){const V=`You are a friendly senior technical interviewer coaching a candidate through a live quiz question. Question: ${i}
Model answer outline: ${r}
Key points graded: ${o.join("; ")}

The candidate can ask for hints, share their approach, or debate your/model answers. Be encouraging, probe with follow-up questions, point out what their approach misses relative to the key points, and only reveal the full model answer when they explicitly ask. Keep replies focused, under ~180 words.`,{sys:Q,citations:A,grounded:U,checked:W}=await gp(V,Z,{field:n.fieldId,level:n.levelId}),me=[{role:"system",content:Q},...m.map(je=>({role:je.role,content:je.text})),{role:"user",content:Z}],pe=await ai(me,{maxTokens:450});y(je=>[...je,{role:"assistant",text:pe,citations:A,grounded:U,checked:W,citationsSource:"vector"}])}else{const V=_T(Z,n,Ne),Q=await up(Z,4,{field:n.fieldId,level:n.levelId}).catch(()=>[]);let A=[];if(Q.length){const U=await Sl().catch(()=>new Map);A=Q.map(W=>({documentId:W.documentId,title:U.get(W.documentId)??"Knowledge base",content:W.content,similarity:W.score,grounded:!0}))}y(U=>[...U,{role:"assistant",text:V,citations:A,grounded:A.length>0,checked:A.length>0,citationsSource:"lexical"}])}}catch(V){const Q=V.message||"Coach unavailable";bn("✗ "+Q),y(A=>[...A,{role:"assistant",text:"I hit an error: "+Q+" — switch to 📚 Knowledge mode to keep going offline."}])}finally{O(!1)}},ce=()=>ae(x),de=J=>`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${J?"grad-bg text-white":"border border-line/15 text-mut hover:border-acc1/40"}`;return b.jsxs("div",{className:`${Pb} overflow-hidden`,children:[b.jsxs("button",{type:"button",onClick:()=>d(J=>{const Z=!J;return Z&&P(),Z}),className:"flex w-full items-center justify-between px-4 py-3 text-left",children:[b.jsx("span",{className:"text-[13px] font-extrabold",children:"🤖 AI Coach — discuss your approach"}),b.jsx("span",{className:"text-[11px] font-bold text-mut",children:u?"Hide ▾":"Ask anytime ▴"})]}),u&&b.jsxs("div",{className:"border-t border-line/10 px-4 pb-4 pt-3",children:[b.jsxs("div",{className:"mb-2 flex flex-wrap items-center gap-1.5",children:[b.jsx("span",{className:"text-[10.5px] font-bold uppercase tracking-wider text-mut",children:"Mode"}),b.jsx("button",{type:"button",className:de(p==="api"),onClick:()=>f("api"),children:"🤖 AI · API key"}),b.jsx("button",{type:"button",className:de(p==="local"),onClick:()=>f("local"),children:"📚 Knowledge · offline"}),p==="local"&&b.jsx("span",{className:"text-[10.5px] text-mut",children:"no key needed — grounded in the question bank"})]}),b.jsx("div",{className:"mb-1.5",children:b.jsx(sv,{minSim:ul().minSim,pool:ul().pool})}),b.jsxs("div",{ref:I,className:"h-[240px] space-y-2 overflow-y-auto pr-1",children:[m.length===0?b.jsx("div",{className:"text-[12.5px] leading-relaxed text-mut",children:"Share your approach, ask for a hint, or debate the model answer. In 📚 Knowledge mode I answer from the question bank — learning never stops, even without an API key."}):m.map((J,Z)=>{var Ne;return b.jsxs("div",{className:`flex flex-col ${J.role==="user"?"items-end":"items-start"}`,children:[b.jsx("div",{className:`max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${J.role==="user"?"grad-bg text-white":"bg-deep/60 text-ink"}`,children:J.text}),J.role==="assistant"&&(((Ne=J.citations)==null?void 0:Ne.length)??0)>0&&b.jsxs("div",{className:"mt-1 w-full max-w-[92%] space-y-1",children:[b.jsx("div",{className:"text-[10px] font-bold uppercase tracking-wider text-ok",children:rv(J.citations.length,J.citationsSource)}),J.citations.map((V,Q)=>b.jsx(iv,{title:V.title,content:V.content},Q))]}),J.role==="assistant"&&!J.grounded&&b.jsx("button",{type:"button",onClick:()=>{lT(J.text,{field:n.fieldId,level:n.levelId}),bn("💡 Thanks — queued for review. Admins see it in Quality → 🛰️ RAG health → 💡 KB suggestions")},className:"mt-1 rounded-full border border-line/15 px-2.5 py-1 text-[10.5px] font-bold text-mut transition-all hover:border-acc1/40 hover:text-ink",children:"💡 Suggest adding this to the knowledge base"})]},Z)}),L&&b.jsx("div",{className:"text-[12px] text-mut",children:"…thinking"})]}),b.jsx("div",{className:"mt-2 flex flex-wrap gap-1.5",children:[{label:"💡 Hint",cmd:"Give me a hint"},{label:"📝 Grade my answer",cmd:"Grade my answer"},{label:"🤔 Debate",cmd:"I disagree with the model answer"},{label:"🎯 Next",cmd:"What should I study next?"}].map(J=>b.jsx("button",{type:"button",disabled:L,onClick:()=>ae(J.cmd),className:"rounded-full border border-line/15 px-2.5 py-1 text-[11px] font-bold text-mut transition-all hover:border-acc1/40 hover:text-ink disabled:opacity-50",children:J.label},J.label))}),b.jsxs("div",{className:"mt-1.5 flex gap-2",children:[b.jsx("textarea",{value:x,rows:1,onChange:J=>{k(J.target.value),Y(J.target)},onKeyDown:J=>{J.key==="Enter"&&!J.shiftKey&&(J.preventDefault(),ce())},placeholder:"Ask about this question… (Shift+Enter for a new line)",className:"inp w-full flex-1 resize-none overflow-y-auto leading-relaxed"}),b.jsx("button",{className:`${Ed} ${dr} flex-none self-end`,onClick:ce,disabled:L||!x.trim(),children:"Send"})]}),m.length>=2&&b.jsx("button",{type:"button",className:`${Cd} ${dr} mt-2 w-full`,onClick:F,children:"💾 Save this discussion into my weak-topic profile"}),m.length>=3&&b.jsx("button",{type:"button",className:`${Cd} ${dr} mt-1.5 w-full`,onClick:K,children:"🎯 Suggest next problem from this discussion"}),_&&b.jsxs("div",{className:"mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-acc1/30 bg-acc1/10 px-3 py-2 text-[12.5px]",children:[b.jsxs("span",{className:"font-bold text-acctxt",children:["🎯 Next: ",_.kind==="fn"?"🧩":_.kind==="ui"?"🎨":"⚙️"," ",_.title]}),n.onPractice&&b.jsx("button",{className:`${Ed} ${dr} ml-auto`,onClick:()=>ue(_.id),children:"▶ Practice this"})]})]})]})}let pr=null,ud=null;function BT(){return pr?Promise.resolve(pr):(ud||(ud=ze(()=>import("./systemDesignBank-DcEELOYM.js"),[],import.meta.url).then(n=>(pr=n.SYSTEM_DESIGN_CASES,pr))),ud)}function Tl(){return pr??[]}const dd="iq.floatingCoachChat",pd="iq.generalChatHistory",my="iq.coachType",gy="iq.ragLastRefresh",ov="iq.ragCachedHits",UT=7200*1e3;function yy(n){return ne(n,[])}function by(n,i){oe(n,i.slice(-100))}function vy(){return ne("iq.coachTopicHistory",[])}function HT(n){return Tl().find(i=>i.id===n)}async function wy(){const n=ne(gy,0);if(Date.now()-n<UT)return;const i=["system design architecture patterns","load balancer caching database","distributed systems consistency availability","microservices API gateway rate limiting","message queue pub sub event driven","database sharding replication partitioning","CDN cache invalidation strategies","real-time WebSocket long polling SSE","storage system blob object file","search engine indexing ranking"],r=[];for(const o of i)try{const u=await up(o,3);if(u.length){const d=await Sl().catch(()=>new Map);for(const p of u)r.push({query:o,title:d.get(p.documentId)??"Knowledge base",content:p.content,at:Date.now()})}}catch{}oe(ov,r.slice(0,100)),oe(gy,Date.now())}function PT(){return ne(ov,[])}function GT(){const[n,i]=B.useState(!1),[r,o]=B.useState(""),u=B.useRef(null),d=typeof window<"u"&&("SpeechRecognition"in window||"webkitSpeechRecognition"in window),p=B.useCallback(()=>{if(!d)return;const m=window.SpeechRecognition??window.webkitSpeechRecognition;if(!m)return;const y=new m;y.continuous=!0,y.interimResults=!0,y.lang="en-US",y.onresult=x=>{let k="";for(let L=x.resultIndex;L<x.results.length;L++)x.results[L].isFinal&&(k+=x.results[L][0].transcript);k&&o(L=>(L+" "+k).trim())},y.onend=()=>i(!1),y.onerror=()=>i(!1),u.current=y,y.start(),i(!0),o("")},[d]),f=B.useCallback(()=>{var m;(m=u.current)==null||m.stop(),i(!1)},[]);return{supported:d,listening:n,transcript:r,start:p,stop:f}}const YT=new Set(["this","that","with","from","have","will","about","would","could","should","what","when","where","which","there","their","them","then","than","some","more","most","very","also","just","only","other","into","over","such","your","does","tell","explain","design","system","make","give","want","need","like","help"]);function dl(n){return n.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(i=>i.length>3&&!YT.has(i))}function Od(n){const i=new Set(dl(n));let r=null,o=0;for(const u of Tl()){const d=new Set(dl([u.title,u.blurb,...u.prerequisites,...u.followUpTopics].join(" ").toLowerCase()));let p=0;for(const f of i)u.title.toLowerCase().includes(f)&&(p+=3),d.has(f)&&(p+=1);p>o&&(o=p,r=u)}return o>=2?r:null}function QT(n){const i=n.toLowerCase();return/overview|explain|walkthrough|architecture|how.*work|what.*is/.test(i)?"overview":/trade.?off|vs|versus|compare|pros.*cons/.test(i)?"tradeoffs":/mistake|error|wrong|pitfall|avoid/.test(i)?"mistakes":/scale|million|billion|throughput|latency|capacity/.test(i)?"scale":/number|memorize|remember|stat|metric/.test(i)?"numbers":/phase|step|stage|whiteboard|interview|minute/.test(i)?"phase":/question|ask|quiz|test|practice/.test(i)?"qa":"general"}function KT(n){const i=n.toLowerCase(),r=["http basics","websockets","web sockets","load balancing","caching","database design","hashing","message queues","social graphs","database sharding","rate limiting","event-driven architecture","long polling","pub-sub","rest api","microservices","consistent hashing"];for(const o of r)if(i.includes(o)||i.includes(o.replace(" ","-")))return o;return null}function FT(n,i){const r=[],o=[];let u=0;switch(r.push(`${n.icon} **${n.title}**`,`_${n.blurb}_`,""),i){case"overview":r.push("**Architecture Phases:**"),n.phases.forEach((d,p)=>{var f;r.push("",`**Phase ${p+1}: ${d.phase}** (${d.duration})`),d.talkingPoints.forEach(m=>r.push(`→ ${m}`)),(f=d.numbers)!=null&&f.length&&r.push(`  📐 ${d.numbers.join(" · ")}`)}),o.push({title:n.title,content:`Phases: ${n.phases.map(d=>d.phase).join(" → ")}`,grounded:!0,source:"case-study"}),u=95;break;case"tradeoffs":r.push("**Key Numbers:**"),n.keyNumbers.forEach(d=>{r.push(`📐 ${d}`),o.push({title:`${n.title} — Scale`,content:d,grounded:!0,source:"case-study"})}),r.push("","💡 **Interview tip:** Name the axis (cost vs latency) and state your choice."),u=90;break;case"mistakes":r.push("**Common Mistakes:**"),n.commonMistakes.forEach(d=>{r.push(`⚠️ ${d}`),o.push({title:`${n.title} — Mistake`,content:d,grounded:!0,source:"case-study"})}),u=100;break;case"scale":r.push("**Scale Numbers:**"),n.keyNumbers.forEach(d=>{r.push(`📐 ${d}`),o.push({title:`${n.title} — Scale`,content:d,grounded:!0,source:"case-study"})}),u=95;break;case"numbers":r.push("**Numbers to Memorize:**"),n.keyNumbers.forEach(d=>{r.push(`🔢 ${d}`),o.push({title:`${n.title} — Number`,content:d,grounded:!0,source:"case-study"})}),u=100;break;case"phase":r.push("**Whiteboard Phases:**"),n.phases.forEach((d,p)=>{r.push("",`**${p+1}. ${d.phase}** (${d.duration})`),d.talkingPoints.forEach(f=>r.push(`   → ${f}`))}),u=95;break;default:r.push(`**Prerequisites:** ${n.prerequisites.join(", ")}`,`**Key Numbers:** ${n.keyNumbers.join("; ")}`,"","💡 Ask about: overview, trade-offs, mistakes, scale, or phases."),o.push({title:n.title,content:`Prereqs: ${n.prerequisites.join(", ")}. Numbers: ${n.keyNumbers.join("; ")}`,grounded:!0,source:"case-study"}),u=95}return n.followUpTopics.length&&r.push("",`**Related:** ${n.followUpTopics.join(" · ")}`),{lines:r,citations:o,trustScore:u}}async function VT(n,i,r){const o=QT(n),u=i??Od(n),d=r.map(m=>({title:m.title,content:m.content,grounded:!0,source:"knowledge-base"})),p=KT(n);if(p){const m=F2(p,u==null?void 0:u.id);if(m){const y=[`📘 **${p}**`,"",`🟢 **Beginner:** ${m.beginner}`,"",`🟡 **Intermediate:** ${m.intermediate}`,"",`🔴 **Advanced:** ${m.advanced}`];return m.context&&y.push("",`📌 **In ${(u==null?void 0:u.title)??"this system"}:** ${m.context}`),{text:y.join(`
`),citations:[{title:`${p} — Knowledge Base`,content:m.context??m.beginner,grounded:!0,source:"deep-dive"}],trustScore:90}}}let f;if(u)f=FT(u,o);else if(d.length){const m=["**📚 From Knowledge Base:**",""];d.forEach(y=>m.push(`• **[${y.title}]** ${y.content.slice(0,300)}`)),m.push("","💡 Ask about a specific system design topic for more detail."),f={lines:m,citations:d,trustScore:70}}else f={lines:["**I don't have verified info on this topic yet.**","","I can answer about these case studies:",...Tl().map(m=>`• ${m.icon} ${m.title}`),"","---","🌐 **Need more details?** For topics I don't cover:","• Google it — search the concept + 'system design interview'","• Check official docs (Redis, Kafka, etc.)","• Switch to 🤖 AI mode for generative answers","","💡 _All answers come from verified sources._"],citations:[],trustScore:0};if(f.trustScore>0){const m=f.trustScore>=90?"🟢 High":f.trustScore>=70?"🟡 Medium":"🔵 KB";f.lines.push("","---",`_Trust: ${m} · ${f.citations.length} citation(s) · All facts from verified data_`)}return{text:f.lines.join(`
`),citations:f.citations,trustScore:f.trustScore}}async function JT(n,i){const r=i.map(o=>({title:o.title,content:o.content,grounded:!0,source:"knowledge-base"}));if(r.length){const o=["**📚 From Knowledge Base:**",""];return r.forEach(u=>o.push(`• **[${u.title}]** ${u.content.slice(0,400)}`)),o.push("","_These are knowledge base excerpts. For a more detailed answer, try 🤖 AI mode._"),{text:o.join(`
`),citations:r}}return{text:["**I don't have info on this topic in my knowledge base yet.**","","🌐 **To get a better answer:**","• Try 🤖 AI mode — switch for a generative answer (needs API key)","• Google it — search for this topic online","• Check official documentation","","_My offline mode searches a curated knowledge base. For broader topics, AI mode or the internet works better._"].join(`
`),citations:[]}}async function WT(n){try{const o=await up(n,5);if(o.length){const u=await Sl().catch(()=>new Map);return o.map(d=>({title:u.get(d.documentId)??"Knowledge base",content:d.content}))}}catch{}const i=PT(),r=new Set(dl(n));return i.filter(o=>dl(o.content).some(u=>r.has(u))).slice(0,3).map(o=>({title:o.title,content:o.content}))}function $T(){const n=mT(),[i,r]=B.useState(!1),[o,u]=B.useState(()=>ne(my,"system-design")),[d,p]=B.useState(Ld()?"api":"local"),[f,m]=B.useState(()=>yy(dd)),[y,x]=B.useState(()=>yy(pd)),k=o==="system-design"?f:y,L=o==="system-design"?m:x,[O,_]=B.useState(""),[T,G]=B.useState(!1),N=B.useRef(null),I=B.useRef(null),[Y,F]=B.useState(()=>vy()),K=GT(),[P,ue]=B.useState(!1);B.useEffect(()=>{by(dd,f)},[f]),B.useEffect(()=>{by(pd,y)},[y]),B.useEffect(()=>{oe(my,o)},[o]),B.useEffect(()=>{K.transcript&&_(Q=>Q?Q+" "+K.transcript:K.transcript)},[K.transcript]),B.useEffect(()=>{var Q;(Q=N.current)==null||Q.scrollTo({top:N.current.scrollHeight})},[k,T,i]),B.useEffect(()=>{p(Ld()?"api":"local")},[]),B.useEffect(()=>{const Q=setInterval(()=>F(vy()),2e3);return()=>clearInterval(Q)},[]),B.useEffect(()=>{wy();const Q=setInterval(()=>void wy(),1800*1e3);return()=>clearInterval(Q)},[]),B.useEffect(()=>{BT()},[]),B.useEffect(()=>{const Q=A=>{(A.ctrlKey||A.metaKey)&&A.key==="/"&&(A.preventDefault(),r(U=>(U||setTimeout(()=>{var W;return(W=I.current)==null?void 0:W.focus()},100),!U))),A.key==="Escape"&&i&&(A.preventDefault(),r(!1),P&&(K.stop(),ue(!1)))};return window.addEventListener("keydown",Q),()=>window.removeEventListener("keydown",Q)},[i,P,K]);const ae=Q=>{Q.style.height="auto",Q.style.height=Math.min(120,Q.scrollHeight)+"px"},ce=async Q=>{const A=Q.trim();if(!(!A||T)){_(""),L(U=>[...U,{role:"user",text:A}]),G(!0);try{if(d==="api"){const W=[{role:"system",content:o==="system-design"?"You are a friendly, senior technical interviewer and system design coach. Keep replies under 180 words. Use → arrows for diagrams. Be encouraging but precise. Never hallucinate."+(n.title?`
The user is studying: ${n.icon} ${n.title} — ${n.blurb}`:""):"You are a helpful, knowledgeable AI assistant — like ChatGPT. Be friendly, clear, and thorough. Use markdown for readability. Keep replies under 200 words unless asked for more. Discuss any topic: tech, career, life, hobbies, etc."},...k.map(pe=>({role:pe.role,content:pe.text})),{role:"user",content:A}],me=await ai(W,{maxTokens:o==="system-design"?450:600});L(pe=>[...pe,{role:"assistant",text:me}])}else{const U=await WT(A);if(o==="system-design"){const W=n.caseId?Tl().find(je=>je.id===n.caseId)??Od(A):Od(A),{text:me,citations:pe}=await VT(A,W,U);L(je=>[...je,{role:"assistant",text:me,citations:pe,grounded:pe.length>0,citationsSource:"lexical"}])}else{const{text:W,citations:me}=await JT(A,U);L(pe=>[...pe,{role:"assistant",text:W,citations:me,grounded:me.length>0,citationsSource:"lexical"}])}}}catch(U){L(W=>[...W,{role:"assistant",text:"⚠️ "+(U.message||"Coach unavailable")+(d==="api"?" — switch to 📚 Offline to keep going.":"")}])}finally{G(!1)}}},de=()=>{P&&(K.stop(),ue(!1)),ce(O)},J=()=>{P?(K.stop(),ue(!1)):(K.start(),ue(!0),bn("🎤 Listening — speak your question"))},Z=()=>{o==="system-design"?(m([]),oe(dd,[])):(x([]),oe(pd,[])),bn("🗑️ Chat cleared")},Ne=o==="system-design"?n.title?[{label:"🏗️ Overview",cmd:`Explain the architecture for ${n.title}`},{label:"⚖️ Trade-offs",cmd:`Key trade-offs for ${n.title}?`},{label:"⚠️ Mistakes",cmd:`Common mistakes in ${n.title}?`},{label:"📐 Scale",cmd:`How to handle scale for ${n.title}?`}]:[{label:"🏗️ Overview",cmd:"Architecture overview"},{label:"⚖️ Trade-offs",cmd:"Key trade-offs"},{label:"⚠️ Mistakes",cmd:"Common mistakes"},{label:"📐 Scale",cmd:"Scale considerations"}]:[{label:"💡 Explain",cmd:"Explain this to me simply"},{label:"📝 Summarize",cmd:"Summarize key points"},{label:"🔄 Compare",cmd:"Pros and cons?"},{label:"🎯 Next",cmd:"What should I do next?"}],V=Q=>`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all ${Q?"grad-bg text-white":"border border-line/15 text-mut hover:border-acc1/40"}`;return b.jsxs(b.Fragment,{children:[b.jsx("button",{onClick:()=>r(Q=>!Q),className:`no-print fixed bottom-20 right-4 z-[110] grid h-14 w-14 place-items-center rounded-full shadow-[0_8px_30px_rgba(99,102,241,.45)] transition-all hover:scale-110 md:bottom-8 ${i?"bg-deep border-2 border-acc1/50":"grad-bg"}`,title:"AI Coach (Ctrl+/)","aria-label":"Open AI Coach",children:b.jsx("span",{className:"text-[22px]",children:i?"✕":"🤖"})}),i&&b.jsx("div",{className:`no-print fixed bottom-[90px] z-[109] w-[380px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)] md:bottom-[80px] ${n.drawerOpen?"left-4":"right-4"}`,children:b.jsxs("div",{className:`${Pb} overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,.55)]`,children:[b.jsxs("div",{className:"flex border-b border-line/10",children:[b.jsxs("button",{onClick:()=>u("system-design"),className:`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-bold transition-all border-b-2 ${o==="system-design"?"border-acctxt text-acctxt bg-acc1/10":"border-transparent text-mut hover:text-ink hover:bg-wht/5"}`,children:[b.jsx("span",{children:"🏗️"}),b.jsx("span",{children:"System Design"}),n.title&&b.jsx("span",{className:"text-[9px]",children:"📎"})]}),b.jsxs("button",{onClick:()=>u("general"),className:`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-bold transition-all border-b-2 ${o==="general"?"border-acctxt text-acctxt bg-acc1/10":"border-transparent text-mut hover:text-ink hover:bg-wht/5"}`,children:[b.jsx("span",{children:"💬"}),b.jsx("span",{children:"General Chat"})]})]}),b.jsxs("div",{className:"flex items-center gap-2 border-b border-line/10 px-4 py-2.5",children:[b.jsx("span",{className:"text-[14px]",children:o==="system-design"?"🏗️":"💬"}),b.jsx("span",{className:"flex-1 text-[12px] font-extrabold",children:o==="system-design"?"System Design Coach":"General Chat"}),n.drawerOpen&&o==="system-design"&&b.jsx("span",{className:"text-[9px] font-bold text-acctxt animate-pulse",children:"← moved"}),k.length>0&&b.jsx("button",{onClick:Z,title:"Clear chat",className:"rounded-lg border border-line/15 px-2 py-0.5 text-[10px] font-bold text-mut hover:border-warn/40 hover:text-warn",children:"🗑️"}),b.jsxs("div",{className:"flex gap-1",children:[b.jsx("button",{type:"button",className:V(d==="api"),onClick:()=>p("api"),children:"🤖 AI"}),b.jsx("button",{type:"button",className:V(d==="local"),onClick:()=>p("local"),children:"📚 Offline"})]})]}),o==="system-design"&&n.title&&b.jsxs("div",{className:"flex items-center gap-2 border-b border-acc1/20 bg-acc1/10 px-4 py-2",children:[b.jsx("span",{className:"text-[14px]",children:n.icon}),b.jsxs("div",{className:"min-w-0 flex-1",children:[b.jsx("span",{className:"text-[12px] font-extrabold text-acctxt",children:n.title}),n.blurb&&b.jsx("p",{className:"truncate text-[11px] text-mut",children:n.blurb})]}),b.jsx("span",{className:"flex-none rounded-full border border-acc1/30 bg-acc1/15 px-2 py-0.5 text-[10px] font-bold text-acctxt",children:"📎 Context"})]}),o==="system-design"&&!n.title&&Y.length>0&&b.jsxs("div",{className:"border-b border-line/10 px-4 py-2",children:[b.jsx("div",{className:"mb-1 text-[10px] font-bold uppercase tracking-wider text-mut",children:"Recently studied"}),b.jsx("div",{className:"flex flex-wrap gap-1.5",children:Y.slice(0,5).map(Q=>{const A=HT(Q);return A?b.jsxs("button",{onClick:()=>{const U=window.__setCoachTopic;U&&U({caseId:A.id,title:A.title,icon:A.icon,blurb:A.blurb,drawerOpen:!1})},className:"flex items-center gap-1 rounded-full border border-line/15 bg-wht/5 px-2 py-0.5 text-[10.5px] font-bold text-mut hover:border-acc1/40 hover:text-ink",children:[b.jsx("span",{children:A.icon}),b.jsx("span",{className:"truncate max-w-[120px]",children:A.title})]},Q):null})})]}),d==="local"&&b.jsx("div",{className:"border-b border-line/10 px-4 py-2",children:b.jsx(sv,{minSim:ul().minSim,pool:ul().pool})}),k.length===0&&b.jsx("div",{className:"px-4 pt-3 pb-2 text-center",children:o==="system-design"?n.title?b.jsxs("div",{className:"text-[12.5px] leading-relaxed text-mut",children:["I know verified facts about ",b.jsx("strong",{children:n.title}),". Ask about architecture, trade-offs, failure modes, or scale."]}):b.jsx("div",{className:"text-[12.5px] leading-relaxed text-mut",children:"I know verified facts about all system design case studies. Every answer comes from curated, verified sources."}):b.jsxs("div",{children:[b.jsx("div",{className:"text-[14px] mb-1",children:"💬"}),b.jsx("div",{className:"text-[12.5px] font-bold text-ink",children:"Ask me anything!"}),b.jsx("div",{className:"text-[11.5px] text-mut mt-0.5",children:"Coding, math, writing, career advice, current events — you name it."}),b.jsx("div",{className:"mt-2",children:b.jsx("span",{className:"rounded-full border border-line/15 bg-wht/5 px-2.5 py-0.5 text-[10px] font-bold text-mut",children:"Ctrl + / to toggle"})})]})}),b.jsxs("div",{ref:N,className:"h-[300px] space-y-2 overflow-y-auto px-4 py-3 pr-2",children:[k.map((Q,A)=>{var U;return b.jsxs("div",{className:"flex flex-col",children:[Q.role==="user"&&b.jsx("div",{className:"mb-0.5 text-right text-[10px] font-bold text-mut",children:"You asked:"}),b.jsx("div",{className:`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${Q.role==="user"?"ml-auto grad-bg text-white":"bg-deep/60 text-ink"}`,children:Q.text}),Q.role==="assistant"&&((U=Q.citations)!=null&&U.length)?b.jsxs("div",{className:"mt-1 max-w-[90%] space-y-1",children:[b.jsx("div",{className:"text-[10px] font-bold uppercase tracking-wider text-ok",children:rv(Q.citations.length,Q.citationsSource)}),Q.citations.map((W,me)=>b.jsx(iv,{title:W.title,content:W.content,source:W.source},me))]}):null]},A)}),T&&b.jsx("div",{className:"text-[12px] text-mut",children:"…thinking"}),P&&b.jsxs("div",{className:"flex items-center gap-2 text-[12px] text-acc1",children:[b.jsx("span",{className:"h-2 w-2 animate-pulse rounded-full bg-acc1"}),b.jsx("span",{className:"font-bold",children:"Listening…"})]})]}),b.jsx("div",{className:"flex flex-wrap gap-1 border-t border-line/10 px-4 py-2",children:Ne.map(Q=>b.jsx("button",{disabled:T,onClick:()=>ce(Q.cmd),className:"rounded-full border border-line/15 px-2 py-0.5 text-[10.5px] font-bold text-mut hover:border-acc1/40 hover:text-ink disabled:opacity-50",children:Q.label},Q.label))}),b.jsxs("div",{className:"flex gap-2 border-t border-line/10 px-4 py-3",children:[K.supported&&b.jsx("button",{onClick:J,title:P?"Stop":"Voice",className:`flex-none self-end rounded-xl border px-2.5 py-2 text-[14px] ${P?"border-acc1/50 bg-acc1/15 text-acc1 animate-pulse":"border-line/25 bg-deep/60 text-mut hover:border-acc1/40 hover:text-acc1"}`,children:"🎤"}),b.jsx("textarea",{ref:I,value:O,rows:1,onChange:Q=>{_(Q.target.value),ae(Q.target)},onKeyDown:Q=>{Q.key==="Enter"&&!Q.shiftKey&&(Q.preventDefault(),de())},placeholder:o==="system-design"&&n.title?`Ask about ${n.title}…`:o==="system-design"?"Ask about system design…":"Ask me anything…",className:"min-h-[36px] w-full flex-1 resize-none overflow-hidden rounded-xl border border-line/25 bg-deep/60 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"}),b.jsx("button",{onClick:de,disabled:T||!O.trim(),className:"self-end rounded-xl bg-acc1 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-acc2 disabled:opacity-50",children:"Send"})]})]})})]})}function lv(){return ne(H.theme,"dark")}function cv(n){document.documentElement.classList.toggle("light",n==="light");const i=document.querySelector('meta[name="theme-color"]');i==null||i.setAttribute("content",n==="light"?"#eef1f8":"#0a0e1a")}function XT(n){oe(H.theme,n),cv(n)}function ZT(){cv(lv())}const eA=[{id:"monthly",label:"Monthly",price:9,per:"/mo"},{id:"yearly",label:"Yearly",price:79,per:"/yr"},{id:"lifetime",label:"Lifetime",price:199,per:" once"}];let St=null;function tA(){return St}function nA(){St=null}function uv(n){return{tier:n.tier??"free",plan:n.plan??null,expiresAt:n.expires_at??null,source:n.source??null,discountPct:Number(n.discount_pct??0),discountExpiresAt:n.discount_expires_at??null,active:!!n.active,issuedBy:n.issued_by??null,updatedAt:n.updated_at??null}}function aA(n){return!n||!n.discountPct||n.discountExpiresAt&&new Date(n.discountExpiresAt).getTime()<Date.now()?0:n.discountPct}function iA(n,i){return Math.round(n*(1-Math.max(0,Math.min(100,i))/100)*100)/100}function sA(n){return"$"+(Number.isInteger(n)?String(n):n.toFixed(2))}function dv(){return(St==null?void 0:St.active)===!0}async function pv(){try{const n=await ie();if(!n||!At().user)return null;const{data:i,error:r}=await n.rpc("get_my_entitlement");if(r)throw new Error(r.message);const o=(i??[])[0];return St=o?uv(o):{tier:"free",plan:null,expiresAt:null,source:null,discountPct:0,discountExpiresAt:null,active:!1,issuedBy:null,updatedAt:null},(os()!=="pro"||!St.active)&&rb(St.active?"pro":"free"),St}catch{return null}}async function rA(n){const i=await ie();if(!i||!At().user)return{ok:!1,error:"Sign in to your cloud account first — codes are tied to your account."};const{data:r,error:o}=await i.rpc("redeem_grant",{p_code:n.trim().toUpperCase()});if(o){const u=(o.message??"").toLowerCase();return{ok:!1,error:u.includes("already_used")?"That code was already used.":u.includes("invalid_code")?"That code doesn't exist — double-check it.":u.includes("expired")?"That code has expired.":o.message}}return St=(r??[])[0]?uv(r[0]):null,St!=null&&St.active&&rb("pro"),{ok:!0,entitlement:St??void 0}}async function hv(n,i){const r=await ie();if(!r)throw new Error("Cloud not configured");const{error:o}=await r.rpc(n,i);if(o)throw new Error(o.message)}async function oA(n,i,r,o,u="admin"){await hv("admin_set_entitlement",{p_user:n,p_tier:i,p_plan:r,p_expires:o,p_source:u})}async function lA(n,i,r=90){await hv("admin_issue_discount",{p_user:n,p_pct:Math.round(i),p_days:Math.round(r)})}async function cA(n,i,r){const o=await ie();if(!o)throw new Error("Cloud not configured");const{data:u,error:d}=await o.rpc("admin_create_grant",{p_plan:n,p_days:Math.round(i),p_discount_pct:Math.round(r)});if(d)throw new Error(d.message);return String(u??"")}async function uA(){const n=await ie();if(!n)throw new Error("Cloud not configured");const{data:i,error:r}=await n.rpc("admin_list_entitlements");if(r)throw new Error(r.message);return(i??[]).map(o=>({userId:String(o.user_id??""),email:String(o.email??""),tier:String(o.tier??"free"),plan:o.plan??null,expiresAt:o.expires_at??null,source:o.source??null,discountPct:Number(o.discount_pct??0),discountExpiresAt:o.discount_expires_at??null,active:!!o.active,updatedAt:o.updated_at??null}))}function dA(){return Lx()?"admin":dv()?"server":os()==="pro"?ne(H.licenseKey,"")?"local":"team":"free"}const SC=Object.freeze(Object.defineProperty({__proto__:null,PLANS:eA,adminCreateGrant:cA,adminIssueDiscount:lA,adminListEntitlements:uA,adminSetEntitlement:oA,clearServerEntitlement:nA,discountLive:aA,discountedPrice:iA,fmtMoney:sA,getCachedEntitlement:tA,redeemGrant:rA,refreshEntitlement:pv,serverPro:dv,tierSource:dA},Symbol.toStringTag,{value:"Module"}));class ky extends B.Component{constructor(r){super(r);en(this,"reset",()=>{this.setState({hasError:!1,error:null})});this.state={hasError:!1,error:null}}static getDerivedStateFromError(r){return{hasError:!0,error:r}}componentDidCatch(r,o){console.error(`[ErrorBoundary${this.props.section?` — ${this.props.section}`:""}]`,r,o.componentStack)}render(){var r;return this.state.hasError?this.props.fallback?this.props.fallback:b.jsxs("div",{className:"mx-auto max-w-lg space-y-4 rounded-2xl border border-warn/30 bg-warn/10 p-6 text-center",children:[b.jsx("span",{className:"text-4xl",children:"⚠️"}),b.jsx("h3",{className:"text-lg font-extrabold text-ink",children:"Something went wrong"}),b.jsxs("p",{className:"text-[13px] text-mut",children:[this.props.section?`The ${this.props.section} section`:"This section"," encountered an error and couldn't render."]}),b.jsx("p",{className:"text-[12px] text-fnt/50 font-mono",children:(r=this.state.error)==null?void 0:r.message}),b.jsx("button",{onClick:this.reset,className:"rounded-xl border border-acc1/40 bg-acc1/15 px-5 py-2 text-[13px] font-bold text-acctxt transition-all hover:bg-acc1/30",children:"Try again"})]}):this.props.children}}const pA=B.lazy(()=>ze(()=>import("./Landing-CpcNc9r4.js"),__vite__mapDeps([0,1,2,3,4,5]),import.meta.url).then(n=>({default:n.Landing}))),hA=B.lazy(()=>ze(()=>import("./Onboarding-DncEqXt3.js"),__vite__mapDeps([6,1,2,3,7,8,9,5]),import.meta.url).then(n=>({default:n.Onboarding}))),fA=B.lazy(()=>ze(()=>import("./Interview-BTcL342N.js"),__vite__mapDeps([10,1,2,3,8,11,5]),import.meta.url).then(n=>({default:n.Interview}))),mA=B.lazy(()=>ze(()=>import("./Results-DQD0EZhv.js"),__vite__mapDeps([12,1,13,11,5,14]),import.meta.url).then(n=>({default:n.Results}))),gA=B.lazy(()=>ze(()=>import("./Planner-Cxo_0sbq.js"),__vite__mapDeps([15,1,5]),import.meta.url).then(n=>({default:n.Planner}))),yA=B.lazy(()=>ze(()=>import("./Roadmap-CZNbzkXv.js"),__vite__mapDeps([16,1,17,18,7,5]),import.meta.url).then(n=>({default:n.Roadmap}))),bA=B.lazy(()=>ze(()=>import("./Drill-BodQ-KYb.js"),__vite__mapDeps([19,1,14,5]),import.meta.url).then(n=>({default:n.Drill}))),vA=B.lazy(()=>ze(()=>import("./Bank-BGr7Bla_.js"),__vite__mapDeps([20,1,21,14,5]),import.meta.url).then(n=>({default:n.Bank}))),wA=B.lazy(()=>ze(()=>import("./History-DSwLr_ml.js"),__vite__mapDeps([22,1,23,11,5]),import.meta.url).then(n=>({default:n.History}))),kA=B.lazy(()=>ze(()=>import("./Progress-DMa9BiEz.js"),__vite__mapDeps([24,1,11,5]),import.meta.url).then(n=>({default:n.Progress}))),xA=B.lazy(()=>ze(()=>import("./Settings-DvoGgrIS.js"),__vite__mapDeps([25,1,26,7,8,5]),import.meta.url).then(n=>({default:n.Settings}))),SA=B.lazy(()=>ze(()=>import("./Account-DSR4Ervg.js"),__vite__mapDeps([27,1,5]),import.meta.url).then(n=>({default:n.Account}))),TA=B.lazy(()=>ze(()=>import("./Playground-DToABiZY.js").then(n=>n.v),__vite__mapDeps([28,1,7,2,3,9]),import.meta.url).then(n=>({default:n.Playground}))),AA=B.lazy(()=>ze(()=>import("./Admin-CZLihlns.js").then(n=>n.A),__vite__mapDeps([29,1]),import.meta.url).then(n=>({default:n.Admin}))),qA=B.lazy(()=>ze(()=>import("./Team-CQ1oxguz.js"),__vite__mapDeps([30,1,23,11,5]),import.meta.url).then(n=>({default:n.Team}))),EA=B.lazy(()=>ze(()=>import("./Jobs-BdfEN--S.js"),__vite__mapDeps([31,1,2,3,18,21,11,5]),import.meta.url).then(n=>({default:n.Jobs}))),CA=B.lazy(()=>ze(()=>import("./Resources-qui8hUS-.js"),__vite__mapDeps([32,1,33,5]),import.meta.url).then(n=>({default:n.Resources}))),LA=B.lazy(()=>ze(()=>import("./Counselor-0isoF4qe.js"),__vite__mapDeps([34,1,33,35,5]),import.meta.url).then(n=>({default:n.Counselor}))),DA=B.lazy(()=>ze(()=>import("./SkillExplorer-DCw-ZAp0.js"),__vite__mapDeps([36,1,37,5]),import.meta.url).then(n=>({default:n.SkillExplorer}))),OA=B.lazy(()=>ze(()=>import("./SkillDetail-CBz1W9OT.js"),__vite__mapDeps([38,1,37,5]),import.meta.url).then(n=>({default:n.SkillDetail}))),zA=B.lazy(()=>ze(()=>import("./SystemDesign-CwINey14.js"),__vite__mapDeps([39,1,40,11,17,5]),import.meta.url).then(n=>({default:n.SystemDesign}))),jA=B.lazy(()=>ze(()=>import("./Legal-odqFs7-s.js"),__vite__mapDeps([41,1,5]),import.meta.url).then(n=>({default:n.Legal}))),MA=B.lazy(()=>ze(()=>import("./ShareView-LQGCYjhH.js"),__vite__mapDeps([13,1,11,5]),import.meta.url).then(n=>({default:n.ShareView}))),RA=[{id:"onboard",label:"Practice",icon:"🎯"},{id:"planner",label:"Planner",icon:"🗓️"},{id:"roadmap",label:"Roadmap",icon:"🧭"},{id:"systemDesign",label:"System Design",icon:"🏗️"},{id:"playground",label:"Code",icon:"💻"}],_A=[{id:"drill",label:"Drill",icon:"🎴"},{id:"bank",label:"Bank",icon:"📚"},{id:"jobs",label:"Jobs",icon:"💼"},{id:"learn",label:"Learn a Skill",icon:"🔍"},{id:"counselor",label:"Skill Counselor",icon:"🧑‍🏫"},{id:"resources",label:"Resources",icon:"🔗"},{id:"progress",label:"Progress",icon:"📈"},{id:"history",label:"History",icon:"🗂️"},{id:"settings",label:"Settings",icon:"⚙️"},{id:"account",label:"Account",icon:"👤"}];function xy(){return b.jsx("div",{className:"grid min-h-[40vh] place-items-center",children:b.jsxs("div",{className:"flex flex-col items-center gap-3 text-mut",children:[b.jsx("span",{className:"h-8 w-8 animate-spin rounded-full border-2 border-acc1 border-t-transparent"}),b.jsx("span",{className:"text-[13px] font-bold",children:"Loading…"})]})})}function NA(){const{state:n,nav:i}=dS(),[r,o]=B.useState(null),[u,d]=B.useState(navigator.onLine),[p,f]=B.useState(()=>lv()),[m,y]=B.useState(!1),[x,k]=B.useState(()=>Z2()),[L,O]=B.useState(()=>Rg()),[_,T]=B.useState(At()),[G]=B.useState(()=>new URLSearchParams(window.location.search).get("share")),[N,I]=B.useState(!1);B.useEffect(()=>{if(!("serviceWorker"in navigator))return;const V=Q=>{var A;((A=Q.data)==null?void 0:A.type)==="SW_UPDATE_READY"&&I(!0)};return navigator.serviceWorker.addEventListener("message",V),()=>navigator.serviceWorker.removeEventListener("message",V)},[]);const Y=()=>{var V,Q;(Q=(V=navigator.serviceWorker)==null?void 0:V.controller)==null||Q.postMessage({type:"SKIP_WAITING"}),I(!1),window.location.reload()};B.useEffect(()=>fr(T),[]),B.useEffect(()=>fr(()=>{tT().catch(()=>{})}),[]),B.useEffect(()=>{const V=()=>{pv()};V();const Q=fr(()=>{At().user&&V()}),A=window.setTimeout(V,1500);return()=>{Q(),window.clearTimeout(A)}},[]);const F=()=>{const V=p==="light"?"dark":"light";XT(V),f(V)};B.useEffect(()=>{if(!("Notification"in window))return;const V=()=>{X1({sessions:n.sessions}),nS({sessions:n.sessions})};V();const Q=setInterval(V,6e4),A=()=>{document.visibilityState==="visible"&&V()};return document.addEventListener("visibilitychange",A),()=>{clearInterval(Q),document.removeEventListener("visibilitychange",A)}},[n.sessions]),B.useEffect(()=>{const V=U=>{U.preventDefault(),o(U)},Q=()=>d(!0),A=()=>d(!1);return window.addEventListener("beforeinstallprompt",V),window.addEventListener("online",Q),window.addEventListener("offline",A),()=>{window.removeEventListener("beforeinstallprompt",V),window.removeEventListener("online",Q),window.removeEventListener("offline",A)}},[]);const K=async()=>{r&&(await r.prompt(),o(null))},P=n.view,ue=V=>{y(!1),i(V)},ae=V=>{window.location.hash=V,i("legal")};if(G)return b.jsx("div",{className:p==="dark"?"dark":"",children:b.jsx("main",{className:"mx-auto w-full max-w-[1200px] flex-1 px-4 pb-12 pt-6",children:b.jsx(B.Suspense,{fallback:b.jsx(xy,{}),children:b.jsx(MA,{payload:G})})})});const ce=V=>V==="roadmap"?"roadmap":V==="playground"?"playground":null,de=RA.filter(V=>{const Q=ce(V.id);return Q?cr(Q):!0}),J=[..._A.filter(V=>(V.id!=="drill"||cr("drill"))&&(V.id!=="jobs"||cr("jobs"))),{id:"team",label:"Team",icon:"🏢"},...x.isAdmin?[{id:"admin",label:"Admin",icon:"🛡️"}]:[]],Z=J.some(V=>V.id===P),Ne=[{id:"onboard",label:"Practice",icon:"🎯"},...cr("jobs")?[{id:"jobs",label:"Jobs",icon:"💼"}]:[],{id:"counselor",label:"Counselor",icon:"🧑‍🏫"},{id:"systemDesign",label:"Sys Design",icon:"🏗️"}];return B.useEffect(()=>eT(V=>{k(V),O(Rg()),Cx(V.isAdmin)}),[]),b.jsxs("div",{className:"flex min-h-screen flex-col",children:[b.jsx("header",{className:"no-print sticky top-0 z-50 border-b border-line/10 bg-night/85 backdrop-blur-xl",children:b.jsxs("div",{className:"mx-auto flex h-[60px] max-w-[1200px] items-center gap-3 px-4",children:[b.jsxs("button",{className:"flex items-center gap-2.5",onClick:()=>i("landing"),children:[b.jsx("span",{className:"grid h-9 w-9 place-items-center rounded-xl grad-bg text-[18px] shadow-[0_6px_18px_rgba(99,102,241,.45)]",children:"🎙️"}),b.jsxs("span",{className:"text-[17px] font-extrabold tracking-tight",children:["Interview",b.jsx("span",{className:"grad-text",children:"IQ"})]})]}),b.jsx("nav",{className:"ml-4 hidden items-center gap-1 md:flex",children:de.map(V=>b.jsx(IA,{icon:V.icon,label:V.label,active:P===V.id,onClick:()=>ue(V.id)},V.id))}),b.jsxs("div",{className:"relative hidden md:block",children:[b.jsx("button",{onClick:()=>y(V=>!V),"aria-label":"More","aria-expanded":m,title:"More",className:`grid h-9 w-9 place-items-center rounded-xl border text-[16px] transition-all ${m||Z?"border-acc1/50 bg-acc1/15 text-acctxt":"border-line/15 bg-wht/10 hover:bg-wht/20"}`,children:m?"✕":"☰"}),b.jsx("div",{className:`absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-line/10 bg-deep/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-xl transition-all duration-200 ease-out ${m?"translate-y-0 opacity-100":"pointer-events-none invisible -translate-y-2 opacity-0"}`,children:b.jsx(Sy,{current:P,tabs:J,onPick:ue})})]}),b.jsx("span",{className:"flex-1"}),!u&&b.jsx("span",{className:"hidden rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-[11.5px] font-bold text-warn sm:inline",children:"Offline — cached"}),b.jsxs("button",{onClick:()=>ue("account"),title:_.user?`Account — ${_.user.email}`:"Sign in / Sign up","aria-label":"Account",className:`relative flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[13px] font-bold transition-all active:scale-95 ${_.user?"border-line/15 bg-wht/10 hover:bg-wht/20":"border-acctxt/40 bg-acctxt/10 text-acctxt hover:bg-acctxt/20"}`,children:[b.jsx("span",{className:"grid h-7 w-7 place-items-center rounded-lg bg-deep/30 text-[12px] font-extrabold",children:_.user?(_.user.email??"?").charAt(0).toUpperCase():"👤"}),b.jsx("span",{className:"hidden sm:inline",children:_.user?(_.user.email??"Account").split("@")[0]:"Sign in"}),_.user&&b.jsx("span",{className:"absolute right-1 top-1 h-2 w-2 rounded-full border border-deep bg-ok"})]}),b.jsx("button",{onClick:F,title:p==="light"?"Switch to dark mode":"Switch to light mode",className:"grid h-10 w-10 place-items-center rounded-xl border border-line/15 bg-wht/10 text-[16px] transition-all hover:bg-wht/20 active:scale-95",children:p==="light"?"🌙":"☀️"}),b.jsx("span",{className:"hidden sm:inline-flex",children:b.jsx(O2,{})}),r&&b.jsx("button",{onClick:K,className:"hidden rounded-xl border border-acc1/50 bg-acc1/15 px-3.5 py-1.5 text-[13px] font-bold text-acctxt transition-all hover:bg-acc1/30 sm:inline-flex",children:"⬇ Install app"})]})}),b.jsx("main",{className:"mx-auto w-full max-w-[1200px] flex-1 px-4 pb-24 pt-6 md:pb-12",children:b.jsx(ky,{section:"page",children:b.jsxs(B.Suspense,{fallback:b.jsx(xy,{}),children:[P==="landing"&&b.jsx(pA,{}),P==="onboard"&&b.jsx(hA,{}),P==="interview"&&b.jsx(fA,{}),P==="results"&&b.jsx(mA,{}),P==="planner"&&b.jsx(gA,{}),P==="roadmap"&&b.jsx(yA,{}),P==="drill"&&b.jsx(bA,{}),P==="bank"&&b.jsx(vA,{}),P==="history"&&b.jsx(wA,{}),P==="progress"&&b.jsx(kA,{}),P==="settings"&&b.jsx(xA,{}),P==="account"&&b.jsx(SA,{}),P==="playground"&&b.jsx(TA,{}),P==="admin"&&b.jsx(AA,{}),P==="team"&&b.jsx(qA,{}),P==="legal"&&b.jsx(jA,{}),P==="jobs"&&b.jsx(EA,{}),P==="resources"&&b.jsx(CA,{}),P==="counselor"&&b.jsx(LA,{}),P==="learn"&&b.jsx(DA,{}),P==="learn-detail"&&b.jsx(OA,{}),P==="systemDesign"&&b.jsx(zA,{})]})})}),P!=="landing"&&b.jsx("footer",{className:"no-print border-t border-line/10 px-4 pb-24 pt-6 md:pb-8",children:b.jsxs("div",{className:"mx-auto flex max-w-[1200px] flex-col items-center gap-3 text-[12px] text-mut sm:flex-row sm:justify-between",children:[b.jsxs("span",{className:"font-extrabold",children:["Interview",b.jsx("span",{className:"grad-text",children:"IQ"})," — AI Interview Coach"]}),b.jsxs("span",{className:"flex flex-wrap items-center justify-center gap-x-4 gap-y-1",children:[b.jsx("button",{className:"transition-colors hover:text-ink",onClick:()=>ae("terms"),children:"Terms"}),b.jsx("button",{className:"transition-colors hover:text-ink",onClick:()=>ae("privacy"),children:"Privacy"}),b.jsx("button",{className:"transition-colors hover:text-ink",onClick:()=>ae("refunds"),children:"Refunds"}),b.jsx("button",{className:"transition-colors hover:text-ink",onClick:()=>ae("shipping"),children:"Shipping"}),b.jsxs("a",{href:"https://github.com/gaurav123337/interviewiq",target:"blank",rel:"noreferrer",className:"inline-flex items-center gap-1 transition-colors hover:text-ink",children:[b.jsx("span",{"aria-hidden":!0,children:"🐙"})," GitHub"]})]})]})}),N&&b.jsx("div",{className:"no-print fixed inset-x-0 top-[60px] z-40 px-3",children:b.jsxs("div",{className:"mx-auto flex max-w-[1200px] items-center gap-3 rounded-xl border border-ok/40 bg-ok/15 px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur-xl",children:[b.jsx("span",{className:"grid h-8 w-8 flex-none place-items-center rounded-lg bg-ok/30 text-[15px]",children:"🔄"}),b.jsxs("div",{className:"min-w-0 flex-1",children:[b.jsx("span",{className:"text-[13.5px] font-extrabold",children:"New version available!"}),b.jsx("p",{className:"text-[12.5px] text-mut",children:"Click refresh to get the latest features and improvements."})]}),b.jsx("button",{onClick:Y,className:"rounded-xl border border-ok/50 bg-ok/20 px-3.5 py-1.5 text-[13px] font-bold text-ok transition-all hover:bg-ok/30",children:"🔄 Refresh"}),b.jsx("button",{className:"grid h-8 w-8 flex-none place-items-center rounded-lg border border-line/15 bg-wht/10 text-[13px] font-bold text-mut transition-all hover:bg-wht/20 hover:text-ink",onClick:()=>I(!1),"aria-label":"Dismiss",children:"✕"})]})}),L&&b.jsx("div",{className:"no-print fixed inset-x-0 top-[60px] z-40 px-3",children:b.jsxs("div",{className:"mx-auto flex max-w-[1200px] items-center gap-3 rounded-xl border border-acc1/40 bg-panel/95 px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur-xl",children:[b.jsx("span",{className:"grid h-8 w-8 flex-none place-items-center rounded-lg grad-bg text-[15px]",children:"📣"}),b.jsxs("div",{className:"min-w-0 flex-1",children:[b.jsx("div",{className:"flex items-center gap-2",children:b.jsxs("span",{className:"text-[13.5px] font-extrabold",children:[L.badge&&b.jsx(C2,{tone:"co",children:L.badge})," ",L.title]})}),b.jsx("p",{className:"truncate text-[12.5px] text-mut",children:L.body})]}),b.jsx("button",{className:"grid h-8 w-8 flex-none place-items-center rounded-lg border border-line/15 bg-wht/10 text-[13px] font-bold text-mut transition-all hover:bg-wht/20 hover:text-ink",onClick:()=>{nx(L.id),O(null)},"aria-label":"Dismiss announcement",children:"✕"})]})}),b.jsx("div",{className:`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${m?"opacity-100":"pointer-events-none invisible opacity-0"}`,onClick:()=>y(!1),"aria-hidden":!0}),b.jsxs("nav",{className:"no-print fixed inset-x-0 bottom-0 z-50 border-t border-line/10 bg-deep/95 backdrop-blur-xl md:hidden",children:[b.jsx("div",{className:`absolute inset-x-0 bottom-full mb-2 px-3 transition-all duration-200 ease-out ${m?"translate-y-0 opacity-100":"pointer-events-none invisible translate-y-3 opacity-0"}`,children:b.jsx("div",{className:"rounded-2xl border border-line/10 bg-deep/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,.5)]",children:b.jsx(Sy,{current:P,tabs:J,onPick:ue})})}),b.jsxs("div",{className:"mx-auto flex max-w-[1200px] items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]",children:[Ne.map(V=>b.jsxs("button",{onClick:()=>ue(V.id),className:`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold ${P===V.id?"text-acc3":"text-fnt"}`,children:[b.jsx("span",{className:`grid h-9 w-9 place-items-center rounded-xl text-[20px] ${P===V.id?"bg-acc1/20":""}`,children:V.icon}),b.jsx("span",{className:"leading-none",children:V.label})]},V.id)),b.jsxs("button",{onClick:()=>y(V=>!V),"aria-label":"More","aria-expanded":m,className:`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold ${m||Z?"text-acc3":"text-fnt"}`,children:[b.jsx("span",{className:`grid h-9 w-9 place-items-center rounded-xl text-[20px] ${m||Z?"bg-acc1/20":""}`,children:m?"✕":"☰"}),b.jsx("span",{className:"leading-none",children:"More"})]})]})]}),b.jsx(sS,{}),b.jsx(hT,{children:b.jsx(ky,{section:"AI coach",children:b.jsx($T,{})})})]})}function Sy({current:n,tabs:i,onPick:r}){return b.jsx("div",{className:"grid gap-0.5 p-1",children:i.map(o=>{const u=n===o.id;return b.jsxs("button",{onClick:()=>r(o.id),className:`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold transition-all ${u?"grad-bg-soft border border-acc1/40 text-acctxt":"text-fnt hover:bg-wht/10 hover:text-ink"}`,children:[b.jsx("span",{className:"text-[15px]",children:o.icon}),b.jsx("span",{className:"flex-1 text-left",children:o.label}),u&&b.jsx("span",{className:"text-[10px] font-extrabold text-acc3",children:"●"})]},o.id)})})}function IA({icon:n,label:i,active:r,onClick:o}){return b.jsxs("button",{onClick:o,className:`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-bold transition-all ${r?"grad-bg-soft border border-acc1/40 text-acctxt":"text-mut hover:bg-wht/10 hover:text-ink"}`,children:[b.jsx("span",{children:n}),i]})}const zd=new Set;let et={teams:[],pending:[],roster:[],auditLog:[],activeTeamId:null,loading:!1,proBySeat:!1,error:null};function Un(n){et={...et,...n};for(const i of zd)try{i(et)}catch{}}function TC(){return et}function AC(n){return zd.add(n),n(et),()=>{zd.delete(n)}}function BA(){ti(),fr(()=>void ti())}let el=null;function ti(){return el||(el=UA().finally(()=>{el=null})),el}async function UA(){var r;const n=await ie(),i=At().user;if(!n||!i){Wu(!1),Un({teams:[],pending:[],roster:[],activeTeamId:null,loading:!1,proBySeat:!1,error:null});return}Un({loading:!0,error:null});try{const[o,u,d]=await Promise.all([rn(n,"my_teams"),rn(n,"my_pending_invites"),rn(n,"team_grants_pro")]),p=(o??[]).map(y=>({teamId:y.team_id,name:y.team_name,role:y.role,seats:y.seats,members:Number(y.members)})),f=(u??[]).map(y=>({teamId:y.team_id,teamName:y.team_name})),m=et.activeTeamId&&p.some(y=>y.teamId===et.activeTeamId)?et.activeTeamId:((r=p[0])==null?void 0:r.teamId)??null;Wu(!!d),Un({teams:p,pending:f,activeTeamId:m,loading:!1,proBySeat:!!d,error:null,auditLog:[]}),m&&(await Al(n,m),await yp(n,m))}catch(o){Wu(!1),Un({loading:!1,error:o.message})}}async function rn(n,i,r){const{data:o,error:u}=await n.rpc(i,r??{});if(u)throw new Error(u.message);return o}async function Al(n,i){try{const o=(await rn(n,"team_roster",{p_team_id:i})??[]).map(u=>({userId:u.user_id,email:u.email,role:u.role,status:u.status,invitedEmail:u.invited_email,createdAt:u.created_at}));Un({roster:o,error:null})}catch(r){Un({error:r.message})}}async function yp(n,i){try{const{data:r,error:o}=await n.from("team_audit").select("id, kind, meta, actor, created_at").eq("team_id",i).order("created_at",{ascending:!1}).limit(20);if(o)throw new Error(o.message);const u=(r??[]).map(d=>({id:d.id,kind:d.kind,meta:d.meta??{},actor:d.actor??"system",createdAt:d.created_at}));Un({auditLog:u,error:null})}catch(r){Un({error:r.message})}}function qC(n){Un({activeTeamId:n}),ie().then(i=>{i&&(Al(i,n),yp(i,n))})}async function EC(n,i){const r=await ie();if(!r)return{ok:!1,error:"Sign in to create a team."};try{return await rn(r,"create_team",{p_name:n,p_seats:i}),await ti(),{ok:!0}}catch(o){return{ok:!1,error:o.message}}}async function CC(n){const i=await ie();if(!i||!et.activeTeamId)return{ok:!1,error:"No team selected."};try{return await rn(i,"invite_member",{p_team_id:et.activeTeamId,p_email:n}),await Al(i,et.activeTeamId),{ok:!0}}catch(r){return{ok:!1,error:r.message}}}async function LC(n){const i=await ie();if(!i)return{ok:!1,error:"Sign in to accept."};try{return await rn(i,"accept_invite",{p_team_id:n}),await ti(),{ok:!0}}catch(r){return{ok:!1,error:r.message}}}async function DC(n){const i=await ie();if(!i||!et.activeTeamId)return{ok:!1,error:"No team selected."};try{return await rn(i,"remove_member",{p_team_id:et.activeTeamId,p_user_id:n}),await Al(i,et.activeTeamId),{ok:!0}}catch(r){return{ok:!1,error:r.message}}}async function OC(n){const i=await ie();if(!i)return{ok:!1,error:"Sign in first."};try{return await rn(i,"leave_team",{p_team_id:n}),await ti(),{ok:!0}}catch(r){return{ok:!1,error:r.message}}}async function zC(n){const i=await ie();if(!i)return{ok:!1,error:"Sign in first."};try{return await rn(i,"delete_team",{p_team_id:n}),await ti(),{ok:!0}}catch(r){return{ok:!1,error:r.message}}}function jC(n){var i;{const r=encodeURIComponent(`Team plan upgrade — ${((i=et.teams.find(o=>o.teamId===et.activeTeamId))==null?void 0:i.name)??""}`);window.location.href=`mailto:${mt.supportEmail}?subject=${r}`}}async function MC(n){const i=await ie();if(!i||!et.activeTeamId)return{ok:!1,error:"No team selected."};try{return await rn(i,"bump_team_seats",{p_team_id:et.activeTeamId,p_extra:n}),await ti(),await yp(i,et.activeTeamId),{ok:!0}}catch(r){return{ok:!1,error:r.message}}}ZT();const HA=new Sk({defaultOptions:{queries:{refetchOnWindowFocus:!1,retry:1,staleTime:3e4}}});V0.createRoot(document.getElementById("root")).render(b.jsx(B.StrictMode,{children:b.jsx(H0,{store:q2,children:b.jsx(Tk,{client:HA,children:b.jsx(uS,{children:b.jsx(NA,{})})})})}));"serviceWorker"in navigator&&window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{})});pb().then(()=>{nT(),BA()});export{B1 as $,IE as A,dq as B,yd as C,lq as D,kd as E,ni as F,Ky as G,pq as H,NT as I,UE as J,np as K,an as L,D2 as M,hq as N,fq as O,mq as P,gq as Q,gr as R,H as S,At as T,P1 as U,ls as V,vl as W,os as X,kC as Y,fr as Z,q1 as _,Q3 as a,cC as a$,fb as a0,nA as a1,U1 as a2,H1 as a3,TC as a4,AC as a5,ti as a6,LC as a7,qC as a8,jC as a9,Jd as aA,gp as aB,$E as aC,Ar as aD,sn as aE,l1 as aF,Pn as aG,T2 as aH,F3 as aI,Ld as aJ,ai as aK,Z2 as aL,ex as aM,ax as aN,eT as aO,ze as aP,tA as aQ,pv as aR,aA as aS,eA as aT,dA as aU,sA as aV,rb as aW,vb as aX,iA as aY,aT as aZ,aC as a_,MC as aa,BE as ab,DC as ac,OC as ad,zC as ae,EC as af,CC as ag,ie as ah,ne as ai,Zd as aj,mt as ak,nC as al,uA as am,tT as an,eC as ao,$2 as ap,oC as aq,tC as ar,cy as as,X2 as at,lC as au,iC as av,sC as aw,It as ax,L2 as ay,eb as az,Y3 as b,N1 as b$,rC as b0,Jb as b1,uC as b2,Z1 as b3,$b as b4,sq as b5,mC as b6,Er as b7,XA as b8,XE as b9,nq as bA,bC as bB,yC as bC,od as bD,Iq as bE,Bq as bF,t3 as bG,op as bH,Yq as bI,l2 as bJ,Qq as bK,pC as bL,bT as bM,ns as bN,WE as bO,ap as bP,QE as bQ,PE as bR,FE as bS,YE as bT,GE as bU,VE as bV,KE as bW,Cr as bX,lv as bY,ol as bZ,wb as b_,ZE as ba,wC as bb,bl as bc,cA as bd,oA as be,lA as bf,rs as bg,vn as bh,vC as bi,JA as bj,$A as bk,Bg as bl,WA as bm,Ta as bn,Sl as bo,ul as bp,sv as bq,iv as br,Kd as bs,ob as bt,Yx as bu,Sb as bv,eq as bw,ZA as bx,ab as by,tq as bz,Pb as c,FS as c$,XT as c0,C1 as c1,M1 as c2,yq as c3,tS as c4,wl as c5,bq as c6,JE as c7,R1 as c8,j1 as c9,gC as cA,kT as cB,hC as cC,fC as cD,dC as cE,dp as cF,iq as cG,oq as cH,Hx as cI,rp as cJ,is as cK,Eq as cL,BS as cM,Wq as cN,VA as cO,Nb as cP,y2 as cQ,Aq as cR,qq as cS,Nq as cT,Zq as cU,Xq as cV,n3 as cW,Fq as cX,Dq as cY,Lq as cZ,ey as c_,O1 as ca,D1 as cb,L1 as cc,z1 as cd,E1 as ce,I1 as cf,_1 as cg,rA as ch,F2 as ci,up as cj,pl as ck,uk as cl,ak as cm,QA as cn,fd as co,tn as cp,Uy as cq,tk as cr,nk as cs,hd as ct,Ny as cu,bk as cv,rk as cw,ft as cx,KA as cy,FA as cz,hl as d,jq as d0,Mq as d1,Oq as d2,_q as d3,zq as d4,Zg as d5,Rq as d6,JS as d7,VS as d8,Vq as d9,Tq as dA,Cq as dB,OS as dC,DS as dD,cs as dE,$q as dF,Jq as dG,kq as dH,Qi as dI,_b as dJ,cl as dK,f2 as dL,ny as dM,pS as dN,rq as dO,xq as dP,SC as dQ,g2 as da,qb as db,wq as dc,KS as dd,c2 as de,i2 as df,Pq as dg,u2 as dh,n2 as di,Sq as dj,qr as dk,Bb as dl,Eb as dm,m2 as dn,QS as dp,e2 as dq,vq as dr,Hq as ds,Gq as dt,Uq as du,Kq as dv,d2 as dw,CS as dx,LS as dy,e3 as dz,Cd as e,K3 as f,P3 as g,Ed as h,HE as i,b as j,Vd as k,Tt as l,kx as m,Qd as n,cq as o,G3 as p,tp as q,uq as r,aq as s,bn as t,dS as u,dr as v,C2 as w,ss as x,xC as y,oe as z};
