/*! @akedly/shield 1.1.0 — MIT — https://www.npmjs.com/package/@akedly/shield */
var C=new Uint32Array([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]),E=new Uint32Array([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]);function d(i,r){return r>>>i|r<<32-i}function P(i){var r;if(typeof i=="string"){r=[];for(var e=0;e<i.length;e++)(f=i.charCodeAt(e))<128?r.push(f):f<2048?r.push(192|f>>6,128|63&f):r.push(224|f>>12,128|f>>6&63,128|63&f)}else r=i;var c=r.length,o=8*c,s=c+1+8,u=64*Math.ceil(s/64),h=new Uint8Array(u);for(e=0;e<c;e++)h[e]=r[e];h[c]=128;var x=new DataView(h.buffer);x.setUint32(u-4,o>>>0,!1),o>4294967295&&x.setUint32(u-8,Math.floor(o/4294967296),!1);for(var n=new Uint32Array(E),a=new Uint32Array(64),y=0;y<u;y+=64){for(var t=0;t<16;t++)a[t]=x.getUint32(y+4*t,!1);for(t=16;t<64;t++){var w=d(7,a[t-15])^d(18,a[t-15])^a[t-15]>>>3,g=d(17,a[t-2])^d(19,a[t-2])^a[t-2]>>>10;a[t]=a[t-16]+w+a[t-7]+g>>>0}var l=n[0],b=n[1],f=n[2],p=n[3],v=n[4],m=n[5],k=n[6],_=n[7];for(t=0;t<64;t++){var H=_+(d(6,v)^d(11,v)^d(25,v))+(v&m^~v&k)+C[t]+a[t]>>>0,A=l&b^l&f^b&f;_=k,k=m,m=v,v=p+H>>>0,p=f,f=b,b=l,l=H+((d(2,l)^d(13,l)^d(22,l))+A>>>0)>>>0}n[0]=n[0]+l>>>0,n[1]=n[1]+b>>>0,n[2]=n[2]+f>>>0,n[3]=n[3]+p>>>0,n[4]=n[4]+v>>>0,n[5]=n[5]+m>>>0,n[6]=n[6]+k>>>0,n[7]=n[7]+_>>>0}var L="";for(e=0;e<8;e++)L+=("00000000"+n[e].toString(16)).slice(-8);return L}var S=!1,T=null;function R(i,r,e){return e||(e={}),(S?Promise.resolve():T||(T=new Promise(function(c,o){if(typeof document<"u"){if(window.turnstile!==void 0)return S=!0,void c();var s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",s.async=!0,s.onload=function(){S=!0,c()},s.onerror=function(){T=null,o(new Error("Failed to load Turnstile script"))},document.head.appendChild(s)}else o(new Error("Turnstile requires a browser environment"))}))).then(function(){return new Promise(function(c,o){window.turnstile.render(r,{sitekey:i,theme:e.theme||"auto",size:e.size||"normal",callback:function(s){c(s)},"error-callback":function(s){o(new Error("Turnstile error: "+s))},"expired-callback":function(){o(new Error("Turnstile token expired"))}})})})}function I(i,r){if(typeof document>"u")return Promise.reject(new Error("getTurnstileToken requires a browser environment. Use the Turnstile bridge page for mobile apps."));r||(r={});var e=document.createElement("div");return e.style.position="fixed",e.style.top="-9999px",e.style.left="-9999px",document.body.appendChild(e),R(i,e,r).then(function(c){return document.body.removeChild(e),c}).catch(function(c){throw e.parentNode&&document.body.removeChild(e),c})}var W=`var K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

var H_INIT = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }

function sha256HexSync(input) {
  var bytes;
  if (typeof input === 'string') {
    bytes = [];
    for (var i = 0; i < input.length; i++) {
      var c = input.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
  } else {
    bytes = input;
  }

  var len = bytes.length;
  var bitLen = len * 8;
  var padded = len + 1 + 8;
  var blocks = Math.ceil(padded / 64);
  var totalLen = blocks * 64;
  var buf = new Uint8Array(totalLen);
  for (var i = 0; i < len; i++) buf[i] = bytes[i];
  buf[len] = 0x80;
  var dv = new DataView(buf.buffer);
  dv.setUint32(totalLen - 4, bitLen >>> 0, false);
  if (bitLen > 0xffffffff) {
    dv.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  }

  var H = new Uint32Array(H_INIT);
  var W = new Uint32Array(64);

  for (var b = 0; b < totalLen; b += 64) {
    for (var t = 0; t < 16; t++) {
      W[t] = dv.getUint32(b + t * 4, false);
    }
    for (var t = 16; t < 64; t++) {
      var s0 = rotr(7, W[t-15]) ^ rotr(18, W[t-15]) ^ (W[t-15] >>> 3);
      var s1 = rotr(17, W[t-2]) ^ rotr(19, W[t-2]) ^ (W[t-2] >>> 10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
    }

    var a = H[0], b_ = H[1], c = H[2], d = H[3];
    var e = H[4], f = H[5], g = H[6], h = H[7];

    for (var t = 0; t < 64; t++) {
      var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      var ch = (e & f) ^ (~e & g);
      var temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      var maj = (a & b_) ^ (a & c) ^ (b_ & c);
      var temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b_; b_ = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b_) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  var hex = '';
  for (var i = 0; i < 8; i++) {
    hex += ('00000000' + H[i].toString(16)).slice(-8);
  }
  return hex;
}

async function sha256Hex(input) {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    try {
      var enc = new TextEncoder();
      var data = enc.encode(input);
      var buf = await globalThis.crypto.subtle.digest('SHA-256', data);
      var arr = new Uint8Array(buf);
      var hex = '';
      for (var i = 0; i < arr.length; i++) {
        hex += ('00' + arr[i].toString(16)).slice(-2);
      }
      return hex;
    } catch (e) {
      return sha256HexSync(input);
    }
  }
  return sha256HexSync(input);
}


function solve(challenge, difficulty, sha256SyncFn) {
  var prefix = '';
  for (var i = 0; i < difficulty; i++) prefix += '0';
  var nonce = 0;
  while (true) {
    var hash = sha256SyncFn(challenge + ':' + String(nonce));
    if (hash.startsWith(prefix)) {
      return { nonce: nonce, hashesChecked: nonce + 1 };
    }
    nonce++;
  }
}

function solveBatch(challenge, difficulty, sha256SyncFn, startNonce, batchSize) {
  if (batchSize === undefined) batchSize = 10000;
  var prefix = '';
  for (var i = 0; i < difficulty; i++) prefix += '0';
  var end = startNonce + batchSize;
  for (var nonce = startNonce; nonce < end; nonce++) {
    var hash = sha256SyncFn(challenge + ':' + String(nonce));
    if (hash.startsWith(prefix)) {
      return { nonce: nonce, found: true, hashesChecked: nonce - startNonce + 1 };
    }
  }
  return { nonce: -1, found: false, hashesChecked: batchSize };
}


var PROGRESS_INTERVAL = 50000;

self.onmessage = function (e) {
  var msg = e.data;
  if (msg.type === 'solve') {
    var challenge = msg.challenge;
    var difficulty = msg.difficulty;
    var id = msg.id;

    var prefix = '';
    for (var i = 0; i < difficulty; i++) prefix += '0';
    var nonce = 0;

    while (true) {
      var hash = sha256HexSync(challenge + ':' + String(nonce));
      if (hash.startsWith(prefix)) {
        self.postMessage({ type: 'result', nonce: nonce, hashesChecked: nonce + 1, id: id });
        return;
      }
      nonce++;
      if (nonce % PROGRESS_INTERVAL === 0) {
        self.postMessage({ type: 'progress', hashesChecked: nonce, id: id });
      }
    }
  }
};
`,N=0;function U(i){i||(i={});var r=i.useWorker;this._useWorker=r===void 0||r==="auto"?typeof Worker<"u"&&typeof Blob<"u"&&typeof URL<"u"&&typeof URL.createObjectURL=="function":!!r,this._worker=null,this._blobUrl=null}U.prototype.solve=function(i,r,e){e||(e={});var c=e.onProgress,o=this;return this._useWorker&&W?new Promise(function(s,u){try{var h=new Blob([W],{type:"application/javascript"});o._blobUrl=URL.createObjectURL(h),o._worker=new Worker(o._blobUrl);var x=++N;o._worker.onmessage=function(n){var a=n.data;a.id===x&&(a.type==="progress"&&c&&c(a.hashesChecked),a.type==="result"&&(o.terminate(),s({nonce:a.nonce})))},o._worker.onerror=function(n){o.terminate(),u(n)},o._worker.postMessage({type:"solve",challenge:i,difficulty:r,id:x})}catch(n){o.terminate(),u(n)}}):new Promise(function(s){var u=0,h=0;(function x(){var n=(function(a,y,t,w,g){for(var l="",b=0;b<y;b++)l+="0";for(var f=w+g,p=w;p<f;p++)if(t(a+":"+String(p)).startsWith(l))return{nonce:p,found:!0,hashesChecked:p-w+1};return{nonce:-1,found:!1,hashesChecked:g}})(i,r,P,u,1e4);h+=n.hashesChecked,n.found?s({nonce:n.nonce}):(u+=1e4,c&&c(h),setTimeout(x,0))})()})},U.prototype.terminate=function(){this._worker&&(this._worker.terminate(),this._worker=null),this._blobUrl&&(URL.revokeObjectURL(this._blobUrl),this._blobUrl=null)};export{U as AkedlyShield,I as getTurnstileToken};
