(function () {
  if (window.__agxVoiceLoaded) return;
  window.__agxVoiceLoaded = true;

  /* ============================================================
     CONFIG — matches src/components/VoiceAssistant.tsx
     ============================================================ */
  var SUPABASE_URL = "https://cgdfhsseqspwitlgeaxt.supabase.co";
  var ANON_KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGZoc3NlcXNwd2l0bGdlYXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTcyODksImV4cCI6MjA4NDczMzI4OX0.NIIhXWxr6YpL84PySjCNeJbX1dht1naXQL24iHscuU0";
  var CHAT_URL    = SUPABASE_URL + "/functions/v1/chat";
  var STT_URL     = SUPABASE_URL + "/functions/v1/elevenlabs-stt";
  var TTS_URL     = SUPABASE_URL + "/functions/v1/elevenlabs-tts";
  var VOICE_ID    = "lxYfHSkYm1EzQzGhdbfc";
  var WELCOME_MESSAGE = "Hi there! I'm your Agilisium AI assistant — how can I help you today?";
  var INTERRUPT_SYSTEM_HINT =
    "The user just verbally interrupted your previous response. Their interruption words are in the next user message (examples of intent: 'stop', 'that's fine', 'okay thanks', 'got it', or a new question). " +
    "If they signalled they're done or satisfied, reply with ONE short, warm, human closing line — vary the wording every time, never repeat a template, keep it under 15 words, and offer to help further. " +
    "If instead they asked a new question, answer it normally using the same grounded knowledge you always use. Do not apologize for being interrupted.";

  var SUGGESTED = [
    "Tell me about Agilisium",
    "What services do you provide?",
    "Show Life Sciences capabilities",
    "Book a demo",
    "Talk to an expert"
  ];

  var EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  var STORE_KEY = "agilisium_chat_email";
  var authHeaders = { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY };

  /* ============================================================
     INLINE SVG ICONS (lucide equivalents)
     ============================================================ */
  var ICON = {
    sparkles: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>',
    close:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    minimize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    expand:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    mic:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
    micOff:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
    send:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>'
  };

  /* ============================================================
     UTILS
     ============================================================ */
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function md(s){
    s = esc(s);
    s = s.replace(/```([\s\S]*?)```/g, function(_,c){ return "<pre><code>"+c+"</code></pre>"; });
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/^### (.+)$/gm, "<h4>$1</h4>");
    s = s.replace(/^## (.+)$/gm,  "<h3>$1</h3>");
    s = s.replace(/^# (.+)$/gm,   "<h2>$1</h2>");
    s = s.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
    s = s.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, function(m){ return "<ul>"+m+"</ul>"; });
    s = s.split(/\n{2,}/).map(function(p){
      if (/^<(ul|ol|pre|h\d|blockquote)/.test(p.trim())) return p;
      return "<p>" + p.replace(/\n/g,"<br>") + "</p>";
    }).join("");
    return s;
  }
  function timeLabel(ts){
    var d = new Date(ts), h = d.getHours(), m = d.getMinutes();
    return (h<10?"0":"")+h+":"+(m<10?"0":"")+m;
  }
  function loadEmail(){ try{return localStorage.getItem(STORE_KEY)||"";}catch(e){return"";} }
  function saveEmail(e){ if(!e) return; try{localStorage.setItem(STORE_KEY,e);}catch(_){} }
  function extractEmail(t){ var m=String(t||"").match(EMAIL_RE); return m?m[0].toLowerCase():null; }

  /* ============================================================
     STATE
     ============================================================ */
  var state = {
    open:false, viewMode:"expanded", muted:false, micMuted:false,
    thinking:false, speaking:false, listening:false, micLevel:0,
    messages:[], email:loadEmail(), connStatus:"idle",
    welcomed:false, micPermission:"unknown", micPrimed:false
  };

  var audioEl = null, chatAbort = null, ttsAbort = null;
  var justInterrupted = false;
  var micRequestInFlight = false;

  function micConstraints(){
    return { audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } };
  }
  function isDeniedMicError(err){
    var n = err && err.name;
    return n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError";
  }
  function isNoMicError(err){
    var n = err && err.name;
    return n === "NotFoundError" || n === "DevicesNotFoundError" || n === "NotReadableError" || n === "TrackStartError";
  }
  function markMicDenied(source, err){
    state.micPermission = "denied";
    state.micPrimed = false;
    state.connStatus = "denied";
    state.listening = false;
    state.micLevel = 0;
    try { stopAmbientVAD(); } catch(_){}
    try { stopBargeIn(); } catch(_){}
    updateConnPill(); updateAvatarState();
    console.warn("[agx-mic] microphone blocked" + (source ? " in " + source : ""), err || "");
  }
  function markMicUnavailable(source, err){
    state.micPermission = "unavailable";
    state.connStatus = "unavailable";
    state.listening = false;
    state.micLevel = 0;
    updateConnPill(); updateAvatarState();
    console.warn("[agx-mic] microphone unavailable" + (source ? " in " + source : ""), err || "");
  }
  function handleMicError(err, source){
    if (err && err.name === "MicRequestInFlight") {
      console.debug("[agx-mic] skipped duplicate microphone request", source || "");
      return;
    }
    if (isDeniedMicError(err)) markMicDenied(source, err);
    else if (isNoMicError(err)) markMicUnavailable(source, err);
    else markMicUnavailable(source, err);
  }
  function checkMicPermission(){
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      var e = new Error("Microphone is not available in this browser/context");
      e.name = "NotFoundError";
      handleMicError(e, "permission-check");
      return Promise.resolve(false);
    }
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(true);
    return navigator.permissions.query({ name:"microphone" }).then(function(status){
      state.micPermission = status.state || state.micPermission;
      status.onchange = function(){
        state.micPermission = status.state || state.micPermission;
        if (status.state === "denied") markMicDenied("permission-change");
      };
      if (status.state === "denied") { markMicDenied("permission-check"); return false; }
      return true;
    }).catch(function(){ return true; });
  }
  function requestMicStream(source, constraints, opts){
    opts = opts || {};
    if (state.micMuted && !opts.ignoreMuted) {
      var muted = new Error("Microphone is muted"); muted.name = "MicMuted";
      return Promise.reject(muted);
    }
    if (state.micPermission === "denied" && !opts.userGesture) {
      var denied = new Error("Microphone permission is blocked"); denied.name = "NotAllowedError";
      handleMicError(denied, source);
      return Promise.reject(denied);
    }
    if (state.micPermission === "unavailable" && !opts.userGesture) {
      var unavailable = new Error("No usable microphone is available"); unavailable.name = "NotFoundError";
      return Promise.reject(unavailable);
    }
    if (micRequestInFlight) {
      var busy = new Error("Microphone request already in progress"); busy.name = "MicRequestInFlight";
      return Promise.reject(busy);
    }
    micRequestInFlight = true;
    return checkMicPermission().then(function(ok){
      if (!ok) { var e = new Error("Microphone permission denied"); e.name = "NotAllowedError"; throw e; }
      return navigator.mediaDevices.getUserMedia(constraints || micConstraints())
        .then(function(stream){
          state.micPermission = "granted";
          state.micPrimed = true;
          return stream;
        })
        .catch(function(err){ handleMicError(err, source); throw err; });
    }).finally(function(){ micRequestInFlight = false; });
  }

  /* ============================================================
     DOM  (built via template literals so all HTML is intact)
     ============================================================ */
  var root = document.createElement("div");
  root.className = "agx";
  root.innerHTML = ''
    + '<button class="agx-pill" type="button" aria-label="Talk to Agilisium AI">'
    +   '<span class="agx-pill-orb">' + ICON.sparkles + '</span>'
    +   '<span class="agx-pill-label">Talk to Agilisium AI</span>'
    + '</button>'
    + '<div class="agx-modal agx-expanded" role="dialog" aria-modal="true" aria-label="Agilisium AI">'
    +   '<div class="agx-backdrop"></div>'
    +   '<div class="agx-shell">'
    +     '<div class="agx-stage">'
    +       '<div class="agx-avatar agx-state-idle">'
    +         '<div class="agx-halo"></div>'
    +         '<div class="agx-ring" data-i="0"></div>'
    +         '<div class="agx-ring" data-i="1"></div>'
    +         '<div class="agx-ring" data-i="2"></div>'
    +         '<div class="agx-core">' + ICON.sparkles + '</div>'
    +       '</div>'
    +       '<div class="agx-status-text">'
    +         '<div class="agx-status-title">Ready</div>'
    +         '<div class="agx-status-sub">Tap the mic to talk or type on the right</div>'
    +       '</div>'
    +       '<button class="agx-mic" type="button" aria-label="Mute microphone">' + ICON.mic + '</button>'
    +     '</div>'
    +     '<div class="agx-conv">'
    +       '<div class="agx-conv-head">'
    +         '<div class="agx-title-block">'
    +           '<div class="agx-title">Agilisium AI</div>'
    +           '<div class="agx-subtitle">Voice-enabled assistant</div>'
    +         '</div>'
    +         '<div class="agx-head-actions">'
    +           '<span class="agx-status-pill agx-st-idle">'
    +             '<span class="agx-status-dot"></span>'
    +             '<span class="agx-status-label">Idle</span>'
    +           '</span>'
    +           '<button class="agx-head-btn agx-toggle" type="button" aria-label="Shrink to corner">' + ICON.minimize + '</button>'
    +           '<button class="agx-head-btn agx-close" type="button" aria-label="Close">' + ICON.close + '</button>'
    +         '</div>'
    +       '</div>'
    +       '<div class="agx-scroll"></div>'
    +       '<div class="agx-chips"></div>'
    +       '<form class="agx-form">'
    +         '<input class="agx-input" type="text" placeholder="Type or tap the mic…" />'
    +         '<button class="agx-send" type="submit" disabled aria-label="Send">' + ICON.send + '</button>'
    +       '</form>'
    +     '</div>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(root);

  var pillEl      = root.querySelector(".agx-pill");
  var modalEl     = root.querySelector(".agx-modal");
  var backdropEl  = root.querySelector(".agx-backdrop");
  var shellEl     = root.querySelector(".agx-shell");
  var closeBtn    = root.querySelector(".agx-close");
  var toggleBtn   = root.querySelector(".agx-toggle");
  var avatarEl    = root.querySelector(".agx-avatar");
  var coreEl      = root.querySelector(".agx-core");
  var ringEls     = root.querySelectorAll(".agx-ring");
  var statusTitle = root.querySelector(".agx-status-title");
  var statusSub   = root.querySelector(".agx-status-sub");
  var micBtn      = root.querySelector(".agx-mic");
  var scrollEl    = root.querySelector(".agx-scroll");
  var chipsEl     = root.querySelector(".agx-chips");
  var formEl      = root.querySelector(".agx-form");
  var inputEl     = root.querySelector(".agx-input");
  var sendBtn     = root.querySelector(".agx-send");
  var statusPill  = root.querySelector(".agx-status-pill");
  var statusLabel = root.querySelector(".agx-status-label");

  /* ============================================================
     RENDER
     ============================================================ */
  function renderChips(){
    var asked = {};
    state.messages.forEach(function(m){
      if (m.role === "user") asked[m.content.trim().toLowerCase()] = true;
    });
    var remain = SUGGESTED.filter(function(s){ return !asked[s.trim().toLowerCase()]; });
    if (remain.length === 0) { chipsEl.innerHTML = ""; return; }
    chipsEl.innerHTML = remain.map(function(p){
      return '<button class="agx-chip" type="button">' + esc(p) + '</button>';
    }).join("");
    chipsEl.querySelectorAll(".agx-chip").forEach(function(b){
      b.addEventListener("click", function(){ ask(b.textContent, { voice:false }); });
    });
  }

  function renderMessages(){
    if (state.messages.length === 0) {
      scrollEl.innerHTML = '<div class="agx-empty">Hi! I\'m your Agilisium AI. Tap the mic to talk, or pick a prompt below.</div>';
      return;
    }
    var html = "";
    for (var i=0; i<state.messages.length; i++){
      var m = state.messages[i];
      var wrap = m.role === "user" ? "agx-user" : "agx-bot";
      html += '<div class="agx-msg-wrap ' + wrap + '">'
           +    '<div class="agx-msg">' + (m.role==="assistant" ? md(m.content || "…") : esc(m.content)) + '</div>'
           +    '<div class="agx-ts">' + timeLabel(m.ts) + '</div>'
           + '</div>';
    }
    if (state.thinking) {
      html += '<div class="agx-thinking"><span></span><span></span><span></span></div>';
    }
    scrollEl.innerHTML = html;
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function updateAvatarState(){
    var s = state.speaking ? "speaking" : state.listening ? "listening" : "idle";
    avatarEl.className = "agx-avatar agx-state-" + s;
    if (s === "listening") {
      for (var i=0; i<ringEls.length; i++){
        var size = 240 + i*60 + state.micLevel*80;
        ringEls[i].style.width  = size + "px";
        ringEls[i].style.height = size + "px";
        ringEls[i].style.opacity = String(0.6 - i*0.15);
      }
    }
    var glow = 40 + state.micLevel*120;
    var alpha = 0.4 + state.micLevel*0.5;
    coreEl.style.boxShadow = "0 0 " + glow + "px rgba(20,184,166," + alpha.toFixed(2) + ")";
    statusTitle.textContent = state.speaking ? "Speaking…"
      : state.listening ? "Listening…"
      : state.thinking  ? "Thinking…"
      : "Ready";
    statusSub.textContent = state.listening
      ? "I'll respond when you pause"
      : "Tap the mic to talk or type on the right";
    // mic button = MUTE ONLY (never reflects listening/speaking)
    micBtn.classList.toggle("agx-muted", state.micMuted);
    micBtn.innerHTML = state.micMuted ? ICON.micOff : ICON.mic;
    micBtn.setAttribute("aria-label", state.micMuted ? "Unmute microphone" : "Mute microphone");
  }

  function updateConnPill(){
    var labels = { idle:"Idle", checking:"Connecting", connected:"Voice live",
      offline:"Offline", denied:"Mic blocked", unavailable:"Voice unavailable" };
    statusPill.className = "agx-status-pill agx-st-" + state.connStatus;
    statusLabel.textContent = labels[state.connStatus] || "Idle";
  }

  function updateViewMode(){
    modalEl.classList.remove("agx-expanded", "agx-docked");
    modalEl.classList.add("agx-" + state.viewMode);
    var expanded = state.viewMode === "expanded";
    toggleBtn.innerHTML = expanded ? ICON.minimize : ICON.expand;
    toggleBtn.setAttribute("aria-label", expanded ? "Shrink to corner" : "Expand");
  }

  /* ============================================================
     OPEN / CLOSE / VIEW MODE
     ============================================================ */
  function primeMicOnGesture(){
    // Called from a real user gesture (pill click) so the permission prompt
    // shows and AudioContext can resume under autoplay policies.
    try {
      if (!window._agxAC) {
        window._agxAC = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (window._agxAC.state === "suspended") { window._agxAC.resume().catch(function(){}); }
    } catch(_){}
    requestMicStream("open-prime", { audio:true }, { userGesture:true, ignoreMuted:true })
      .then(function(s){
        // Immediately release — real recorder/VAD will re-request. This just
        // unlocks the permission grant on the user gesture.
        s.getTracks().forEach(function(t){ t.stop(); });
      })
      .catch(function(e){
        if (e && (e.name === "MicRequestInFlight" || e.name === "MicMuted")) return;
      })
      .finally(function(){
        if (state.open && !state.speaking && !state.thinking && !state.listening && !state.micMuted && state.micPermission !== "denied" && state.micPermission !== "unavailable") {
          setTimeout(startAmbientVAD, 80);
        }
      });
  }
  function openModal(){
    state.open = true; state.viewMode = "expanded";
    modalEl.classList.add("agx-open");
    updateViewMode();
    pillEl.style.display = "none";
    document.body.classList.add("agx-lock");
    document.documentElement.classList.add("agx-lock");
    renderMessages(); renderChips(); updateAvatarState(); updateConnPill();
    setTimeout(function(){ inputEl.focus(); }, 200);
    checkConn();
    // spoken welcome on every open
    if (!state.welcomed) {
      state.welcomed = true;
      state.messages.push({ role:"assistant", content:WELCOME_MESSAGE, ts:Date.now(), voice:true });
      renderMessages();
      speakCanned(WELCOME_MESSAGE);
    }
    startAmbientVAD();
  }
  function handleClose(){
    state.open = false; state.viewMode = "expanded"; state.welcomed = false;
    modalEl.classList.remove("agx-open");
    updateViewMode(); // reset to expanded so docked shell doesn't intercept clicks over the pill
    pillEl.style.display = "";
    pillEl.style.pointerEvents = "auto";
    document.body.classList.remove("agx-lock");
    document.documentElement.classList.remove("agx-lock");
    if (chatAbort) chatAbort.abort();
    if (ttsAbort)  ttsAbort.abort();
    stopRecording();
    stopBargeIn();
    stopAmbientVAD();
    if (audioEl) { try { audioEl.pause(); audioEl.removeAttribute("src"); audioEl.load(); } catch(_){} }
    state.speaking = false; state.thinking = false;
    updateAvatarState();
  }
  function toggleView(){
    state.viewMode = state.viewMode === "expanded" ? "docked" : "expanded";
    updateViewMode();
  }

  pillEl.addEventListener("click", function(){ primeMicOnGesture(); openModal(); });
  closeBtn.addEventListener("click", handleClose);
  toggleBtn.addEventListener("click", toggleView);
  backdropEl.addEventListener("click", handleClose);
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && state.open) handleClose();
  });

  inputEl.addEventListener("input", function(){
    sendBtn.disabled = inputEl.value.trim().length === 0;
  });
  formEl.addEventListener("submit", function(e){
    e.preventDefault();
    var q = inputEl.value.trim();
    if (!q) return;
    inputEl.value = ""; sendBtn.disabled = true;
    ask(q, { voice:false });
  });

  /* ============================================================
     AUDIO
     ============================================================ */
  function ensureAudio(){
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.addEventListener("play",  function(){ state.speaking=true;  updateAvatarState(); startBargeIn(); });
      audioEl.addEventListener("ended", function(){ state.speaking=false; updateAvatarState(); stopBargeIn(); });
      audioEl.addEventListener("pause", function(){ state.speaking=false; updateAvatarState(); stopBargeIn(); });
    }
    return audioEl;
  }
  function interruptAudio(){
    if (audioEl) { try { audioEl.pause(); audioEl.currentTime = 0; } catch(_){} }
    if (ttsAbort) ttsAbort.abort();
    state.speaking = false; updateAvatarState(); stopBargeIn();
  }
  function speakCanned(text){
    if (state.muted) return;
    if (ttsAbort) ttsAbort.abort();
    ttsAbort = new AbortController();
    var sp = createStreamingSpeaker(ensureAudio(), ttsAbort.signal);
    sp.push(text); sp.flush().catch(function(){});
  }

  /* ============================================================
     STT / TTS / CHAT
     ============================================================ */
  function transcribe(blob, ext){
    var fd = new FormData();
    var safeExt = ext || (blob.type && blob.type.indexOf("mp4") !== -1 ? "mp4" : "webm");
    fd.append("file", blob, "input." + safeExt);
    return fetch(STT_URL, { method:"POST", headers: authHeaders, body: fd })
      .then(function(res){
        return res.text().then(function(body){
          if (!res.ok) {
            console.error("[agx] STT " + res.status + " → " + body);
            throw new Error("stt " + res.status);
          }
          try { return JSON.parse(body); } catch(_){ return { text:"" }; }
        });
      })
      .then(function(j){ return (j.text || "").trim(); });
  }

  function fetchTtsUrl(text, signal){
    return fetch(TTS_URL, {
      method:"POST", signal,
      headers: Object.assign({ "Content-Type":"application/json" }, authHeaders),
      body: JSON.stringify({ text:text, voiceId: VOICE_ID })
    }).then(function(res){
      if (!res.ok) throw new Error("tts "+res.status);
      return res.arrayBuffer();
    }).then(function(buf){
      return URL.createObjectURL(new Blob([buf], { type:"audio/mpeg" }));
    });
  }

  function createStreamingSpeaker(audio, signal){
    var buffer = "", playing = Promise.resolve(), cancelled = false;
    var firstEmitted = false;
    var MIN_FIRST = 8, SOFT_FIRST_CAP = 40, HARD_FIRST_CAP = 80, MIN_REST = 40;

    signal.addEventListener("abort", function(){
      cancelled = true;
      try { audio.pause(); } catch(_){}
    });

    function enqueue(text){
      var clean = text.trim();
      if (!clean) return;
      var urlPromise = fetchTtsUrl(clean, signal).catch(function(e){ console.warn("tts chunk failed", e); return ""; });
      playing = playing.then(function(){
        if (cancelled) return;
        return urlPromise.then(function(url){
          if (!url || cancelled) return;
          return new Promise(function(resolve){
            var done = function(){
              audio.removeEventListener("ended", done);
              audio.removeEventListener("error", done);
              URL.revokeObjectURL(url); resolve();
            };
            audio.addEventListener("ended", done);
            audio.addEventListener("error", done);
            audio.src = url;
            audio.play().catch(function(){ done(); });
          });
        });
      });
    }
    function flushBoundary(){
      if (!firstEmitted) {
        var m = buffer.match(/^([^.!?\n,;:—-]{8,}?[.!?\n,;:—-])/);
        if (m && m[1].length >= MIN_FIRST) {
          var c = m[1]; buffer = buffer.slice(c.length); enqueue(c); firstEmitted = true;
        } else if (buffer.length >= SOFT_FIRST_CAP) {
          var ws = buffer.lastIndexOf(" ", SOFT_FIRST_CAP);
          var cut = ws > MIN_FIRST ? ws : SOFT_FIRST_CAP;
          enqueue(buffer.slice(0, cut));
          buffer = buffer.slice(cut); firstEmitted = true;
        } else if (buffer.length >= HARD_FIRST_CAP) {
          enqueue(buffer.slice(0, HARD_FIRST_CAP));
          buffer = buffer.slice(HARD_FIRST_CAP); firstEmitted = true;
        }
        if (!firstEmitted) return;
      }
      var re = /[^.!?\n]*[.!?\n]+/g;
      var match, lastIdx = 0, pending = "";
      while ((match = re.exec(buffer)) !== null) {
        pending += match[0];
        lastIdx = re.lastIndex;
        if (pending.trim().length >= MIN_REST) { enqueue(pending); pending = ""; }
      }
      buffer = pending + buffer.slice(lastIdx);
    }
    return {
      push:  function(delta){ if (cancelled) return; buffer += delta; flushBoundary(); },
      flush: function(){
        if (cancelled) return Promise.resolve();
        if (buffer.trim()) { enqueue(buffer); buffer = ""; }
        return playing;
      },
      cancel: function(){ cancelled = true; }
    };
  }

  function streamChat(msgs, onDelta, onDone, signal, emailForTurn){
    var body = {
      messages: msgs.map(function(m){ return { role:m.role, content:m.content }; }),
      email: emailForTurn || null,
      pageUrl: typeof window !== "undefined" ? window.location.href : ""
    };
    return fetch(CHAT_URL, {
      method:"POST", signal,
      headers: Object.assign({ "Content-Type":"application/json" }, authHeaders),
      body: JSON.stringify(body)
    }).then(function(res){
      if (!res.ok || !res.body) throw new Error("chat "+res.status);
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = "", full = "";
      function pump(){
        return reader.read().then(function(r){
          if (r.done) { onDone(full); return; }
          buf += dec.decode(r.value, { stream:true });
          var parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (var i=0; i<parts.length; i++){
            var line = parts[i].trim();
            if (line.indexOf("data:") !== 0) continue;
            var payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              var j = JSON.parse(payload);
              var delta = (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content)
                || j.delta || j.text || "";
              if (delta) { full += delta; onDelta(delta); }
            } catch(_){}
          }
          return pump();
        });
      }
      return pump();
    });
  }

  /* ============================================================
     ASK
     ============================================================ */
  function ask(query, opts){
    var q = (query || "").trim();
    if (!q) return;
    var isVoice = !!(opts && opts.voice);

    interruptAudio();
    if (chatAbort) chatAbort.abort();
    chatAbort = new AbortController();

    var wasInterrupted = justInterrupted && isVoice;
    justInterrupted = false;

    var emailFromText = extractEmail(q);
    var emailForTurn = emailFromText || state.email || null;
    if (emailFromText) { saveEmail(emailFromText); state.email = emailFromText; }

    var userMsg = { role:"user", content:q, ts:Date.now(), voice:isVoice };
    var asstMsg = { role:"assistant", content:"", ts:Date.now(), voice:isVoice };
    var prevMessages = state.messages.slice();
    state.messages.push(userMsg); state.messages.push(asstMsg);
    state.thinking = true;
    renderMessages(); renderChips(); updateAvatarState();

    if (ttsAbort) ttsAbort.abort();
    ttsAbort = new AbortController();
    var speaker = null;
    if (isVoice && !state.muted) {
      speaker = createStreamingSpeaker(ensureAudio(), ttsAbort.signal);
    }

    // Inject interrupt hint into outbound history (matches React logic)
    var outbound = wasInterrupted
      ? prevMessages.concat([{ role:"assistant", content:INTERRUPT_SYSTEM_HINT, ts:Date.now() }, userMsg])
      : prevMessages.concat([userMsg]);

    var acc = "";
    streamChat(outbound, function(delta){
      acc += delta;
      state.messages[state.messages.length - 1].content = acc;
      renderMessages();
      if (speaker) speaker.push(delta);
    }, function(){
      state.thinking = false;
      renderMessages(); updateAvatarState();
      if (speaker) speaker.flush().catch(function(){});
    }, chatAbort.signal, emailForTurn).catch(function(err){
      if (err && err.name === "AbortError") return;
      console.error("chat failed", err);
      state.thinking = false;
      state.messages[state.messages.length - 1].content = "Sorry — I hit a snag reaching the assistant. Please try again.";
      renderMessages(); updateAvatarState();
    });
  }

  /* ============================================================
     RECORDER + VAD (in-recording silence detection)
     ============================================================ */
  var recStream=null, recMr=null, recChunks=[], recAC=null, recRaf=0, recSilenceStart=null, recStopping=false;

  function safeCloseAC(ctx){
    if (!ctx) return;
    try { if (ctx.state !== "closed") ctx.close().catch(function(){}); } catch(_){}
  }

  function stopRecording(){
    if (recStopping) return;
    recStopping = true;
    try { if (recMr && recMr.state !== "inactive") recMr.stop(); } catch(_){}
    if (recStream) { try { recStream.getTracks().forEach(function(t){ t.stop(); }); } catch(_){} }
    if (recRaf) cancelAnimationFrame(recRaf);
    safeCloseAC(recAC);
    recStream=null; recAC=null; recRaf=0; recSilenceStart=null;
    state.listening=false; state.micLevel=0;
    updateAvatarState();
    // NOTE: don't null recMr here — onstop still needs to fire and read state.
  }

  function handleNoSpeech(){
    var line = "Sorry, I didn't catch that — could you repeat?";
    state.messages.push({ role:"assistant", content:line, ts:Date.now(), voice:true });
    renderMessages();
    speakCanned(line);
  }

  function pickMimeType(){
    var candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (var i=0; i<candidates.length; i++){
      try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(candidates[i])) return candidates[i]; } catch(_){}
    }
    return "";
  }

  function startRecording(){
    if (state.listening || state.micMuted || state.micPermission === "denied" || state.micPermission === "unavailable" || micRequestInFlight) return;
    interruptAudio();
    recStopping = false;

    // Unlock playback via user gesture (safe no-op if already unlocked)
    var a = ensureAudio();
    try {
      a.muted = true;
      a.play().catch(function(){}).finally(function(){
        try { a.pause(); a.currentTime = 0; a.muted = false; } catch(_){}
      });
    } catch(_){}

    requestMicStream("recording", micConstraints(), { userGesture:false })
      .then(function(stream){
        recStream = stream; recChunks = [];
        var mime = pickMimeType();
        var ext = mime.indexOf("mp4") !== -1 ? "mp4" : "webm";
        try { recMr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
        catch(_) { recMr = new MediaRecorder(stream); }

        // Local flags — captured by onstop closure so nulling refs can't crash it.
        var hadSpeechFinal = false;
        var localMime = recMr.mimeType || mime || "audio/webm";

        recMr.ondataavailable = function(e){ if (e.data && e.data.size) recChunks.push(e.data); };
        recMr.onstop = function(){
          try {
            var blob = new Blob(recChunks, { type: localMime });
            console.debug("[agx-vad] onstop", { size: blob.size, hadSpeech: hadSpeechFinal, mime: localMime });
            if (blob.size > 1000 && hadSpeechFinal) {
              transcribe(blob, ext).then(function(text){
                console.debug("[agx-stt] result", text);
                if (text) ask(text, { voice:true });
                else handleNoSpeech();
              }).catch(function(err){
                console.error("[agx-stt] error", err);
                state.connStatus = "unavailable"; updateConnPill();
                handleNoSpeech();
              });
            } else {
              handleNoSpeech();
            }
          } finally {
            recMr = null;
          }
        };
        try { recMr.start(250); } catch(err){ console.error("recorder start failed", err); recStopping=false; stopRecording(); return; }
        state.listening = true; updateAvatarState();

        var startedAt = performance.now();
        var hadSpeech = false, speechRunStart = null;
        recAC = new (window.AudioContext || window.webkitAudioContext)();
        var src = recAC.createMediaStreamSource(stream);
        var analyser = recAC.createAnalyser(); analyser.fftSize = 1024;
        src.connect(analyser);
        var data = new Uint8Array(analyser.frequencyBinCount);

        // Adaptive noise floor calibrated over the first ~350 ms
        var CAL_MS = 350, calStart = null, calSum = 0, calN = 0, noiseFloor = 0.012;
        var SUSTAIN_MS = 100, SILENCE_MS = 1200, MAX_WAIT_MS = 8000, HARD_CAP_MS = 15000;
        var ABS_MIN = 0.02, ABS_MAX = 0.06, NOISE_MULT = 2.2;

        var tick = function(){
          if (!state.listening) return;
          analyser.getByteTimeDomainData(data);
          var sumSq = 0;
          for (var i=0; i<data.length; i++){ var v = (data[i]-128)/128; sumSq += v*v; }
          var rms = Math.sqrt(sumSq/data.length);
          state.micLevel = rms; updateAvatarState();
          var now = performance.now();
          var elapsed = now - startedAt;

          // Hard absolute cap — always terminates
          if (elapsed > HARD_CAP_MS) { console.debug("[agx-vad] hard cap"); stopRecording(); return; }

          // Calibrate ambient noise
          if (calStart === null) calStart = now;
          if (now - calStart < CAL_MS) {
            calSum += rms; calN++;
            recRaf = requestAnimationFrame(tick); return;
          }
          if (calN > 0) { noiseFloor = Math.max(0.008, calSum/calN); calN = 0; }
          var speechFloor = Math.min(ABS_MAX, Math.max(ABS_MIN, noiseFloor * NOISE_MULT));

          if (rms >= speechFloor) {
            if (speechRunStart === null) speechRunStart = now;
            if (!hadSpeech && now - speechRunStart >= SUSTAIN_MS) {
              hadSpeech = true; hadSpeechFinal = true;
              console.debug("[agx-vad] speech detected", { rms: rms, floor: speechFloor });
            }
            recSilenceStart = null;
          } else {
            // Everything below speechFloor counts toward silence — no dead zone.
            speechRunStart = null;
            if (recSilenceStart === null) recSilenceStart = now;
            var silentFor = now - recSilenceStart;
            if (hadSpeech && silentFor > SILENCE_MS) { console.debug("[agx-vad] silence after speech"); stopRecording(); return; }
            if (!hadSpeech && elapsed > MAX_WAIT_MS) { console.debug("[agx-vad] max wait no speech"); stopRecording(); return; }
          }
          recRaf = requestAnimationFrame(tick);
        };
        recRaf = requestAnimationFrame(tick);
      })
      .catch(function(err){
        if (err && (err.name === "MicRequestInFlight" || err.name === "MicMuted")) return;
        console.error("mic error", err);
        handleMicError(err, "recording");
      });
  }

  // Mic button = MUTE ONLY
  micBtn.addEventListener("click", function(){
    state.micMuted = !state.micMuted;
    if (state.micMuted && state.listening) stopRecording();
    if (!state.micMuted) {
      state.micPermission = "unknown";
      requestMicStream("mic-button", { audio:true }, { userGesture:true, ignoreMuted:true })
        .then(function(s){ s.getTracks().forEach(function(t){ t.stop(); }); })
        .catch(function(e){
          if (e && e.name === "MicRequestInFlight") return;
        })
        .finally(function(){
          if (state.open && !state.speaking && !state.thinking && !state.listening && !state.micMuted && state.micPermission !== "denied" && state.micPermission !== "unavailable") startAmbientVAD();
        });
    }
    updateAvatarState();
  });

  /* ============================================================
     BARGE-IN — while AI speaking, listen for user interruption
     ============================================================ */
  var bargeCancel = null;
  function startBargeIn(){
    stopBargeIn();
    if (!state.open || state.listening || state.micMuted || state.micPermission === "denied" || state.micPermission === "unavailable" || micRequestInFlight) return;
    var cancelled = false, stream = null, ac = null, raf = 0, speechStart = null;
    var THRESH = 0.09, SUSTAIN = 120;
    requestMicStream("barge-in", micConstraints(), { userGesture:false })
      .then(function(s){
        if (cancelled) { s.getTracks().forEach(function(t){t.stop();}); return; }
        stream = s;
        ac = new (window.AudioContext || window.webkitAudioContext)();
        var src = ac.createMediaStreamSource(stream);
        var analyser = ac.createAnalyser(); analyser.fftSize = 512; src.connect(analyser);
        var data = new Uint8Array(analyser.frequencyBinCount);
        var tick = function(){
          if (cancelled) return;
          analyser.getByteTimeDomainData(data);
          var peak = 0;
          for (var i=0; i<data.length; i++){ var v = Math.abs(data[i]-128); if (v>peak) peak=v; }
          var norm = peak/128, now = performance.now();
          if (norm >= THRESH) {
            if (speechStart === null) speechStart = now;
            if (now - speechStart >= SUSTAIN) {
              cancelled = true;
              interruptAudio();
              justInterrupted = true;
              queueMicrotask(function(){ startRecording(); });
              return;
            }
          } else { speechStart = null; }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(function(e){
        if (e && (e.name === "MicRequestInFlight" || e.name === "MicMuted")) return;
        console.warn("[barge-in] mic unavailable", e);
      });
    bargeCancel = function(){
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(function(t){ t.stop(); });
      safeCloseAC(ac);
    };
  }
  function stopBargeIn(){ if (bargeCancel) { bargeCancel(); bargeCancel = null; } }

  /* ============================================================
     AMBIENT VAD — auto-start recording when user speaks
     (calibrates noise floor, matches React auto-listen logic)
     ============================================================ */
  var ambientCancel = null;
  function startAmbientVAD(){
    stopAmbientVAD();
    if (!state.open || state.speaking || state.thinking || state.listening || state.micMuted || state.micPermission === "denied" || state.micPermission === "unavailable" || micRequestInFlight) return;
    var cancelled = false, stream=null, ac=null, raf=0, speechStart=null;
    var CALIBRATION_MS=350, SUSTAIN_MS=80;
    var ABS_MIN=0.018, ABS_MAX=0.055, NOISE_MULT=2.2;
    var noiseFloor=0.01, calStart=null, calSamples=0, calSum=0;

    requestMicStream("auto-listen", micConstraints(), { userGesture:false })
      .then(function(s){
        if (cancelled) { s.getTracks().forEach(function(t){t.stop();}); return; }
        stream = s;
        ac = new (window.AudioContext || window.webkitAudioContext)();
        var src = ac.createMediaStreamSource(stream);
        var analyser = ac.createAnalyser(); analyser.fftSize = 1024; src.connect(analyser);
        var data = new Uint8Array(analyser.frequencyBinCount);
        var tick = function(){
          if (cancelled) return;
          analyser.getByteTimeDomainData(data);
          var sumSq = 0;
          for (var i=0; i<data.length; i++){ var v = (data[i]-128)/128; sumSq += v*v; }
          var rms = Math.sqrt(sumSq/data.length), now = performance.now();
          if (calStart === null) calStart = now;
          if (now - calStart < CALIBRATION_MS) {
            calSum += rms; calSamples++;
            raf = requestAnimationFrame(tick); return;
          }
          if (calSamples > 0) { noiseFloor = Math.max(0.005, calSum/calSamples); calSamples = 0; }
          var threshold = Math.min(ABS_MAX, Math.max(ABS_MIN, noiseFloor*NOISE_MULT));
          if (rms >= threshold) {
            if (speechStart === null) speechStart = now;
            if (now - speechStart >= SUSTAIN_MS) {
              cancelled = true;
              stream.getTracks().forEach(function(t){t.stop();});
              safeCloseAC(ac);
              queueMicrotask(function(){ startRecording(); });
              return;
            }
          } else {
            speechStart = null;
            if (rms < threshold*0.8) noiseFloor = noiseFloor*0.98 + rms*0.02;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(function(e){
        if (e && (e.name === "MicRequestInFlight" || e.name === "MicMuted")) return;
        console.warn("[auto-listen] mic unavailable", e);
      });
    ambientCancel = function(){
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(function(t){t.stop();});
      safeCloseAC(ac);
    };
  }
  function stopAmbientVAD(){ if (ambientCancel) { ambientCancel(); ambientCancel = null; } }

  // Re-arm ambient VAD when the AI stops speaking / thinking / listening
  var _prev = { speaking:false, thinking:false, listening:false, micMuted:false, open:false };
  setInterval(function(){
    var changed = _prev.speaking !== state.speaking || _prev.thinking !== state.thinking
      || _prev.listening !== state.listening || _prev.micMuted !== state.micMuted
      || _prev.open !== state.open;
    if (!changed) return;
    _prev = { speaking:state.speaking, thinking:state.thinking, listening:state.listening, micMuted:state.micMuted, open:state.open };
    if (state.open && !state.speaking && !state.thinking && !state.listening && !state.micMuted) {
      startAmbientVAD();
    } else {
      stopAmbientVAD();
    }
  }, 200);

  /* ============================================================
     CONNECTION PROBE
     ============================================================ */
  function checkConn(){
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      state.connStatus = "offline"; updateConnPill(); return;
    }
    state.connStatus = "checking"; updateConnPill();
    fetch(STT_URL, { method:"OPTIONS", headers: authHeaders })
      .then(function(res){ state.connStatus = res.status < 500 ? "connected" : "unavailable"; updateConnPill(); })
      .catch(function(){ state.connStatus = "unavailable"; updateConnPill(); });
  }
  window.addEventListener("online",  function(){ if (state.open) checkConn(); });
  window.addEventListener("offline", function(){ state.connStatus = "offline"; updateConnPill(); });

  /* Initial paint */
  updateViewMode();
  renderMessages(); renderChips(); updateAvatarState(); updateConnPill();
})();
