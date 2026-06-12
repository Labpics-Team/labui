(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const n of s)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function e(s){const n={};return s.integrity&&(n.integrity=s.integrity),s.referrerPolicy&&(n.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?n.credentials="include":s.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(s){if(s.ep)return;s.ep=!0;const n=e(s);fetch(s.href,n)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const L=globalThis,J=L.ShadowRoot&&(L.ShadyCSS===void 0||L.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,G=Symbol(),Y=new WeakMap;let pt=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==G)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(J&&t===void 0){const i=e!==void 0&&e.length===1;i&&(t=Y.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&Y.set(e,t))}return t}toString(){return this.cssText}};const $t=r=>new pt(typeof r=="string"?r:r+"",void 0,G),yt=(r,...t)=>{const e=r.length===1?r[0]:t.reduce((i,s,n)=>i+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+r[n+1],r[0]);return new pt(e,r,G)},gt=(r,t)=>{if(J)r.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const i=document.createElement("style"),s=L.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=e.cssText,r.appendChild(i)}},tt=J?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return $t(e)})(r):r;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:_t,defineProperty:vt,getOwnPropertyDescriptor:At,getOwnPropertyNames:Et,getOwnPropertySymbols:wt,getPrototypeOf:St}=Object,$=globalThis,et=$.trustedTypes,Ct=et?et.emptyScript:"",q=$.reactiveElementPolyfillSupport,O=(r,t)=>r,D={toAttribute(r,t){switch(t){case Boolean:r=r?Ct:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},Q=(r,t)=>!_t(r,t),st={attribute:!0,type:String,converter:D,reflect:!1,useDefault:!1,hasChanged:Q};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),$.litPropertyMetadata??($.litPropertyMetadata=new WeakMap);let w=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=st){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);s!==void 0&&vt(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:n}=At(this.prototype,t)??{get(){return this[e]},set(o){this[e]=o}};return{get:s,set(o){const l=s==null?void 0:s.call(this);n==null||n.call(this,o),this.requestUpdate(t,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??st}static _$Ei(){if(this.hasOwnProperty(O("elementProperties")))return;const t=St(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(O("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(O("properties"))){const e=this.properties,i=[...Et(e),...wt(e)];for(const s of i)this.createProperty(s,e[s])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[i,s]of e)this.elementProperties.set(i,s)}this._$Eh=new Map;for(const[e,i]of this.elementProperties){const s=this._$Eu(e,i);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const s of i)e.unshift(tt(s))}else t!==void 0&&e.push(tt(t));return e}static _$Eu(t,e){const i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return gt(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostConnected)==null?void 0:i.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostDisconnected)==null?void 0:i.call(e)})}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){var n;const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(s!==void 0&&i.reflect===!0){const o=(((n=i.converter)==null?void 0:n.toAttribute)!==void 0?i.converter:D).toAttribute(e,i.type);this._$Em=t,o==null?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){var n,o;const i=this.constructor,s=i._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const l=i.getPropertyOptions(s),a=typeof l.converter=="function"?{fromAttribute:l.converter}:((n=l.converter)==null?void 0:n.fromAttribute)!==void 0?l.converter:D;this._$Em=s;const d=a.fromAttribute(e,l.type);this[s]=d??((o=this._$Ej)==null?void 0:o.get(s))??d,this._$Em=null}}requestUpdate(t,e,i,s=!1,n){var o;if(t!==void 0){const l=this.constructor;if(s===!1&&(n=this[t]),i??(i=l.getPropertyOptions(t)),!((i.hasChanged??Q)(n,e)||i.useDefault&&i.reflect&&n===((o=this._$Ej)==null?void 0:o.get(t))&&!this.hasAttribute(l._$Eu(t,i))))return;this.C(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:n},o){i&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,o??e??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),s===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var i;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[n,o]of this._$Ep)this[n]=o;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[n,o]of s){const{wrapped:l}=o,a=this[n];l!==!0||this._$AL.has(n)||a===void 0||this.C(n,void 0,o,a)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),(i=this._$EO)==null||i.forEach(s=>{var n;return(n=s.hostUpdate)==null?void 0:n.call(s)}),this.update(e)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(e)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(i=>{var s;return(s=i.hostUpdated)==null?void 0:s.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[O("elementProperties")]=new Map,w[O("finalized")]=new Map,q==null||q({ReactiveElement:w}),($.reactiveElementVersions??($.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const k=globalThis,it=r=>r,j=k.trustedTypes,rt=j?j.createPolicy("lit-html",{createHTML:r=>r}):void 0,ut="$lit$",m=`lit$${Math.random().toFixed(9).slice(2)}$`,ft="?"+m,xt=`<${ft}>`,A=document,U=()=>A.createComment(""),N=r=>r===null||typeof r!="object"&&typeof r!="function",X=Array.isArray,Pt=r=>X(r)||typeof(r==null?void 0:r[Symbol.iterator])=="function",W=`[ 	
\f\r]`,P=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,nt=/-->/g,ot=/>/g,g=RegExp(`>|${W}(?:([^\\s"'>=/]+)(${W}*=${W}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),at=/'/g,lt=/"/g,bt=/^(?:script|style|textarea|title)$/i,Ot=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),V=Ot(1),C=Symbol.for("lit-noChange"),h=Symbol.for("lit-nothing"),ct=new WeakMap,_=A.createTreeWalker(A,129);function mt(r,t){if(!X(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return rt!==void 0?rt.createHTML(t):t}const kt=(r,t)=>{const e=r.length-1,i=[];let s,n=t===2?"<svg>":t===3?"<math>":"",o=P;for(let l=0;l<e;l++){const a=r[l];let d,p,c=-1,f=0;for(;f<a.length&&(o.lastIndex=f,p=o.exec(a),p!==null);)f=o.lastIndex,o===P?p[1]==="!--"?o=nt:p[1]!==void 0?o=ot:p[2]!==void 0?(bt.test(p[2])&&(s=RegExp("</"+p[2],"g")),o=g):p[3]!==void 0&&(o=g):o===g?p[0]===">"?(o=s??P,c=-1):p[1]===void 0?c=-2:(c=o.lastIndex-p[2].length,d=p[1],o=p[3]===void 0?g:p[3]==='"'?lt:at):o===lt||o===at?o=g:o===nt||o===ot?o=P:(o=g,s=void 0);const b=o===g&&r[l+1].startsWith("/>")?" ":"";n+=o===P?a+xt:c>=0?(i.push(d),a.slice(0,c)+ut+a.slice(c)+m+b):a+m+(c===-2?l:b)}return[mt(r,n+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]};class T{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let n=0,o=0;const l=t.length-1,a=this.parts,[d,p]=kt(t,e);if(this.el=T.createElement(d,i),_.currentNode=this.el.content,e===2||e===3){const c=this.el.content.firstChild;c.replaceWith(...c.childNodes)}for(;(s=_.nextNode())!==null&&a.length<l;){if(s.nodeType===1){if(s.hasAttributes())for(const c of s.getAttributeNames())if(c.endsWith(ut)){const f=p[o++],b=s.getAttribute(c).split(m),z=/([.?@])?(.*)/.exec(f);a.push({type:1,index:n,name:z[2],strings:b,ctor:z[1]==="."?Nt:z[1]==="?"?Tt:z[1]==="@"?Mt:B}),s.removeAttribute(c)}else c.startsWith(m)&&(a.push({type:6,index:n}),s.removeAttribute(c));if(bt.test(s.tagName)){const c=s.textContent.split(m),f=c.length-1;if(f>0){s.textContent=j?j.emptyScript:"";for(let b=0;b<f;b++)s.append(c[b],U()),_.nextNode(),a.push({type:2,index:++n});s.append(c[f],U())}}}else if(s.nodeType===8)if(s.data===ft)a.push({type:2,index:n});else{let c=-1;for(;(c=s.data.indexOf(m,c+1))!==-1;)a.push({type:7,index:n}),c+=m.length-1}n++}}static createElement(t,e){const i=A.createElement("template");return i.innerHTML=t,i}}function x(r,t,e=r,i){var o,l;if(t===C)return t;let s=i!==void 0?(o=e._$Co)==null?void 0:o[i]:e._$Cl;const n=N(t)?void 0:t._$litDirective$;return(s==null?void 0:s.constructor)!==n&&((l=s==null?void 0:s._$AO)==null||l.call(s,!1),n===void 0?s=void 0:(s=new n(r),s._$AT(r,e,i)),i!==void 0?(e._$Co??(e._$Co=[]))[i]=s:e._$Cl=s),s!==void 0&&(t=x(r,s._$AS(r,t.values),s,i)),t}class Ut{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=((t==null?void 0:t.creationScope)??A).importNode(e,!0);_.currentNode=s;let n=_.nextNode(),o=0,l=0,a=i[0];for(;a!==void 0;){if(o===a.index){let d;a.type===2?d=new H(n,n.nextSibling,this,t):a.type===1?d=new a.ctor(n,a.name,a.strings,this,t):a.type===6&&(d=new Ht(n,this,t)),this._$AV.push(d),a=i[++l]}o!==(a==null?void 0:a.index)&&(n=_.nextNode(),o++)}return _.currentNode=A,s}p(t){let e=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class H{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=h,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=x(this,t,e),N(t)?t===h||t==null||t===""?(this._$AH!==h&&this._$AR(),this._$AH=h):t!==this._$AH&&t!==C&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Pt(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==h&&N(this._$AH)?this._$AA.nextSibling.data=t:this.T(A.createTextNode(t)),this._$AH=t}$(t){var n;const{values:e,_$litType$:i}=t,s=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=T.createElement(mt(i.h,i.h[0]),this.options)),i);if(((n=this._$AH)==null?void 0:n._$AD)===s)this._$AH.p(e);else{const o=new Ut(s,this),l=o.u(this.options);o.p(e),this.T(l),this._$AH=o}}_$AC(t){let e=ct.get(t.strings);return e===void 0&&ct.set(t.strings,e=new T(t)),e}k(t){X(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const n of t)s===e.length?e.push(i=new H(this.O(U()),this.O(U()),this,this.options)):i=e[s],i._$AI(n),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){var i;for((i=this._$AP)==null?void 0:i.call(this,!1,!0,e);t!==this._$AB;){const s=it(t).nextSibling;it(t).remove(),t=s}}setConnected(t){var e;this._$AM===void 0&&(this._$Cv=t,(e=this._$AP)==null||e.call(this,t))}}class B{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,n){this.type=1,this._$AH=h,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=n,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=h}_$AI(t,e=this,i,s){const n=this.strings;let o=!1;if(n===void 0)t=x(this,t,e,0),o=!N(t)||t!==this._$AH&&t!==C,o&&(this._$AH=t);else{const l=t;let a,d;for(t=n[0],a=0;a<n.length-1;a++)d=x(this,l[i+a],e,a),d===C&&(d=this._$AH[a]),o||(o=!N(d)||d!==this._$AH[a]),d===h?t=h:t!==h&&(t+=(d??"")+n[a+1]),this._$AH[a]=d}o&&!s&&this.j(t)}j(t){t===h?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class Nt extends B{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===h?void 0:t}}class Tt extends B{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==h)}}class Mt extends B{constructor(t,e,i,s,n){super(t,e,i,s,n),this.type=5}_$AI(t,e=this){if((t=x(this,t,e,0)??h)===C)return;const i=this._$AH,s=t===h&&i!==h||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,n=t!==h&&(i===h||s);s&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e;typeof this._$AH=="function"?this._$AH.call(((e=this.options)==null?void 0:e.host)??this.element,t):this._$AH.handleEvent(t)}}class Ht{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){x(this,t)}}const F=k.litHtmlPolyfillSupport;F==null||F(T,H),(k.litHtmlVersions??(k.litHtmlVersions=[])).push("3.3.3");const Rt=(r,t,e)=>{const i=(e==null?void 0:e.renderBefore)??t;let s=i._$litPart$;if(s===void 0){const n=(e==null?void 0:e.renderBefore)??null;i._$litPart$=s=new H(t.insertBefore(U(),n),n,void 0,e??{})}return s._$AI(r),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const v=globalThis;class S extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var e;const t=super.createRenderRoot();return(e=this.renderOptions).renderBefore??(e.renderBefore=t.firstChild),t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Rt(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return C}}var dt;S._$litElement$=!0,S.finalized=!0,(dt=v.litElementHydrateSupport)==null||dt.call(v,{LitElement:S});const K=v.litElementPolyfillSupport;K==null||K({LitElement:S});(v.litElementVersions??(v.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const zt=r=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(r,t)}):customElements.define(r,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Lt={attribute:!0,type:String,converter:D,reflect:!1,hasChanged:Q},Dt=(r=Lt,t,e)=>{const{kind:i,metadata:s}=e;let n=globalThis.litPropertyMetadata.get(s);if(n===void 0&&globalThis.litPropertyMetadata.set(s,n=new Map),i==="setter"&&((r=Object.create(r)).wrapped=!0),n.set(e.name,r),i==="accessor"){const{name:o}=e;return{set(l){const a=t.get.call(this);t.set.call(this,l),this.requestUpdate(o,a,r,!0,l)},init(l){return l!==void 0&&this.C(o,void 0,r,l),l}}}if(i==="setter"){const{name:o}=e;return function(l){const a=this[o];t.call(this,l),this.requestUpdate(o,a,r,!0,l)}}throw Error("Unsupported decorator location: "+i)};function E(r){return(t,e)=>typeof e=="object"?Dt(r,t,e):((i,s,n)=>{const o=s.hasOwnProperty(n);return s.constructor.createProperty(n,i),o?Object.getOwnPropertyDescriptor(s,n):void 0})(r,t,e)}var jt=Object.defineProperty,Bt=Object.getOwnPropertyDescriptor,y=(r,t,e,i)=>{for(var s=i>1?void 0:i?Bt(t,e):t,n=r.length-1,o;n>=0;n--)(o=r[n])&&(s=(i?o(t,e,s):o(s))||s);return i&&s&&jt(t,e,s),s};let u=class extends S{constructor(){super(...arguments),this.type="accent",this.kind="fill",this.size="m",this.icon=!1,this.loading=!1,this.disabled=!1,this.htmlType="button"}render(){const r=this.disabled||this.loading;return V`
      <button
        type=${this.htmlType}
        ?disabled=${r}
        aria-busy=${this.loading?"true":h}
        aria-disabled=${this.disabled?"true":h}
      >
        ${this.loading?V`<span class="spinner" aria-hidden="true"></span>`:h}
        <span class="label">
          <slot name="icon"></slot>
          ${this.icon?h:V`<slot></slot>`}
        </span>
      </button>
    `}};u.shadowRootOptions={...S.shadowRootOptions,delegatesFocus:!0};u.styles=yt`
    :host {
      /* Token-driven knobs the size axis maps onto. No literal hex anywhere. */
      --_radius: var(--lab-radius-control, 0.5rem);
      --_font: var(--lab-font-size-md, 1rem);
      --_pad-x: var(--lab-space-md, 1rem);
      --_pad-y: var(--lab-space-sm, 0.5rem);
      --_gap: var(--lab-space-sm, 0.5rem);
      --_min: 2.5rem;

      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='s']) {
      --_font: var(--lab-font-size-xs, 0.8333rem);
      --_pad-x: var(--lab-space-sm, 0.5rem);
      --_pad-y: var(--lab-space-xs, 0.25rem);
      --_min: 2rem;
    }
    :host([size='l']) {
      --_font: var(--lab-font-size-lg, 1.2rem);
      --_pad-x: var(--lab-space-lg, 1.5rem);
      --_pad-y: var(--lab-space-md, 1rem);
      --_min: 3rem;
    }

    button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--_gap);
      min-height: var(--_min);
      padding: var(--_pad-y) var(--_pad-x);
      border-radius: var(--_radius);
      border: 0.0625rem solid transparent;
      font: inherit;
      font-size: var(--_font);
      line-height: var(--lab-line-height-md, 1.5);
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      /* Defensive direction faster than the relaxing one (motion principle):
         this prototype keeps it simple — a single short transition. */
      transition:
        background-color 120ms ease,
        border-color 120ms ease,
        color 120ms ease;
      /* Base: transparent surface, primary label. The [type][kind] selectors
         below override these directly with the --lab-* role. We set the
         longhands directly (not via an intermediate --_bg custom property): a
         var()->var() chain across the shadow boundary fails to re-invalidate in
         Chromium when the theme set is swapped, so the paint would go stale. */
      background-color: transparent;
      color: var(--lab-label-primary);
      border-color: transparent;
    }

    /* Icon-only: square, no text padding asymmetry. */
    :host([icon]) button {
      width: var(--_min);
      padding: 0;
      aspect-ratio: 1;
    }

    /* ---- type=accent ---------------------------------------------------- */
    /* Roles read straight from the --lab-* contract — no hex fallbacks in the
       component. Every role is supplied by the active theme variable set.
       Longhands set directly so a theme swap repaints (see base note). */
    :host([type='accent'][kind='fill']) button {
      background-color: var(--lab-fill-accent);
      color: var(--lab-label-on-accent);
    }
    :host([type='accent'][kind='tinted']) button {
      background-color: var(--lab-fill-accent-tinted);
      color: var(--lab-label-accent);
    }
    :host([type='accent'][kind='border']) button {
      color: var(--lab-label-accent);
      border-color: var(--lab-border-accent);
    }
    :host([type='accent'][kind='ghost']) button {
      color: var(--lab-label-accent);
    }

    /* ---- type=neutral --------------------------------------------------- */
    :host([type='neutral'][kind='fill']) button {
      background-color: var(--lab-fill-neutral);
      color: var(--lab-label-on-neutral);
    }
    :host([type='neutral'][kind='tinted']) button {
      background-color: var(--lab-fill-neutral-tinted);
      color: var(--lab-label-primary);
    }
    :host([type='neutral'][kind='border']) button {
      color: var(--lab-label-primary);
      border-color: var(--lab-border-neutral);
    }
    :host([type='neutral'][kind='ghost']) button {
      color: var(--lab-label-primary);
    }

    /* ---- type=danger ---------------------------------------------------- */
    :host([type='danger'][kind='fill']) button {
      background-color: var(--lab-fill-danger);
      color: var(--lab-label-on-danger);
    }
    :host([type='danger'][kind='tinted']) button {
      background-color: var(--lab-fill-danger-tinted);
      color: var(--lab-label-danger);
    }
    :host([type='danger'][kind='border']) button {
      color: var(--lab-label-danger);
      border-color: var(--lab-border-danger);
    }
    :host([type='danger'][kind='ghost']) button {
      color: var(--lab-label-danger);
    }

    /* ---- interactive states (hover / active / focus) -------------------- */
    button:hover {
      filter: brightness(1.08);
    }
    button:active {
      filter: brightness(0.92);
    }
    button:focus-visible {
      outline: 0.125rem solid var(--lab-border-focus);
      outline-offset: 0.125rem;
    }

    /* ---- disabled ------------------------------------------------------- */
    :host([disabled]) button,
    button[disabled] {
      cursor: not-allowed;
      opacity: 0.45;
      filter: none;
    }

    /* ---- loading -------------------------------------------------------- */
    :host([loading]) button {
      cursor: progress;
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: var(--_gap);
    }
    :host([loading]) .label {
      visibility: hidden;
    }
    .spinner {
      position: absolute;
      width: 1em;
      height: 1em;
      border: 0.125rem solid currentColor;
      border-right-color: transparent;
      border-radius: var(--lab-radius-full, 9999px);
      animation: spin 0.7s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 0s;
      }
      button {
        transition: none;
      }
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    button {
      position: relative;
    }
  `;y([E({reflect:!0})],u.prototype,"type",2);y([E({reflect:!0})],u.prototype,"kind",2);y([E({reflect:!0})],u.prototype,"size",2);y([E({type:Boolean,reflect:!0})],u.prototype,"icon",2);y([E({type:Boolean,reflect:!0})],u.prototype,"loading",2);y([E({type:Boolean,reflect:!0})],u.prototype,"disabled",2);y([E()],u.prototype,"htmlType",2);u=y([zt("lab-button")],u);const It=["accent","neutral","danger"],qt=["fill","tinted","border","ghost"],Wt=["s","m","l"];function I(r){const t=document.createElement("div");t.className="cell";const e=document.createElement("span");return e.className="caption",e.textContent=r,t.appendChild(e),t}function M(r){const t=document.createElement("lab-button");if(t.setAttribute("type",r.type),t.setAttribute("kind",r.kind),r.size&&t.setAttribute("size",r.size),r.icon&&t.setAttribute("icon",""),r.loading&&t.setAttribute("loading",""),r.disabled&&t.setAttribute("disabled",""),t.setAttribute("data-testid",r.testid),r.icon){const e=document.createElement("span");e.slot="icon",e.textContent="★",t.appendChild(e)}else t.textContent=r.label??`${r.type}/${r.kind}`;return t}const R=document.getElementById("matrix");if(!R)throw new Error("matrix mount point missing");for(const r of It)for(const t of qt){const e=I(`${r} · ${t}`);e.appendChild(M({type:r,kind:t,testid:`btn-${r}-${t}`})),R.appendChild(e)}{const r=I("size s · m · l");for(const t of Wt)r.appendChild(M({type:"accent",kind:"fill",size:t,testid:`btn-size-${t}`,label:t}));R.appendChild(r)}{const r=I("icon-only");r.appendChild(M({type:"accent",kind:"fill",icon:!0,testid:"btn-icon"})),R.appendChild(r)}{const r=I("loading · disabled");r.appendChild(M({type:"accent",kind:"fill",loading:!0,testid:"btn-loading",label:"Saving"})),r.appendChild(M({type:"neutral",kind:"border",disabled:!0,testid:"btn-disabled",label:"Off"})),R.appendChild(r)}const Z=document.getElementById("theme-toggle"),ht=document.querySelector('[data-testid="theme-name"]');Z==null||Z.addEventListener("click",()=>{const r=document.body.dataset.theme==="dark"?"light":"dark";document.body.dataset.theme=r,ht&&(ht.textContent=r)});
