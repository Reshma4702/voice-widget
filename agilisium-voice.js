(function () {
  if (window.__agxVoiceLoaded) return;
  window.__agxVoiceLoaded = true;

  /* ============================================================
     CONFIG
     ============================================================ */
//   var SUPABASE_URL = "https://cgdfhsseqspwitlgeaxt.supabase.co";
//   var ANON_KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGZoc3NlcXNwd2l0bGdlYXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTcyODksImV4cCI6MjA4NDczMzI4OX0.NIIhXWxr6YpL84PySjCNeJbX1dht1naXQL24iHscuU0";
//   var CHAT_URL    = SUPABASE_URL + "/functions/v1/chat";
//   var STT_URL     = SUPABASE_URL + "/functions/v1/elevenlabs-stt";
//   var TTS_URL     = SUPABASE_URL + "/functions/v1/elevenlabs-tts";
//   var VOICE_ID    = "lxYfHSkYm1EzQzGhdbfc";
const widgetScript =
document.currentScript ||
document.getElementById("agilisium-widget");

const CONFIG = {

endpoint:
widgetScript.dataset.endpoint,

anonKey:
widgetScript.dataset.anonKey,

title:
widgetScript.dataset.title ||
"Talk to Agilisium AI",

voiceId:
widgetScript.dataset.voiceId ||
"lxYfHSkYm1EzQzGhdbfc"

};

const SUPABASE_URL = CONFIG.endpoint;

const CHAT_URL =
`${SUPABASE_URL}/functions/v1/chat`;

const STT_URL =
`${SUPABASE_URL}/functions/v1/elevenlabs-stt`;

const TTS_URL =
`${SUPABASE_URL}/functions/v1/elevenlabs-tts`;

const ANON_KEY =
CONFIG.anonKey;

const VOICE_ID =
CONFIG.voiceId;

  var SUGGESTED = [
    "Tell me about Agilisium",
    "What services do you provide?",
    "Show Life Sciences capabilities",
    "Book a demo",
    "Talk to an expert"
  ];

  var EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  var STORE_KEY = "agilisium_chat_email";

  /* ============================================================
     ICONS (inline SVG)
     ============================================================ */
  var ICON = {
    sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/><path d="M5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6L5 15z"/></svg>',
    close:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    mic:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>',
    micOff:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7 7 0 0 0 19 12"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V4a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
    volume:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    volumeX:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    send:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
  };

  /* ============================================================
     UTILS
     ============================================================ */
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function md(s){
    s = esc(s);
    s = s.replace(/```([\s\S]*?)```/g, function(_,c){return "<pre><code>"+c+"</code></pre>";});
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/^### (.+)$/gm, "<h4>$1</h4>");
    s = s.replace(/^## (.+)$/gm, "<h3>$1</h3>");
    s = s.replace(/^# (.+)$/gm, "<h2>$1</h2>");
    s = s.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
    s = s.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, function(m){return "<ul>"+m+"</ul>";});
    s = s.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
    return "<p>" + s + "</p>";
  }
  function timeLabel(ts){
    var d = new Date(ts);
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function loadEmail(){ try{return localStorage.getItem(STORE_KEY)||"";}catch(e){return"";} }
  function saveEmail(e){ if(!e) return; try{localStorage.setItem(STORE_KEY,e);}catch(_){} }
  function extractEmail(t){ var m = String(t||"").match(EMAIL_RE); return m ? m[0].toLowerCase() : null; }

  var authHeaders = { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY };

  /* ============================================================
     STATE
     ============================================================ */
  var state = {
    open: false,
    muted: false,
    thinking: false,
    speaking: false,
    listening: false,
    micLevel: 0,
    messages: [],
    email: loadEmail(),
    connStatus: "idle" // idle | checking | connected | offline | denied | unavailable
  };

  var audioEl = null;
  var chatAbort = null;
  var ttsAbort  = null;
  var justInterrupted = false;

  /* ============================================================
     DOM
     ============================================================ */
  var root = document.createElement("div");
  root.className = "agx";
  root.innerHTML =
    '<button class="agx-pill" type="button" aria-label="Talk to Agilisium AI">' +
      '<span class="agx-pill-orb">' + ICON.sparkles + '</span>' +
      '<span class="agx-pill-label">Talk to Agilisium AI</span>' +
    '</button>' +
    '<div class="agx-modal" role="dialog" aria-modal="true" aria-label="Agilisium AI">' +
      '<div class="agx-backdrop"></div>' +
      '<div class="agx-shell">' +
        '<button class="agx-close" type="button" aria-label="Close">' + ICON.close + '</button>' +
        '<div class="agx-stage">' +
          '<div class="agx-avatar agx-state-idle">' +
            '<div class="agx-halo"></div>' +
            '<div class="agx-ring" data-ring="0"></div>' +
            '<div class="agx-ring" data-ring="1"></div>' +
            '<div class="agx-ring" data-ring="2"></div>' +
            '<div class="agx-core">' + ICON.sparkles + '</div>' +
          '</div>' +
          '<div class="agx-status-text">' +
            '<div class="agx-status-title">Ready</div>' +
            '<div class="agx-status-sub">Tap the mic to talk or type on the right</div>' +
          '</div>' +
          '<button class="agx-mic" type="button" aria-label="Start listening">' + ICON.mic + '</button>' +
        '</div>' +
        '<div class="agx-conv">' +
          '<div class="agx-conv-head">' +
            '<div class="agx-title-block">' +
              '<div class="agx-title">Agilisium AI</div>' +
              '<div class="agx-subtitle">Voice-enabled assistant</div>' +
            '</div>' +
            '<div class="agx-head-actions">' +
              '<div class="agx-status-pill agx-st-idle"><span class="agx-status-dot"></span><span class="agx-status-label">Idle</span></div>' +
              '<button class="agx-mute" type="button" aria-label="Mute voice">' + ICON.volume + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="agx-scroll" aria-live="polite"></div>' +
          '<div class="agx-chips"></div>' +
          '<form class="agx-form">' +
            '<input class="agx-input" type="text" placeholder="Type or tap the mic…" autocomplete="off" />' +
            '<button class="agx-send" type="submit" aria-label="Send" disabled>' + ICON.send + '</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  var pillEl      = root.querySelector(".agx-pill");
  var modalEl     = root.querySelector(".agx-modal");
  var backdropEl  = root.querySelector(".agx-backdrop");
  var closeBtn    = root.querySelector(".agx-close");
  var avatarEl    = root.querySelector(".agx-avatar");
  var haloEl      = root.querySelector(".agx-halo");
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
  var muteBtn     = root.querySelector(".agx-mute");

  /* ============================================================
     RENDER
     ============================================================ */
  function renderChips(){
    if (state.messages.length > 0) { chipsEl.innerHTML = ""; return; }
    chipsEl.innerHTML = SUGGESTED.map(function(p){
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
    for (var i = 0; i < state.messages.length; i++) {
      var m = state.messages[i];
      var wrap = m.role === "user" ? "agx-user" : "agx-bot";
      html += '<div class="agx-msg-wrap ' + wrap + '">' +
                '<div class="agx-msg">' + (m.role === "assistant" ? md(m.content || "…") : esc(m.content)) + '</div>' +
                '<div class="agx-ts">' + timeLabel(m.ts) + '</div>' +
              '</div>';
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
    // rings scale with mic level
    if (s === "listening") {
      for (var i = 0; i < ringEls.length; i++) {
        var size = 240 + i * 60 + state.micLevel * 80;
        ringEls[i].style.width  = size + "px";
        ringEls[i].style.height = size + "px";
        ringEls[i].style.opacity = String(0.6 - i * 0.15);
      }
    }
    // core glow
    var glow = 40 + state.micLevel * 120;
    var alpha = 0.4 + state.micLevel * 0.5;
    coreEl.style.boxShadow = "0 0 " + glow + "px rgba(20,184,166," + alpha.toFixed(2) + ")";
    // status text
    statusTitle.textContent = state.speaking ? "Speaking…"
      : state.listening ? "Listening…"
      : state.thinking ? "Thinking…"
      : "Ready";
    statusSub.textContent = state.listening
      ? "I'll respond when you pause"
      : "Tap the mic to talk or type on the right";
    // mic button appearance
    var active = state.listening || state.speaking;
    micBtn.classList.toggle("agx-mic-active", active);
    micBtn.innerHTML = active ? ICON.micOff : ICON.mic;
    micBtn.setAttribute("aria-label",
      state.speaking ? "Interrupt" : state.listening ? "Stop listening" : "Start listening");
  }

  function updateConnPill(){
    var labels = {
      idle:        "Idle",
      checking:    "Connecting",
      connected:   "Voice live",
      offline:     "Offline",
      denied:      "Mic blocked",
      unavailable: "Voice unavailable"
    };
    statusPill.className = "agx-status-pill agx-st-" + state.connStatus;
    statusLabel.textContent = labels[state.connStatus] || "Idle";
  }

  function updateMute(){
    muteBtn.innerHTML = state.muted ? ICON.volumeX : ICON.volume;
    muteBtn.setAttribute("aria-label", state.muted ? "Unmute voice" : "Mute voice");
  }

  /* ============================================================
     OPEN / CLOSE
     ============================================================ */
  function openModal(){
    state.open = true;
    modalEl.classList.add("agx-open");
    pillEl.style.display = "none";
    document.body.classList.add("agx-lock");
    document.documentElement.classList.add("agx-lock");
    renderMessages(); renderChips(); updateAvatarState(); updateMute(); updateConnPill();
    setTimeout(function(){ inputEl.focus(); }, 200);
    checkConn();
  }
  function closeModal(){
    state.open = false;
    modalEl.classList.remove("agx-open");
    pillEl.style.display = "";
    document.body.classList.remove("agx-lock");
    document.documentElement.classList.remove("agx-lock");
    // Hard tear-down so nothing auto-plays on reopen
    if (chatAbort) chatAbort.abort();
    if (ttsAbort)  ttsAbort.abort();
    stopRecording();
    if (audioEl) {
      try { audioEl.pause(); audioEl.removeAttribute("src"); audioEl.load(); } catch (_) {}
    }
    state.speaking = false; state.thinking = false;
    updateAvatarState();
  }

  pillEl.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  backdropEl.addEventListener("click", closeModal);
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && state.open) closeModal();
  });
  muteBtn.addEventListener("click", function(){ state.muted = !state.muted; updateMute(); });

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
     AUDIO ELEMENT (unlocked lazily via user gesture)
     ============================================================ */
  function ensureAudio(){
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.addEventListener("play",  function(){ state.speaking = true;  updateAvatarState(); });
      audioEl.addEventListener("ended", function(){ state.speaking = false; updateAvatarState(); });
      audioEl.addEventListener("pause", function(){ state.speaking = false; updateAvatarState(); });
    }
    return audioEl;
  }

  function interruptAudio(){
    if (audioEl) { try { audioEl.pause(); audioEl.currentTime = 0; } catch(_){} }
    if (ttsAbort) ttsAbort.abort();
    state.speaking = false; updateAvatarState();
  }

  /* ============================================================
     STT (multipart upload to /elevenlabs-stt)
     ============================================================ */
  function transcribe(blob){
    var fd = new FormData();
    fd.append("file", blob, "input.webm");
    return fetch(STT_URL, { method:"POST", headers: authHeaders, body: fd })
      .then(function(res){
        if (!res.ok) throw new Error("stt " + res.status);
        return res.json();
      })
      .then(function(j){ return (j.text || "").trim(); });
  }

  /* ============================================================
     STREAMING TTS (sentence-by-sentence)
     ============================================================ */
  function fetchTtsUrl(text, signal){
    return fetch(TTS_URL, {
      method:"POST", signal,
      headers: Object.assign({ "Content-Type":"application/json" }, authHeaders),
      body: JSON.stringify({ text: text, voiceId: VOICE_ID })
    }).then(function(res){
      if (!res.ok) throw new Error("tts " + res.status);
      return res.arrayBuffer();
    }).then(function(buf){
      return URL.createObjectURL(new Blob([buf], { type:"audio/mpeg" }));
    });
  }

  function createStreamingSpeaker(audio, signal){
    var buffer = "";
    var playing = Promise.resolve();
    var cancelled = false;
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
      push: function(delta){ if (cancelled) return; buffer += delta; flushBoundary(); },
      flush: function(){
        if (cancelled) return Promise.resolve();
        if (buffer.trim()) { enqueue(buffer); buffer = ""; }
        return playing;
      },
      cancel: function(){ cancelled = true; }
    };
  }

  /* ============================================================
     CHAT (SSE stream)
     ============================================================ */
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
      if (!res.ok || !res.body) throw new Error("chat " + res.status);
      var reader = res.body.getReader();
      var dec = new TextDecoder();
      var buf = "", full = "";
      function pump(){
        return reader.read().then(function(r){
          if (r.done) { onDone(full); return; }
          buf += dec.decode(r.value, { stream:true });
          var parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (var i = 0; i < parts.length; i++) {
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
     ASK (unified query handler)
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
    var ackPrefix = wasInterrupted ? "Sure, go ahead — " : "";

    var emailFromText = extractEmail(q);
    var emailForTurn = emailFromText || state.email || null;
    if (emailFromText) { saveEmail(emailFromText); state.email = emailFromText; }

    state.messages.push({ role:"user", content:q, ts:Date.now(), voice:isVoice });
    state.messages.push({ role:"assistant", content:ackPrefix, ts:Date.now(), voice:isVoice });
    state.thinking = true;
    renderMessages(); renderChips(); updateAvatarState();

    if (ttsAbort) ttsAbort.abort();
    ttsAbort = new AbortController();
    var speaker = null;
    if (isVoice && !state.muted) {
      speaker = createStreamingSpeaker(ensureAudio(), ttsAbort.signal);
      if (ackPrefix) speaker.push(ackPrefix);
    }

    var acc = ackPrefix;
    streamChat(state.messages.slice(0, -1), function(delta){
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
     RECORDER + VAD
     ============================================================ */
  var recStream = null, recMr = null, recChunks = [], recAC = null, recRaf = 0, recSilenceStart = null;

  function stopRecording(){
    try { if (recMr && recMr.state !== "inactive") recMr.stop(); } catch(_){}
    if (recStream) recStream.getTracks().forEach(function(t){ t.stop(); });
    if (recRaf) cancelAnimationFrame(recRaf);
    if (recAC) { try { recAC.close(); } catch(_){} }
    recMr = null; recStream = null; recAC = null; recRaf = 0; recSilenceStart = null;
    state.listening = false; state.micLevel = 0;
    updateAvatarState();
  }

  function handleNoSpeech(){
    var line = "Sorry, I didn't catch that — could you repeat?";
    state.messages.push({ role:"assistant", content:line, ts:Date.now(), voice:true });
    renderMessages();
    if (!state.muted) {
      if (ttsAbort) ttsAbort.abort();
      ttsAbort = new AbortController();
      var sp = createStreamingSpeaker(ensureAudio(), ttsAbort.signal);
      sp.push(line); sp.flush().catch(function(){});
    }
  }

  function startRecording(){
    if (state.listening) return;
    interruptAudio();

    // Unlock playback in user gesture so autoplay works later
    var a = ensureAudio();
    try {
      a.muted = true;
      a.play().catch(function(){}).finally(function(){
        try { a.pause(); a.currentTime = 0; a.muted = false; } catch(_){}
      });
    } catch(_){}

    navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } })
      .then(function(stream){
        recStream = stream;
        recChunks = [];
        try {
          recMr = new MediaRecorder(stream, { mimeType:"audio/webm" });
        } catch(_) {
          recMr = new MediaRecorder(stream);
        }
        recMr.ondataavailable = function(e){ if (e.data && e.data.size) recChunks.push(e.data); };
        recMr.onstop = function(){
          var blob = new Blob(recChunks, { type:"audio/webm" });
          if (blob.size > 1000) {
            transcribe(blob).then(function(text){
              if (text) ask(text, { voice:true });
              else handleNoSpeech();
            }).catch(function(err){
              console.error("stt error", err);
              state.connStatus = "unavailable"; updateConnPill();
            });
          } else {
            handleNoSpeech();
          }
        };
        recMr.start(250);
        state.listening = true; updateAvatarState();

        // VAD
        var startedAt = performance.now();
        var hadSpeech = false;
        recAC = new (window.AudioContext || window.webkitAudioContext)();
        var src = recAC.createMediaStreamSource(stream);
        var analyser = recAC.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        var data = new Uint8Array(analyser.frequencyBinCount);
        var SILENCE_THRESHOLD = 0.05, SPEECH_THRESHOLD = 0.08;
        var SILENCE_MS = 1200, MAX_WAIT_MS = 8000;
        var tick = function(){
          if (!state.listening) return;
          analyser.getByteTimeDomainData(data);
          var peak = 0;
          for (var i = 0; i < data.length; i++) {
            var v = Math.abs(data[i] - 128);
            if (v > peak) peak = v;
          }
          var norm = peak / 128;
          state.micLevel = norm; updateAvatarState();
          var now = performance.now();
          if (norm >= SPEECH_THRESHOLD) {
            hadSpeech = true; recSilenceStart = null;
          } else if (norm < SILENCE_THRESHOLD) {
            if (recSilenceStart === null) recSilenceStart = now;
            var silentFor = now - recSilenceStart;
            if (hadSpeech && silentFor > SILENCE_MS) { stopRecording(); return; }
            if (!hadSpeech && now - startedAt > MAX_WAIT_MS) { stopRecording(); return; }
          }
          recRaf = requestAnimationFrame(tick);
        };
        recRaf = requestAnimationFrame(tick);
      })
      .catch(function(err){
        console.error("mic error", err);
        state.listening = false;
        state.connStatus = "denied"; updateConnPill();
        updateAvatarState();
      });
  }

  micBtn.addEventListener("click", function(){
    if (state.speaking) { interruptAudio(); return; }
    if (state.listening) stopRecording();
    else startRecording();
  });

  /* ============================================================
     BARGE-IN — while AI speaking, monitor mic and interrupt
     ============================================================ */
  var bargeCancel = null;
  function startBargeIn(){
    stopBargeIn();
    if (!state.open || state.listening) return;
    var cancelled = false, stream = null, ac = null, raf = 0, speechStart = null;
    var THRESH = 0.09, SUSTAIN = 120;
    navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } })
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
          for (var i = 0; i < data.length; i++) {
            var v = Math.abs(data[i] - 128); if (v > peak) peak = v;
          }
          var norm = peak / 128, now = performance.now();
          if (norm >= THRESH) {
            if (speechStart === null) speechStart = now;
            if (now - speechStart >= SUSTAIN) {
              cancelled = true;
              interruptAudio();
              justInterrupted = true;
              queueMicrotask(function(){ startRecording(); });
              stopBargeIn();
              return;
            }
          } else { speechStart = null; }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(function(e){ console.warn("[barge-in] mic unavailable", e); });
    bargeCancel = function(){
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(function(t){ t.stop(); });
      if (ac) { try { ac.close(); } catch(_){} }
    };
  }
  function stopBargeIn(){ if (bargeCancel) { bargeCancel(); bargeCancel = null; } }

  // Watch speaking transitions to arm/disarm barge-in
  var _wasSpeaking = false;
  setInterval(function(){
    if (state.speaking !== _wasSpeaking) {
      _wasSpeaking = state.speaking;
      if (state.speaking && state.open && !state.listening) startBargeIn();
      else stopBargeIn();
    }
  }, 150);

  /* ============================================================
     CONNECTION PROBE
     ============================================================ */
  function checkConn(){
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      state.connStatus = "offline"; updateConnPill(); return;
    }
    state.connStatus = "checking"; updateConnPill();
    fetch(STT_URL, { method:"OPTIONS", headers: authHeaders })
      .then(function(res){
        state.connStatus = res.status < 500 ? "connected" : "unavailable";
        updateConnPill();
      })
      .catch(function(){ state.connStatus = "unavailable"; updateConnPill(); });
  }
  window.addEventListener("online",  function(){ if (state.open) checkConn(); });
  window.addEventListener("offline", function(){ state.connStatus = "offline"; updateConnPill(); });

  /* Initial paint */
  renderMessages(); renderChips(); updateAvatarState(); updateMute(); updateConnPill();
})();