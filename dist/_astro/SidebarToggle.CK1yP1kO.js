import{r as u}from"./index.DiEladB3.js";var o={exports:{}},a={};/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var d;function c(){if(d)return a;d=1;var r=Symbol.for("react.transitional.element"),i=Symbol.for("react.fragment");function t(x,e,s){var l=null;if(s!==void 0&&(l=""+s),e.key!==void 0&&(l=""+e.key),"key"in e){s={};for(var n in e)n!=="key"&&(s[n]=e[n])}else s=e;return e=s.ref,{$$typeof:r,type:x,key:l,ref:e!==void 0?e:null,props:s}}return a.Fragment=i,a.jsx=t,a.jsxs=t,a}var m;function f(){return m||(m=1,o.exports=c()),o.exports}var p=f();function R(){const[r,i]=u.useState(!1);return u.useEffect(()=>{const t=document.getElementById("sidebar");t&&(r?(t.classList.add("-translate-y-full"),t.classList.add("md:w-xs"),t.classList.add("md:-translate-x-64")):(t.classList.remove("-translate-y-full"),t.classList.remove("md:w-xs"),t.classList.remove("md:-translate-x-64")))},[r]),p.jsx("button",{className:`fixed md:absolute top-4 right-8 md:right-auto md:left-[18rem] transition-all duration-500
            ${r?"md:left-1 rotate-180":"md:left-[18rem]]"}
            p-2 text-zinc-400 hover:text-white material-icons z-50`,"aria-label":"",onClick:()=>i(!r),children:r?"menu":"close"})}export{R as default};
