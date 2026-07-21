/* =========================================================================
   Agilisium Voice Chat Widget — vanilla JavaScript
   Framework-free rewrite of the React/Vite bundle. No dependencies.
   Pair with agilisium-widget.css.
   ========================================================================= */
(function () {
  "use strict";

  /* ======================================================================
     1. Configuration
     ====================================================================== */

  var SUPABASE_URL = "https://cgdfhsseqspwitlgeaxt.supabase.co";
  var CHAT_URL = SUPABASE_URL + "/functions/v1/chat";
  var STT_URL = SUPABASE_URL + "/functions/v1/elevenlabs-stt";
  var TTS_URL = SUPABASE_URL + "/functions/v1/elevenlabs-tts";
  var ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGZoc3NlcXNwd2l0bGdlYXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTcyODksImV4cCI6MjA4NDczMzI4OX0.NIIhXWxr6YpL84PySjCNeJbX1dht1naXQL24iHscuU0";

  var CONTAINER_ID = "agilisium-chat-widget";
  var EMAIL_STORAGE_KEY = "agilisium_chat_email";
  var MOBILE_BREAKPOINT = 768;

  /* Painted inline only if the stylesheet fails to give the pill a colour. */
  var LAUNCHER_FALLBACK_BG = "#000000";

  /* Gap left between the host site's sticky header and the panel. */
  var NAVBAR_CLEARANCE = 12;
  var NAVBAR_MAX_HEIGHT = 240;

  var PROMPTS = [
    "Tell me about Agilisium",
    "What services do you provide?",
    "Show Life Sciences capabilities",
    "Book a demo",
    "Talk to an expert"
  ];

  var INTERRUPTION_PROMPT =
    "The user just verbally interrupted your previous response. Their interruption words are in the next user message (examples of intent: 'stop', 'that's fine', 'okay thanks', 'got it', or a new question). If they signalled they're done or satisfied, reply with ONE short, warm, human closing line — vary the wording every time, never repeat a template, keep it under 15 words, and offer to help further. If instead they asked a new question, answer it normally using the same grounded knowledge you always use. Do not apologize for being interrupted.";

  var WELCOME_TEXT =
    "Hi there! Welcome to Agilisium. I'm here to help you discover our AI, data, analytics, and life sciences solutions. Ask me anything, and I'll do my best to assist you.";

  var OPENING_TEXT =
    "Just so I can guide you to the right solutions, could you tell me which best describes you? Are you representing a pharmaceutical or biotech company, a healthcare organization, a technology partner, an existing customer, or are you exploring career opportunities?";

  var NOISE_WARNINGS = [
    "I'm having trouble hearing you clearly over the background noise — could you move somewhere quieter, or turn off your mic if you're not ready to talk?",
    "There's a lot of background sound coming through — mind finding a quieter spot, or muting your mic until you're ready?",
    "I'm not quite catching your voice through the noise — a quieter room would really help, or you can mute the mic for now."
  ];

  var HALLUCINATION_PATTERNS = [
    /^\s*thank(s| you)( for watching| for listening| very much)?[.!\s]*$/i,
    /^\s*(please\s+)?(like[,\s]+)?subscribe[.!\s]*$/i,
    /^\s*(bye|goodbye)[.!\s]*$/i,
    /^\s*you[.!\s]*$/i,
    /^\s*\.?\s*$/,
    /^\s*\[?\s*(music|silence|inaudible|background noise|applause)\s*\]?[.!\s]*$/i,
    /^\s*(uh|um|hmm|mm)[.!\s]*$/i
  ];

  var EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  /* docked-window size constraints */
  var MIN_W = 300, MIN_H = 340, MAX_W = 640, MAX_H = 760;

  /* ======================================================================
     2. Latency tracker (exposed as window.__VT, as before)
     ====================================================================== */

  var VT = {
    t0: 0,
    last: 0,
    marks: [],
    reset: function () {
      this.t0 = performance.now();
      this.last = this.t0;
      this.marks = [];
      console.log(
        "%c[VoiceLatency] \u23F1 RESET (silence detected \u2192 recording stopped)",
        "color:#14b8a6;font-weight:bold"
      );
    },
    mark: function (label) {
      if (!this.t0) return;
      var now = performance.now();
      var delta = Math.round(now - this.last);
      var total = Math.round(now - this.t0);
      this.last = now;
      this.marks.push({ label: label, t: now, deltaMs: delta, sinceStartMs: total });
      console.log(
        "%c[VoiceLatency] " +
          label.padEnd(32) +
          " +" +
          String(delta).padStart(5) +
          "ms   (total " +
          total +
          "ms)",
        "color:#0ea5e9"
      );
    },
    summary: function () {
      if (!this.marks.length) return;
      console.table(
        this.marks.map(function (m) {
          return { stage: m.label, deltaMs: m.deltaMs, totalMs: m.sinceStartMs };
        })
      );
    }
  };
  if (typeof window !== "undefined") window.__VT = VT;

  /* ======================================================================
     3. Small helpers
     ====================================================================== */

  function isHallucination(text) {
    var t = (text || "").trim();
    if (t.length < 2) return true;
    return HALLUCINATION_PATTERNS.some(function (re) {
      return re.test(t);
    });
  }

  function extractEmail(text) {
    var m = String(text || "").match(EMAIL_RE);
    return m ? m[0].toLowerCase() : null;
  }

  function loadStoredEmail() {
    try {
      return localStorage.getItem(EMAIL_STORAGE_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function saveStoredEmail(email) {
    if (!email) return;
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, email);
    } catch (e) {}
  }

  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  function toggleClass(node, name, on) {
    if (!node) return;
    node.classList[on ? "add" : "remove"](name);
  }

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  /* ---- Lucide icon paths (same glyphs the bundle used) ------------------ */

  var ICON_PATHS = {
    sparkles:
      '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    mic:
      '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    "mic-off":
      '<line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/>',
    volume2:
      '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    "volume-x":
      '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
    "phone-off":
      '<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" x2="2" y1="2" y2="22"/>',
    send:
      '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    wifi:
      '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>',
    "wifi-off":
      '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    "loader-circle": '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    "refresh-cw":
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    "triangle-alert":
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    shrink:
      '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
    expand:
      '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'
  };

  function iconMarkup(name, className, strokeWidth) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="' +
      (strokeWidth || 2) +
      '" stroke-linecap="round" stroke-linejoin="round"' +
      (className ? ' class="' + className + '"' : "") +
      ">" +
      (ICON_PATHS[name] || "") +
      "</svg>"
    );
  }

  function iconNode(name, className, strokeWidth) {
    var wrap = document.createElement("div");
    wrap.innerHTML = iconMarkup(name, className, strokeWidth);
    return wrap.firstChild;
  }

  /* ======================================================================
     4. Markdown renderer (replaces react-markdown + remark-gfm)
     ====================================================================== */

  var Markdown = (function () {
    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function safeUrl(url) {
      var u = String(url || "").trim();
      if (/^\s*javascript:/i.test(u) || /^\s*data:/i.test(u) || /^\s*vbscript:/i.test(u)) return "#";
      return escapeHtml(u);
    }

    /* --- inline ------------------------------------------------------- */
    function inline(src) {
      var out = "";
      var i = 0;
      var codeSpans = [];

      /* protect inline code first */
      var text = String(src).replace(/(`+)([\s\S]*?)\1/g, function (_, ticks, body) {
        codeSpans.push(body.replace(/^ | $/g, ""));
        return "\u0000CODE" + (codeSpans.length - 1) + "\u0000";
      });

      text = escapeHtml(text);

      /* images */
      text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (_, alt, url) {
        return '<img src="' + safeUrl(url) + '" alt="' + alt + '">';
      });

      /* links */
      text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (_, label, url) {
        return (
          '<a href="' + safeUrl(url) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>"
        );
      });

      /* gfm autolinks */
      text = text.replace(
        /(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;"')\]])/g,
        function (_, pre, url) {
          var href = /^www\./i.test(url) ? "http://" + url : url;
          return (
            pre +
            '<a href="' + safeUrl(href) + '" target="_blank" rel="noopener noreferrer">' + url + "</a>"
          );
        }
      );

      /* emphasis */
      text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
      text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      text = text.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>");
      text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
      text = text.replace(/(^|[^\w_])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>");

      /* gfm strikethrough */
      text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");

      /* hard line breaks */
      text = text.replace(/ {2,}\n/g, "<br>");

      /* restore code spans */
      text = text.replace(/\u0000CODE(\d+)\u0000/g, function (_, n) {
        return "<code>" + escapeHtml(codeSpans[+n]) + "</code>";
      });

      out += text;
      void i;
      return out;
    }

    /* --- table (gfm) --------------------------------------------------- */
    function splitRow(line) {
      var trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
      var cells = [];
      var buf = "";
      for (var i = 0; i < trimmed.length; i++) {
        var c = trimmed[i];
        if (c === "\\" && trimmed[i + 1] === "|") {
          buf += "|";
          i++;
        } else if (c === "|") {
          cells.push(buf);
          buf = "";
        } else buf += c;
      }
      cells.push(buf);
      return cells.map(function (s) {
        return s.trim();
      });
    }

    function isDelimiterRow(line) {
      return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line) && line.indexOf("-") >= 0;
    }

    /* --- lists ---------------------------------------------------------- */
    function renderList(items, ordered, start) {
      var tag = ordered ? "ol" : "ul";
      var isTask = items.some(function (it) {
        return /^\[( |x|X)\]\s+/.test(it.text);
      });
      var html =
        "<" +
        tag +
        (ordered && start && start !== 1 ? ' start="' + start + '"' : "") +
        (isTask ? ' class="agx-task-list"' : "") +
        ">";
      items.forEach(function (it) {
        var body = it.text;
        var checkbox = "";
        var m = body.match(/^\[( |x|X)\]\s+([\s\S]*)$/);
        if (m) {
          checkbox =
            '<input type="checkbox" disabled' + (m[1].toLowerCase() === "x" ? " checked" : "") + ">";
          body = m[2];
        }
        html += "<li>" + checkbox + inline(body) + (it.children ? blocks(it.children) : "") + "</li>";
      });
      return html + "</" + tag + ">";
    }

    /* --- block parser ---------------------------------------------------- */
    function blocks(src) {
      var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
      var html = "";
      var i = 0;

      while (i < lines.length) {
        var line = lines[i];

        /* blank */
        if (!line.trim()) {
          i++;
          continue;
        }

        /* fenced code */
        var fence = line.match(/^\s*(```+|~~~+)\s*([^\s`]*)\s*$/);
        if (fence) {
          var marker = fence[1][0];
          var body = [];
          i++;
          while (i < lines.length && !new RegExp("^\\s*" + marker + "{3,}\\s*$").test(lines[i])) {
            body.push(lines[i]);
            i++;
          }
          i++;
          html +=
            "<pre><code" +
            (fence[2] ? ' class="language-' + escapeHtml(fence[2]) + '"' : "") +
            ">" +
            escapeHtml(body.join("\n")) +
            "</code></pre>";
          continue;
        }

        /* heading */
        var head = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
        if (head) {
          var lvl = head[1].length;
          html += "<h" + lvl + ">" + inline(head[2]) + "</h" + lvl + ">";
          i++;
          continue;
        }

        /* horizontal rule */
        if (/^\s{0,3}([-*_])\s*(\1\s*){2,}$/.test(line)) {
          html += "<hr>";
          i++;
          continue;
        }

        /* blockquote */
        if (/^\s{0,3}>/.test(line)) {
          var quote = [];
          while (i < lines.length && (/^\s{0,3}>/.test(lines[i]) || lines[i].trim())) {
            if (!/^\s{0,3}>/.test(lines[i]) && !lines[i].trim()) break;
            quote.push(lines[i].replace(/^\s{0,3}>\s?/, ""));
            i++;
          }
          html += "<blockquote>" + blocks(quote.join("\n")) + "</blockquote>";
          continue;
        }

        /* table (gfm) */
        if (
          line.indexOf("|") >= 0 &&
          i + 1 < lines.length &&
          isDelimiterRow(lines[i + 1]) &&
          lines[i + 1].indexOf("|") >= 0
        ) {
          var headCells = splitRow(line);
          var aligns = splitRow(lines[i + 1]).map(function (c) {
            var l = c.charAt(0) === ":";
            var r = c.charAt(c.length - 1) === ":";
            return l && r ? "center" : r ? "right" : l ? "left" : "";
          });
          i += 2;
          var t = "<table><thead><tr>";
          headCells.forEach(function (c, idx) {
            t +=
              "<th" +
              (aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : "") +
              ">" +
              inline(c) +
              "</th>";
          });
          t += "</tr></thead><tbody>";
          while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") >= 0) {
            var cells = splitRow(lines[i]);
            t += "<tr>";
            for (var ci = 0; ci < headCells.length; ci++) {
              t +=
                "<td" +
                (aligns[ci] ? ' style="text-align:' + aligns[ci] + '"' : "") +
                ">" +
                inline(cells[ci] || "") +
                "</td>";
            }
            t += "</tr>";
            i++;
          }
          html += t + "</tbody></table>";
          continue;
        }

        /* list */
        var listMatch = line.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
        if (listMatch) {
          var baseIndent = listMatch[1].length;
          var ordered = /\d/.test(listMatch[2]);
          var startNo = ordered ? parseInt(listMatch[2], 10) : 1;
          var items = [];
          while (i < lines.length) {
            var m2 = lines[i].match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
            if (m2 && m2[1].length <= baseIndent + 1) {
              if (/\d/.test(m2[2]) !== ordered) break;
              items.push({ text: m2[3], children: null });
              i++;
              /* gather continuation / nested lines */
              var nested = [];
              while (i < lines.length) {
                if (!lines[i].trim()) {
                  if (
                    i + 1 < lines.length &&
                    /^\s+\S/.test(lines[i + 1]) &&
                    lines[i + 1].search(/\S/) > baseIndent
                  ) {
                    nested.push("");
                    i++;
                    continue;
                  }
                  break;
                }
                var indent = lines[i].search(/\S/);
                if (indent > baseIndent) {
                  nested.push(lines[i].slice(baseIndent + 2 <= indent ? baseIndent + 2 : indent));
                  i++;
                } else break;
              }
              if (nested.length && nested.join("").trim()) {
                items[items.length - 1].children = nested.join("\n");
              }
            } else if (!lines[i].trim()) {
              break;
            } else break;
          }
          html += renderList(items, ordered, startNo);
          continue;
        }

        /* paragraph */
        var para = [];
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^\s{0,3}(#{1,6})\s/.test(lines[i]) &&
          !/^\s{0,3}>/.test(lines[i]) &&
          !/^\s*(```+|~~~+)/.test(lines[i]) &&
          !/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(lines[i]) &&
          !/^\s{0,3}([-*_])\s*(\1\s*){2,}$/.test(lines[i])
        ) {
          para.push(lines[i]);
          i++;
        }
        if (para.length) {
          html += "<p>" + inline(para.join("\n")) + "</p>";
        } else {
          i++;
        }
      }

      return html;
    }

    return { render: blocks };
  })();

  /* ======================================================================
     5. API layer
     ====================================================================== */

  function authHeaders(extra) {
    var h = { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  /**
   * Streams a chat completion (SSE over fetch) and forwards deltas.
   */
  async function streamChat(messages, onDelta, onDone, signal, opts) {
    var payload = {
      messages: messages.map(function (m) {
        return { role: m.role, content: m.content };
      }),
      email: (opts && opts.email) || null,
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      voice: !!(opts && opts.voice)
    };

    VT.mark("4. Chat request sent (/chat)");

    var res = await fetch(CHAT_URL, {
      method: "POST",
      signal: signal,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });

    if (!res.ok || !res.body) throw new Error("chat " + res.status);
    VT.mark("4b. Chat response headers received");

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var full = "";
    var buffer = "";
    var first = true;

    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      var events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (var e = 0; e < events.length; e++) {
        var raw = events[e].trim();
        if (raw.indexOf("data:") !== 0) continue;
        var data = raw.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          var parsed = JSON.parse(data);
          var delta =
            (parsed.choices &&
              parsed.choices[0] &&
              parsed.choices[0].delta &&
              parsed.choices[0].delta.content) ||
            parsed.delta ||
            parsed.text ||
            "";
          if (delta) {
            if (first) {
              first = false;
              VT.mark("5. 1st LLM token received");
            }
            full += delta;
            onDelta(delta);
          }
        } catch (err) {}
      }
    }

    onDone(full);
  }

  /** Speech-to-text. */
  async function transcribe(blob) {
    var form = new FormData();
    form.append("file", blob, "input.webm");
    VT.mark("2. STT request sent");

    var res = await fetch(STT_URL, { method: "POST", headers: authHeaders(), body: form });
    if (!res.ok) throw new Error("stt " + res.status);

    var json = await res.json();
    VT.mark("3. STT transcript received");
    return { text: (json.text || "").trim(), model: json.model };
  }

  var ttsCallCount = 0;
  var ttsFirstChunkPending = false;

  /** Text-to-speech; resolves to an object URL for the mp3. */
  async function synthesize(text, signal) {
    var isFirst = ++ttsCallCount === 1 || ttsFirstChunkPending;
    if (isFirst) {
      VT.mark("7. TTS request sent (1st chunk)");
      ttsFirstChunkPending = false;
    }

    var t0 = performance.now();
    var res = await fetch(TTS_URL, {
      method: "POST",
      signal: signal,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ text: text })
    });

    if (!res.ok) throw new Error("tts " + res.status);
    if (isFirst) VT.mark("8a. TTS response headers (1st chunk)");

    var buf = await res.arrayBuffer();
    if (isFirst) {
      console.log(
        "[VoiceLatency] 1st TTS body downloaded in " +
          Math.round(performance.now() - t0) +
          "ms (" +
          buf.byteLength +
          " bytes)"
      );
      VT.mark("8b. TTS 1st audio bytes ready");
    }

    return URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
  }

  /** Cheap reachability probe against the STT endpoint. */
  async function pingVoiceService(signal) {
    try {
      var res = await fetch(STT_URL, { method: "OPTIONS", signal: signal, headers: authHeaders() });
      return res.status < 500;
    } catch (e) {
      return false;
    }
  }

  /* ======================================================================
     6. Sentence-chunked TTS playback queue
     ====================================================================== */

  var MIN_CHUNK = 8;
  var MIN_SENTENCE = 40;
  var FIRST_SOFT_CAP = 40;
  var FIRST_HARD_CAP = 80;

  /**
   * Buffers streamed text, splits it into speakable chunks, synthesizes each
   * and plays them back in order through `audio`.
   * `onChunkStart` is invoked with a chunk's text once its audio starts.
   */
  function createSpeechQueue(audio, signal, onChunkStart) {
    var pending = "";
    var chain = Promise.resolve();
    var cancelled = false;
    var dispatchedFirst = false;
    var announcedAudible = false;
    var queued = [];

    signal.addEventListener("abort", function () {
      cancelled = true;
      try {
        audio.pause();
      } catch (e) {}
      if (queued.length && onChunkStart) {
        var rest = queued.join("");
        queued.length = 0;
        try {
          onChunkStart(rest);
        } catch (e) {}
      }
    });

    function enqueue(chunk) {
      var text = chunk.trim();
      if (!text) return;

      if (!dispatchedFirst) {
        dispatchedFirst = true;
        ttsFirstChunkPending = true;
        VT.mark("6. 1st sentence ready \u2192 dispatched to TTS");
      }
      queued.push(chunk);

      var urlPromise = synthesize(text, signal).catch(function (err) {
        console.warn("tts chunk failed", err);
        return "";
      });

      chain = chain.then(async function () {
        if (cancelled) return;
        var url = await urlPromise;
        if (!url || cancelled) return;

        await new Promise(function (resolve) {
          function finish() {
            audio.removeEventListener("ended", finish);
            audio.removeEventListener("error", finish);
            audio.removeEventListener("playing", onPlaying);
            URL.revokeObjectURL(url);
            resolve();
          }
          function onPlaying() {
            if (!announcedAudible) {
              announcedAudible = true;
              VT.mark("9. Audio playback started (audible)");
              VT.summary();
            }
            var idx = queued.indexOf(chunk);
            if (idx !== -1) queued.splice(idx, 1);
            try {
              if (onChunkStart) onChunkStart(chunk);
            } catch (e) {}
          }
          audio.addEventListener("ended", finish);
          audio.addEventListener("error", finish);
          audio.addEventListener("playing", onPlaying);
          audio.src = url;
          audio.play().catch(function () {
            finish();
          });
        });
      });
    }

    var firstFlushed = false;

    function drain() {
      if (!firstFlushed) {
        var early = pending.match(/^([^.!?\n,;:—-]{8,}?[.!?\n,;:—-])/);
        if (early && early[1].length >= MIN_CHUNK) {
          var head = early[1];
          pending = pending.slice(head.length);
          enqueue(head);
          firstFlushed = true;
        } else if (pending.length >= FIRST_SOFT_CAP) {
          var space = pending.lastIndexOf(" ", FIRST_SOFT_CAP);
          var cut = space > MIN_CHUNK ? space : FIRST_SOFT_CAP;
          var piece = pending.slice(0, cut);
          pending = pending.slice(cut);
          enqueue(piece);
          firstFlushed = true;
        } else if (pending.length >= FIRST_HARD_CAP) {
          var hard = pending.slice(0, FIRST_HARD_CAP);
          pending = pending.slice(FIRST_HARD_CAP);
          enqueue(hard);
          firstFlushed = true;
        }
        if (!firstFlushed) return;
      }

      var re = /[^.!?\n]*[.!?\n]+/g;
      var m;
      var consumed = 0;
      var acc = "";
      while ((m = re.exec(pending)) !== null) {
        acc += m[0];
        consumed = re.lastIndex;
        if (acc.trim().length >= MIN_SENTENCE) {
          enqueue(acc);
          acc = "";
        }
      }
      pending = acc + pending.slice(consumed);
    }

    return {
      push: function (text) {
        if (cancelled) return;
        pending += text;
        drain();
      },
      flush: async function () {
        if (cancelled) return;
        if (pending.trim()) {
          enqueue(pending);
          pending = "";
        }
        await chain;
      },
      cancel: function () {
        cancelled = true;
      }
    };
  }

  /* ======================================================================
     7. Microphone recorder with voice-activity detection
     ====================================================================== */

  var VAD_SILENCE_RMS = 0.05;
  var VAD_SPEECH_RMS = 0.09;
  var VAD_SPEECH_CONFIRM_MS = 100;
  var VAD_SILENCE_STOP_MS = 1200;
  var VAD_NO_SPEECH_TIMEOUT_MS = 8000;

  /**
   * Records from the mic and stops automatically on trailing silence.
   * onCapture(blob, stats) fires when usable audio was captured; onReject()
   * fires when the take was discarded.
   */
  function createRecorder(onCapture, onReject, onStateChange) {
    var recorder = null;
    var stream = null;
    var chunks = [];
    var analyser = null;
    var rafId = null;
    var silenceSince = null;
    var listening = false;
    var level = 0;

    function setListening(v) {
      if (listening !== v) {
        listening = v;
        onStateChange();
      }
    }

    function setLevel(v) {
      if (level !== v) {
        level = v;
        onStateChange();
      }
    }

    function stop() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      if (stream) {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
      }
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      recorder = null;
      stream = null;
      analyser = null;
      silenceSince = null;
      setListening(false);
      setLevel(0);
    }

    async function start() {
      try {
        var media = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        stream = media;

        var rec = new MediaRecorder(media, { mimeType: "audio/webm" });
        recorder = rec;
        chunks = [];
        rec.ondataavailable = function (ev) {
          if (ev.data.size) chunks.push(ev.data);
        };

        var stats = {
          speechMs: 0,
          speechRmsSum: 0,
          speechFrames: 0,
          noiseSum: 0,
          noiseFrames: 0,
          startedAt: performance.now()
        };

        rec.onstop = function () {
          var blob = new Blob(chunks, { type: "audio/webm" });
          var capturedMs = performance.now() - stats.startedAt;
          var speechRms = stats.speechFrames > 0 ? stats.speechRmsSum / stats.speechFrames : 0;
          var noiseRms = stats.noiseFrames > 0 ? stats.noiseSum / stats.noiseFrames : 0.01;
          var snr = speechRms / Math.max(noiseRms, 0.005);
          var summary = { speechMs: stats.speechMs, capturedMs: capturedMs, snr: snr };

          console.log(
            "[capture] speechMs=" +
              Math.round(summary.speechMs) +
              " capturedMs=" +
              Math.round(summary.capturedMs) +
              " snr=" +
              snr.toFixed(2) +
              " bytes=" +
              blob.size
          );

          if (blob.size > 1000 && rec._hadSpeech) onCapture(blob, summary);
          else if (onReject) onReject();
        };

        rec.start(250);
        setListening(true);

        var startedAt = stats.startedAt;
        var speechConfirmed = false;
        var loudSince = null;
        var lastFrameAt = startedAt;

        var ctx = new AudioContext();
        var source = ctx.createMediaStreamSource(media);
        var node = ctx.createAnalyser();
        node.fftSize = 512;
        source.connect(node);
        analyser = node;

        var data = new Uint8Array(node.frequencyBinCount);

        var tick = function () {
          node.getByteTimeDomainData(data);

          var peak = 0;
          for (var i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
          var amp = peak / 128;
          setLevel(amp);

          var now = performance.now();
          var dt = Math.min(80, now - lastFrameAt);
          lastFrameAt = now;

          if (amp >= VAD_SPEECH_RMS) {
            if (loudSince === null) loudSince = now;
            if (!speechConfirmed && now - loudSince >= VAD_SPEECH_CONFIRM_MS) {
              speechConfirmed = true;
              rec._hadSpeech = true;
            }
            if (speechConfirmed) {
              stats.speechMs += dt;
              stats.speechRmsSum += amp;
              stats.speechFrames++;
            }
            silenceSince = null;
          } else if (amp < VAD_SILENCE_RMS) {
            loudSince = null;
            if (!speechConfirmed) {
              stats.noiseSum += amp;
              stats.noiseFrames++;
            }
            if (silenceSince === null) silenceSince = now;
            var quietFor = now - silenceSince;

            if (speechConfirmed && quietFor > VAD_SILENCE_STOP_MS) {
              VT.reset();
              VT.mark("1. Silence detected \u2192 recording stopped");
              stop();
              return;
            }
            if (!speechConfirmed && now - startedAt > VAD_NO_SPEECH_TIMEOUT_MS) {
              stop();
              return;
            }
          } else {
            loudSince = null;
          }

          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
      } catch (err) {
        console.error("mic error", err);
        setListening(false);
      }
    }

    return {
      start: start,
      stop: stop,
      isListening: function () {
        return listening;
      },
      getLevel: function () {
        return level;
      }
    };
  }

  /* ======================================================================
     8. Voice-service connection monitor
     ====================================================================== */

  function createConnectionMonitor(onChange) {
    var status = "idle";
    var attempt = 0;
    var lastCheck = 0;
    var retryTimer = null;
    var controller = null;
    var interval = null;
    var active = false;

    function set(next, nextAttempt) {
      var changed = false;
      if (next !== undefined && next !== status) {
        status = next;
        changed = true;
      }
      if (nextAttempt !== undefined && nextAttempt !== attempt) {
        attempt = nextAttempt;
        changed = true;
      }
      if (changed) onChange();
    }

    function clearRetry() {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    async function check() {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        set("offline");
        return false;
      }
      try {
        var perm =
          navigator.permissions && navigator.permissions.query
            ? await navigator.permissions.query({ name: "microphone" })
            : null;
        if (perm && perm.state === "denied") {
          set("denied");
          return false;
        }
      } catch (e) {}

      set(status === "connected" ? "connected" : "checking");

      if (controller) controller.abort();
      controller = new AbortController();

      var ok = await pingVoiceService(controller.signal);
      lastCheck = Date.now();

      if (ok) {
        set("connected", 0);
        return true;
      }
      set("unavailable");
      return false;
    }

    function scheduleReconnect() {
      clearRetry();
      set("reconnecting");
      var next = attempt + 1;
      var delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 5)));
      set(undefined, next);
      retryTimer = window.setTimeout(async function () {
        var ok = await check();
        if (!ok) scheduleReconnect();
      }, delay);
    }

    async function retryNow() {
      clearRetry();
      set(undefined, 0);
      var ok = await check();
      if (!ok) scheduleReconnect();
    }

    function onOnline() {
      retryNow();
    }
    function onOffline() {
      set("offline");
    }

    function enable() {
      if (active) return;
      active = true;
      (async function () {
        var ok = await check();
        if (!ok) scheduleReconnect();
      })();
      interval = window.setInterval(function () {
        if (document.visibilityState === "visible") check();
      }, 30000);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    }

    function disable() {
      if (!active) return;
      active = false;
      if (interval !== null) window.clearInterval(interval);
      interval = null;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearRetry();
      if (controller) controller.abort();
      set("idle", 0);
    }

    return {
      enable: enable,
      disable: disable,
      retryNow: retryNow,
      markFailure: scheduleReconnect,
      getStatus: function () {
        return status;
      },
      getAttempt: function () {
        return attempt;
      },
      getLastCheck: function () {
        return lastCheck;
      }
    };
  }

  /* ======================================================================
     9. Effect helper — re-runs setup/cleanup when a dependency key changes
     ====================================================================== */

  function createEffect(setup) {
    var cleanup = null;
    var lastKey = "\u0000never";
    return function (key) {
      if (key === lastKey) return;
      lastKey = key;
      if (cleanup) {
        try {
          cleanup();
        } catch (e) {}
        cleanup = null;
      }
      var result = setup();
      cleanup = typeof result === "function" ? result : null;
    };
  }

  /* ======================================================================
     10. Widget
     ====================================================================== */

  function createWidget(root) {
    /* ---------------------------------------------------------- state ---- */
    var state = {
      open: false,
      mode: "expanded", // "expanded" | "docked"
      voiceMuted: false,
      micMuted: true,
      messages: [],
      email: loadStoredEmail(),
      thinking: false,
      slowHint: false,
      speaking: false,
      input: "",
      inputFocused: false,
      placeholder: "",
      isMobile: window.innerWidth < MOBILE_BREAKPOINT,
      pos: null, // {x,y} for docked window
      size: { width: 380, height: 520 },
      connStatus: "idle",
      connAttempt: 0
    };

    var audio = null;
    var chatController = null; // aborts the /chat fetch
    var speechController = null; // aborts TTS + playback
    var greeted = false;
    var pendingInterrupt = false;
    var slowHintTimer = null;
    var noiseTracker = { consecutive: 0, lastWarnAt: 0, variantIdx: 0 };
    var dragStart = null;
    var resizeStart = null;
    var resizeDir = "se";
    var typewriterTimer = null;
    var typewriterCancelled = false;
    var bodyScrollLocked = false;
    var lockedScrollY = 0;

    /** Locks/restores background-page scrolling. Only ever engaged while the
     *  widget is a true modal (open + expanded) — the docked mini window
     *  stays non-modal and leaves the host page scrollable.
     *
     *  Pins <body> with position:fixed (not just overflow:hidden) because
     *  overflow:hidden alone still lets touch/wheel scrolling leak through
     *  on iOS Safari. Scroll position is restored exactly on unlock. */
    function setBodyScrollLock(shouldLock) {
      if (shouldLock === bodyScrollLocked) return;
      bodyScrollLocked = shouldLock;
      var body = document.body;
      var html = document.documentElement;

      if (shouldLock) {
        lockedScrollY = window.scrollY || html.scrollTop || 0;
        toggleClass(html, "agx-scroll-lock", true);
        body.style.position = "fixed";
        body.style.top = -lockedScrollY + "px";
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";
      } else {
        toggleClass(html, "agx-scroll-lock", false);
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        window.scrollTo(0, lockedScrollY);
      }
    }

    var scheduled = false;
    function update() {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () {
        scheduled = false;
        render();
        runEffects();
      });
    }

    /* ------------------------------------------------------ connection ---- */
    var connection = createConnectionMonitor(function () {
      state.connStatus = connection.getStatus();
      state.connAttempt = connection.getAttempt();
      update();
    });

    /* -------------------------------------------------------- recorder ---- */
    var recorder = createRecorder(onCapture, onCaptureRejected, update);

    /* ====================================================================
       DOM
       ==================================================================== */

    var dom = {};

    function buildDom() {
      /* -- launcher -------------------------------------------------- */
      var launcher = el("button", "agx-launcher", { "aria-label": "Talk to Agilisium AI" });
      launcher.innerHTML =
        '<span class="agx-launcher-orb">' +
        '<span class="agx-launcher-ping agx-anim-ping"></span>' +
        iconMarkup("sparkles", "agx-launcher-icon", 1.5) +
        "</span>" +
        '<span class="agx-launcher-label">Talk to Agilisium AI</span>';
      launcher.addEventListener("click", function () {
        state.open = true;
        state.mode = "expanded";
        syncTopOffset();
        update();
      });
      dom.launcher = launcher;

      /* -- overlay --------------------------------------------------- */
      var overlay = el("div", "agx-overlay", {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Agilisium AI"
      });
      dom.overlay = overlay;

      var backdrop = el("div", "agx-backdrop");
      backdrop.addEventListener("click", closeWidget);
      overlay.appendChild(backdrop);
      dom.backdrop = backdrop;

      var panel = el("div", "agx-panel");
      panel.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
      panel.addEventListener("pointerdown", function (ev) {
        if (state.mode === "expanded") return;
        if (ev.target.closest("button, a, input, textarea, [data-no-drag], [data-resize-handle]"))
          return;
        beginDrag(ev);
      });
      panel.addEventListener("pointermove", function (ev) {
        if (state.mode === "expanded") return;
        moveDrag(ev);
      });
      panel.addEventListener("pointerup", function (ev) {
        if (state.mode === "expanded") return;
        endDrag(ev);
      });
      overlay.appendChild(panel);
      dom.panel = panel;

      /* brand badge */
      var brand = el("div", "agx-brand");
      brand.innerHTML =
        iconMarkup("sparkles", "agx-brand-icon", 1.5) + '<span class="agx-brand-text"></span>';
      panel.appendChild(brand);
      dom.brandText = brand.querySelector(".agx-brand-text");

      /* docked window controls */
      var winControls = el("div", "agx-window-controls");
      var expandBtn = el("button", "agx-iconbtn agx-iconbtn-sm", { "aria-label": "Expand" });
      expandBtn.innerHTML = iconMarkup("expand", "", 2);
      expandBtn.querySelector("svg").setAttribute("width", "15");
      expandBtn.querySelector("svg").setAttribute("height", "15");
      expandBtn.addEventListener("click", function () {
        state.mode = "expanded";
        update();
      });
      var closeSmall = el("button", "agx-iconbtn agx-iconbtn-sm", { "aria-label": "Close" });
      closeSmall.innerHTML = iconMarkup("x", "", 2);
      closeSmall.querySelector("svg").setAttribute("width", "16");
      closeSmall.querySelector("svg").setAttribute("height", "16");
      closeSmall.addEventListener("click", closeWidget);
      winControls.appendChild(expandBtn);
      winControls.appendChild(closeSmall);
      panel.appendChild(winControls);
      dom.winControls = winControls;

      /* -- stage (orb) ------------------------------------------------ */
      var stage = el("div", "agx-stage");
      var stageInner = el("div", "agx-stage-inner");

      var orb = el("div", "agx-orb", { "aria-hidden": "true" });
      var orbGlow = el("div", "agx-orb-glow");
      orb.appendChild(orbGlow);
      var orbRings = [];
      for (var r = 0; r < 3; r++) {
        var ring = el("div", "agx-orb-ring");
        orb.appendChild(ring);
        orbRings.push(ring);
      }
      var orbCore = el("div", "agx-orb-core");
      orbCore.innerHTML =
        '<div class="agx-orb-sheen"></div>' + iconMarkup("sparkles", "agx-orb-icon", 1.5);
      orb.appendChild(orbCore);
      stageInner.appendChild(orb);

      dom.orbGlow = orbGlow;
      dom.orbRings = orbRings;
      dom.orbCore = orbCore;
      dom.orbIcon = orbCore.querySelector(".agx-orb-icon");

      var status = el("div", "agx-status");
      var statusTitle = el("div", "agx-status-title");
      var statusSub = el("div", "agx-status-sub");
      status.appendChild(statusTitle);
      status.appendChild(statusSub);
      stageInner.appendChild(status);
      stage.appendChild(stageInner);
      dom.statusTitle = statusTitle;
      dom.statusSub = statusSub;

      /* action row */
      var actions = el("div", "agx-actions");
      var contact = el("a", "agx-contact", { href: "/about/contact" });
      contact.textContent = "Contact us";
      actions.appendChild(contact);

      var group = el("div", "agx-action-group");

      var micBtn = el("button", "agx-pillbtn agx-pillbtn-mic");
      micBtn.addEventListener("click", toggleMic);
      group.appendChild(micBtn);
      dom.micBtn = micBtn;

      var voiceBtn = el("button", "agx-pillbtn agx-pillbtn-voice");
      voiceBtn.addEventListener("click", function () {
        state.voiceMuted = !state.voiceMuted;
        if (state.voiceMuted) stopSpeaking();
        update();
      });
      group.appendChild(voiceBtn);
      dom.voiceBtn = voiceBtn;

      var endBtn = el("button", "agx-pillbtn agx-pillbtn-end", { "aria-label": "End chat" });
      endBtn.innerHTML = iconMarkup("phone-off", "agx-conn-icon", 2);
      endBtn.querySelector("svg").style.width = "0.875rem";
      endBtn.querySelector("svg").style.height = "0.875rem";
      endBtn.addEventListener("click", closeWidget);
      group.appendChild(endBtn);

      actions.appendChild(group);
      stage.appendChild(actions);
      panel.appendChild(stage);
      dom.stage = stage;

      /* -- chat pane -------------------------------------------------- */
      var chat = el("div", "agx-chat");

      var header = el("div", "agx-chat-header");
      header.addEventListener("pointerdown", function (ev) {
        if (state.mode === "expanded") return;
        if (ev.target.closest("button, a, input, textarea, [data-no-drag], [data-resize-handle]"))
          return;
        beginDrag(ev);
      });
      header.addEventListener("pointermove", function (ev) {
        if (state.mode === "expanded") return;
        moveDrag(ev);
      });
      header.addEventListener("pointerup", function (ev) {
        if (state.mode === "expanded") return;
        endDrag(ev);
      });

      var titleWrap = el("div", "agx-chat-title-wrap");
      titleWrap.innerHTML =
        '<div class="agx-chat-title">Agilisium AI</div>' +
        '<div class="agx-chat-subtitle">Voice-enabled assistant</div>';
      header.appendChild(titleWrap);
      dom.titleWrap = titleWrap;

      var headerActions = el("div", "agx-chat-header-actions");

      var conn = el("div", "agx-conn", { role: "status", "aria-live": "polite" });
      headerActions.appendChild(conn);
      dom.conn = conn;

      var shrinkBtn = el("button", "agx-iconbtn agx-iconbtn-lg", { "aria-label": "Shrink to corner" });
      shrinkBtn.innerHTML = iconMarkup("shrink", "", 2);
      shrinkBtn.querySelector("svg").setAttribute("width", "15");
      shrinkBtn.querySelector("svg").setAttribute("height", "15");
      shrinkBtn.addEventListener("click", function () {
        state.mode = "docked";
        update();
      });
      headerActions.appendChild(shrinkBtn);
      dom.shrinkBtn = shrinkBtn;

      var closeBtn = el("button", "agx-iconbtn agx-iconbtn-lg", { "aria-label": "Close" });
      closeBtn.innerHTML = iconMarkup("x", "", 2);
      closeBtn.querySelector("svg").setAttribute("width", "16");
      closeBtn.querySelector("svg").setAttribute("height", "16");
      closeBtn.addEventListener("click", closeWidget);
      headerActions.appendChild(closeBtn);
      dom.closeBtn = closeBtn;

      header.appendChild(headerActions);
      chat.appendChild(header);
      dom.header = header;

      var messages = el("div", "agx-messages");
      messages.setAttribute("data-no-drag", "true");
      chat.appendChild(messages);
      dom.messages = messages;

      var empty = el("div", "agx-empty");
      empty.textContent = "Hi! I'm your Agilisium AI. Tap the mic to talk, or pick a prompt below.";
      messages.appendChild(empty);
      dom.empty = empty;

      var typing = el("div", "agx-typing agx-hidden");
      typing.innerHTML =
        '<span class="agx-dot agx-anim-bounce"></span>' +
        '<span class="agx-dot agx-anim-bounce" style="animation-delay:120ms"></span>' +
        '<span class="agx-dot agx-anim-bounce" style="animation-delay:240ms"></span>' +
        '<span class="agx-typing-note agx-hidden">Just a moment\u2026</span>';
      messages.appendChild(typing);
      dom.typing = typing;
      dom.typingNote = typing.querySelector(".agx-typing-note");

      var form = el("form", "agx-form");
      form.setAttribute("data-no-drag", "true");
      var input = el("input", "agx-input", { type: "text" });
      input.addEventListener("input", function () {
        state.input = input.value;
        update();
      });
      input.addEventListener("focus", function () {
        state.inputFocused = true;
        update();
      });
      input.addEventListener("blur", function () {
        state.inputFocused = false;
        update();
      });
      form.appendChild(input);
      dom.input = input;

      var send = el("button", "agx-send", { type: "submit", "aria-label": "Send" });
      send.innerHTML = iconMarkup("send", "", 2);
      send.querySelector("svg").style.width = "1rem";
      send.querySelector("svg").style.height = "1rem";
      form.appendChild(send);
      dom.send = send;

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var text = state.input;
        state.input = "";
        input.value = "";
        update();
        sendMessage(text, { voice: false });
      });
      chat.appendChild(form);

      var disclaimer = el("div", "agx-disclaimer");
      disclaimer.innerHTML =
        "<p>AI-generated responses may be inaccurate. Please verify independently. " +
        'By continuing, you accept our <a href="https://www.agilisium.com/privacy-policy" ' +
        'target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>';
      chat.appendChild(disclaimer);

      panel.appendChild(chat);
      dom.chat = chat;

      /* -- resize handles --------------------------------------------- */
      dom.handles = [];
      ["n", "s", "w", "e", "nw", "ne", "sw", "se"].forEach(function (dir) {
        var handle = el("div", "agx-resize agx-resize-" + dir);
        handle.setAttribute("data-resize-handle", "true");
        if (dir === "se") {
          handle.innerHTML =
            '<svg width="10" height="10" viewBox="0 0 10 10">' +
            '<path d="M9 1L1 9M9 5L5 9" stroke="currentColor" stroke-width="1.2"/></svg>';
        }
        handle.addEventListener("pointerdown", beginResize(dir));
        handle.addEventListener("pointermove", moveResize);
        handle.addEventListener("pointerup", endResize);
        panel.appendChild(handle);
        dom.handles.push(handle);
      });

      root.appendChild(launcher);
      root.appendChild(overlay);
    }

    /* ====================================================================
       Drag & resize
       ==================================================================== */

    function getPos() {
      if (state.pos) return state.pos;
      var rect = dom.panel ? dom.panel.getBoundingClientRect() : null;
      if (rect) return { x: rect.left, y: rect.top };
      return {
        x: window.innerWidth - state.size.width - 24,
        y: window.innerHeight - state.size.height - 24
      };
    }

    function beginDrag(ev) {
      try {
        ev.target.setPointerCapture(ev.pointerId);
      } catch (e) {}
      var p = getPos();
      dragStart = { startX: ev.clientX, startY: ev.clientY, startPosX: p.x, startPosY: p.y };
    }

    function moveDrag(ev) {
      if (!dragStart) return;
      var dx = ev.clientX - dragStart.startX;
      var dy = ev.clientY - dragStart.startY;
      var w = Math.min(state.size.width, window.innerWidth - 16);
      var h = Math.min(state.size.height, window.innerHeight - 16);
      var maxX = window.innerWidth - w - 8;
      var maxY = window.innerHeight - h - 8;
      state.pos = {
        x: Math.min(Math.max(8, dragStart.startPosX + dx), maxX),
        y: Math.min(Math.max(8, dragStart.startPosY + dy), maxY)
      };
      update();
    }

    function endDrag(ev) {
      dragStart = null;
      try {
        ev.target.releasePointerCapture(ev.pointerId);
      } catch (e) {}
    }

    function beginResize(dir) {
      return function (ev) {
        ev.stopPropagation();
        try {
          ev.target.setPointerCapture(ev.pointerId);
        } catch (e) {}
        resizeDir = dir;
        var p = getPos();
        resizeStart = {
          startX: ev.clientX,
          startY: ev.clientY,
          startW: state.size.width,
          startH: state.size.height
        };
        dragStart = { startX: ev.clientX, startY: ev.clientY, startPosX: p.x, startPosY: p.y };
      };
    }

    function moveResize(ev) {
      if (!resizeStart || !dragStart) return;
      var dir = resizeDir;
      var dx = ev.clientX - resizeStart.startX;
      var dy = ev.clientY - resizeStart.startY;

      var w = resizeStart.startW;
      var h = resizeStart.startH;
      var x = dragStart.startPosX;
      var y = dragStart.startPosY;

      if (dir.indexOf("e") >= 0) w = Math.min(MAX_W, Math.max(MIN_W, resizeStart.startW + dx));
      if (dir.indexOf("s") >= 0) h = Math.min(MAX_H, Math.max(MIN_H, resizeStart.startH + dy));
      if (dir.indexOf("w") >= 0) {
        w = Math.min(MAX_W, Math.max(MIN_W, resizeStart.startW - dx));
        x = dragStart.startPosX + (resizeStart.startW - w);
      }
      if (dir.indexOf("n") >= 0) {
        h = Math.min(MAX_H, Math.max(MIN_H, resizeStart.startH - dy));
        y = dragStart.startPosY + (resizeStart.startH - h);
      }

      state.size = { width: w, height: h };
      state.pos = {
        x: Math.min(Math.max(8, x), window.innerWidth - w - 8),
        y: Math.min(Math.max(8, y), window.innerHeight - h - 8)
      };
      update();
    }

    function endResize(ev) {
      resizeStart = null;
      dragStart = null;
      try {
        ev.target.releasePointerCapture(ev.pointerId);
      } catch (e) {}
    }

    /* ====================================================================
       Audio / speech control
       ==================================================================== */

    function ensureAudio() {
      if (!audio) {
        audio = new Audio();
        audio.addEventListener("play", function () {
          state.speaking = true;
          update();
        });
        audio.addEventListener("ended", function () {
          state.speaking = false;
          update();
        });
        audio.addEventListener("pause", function () {
          state.speaking = false;
          update();
        });
      }
      return audio;
    }

    function stopSpeaking() {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      if (speechController) speechController.abort();
      state.speaking = false;
      update();
    }

    /** Speaks one or more strings through the TTS queue. */
    function speak(texts) {
      if (state.voiceMuted || !audio) return;
      if (speechController) speechController.abort();
      speechController = new AbortController();
      var queue = createSpeechQueue(audio, speechController.signal);
      var list = Array.isArray(texts) ? texts : [texts];
      list.forEach(function (t) {
        var trimmed = t.trim();
        if (trimmed) queue.push(trimmed + (/[.!?]$/.test(trimmed) ? " " : ". "));
      });
      queue.flush();
    }

    /* ====================================================================
       Messaging
       ==================================================================== */

    var NEXT_MARKER = "[NEXT]";

    async function sendMessage(rawText, opts) {
      var text = rawText.trim();
      if (!text) return;

      var voice = !!(opts && opts.voice);

      stopSpeaking();
      if (chatController) chatController.abort();
      chatController = new AbortController();
      var controller = chatController;

      var wasInterrupted = pendingInterrupt && voice;
      pendingInterrupt = false;

      var foundEmail = extractEmail(text);
      var email = foundEmail || state.email || null;
      if (foundEmail) {
        saveStoredEmail(foundEmail);
        state.email = foundEmail;
      }

      var userMsg = { role: "user", content: text, ts: Date.now(), voice: voice };
      var assistantMsg = { role: "assistant", content: "", ts: Date.now(), voice: voice };

      var history = state.messages.slice();
      state.messages.push(userMsg, assistantMsg);
      state.thinking = true;
      update();

      try {
        var fullText = "";
        var spokenText = "";
        var carry = "";
        var startedNextSection = false;

        speechController = new AbortController();

        var onChunkSpoken = function (chunk) {
          spokenText += chunk;
          var last = state.messages[state.messages.length - 1];
          if (last) last.content = spokenText;
          update();
        };

        var queue =
          voice && !state.voiceMuted && audio
            ? createSpeechQueue(audio, speechController.signal, onChunkSpoken)
            : null;

        var emit = function (piece) {
          if (!piece) return;
          if (queue) {
            queue.push(piece);
          } else {
            var last = state.messages[state.messages.length - 1];
            if (last) last.content = (last.content || "") + piece;
            update();
          }
        };

        var beginNextSection = function () {
          startedNextSection = true;
          spokenText = "";
          state.messages.push({ role: "assistant", content: "", ts: Date.now(), voice: voice });
          update();
        };

        /* Splits the stream on the [NEXT] marker, buffering partial markers. */
        var route = function (piece) {
          if (!piece) return;
          if (startedNextSection) {
            emit(piece);
            return;
          }
          var buf = carry + piece;
          carry = "";
          var idx = buf.indexOf(NEXT_MARKER);
          if (idx >= 0) {
            var before = buf.slice(0, idx);
            var after = buf.slice(idx + NEXT_MARKER.length);
            if (before) emit(before);
            beginNextSection();
            if (after) emit(after);
            return;
          }
          var keep = NEXT_MARKER.length - 1;
          if (buf.length > keep) {
            var safe = buf.slice(0, buf.length - keep);
            carry = buf.slice(buf.length - keep);
            emit(safe);
          } else {
            carry = buf;
          }
        };

        var outgoing = wasInterrupted
          ? history.concat(
              [{ role: "assistant", content: INTERRUPTION_PROMPT, ts: Date.now() }],
              [userMsg]
            )
          : history.concat([userMsg]);

        await streamChat(
          outgoing,
          function (delta) {
            fullText += delta;
            route(delta);
          },
          async function () {
            state.thinking = false;
            update();
            if (carry) {
              var tail = carry;
              carry = "";
              emit(tail);
            }
            try {
              if (queue) await queue.flush();
            } catch (e) {}
          },
          controller.signal,
          { voice: voice, email: email }
        );
      } catch (err) {
        state.thinking = false;
        console.error(err);
        var last = state.messages[state.messages.length - 1];
        if (last) last.content = "Sorry — I hit a snag reaching the assistant. Please try again.";
        update();
      }
    }

    /* ====================================================================
       Capture handling
       ==================================================================== */

    function warnAboutNoise() {
      var tracker = noiseTracker;
      tracker.consecutive++;
      var now = Date.now();
      if (tracker.consecutive < 2 || now - tracker.lastWarnAt < 10000) return;
      tracker.lastWarnAt = now;
      var message = NOISE_WARNINGS[tracker.variantIdx % NOISE_WARNINGS.length];
      tracker.variantIdx = (tracker.variantIdx + 1) % NOISE_WARNINGS.length;
      state.messages.push({ role: "assistant", content: message, ts: Date.now(), voice: true });
      update();
      speak(message);
    }

    function onCaptureRejected() {
      warnAboutNoise();
    }

    async function onCapture(blob, stats) {
      if (stats.speechMs < 300 || stats.snr < 2.2) {
        console.warn(
          "[capture] REJECT pre-STT reason=low-quality speechMs=" +
            Math.round(stats.speechMs) +
            " snr=" +
            stats.snr.toFixed(2)
        );
        warnAboutNoise();
        return;
      }

      try {
        var result = await transcribe(blob);
        var text = result.text;
        var words = (text.match(/\S+/g) || []).length;
        var hallucinated = isHallucination(text);
        var lengthMismatch = stats.capturedMs > 3000 && words <= 1;

        if (!text || hallucinated || lengthMismatch) {
          console.warn(
            "[stt] REJECT post-STT reason=" +
              (hallucinated ? "hallucination" : lengthMismatch ? "length-mismatch" : "empty") +
              " text=" +
              JSON.stringify(text).slice(0, 120) +
              " words=" +
              words +
              " audioMs=" +
              Math.round(stats.capturedMs)
          );
          warnAboutNoise();
          return;
        }

        noiseTracker.consecutive = 0;
        sendMessage(text, { voice: true });
      } catch (err) {
        console.error("stt error", err);
        connection.markFailure();
      }
    }

    /* ====================================================================
       Open / close / teardown
       ==================================================================== */

    function toggleMic() {
      state.micMuted = !state.micMuted;
      if (state.micMuted && recorder.isListening()) recorder.stop();
      update();
    }

    function closeWidget() {
      state.open = false;
      state.mode = "expanded";
      update();
    }

    function hardStop() {
      try {
        if (chatController) chatController.abort();
      } catch (e) {}
      try {
        if (speechController) speechController.abort();
      } catch (e) {}
      try {
        recorder.stop();
      } catch (e) {}
      if (audio) {
        try {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        } catch (e) {}
      }
      state.speaking = false;
      state.thinking = false;
      state.micMuted = true;
      update();
    }

    /* ====================================================================
       Effects
       ==================================================================== */

    /* -- "Just a moment…" hint after 1.8s of thinking ------------------ */
    var slowHintEffect = createEffect(function () {
      if (!state.thinking) {
        if (state.slowHint) {
          state.slowHint = false;
          update();
        }
        return null;
      }
      slowHintTimer = window.setTimeout(function () {
        state.slowHint = true;
        update();
      }, 1800);
      return function () {
        window.clearTimeout(slowHintTimer);
      };
    });

    /* -- connection monitor is only active while open ------------------ */
    var connectionEffect = createEffect(function () {
      if (!state.open) {
        connection.disable();
        return null;
      }
      connection.enable();
      return function () {
        connection.disable();
      };
    });

    /* -- greeting + welcome audio -------------------------------------- */
    var welcomeEffect = createEffect(function () {
      if (!state.open) {
        greeted = false;
        return null;
      }
      if (greeted) return null;

      greeted = true;
      state.messages.push(
        { role: "assistant", content: WELCOME_TEXT, ts: Date.now(), voice: true },
        { role: "assistant", content: OPENING_TEXT, ts: Date.now() + 1, voice: true }
      );
      update();

      if (state.voiceMuted || !audio) return null;

      var player = audio;
      if (speechController) speechController.abort();
      var controller = new AbortController();
      speechController = controller;
      var t0 = performance.now();

      function playClip(src) {
        return new Promise(function (resolve, reject) {
          if (controller.signal.aborted) return reject(new Error("aborted"));
          function detach() {
            player.removeEventListener("ended", onEnded);
            player.removeEventListener("error", onError);
            controller.signal.removeEventListener("abort", onAbort);
          }
          function onEnded() {
            detach();
            resolve();
          }
          function onError() {
            detach();
            reject(new Error("static audio error"));
          }
          function onAbort() {
            detach();
            try {
              player.pause();
            } catch (e) {}
            reject(new Error("aborted"));
          }
          player.addEventListener("ended", onEnded);
          player.addEventListener("error", onError);
          controller.signal.addEventListener("abort", onAbort);
          player.src = src;
          player.playbackRate = 1;
          player.play().catch(onError);
        });
      }

      (async function () {
        try {
          await playClip("/voice/welcome.mp3");
          console.log(
            "[welcome] static welcome played (t=" + Math.round(performance.now() - t0) + "ms)"
          );
          if (controller.signal.aborted) return;
          await playClip("/voice/opening.mp3");
        } catch (err) {
          if (controller.signal.aborted) return;
          console.warn("[welcome] static playback failed, falling back to live TTS", err);
          speak([WELCOME_TEXT, OPENING_TEXT]);
        }
      })();

      return null;
    });

    /* -- barge-in: listen for the user talking over the assistant ------ */
    var BARGE_CALIBRATE_MS = 400;
    var BARGE_MIN_DURATION_MS = 220;
    var BARGE_MIN_SNR = 2.6;
    var BARGE_MIN_THRESHOLD = 0.02;
    var BARGE_MAX_THRESHOLD = 0.09;
    var BARGE_NOISE_MULTIPLIER = 2.4;

    var bargeInEffect = createEffect(function () {
      if (
        !state.open ||
        (!state.speaking && !state.thinking) ||
        recorder.isListening() ||
        state.micMuted
      )
        return null;

      var stopped = false;
      var stream = null;
      var ctx = null;
      var rafId = 0;
      var loudSince = null;

      var noiseFloor = 0.01;
      var calibrateStart = null;
      var calibrateSum = 0;
      var calibrateFrames = 0;
      var calibrated = false;
      var peak = 0;
      var rmsSum = 0;
      var rmsFrames = 0;

      (async function () {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          if (stopped) {
            stream.getTracks().forEach(function (t) {
              t.stop();
            });
            return;
          }

          ctx = new AudioContext();
          var source = ctx.createMediaStreamSource(stream);
          var analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          var data = new Uint8Array(analyser.frequencyBinCount);

          var tick = function () {
            if (stopped) return;
            analyser.getByteTimeDomainData(data);

            var sumSq = 0;
            var framePeak = 0;
            for (var i = 0; i < data.length; i++) {
              var v = (data[i] - 128) / 128;
              sumSq += v * v;
              var a = Math.abs(v);
              if (a > framePeak) framePeak = a;
            }
            var rms = Math.sqrt(sumSq / data.length);
            var now = performance.now();

            if (calibrateStart === null) calibrateStart = now;

            if (!calibrated) {
              calibrateSum += rms;
              calibrateFrames++;
              if (now - calibrateStart >= BARGE_CALIBRATE_MS) {
                noiseFloor = Math.max(0.005, calibrateSum / Math.max(1, calibrateFrames));
                calibrated = true;
              }
              rafId = requestAnimationFrame(tick);
              return;
            }

            var threshold = Math.min(
              BARGE_MAX_THRESHOLD,
              Math.max(BARGE_MIN_THRESHOLD, noiseFloor * BARGE_NOISE_MULTIPLIER)
            );

            if (rms >= threshold) {
              if (loudSince === null) {
                loudSince = now;
                peak = 0;
                rmsSum = 0;
                rmsFrames = 0;
              }
              if (framePeak > peak) peak = framePeak;
              rmsSum += rms;
              rmsFrames++;

              var duration = now - loudSince;
              if (duration >= BARGE_MIN_DURATION_MS) {
                var snr = rmsSum / Math.max(1, rmsFrames) / Math.max(noiseFloor, 0.005);
                if (snr >= BARGE_MIN_SNR) {
                  console.log(
                    "[barge-in] TRIGGER state=" +
                      (state.speaking ? "speaking" : "thinking") +
                      " snr=" +
                      snr.toFixed(2) +
                      " durationMs=" +
                      Math.round(duration) +
                      " peak=" +
                      peak.toFixed(3) +
                      " noiseFloor=" +
                      noiseFloor.toFixed(4) +
                      " threshold=" +
                      threshold.toFixed(4)
                  );
                  stopped = true;
                  stopSpeaking();
                  if (chatController) chatController.abort();
                  state.thinking = false;
                  pendingInterrupt = true;
                  update();
                  queueMicrotask(function () {
                    recorder.start();
                  });
                  return;
                }
                console.log(
                  "[barge-in] SKIP low-snr snr=" +
                    snr.toFixed(2) +
                    " durationMs=" +
                    Math.round(duration) +
                    " noiseFloor=" +
                    noiseFloor.toFixed(4)
                );
                loudSince = null;
              }
            } else {
              loudSince = null;
              noiseFloor = noiseFloor * 0.98 + rms * 0.02;
            }

            rafId = requestAnimationFrame(tick);
          };

          rafId = requestAnimationFrame(tick);
        } catch (err) {
          console.warn("[barge-in] mic unavailable", err);
        }
      })();

      return function () {
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (stream)
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
        if (ctx) ctx.close().catch(function () {});
      };
    });

    /* -- auto-listen: start recording as soon as the user speaks ------- */
    var AUTO_CALIBRATE_MS = 350;
    var AUTO_MIN_DURATION_MS = 80;
    var AUTO_MIN_THRESHOLD = 0.018;
    var AUTO_MAX_THRESHOLD = 0.055;
    var AUTO_NOISE_MULTIPLIER = 2.2;

    var autoListenEffect = createEffect(function () {
      if (
        !state.open ||
        state.speaking ||
        state.thinking ||
        recorder.isListening() ||
        state.micMuted
      )
        return null;

      var stopped = false;
      var stream = null;
      var ctx = null;
      var rafId = 0;
      var loudSince = null;

      var noiseFloor = 0.01;
      var calibrateStart = null;
      var calibrateFrames = 0;
      var calibrateSum = 0;

      (async function () {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          if (stopped) {
            stream.getTracks().forEach(function (t) {
              t.stop();
            });
            return;
          }

          ctx = new AudioContext();
          var source = ctx.createMediaStreamSource(stream);
          var analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          var data = new Uint8Array(analyser.frequencyBinCount);

          var tick = function () {
            if (stopped) return;
            analyser.getByteTimeDomainData(data);

            var sumSq = 0;
            for (var i = 0; i < data.length; i++) {
              var v = (data[i] - 128) / 128;
              sumSq += v * v;
            }
            var rms = Math.sqrt(sumSq / data.length);
            var now = performance.now();

            if (calibrateStart === null) calibrateStart = now;
            if (now - calibrateStart < AUTO_CALIBRATE_MS) {
              calibrateSum += rms;
              calibrateFrames++;
              rafId = requestAnimationFrame(tick);
              return;
            }
            if (calibrateFrames > 0) {
              noiseFloor = Math.max(0.005, calibrateSum / calibrateFrames);
              calibrateFrames = 0;
            }

            var threshold = Math.min(
              AUTO_MAX_THRESHOLD,
              Math.max(AUTO_MIN_THRESHOLD, noiseFloor * AUTO_NOISE_MULTIPLIER)
            );

            if (rms >= threshold) {
              if (loudSince === null) loudSince = now;
              if (now - loudSince >= AUTO_MIN_DURATION_MS) {
                stopped = true;
                if (stream)
                  stream.getTracks().forEach(function (t) {
                    t.stop();
                  });
                if (ctx) ctx.close().catch(function () {});
                queueMicrotask(function () {
                  recorder.start();
                });
                return;
              }
            } else {
              loudSince = null;
              if (rms < threshold * 0.8) noiseFloor = noiseFloor * 0.98 + rms * 0.02;
            }

            rafId = requestAnimationFrame(tick);
          };

          rafId = requestAnimationFrame(tick);
        } catch (err) {
          console.warn("[auto-listen] mic unavailable", err);
        }
      })();

      return function () {
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (stream)
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
        if (ctx) ctx.close().catch(function () {});
      };
    });

    /* -- Escape closes the widget --------------------------------------- */
    var escapeEffect = createEffect(function () {
      if (!state.open) return null;
      function onKeyDown(ev) {
        if (ev.key === "Escape") closeWidget();
      }
      window.addEventListener("keydown", onKeyDown);
      return function () {
        window.removeEventListener("keydown", onKeyDown);
      };
    });

    /* -- tear everything down when closed -------------------------------- */
    var closeEffect = createEffect(function () {
      if (!state.open) hardStop();
      return null;
    });

    /* -- animated placeholder ("typewriter") ----------------------------- */
    var placeholderEffect = createEffect(function () {
      if (typewriterTimer) clearTimeout(typewriterTimer);
      typewriterCancelled = true;

      if (state.inputFocused || state.input) {
        state.placeholder = "";
        return null;
      }

      typewriterCancelled = false;
      var cancelled = false;
      var promptIdx = 0;

      function typeIn(text, len) {
        if (cancelled || typewriterCancelled) return;
        if (len <= text.length) {
          state.placeholder = text.slice(0, len);
          renderPlaceholder();
          typewriterTimer = setTimeout(function () {
            typeIn(text, len + 1);
          }, 45);
        } else {
          typewriterTimer = setTimeout(function () {
            typeOut(text, text.length);
          }, 1400);
        }
      }

      function typeOut(text, len) {
        if (cancelled || typewriterCancelled) return;
        if (len >= 0) {
          state.placeholder = text.slice(0, len);
          renderPlaceholder();
          typewriterTimer = setTimeout(function () {
            typeOut(text, len - 1);
          }, 25);
        } else {
          promptIdx = (promptIdx + 1) % PROMPTS.length;
          typewriterTimer = setTimeout(function () {
            typeIn(PROMPTS[promptIdx], 0);
          }, 250);
        }
      }

      typeIn(PROMPTS[promptIdx], 0);

      return function () {
        cancelled = true;
        if (typewriterTimer) clearTimeout(typewriterTimer);
      };
    });

    /* -- clear the docked position when going back to expanded ---------- */
    var modeEffect = createEffect(function () {
      if (state.mode === "expanded") state.pos = null;
      return null;
    });

    function runEffects() {
      modeEffect(state.mode);
      slowHintEffect(String(state.thinking));
      connectionEffect(String(state.open));
      welcomeEffect(String(state.open));
      escapeEffect(String(state.open));
      closeEffect(String(state.open));
      placeholderEffect(String(state.inputFocused) + "|" + (state.input ? "1" : "0"));
      bargeInEffect(
        [
          state.open,
          state.speaking,
          state.thinking,
          recorder.isListening(),
          state.micMuted
        ].join("|")
      );
      autoListenEffect(
        [
          state.open,
          state.speaking,
          state.thinking,
          recorder.isListening(),
          state.micMuted
        ].join("|")
      );
    }

    /* ====================================================================
       Rendering
       ==================================================================== */

    var renderedMessages = [];
    var lastConnKey = "";

    /** Swaps a small 14px icon into a button only when it actually changes. */
    function setSmallIcon(button, name) {
      if (button._iconName === name) return;
      button._iconName = name;
      button.innerHTML = iconMarkup(name, "", 2);
      var svg = button.querySelector("svg");
      svg.style.width = "0.875rem";
      svg.style.height = "0.875rem";
    }

    function renderPlaceholder() {
      if (!dom.input) return;
      var text = state.input || state.inputFocused ? "Type or tap the mic\u2026" : state.placeholder;
      if (dom.input.placeholder !== text) dom.input.placeholder = text;
    }

    function renderConnection() {
      var status = state.connStatus;
      var attempt = state.connAttempt;

      var variants = {
        idle: { label: "Idle", icon: "wifi" },
        checking: { label: "Connecting", icon: "loader-circle", spin: true, pulse: true },
        connected: { label: "Voice live", icon: "wifi" },
        reconnecting: {
          label: "Reconnecting" + (attempt > 1 ? " (#" + attempt + ")" : "\u2026"),
          icon: "loader-circle",
          spin: true,
          pulse: true
        },
        offline: { label: "Offline", icon: "wifi-off" },
        denied: { label: "Mic blocked", icon: "mic-off" },
        unavailable: { label: "Voice unavailable", icon: "triangle-alert" }
      };

      var v = variants[status] || variants.idle;
      var key = status + "|" + v.label;
      if (key === lastConnKey) return;
      lastConnKey = key;

      var showRetry = status === "offline" || status === "unavailable" || status === "denied";

      dom.conn.className = "agx-conn agx-conn-" + status;
      dom.conn.setAttribute("title", "Voice: " + v.label);
      dom.conn.innerHTML =
        '<span class="agx-conn-dotwrap">' +
        '<span class="agx-conn-dot"></span>' +
        (v.pulse ? '<span class="agx-conn-ping agx-anim-ping"></span>' : "") +
        "</span>" +
        iconMarkup(v.icon, "agx-conn-icon" + (v.spin ? " agx-anim-spin" : ""), 2) +
        "<span>" +
        v.label +
        "</span>" +
        (showRetry
          ? '<button class="agx-conn-retry" aria-label="Retry voice connection">' +
            iconMarkup("refresh-cw", "agx-conn-icon", 2) +
            "</button>"
          : "");

      var retryBtn = dom.conn.querySelector(".agx-conn-retry");
      if (retryBtn) retryBtn.addEventListener("click", function () {
        connection.retryNow();
      });
    }

    function renderMessages() {
      var msgs = state.messages;

      toggleClass(dom.empty, "agx-hidden", msgs.length !== 0);

      /* rebuild if the list shrank */
      if (renderedMessages.length > msgs.length) {
        renderedMessages.forEach(function (r) {
          r.node.remove();
        });
        renderedMessages = [];
      }

      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        var rec = renderedMessages[i];

        if (!rec) {
          var node = el("div", "agx-msg agx-msg-" + m.role);
          var bubble = el("div", "agx-bubble");
          if (m.role === "assistant") {
            var prose = el("div", "agx-prose");
            bubble.appendChild(prose);
          }
          var time = el("div", "agx-time");
          time.textContent = new Date(m.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          });
          node.appendChild(bubble);
          node.appendChild(time);
          dom.messages.insertBefore(node, dom.typing);
          rec = { node: node, bubble: bubble, prose: bubble.querySelector(".agx-prose"), content: null };
          renderedMessages[i] = rec;
        }

        if (rec.content !== m.content) {
          rec.content = m.content;
          if (m.role === "assistant") {
            rec.prose.innerHTML = Markdown.render(m.content || "\u2026");
          } else {
            rec.bubble.textContent = m.content;
          }
        }
      }
    }

    function render() {
      var expanded = state.mode === "expanded";
      var open = state.open;
      var listening = recorder.isListening();
      var level = recorder.getLevel();
      var orbState = state.speaking ? "speaking" : listening ? "listening" : "idle";

      /* launcher */
      dom.launcher.hidden = open;

      /* overlay + backdrop */
      toggleClass(dom.overlay, "agx-open", open);
      toggleClass(dom.backdrop, "agx-visible", open && expanded);
      setBodyScrollLock(open && expanded);

      /* panel layout */
      toggleClass(dom.panel, "agx-expanded", expanded);
      toggleClass(dom.panel, "agx-docked", !expanded);
      toggleClass(dom.panel, "agx-stacked", expanded && state.isMobile);

      if (expanded) {
        dom.panel.removeAttribute("style");
      } else {
        var w = Math.min(state.size.width, window.innerWidth - 16);
        var h = Math.min(state.size.height, window.innerHeight - 16);
        var left = "auto";
        var top = "auto";
        if (state.pos) {
          left = Math.min(Math.max(8, state.pos.x), window.innerWidth - w - 8) + "px";
          top = Math.min(Math.max(8, state.pos.y), window.innerHeight - h - 8) + "px";
        }
        dom.panel.style.position = "absolute";
        dom.panel.style.left = left;
        dom.panel.style.top = top;
        dom.panel.style.right = state.pos ? "auto" : "24px";
        dom.panel.style.bottom = state.pos ? "auto" : "24px";
        dom.panel.style.width = w + "px";
        dom.panel.style.height = h + "px";
        dom.panel.style.touchAction = "none";
      }

      /* brand */
      var brandHtml = expanded ? "Powered by <b>Agilisium</b>" : "<b>Agilisium</b>";
      if (dom.brandText.innerHTML !== brandHtml) dom.brandText.innerHTML = brandHtml;

      /* docked-only window controls & resize handles */
      toggleClass(dom.winControls, "agx-hidden", expanded);
      dom.handles.forEach(function (handle) {
        toggleClass(handle, "agx-hidden", expanded);
      });

      /* expanded-only header pieces */
      toggleClass(dom.titleWrap, "agx-hidden", !expanded);
      toggleClass(dom.conn, "agx-hidden", !expanded);
      toggleClass(dom.shrinkBtn, "agx-hidden", !expanded);
      toggleClass(dom.closeBtn, "agx-hidden", !expanded);

      /* stage sizing when docked */
      if (expanded) {
        dom.stage.style.flexBasis = "";
      } else {
        dom.stage.style.flexBasis = Math.min(220, state.size.height * 0.42) + "px";
      }

      /* orb */
      var scale = expanded ? 1 : Math.min(1, Math.max(0.5, state.size.height / 520));
      var glowSize = expanded ? 320 : Math.round(160 * scale);
      var coreSize = expanded ? 200 : Math.round(100 * scale);
      var iconSize = expanded ? 64 : Math.round(32 * scale);

      dom.orbGlow.style.width = glowSize + "px";
      dom.orbGlow.style.height = glowSize + "px";
      dom.orbGlow.className =
        "agx-orb-glow" +
        (orbState === "speaking"
          ? " agx-anim-glow"
          : orbState === "listening"
          ? " agx-anim-wave"
          : " agx-anim-breathe");

      var showRings = orbState === "listening" && expanded;
      dom.orbRings.forEach(function (ring, idx) {
        toggleClass(ring, "agx-hidden", !showRings);
        if (showRings) {
          var size = 240 + idx * 60 + level * 80;
          ring.style.width = size + "px";
          ring.style.height = size + "px";
          ring.style.opacity = String(0.6 - idx * 0.15);
        }
      });

      dom.orbCore.style.width = coreSize + "px";
      dom.orbCore.style.height = coreSize + "px";
      dom.orbCore.style.boxShadow =
        "0 0 " + (40 + level * 120) + "px rgba(20,184,166," + (0.4 + level * 0.5) + ")";
      toggleClass(dom.orbCore, "agx-anim-pulse", orbState === "speaking");
      dom.orbIcon.style.width = iconSize + "px";
      dom.orbIcon.style.height = iconSize + "px";

      /* status text */
      setText(
        dom.statusTitle,
        state.speaking
          ? "Speaking\u2026"
          : listening
          ? "Listening\u2026"
          : state.thinking
          ? "Thinking\u2026"
          : "Ready"
      );
      setText(
        dom.statusSub,
        listening
          ? "I'll respond when you pause"
          : state.micMuted
          ? "Tap the mic to begin"
          : ""
      );

      /* mic + voice buttons */
      setSmallIcon(dom.micBtn, state.micMuted ? "mic-off" : "mic");
      dom.micBtn.setAttribute(
        "aria-label",
        state.micMuted ? "Unmute microphone" : "Mute microphone"
      );

      setSmallIcon(dom.voiceBtn, state.voiceMuted ? "volume-x" : "volume2");
      dom.voiceBtn.setAttribute("aria-label", state.voiceMuted ? "Unmute voice" : "Mute voice");

      /* connection pill */
      renderConnection();

      /* messages */
      renderMessages();

      /* typing indicator */
      toggleClass(dom.typing, "agx-hidden", !state.thinking);
      toggleClass(dom.typingNote, "agx-hidden", !state.slowHint);

      /* composer */
      renderPlaceholder();
      dom.send.disabled = !state.input.trim();
    }

    /* -- auto-scroll on new content ------------------------------------- */
    var lastScrollKey = "";
    function autoScroll() {
      var key = state.messages.length + "|" + state.thinking;
      if (key === lastScrollKey) return;
      lastScrollKey = key;
      if (dom.messages) {
        dom.messages.scrollTo({ top: dom.messages.scrollHeight, behavior: "smooth" });
      }
    }

    /**
     * Measures the host page's fixed/sticky header so the expanded panel can
     * sit below it instead of overlapping. Looks for a pinned, full-width bar
     * at the top of the viewport; returns 0 when the page has no such header.
     */
    function measureHostHeader() {
      var bottom = 0;
      try {
        var candidates = document.body.querySelectorAll(
          "header, nav, [role='banner'], [class*='navbar'], [class*='nav-bar']," +
            " [class*='header'], [data-agx-navbar]"
        );
        for (var i = 0; i < candidates.length; i++) {
          var node = candidates[i];
          if (root.contains(node)) continue; // never measure ourselves

          var cs = window.getComputedStyle(node);
          if (cs.position !== "fixed" && cs.position !== "sticky") continue;
          if (cs.display === "none" || cs.visibility === "hidden") continue;

          var rect = node.getBoundingClientRect();
          if (rect.top > 4) continue;                              // not pinned to the top
          if (rect.height < 24 || rect.height > NAVBAR_MAX_HEIGHT) continue;
          if (rect.width < window.innerWidth * 0.6) continue;      // not a full-width bar

          if (rect.bottom > bottom) bottom = rect.bottom;
        }
      } catch (e) {}
      return bottom;
    }

    /** Applies the measured header height to --agx-top-offset. */
    function syncTopOffset() {
      var headerBottom = measureHostHeader();
      if (headerBottom > 0) {
        root.style.setProperty(
          "--agx-top-offset",
          Math.round(headerBottom + NAVBAR_CLEARANCE) + "px"
        );
      } else {
        root.style.removeProperty("--agx-top-offset"); // fall back to the CSS default
      }
    }

    /**
     * Last-resort guard for the launcher pill. It should always be dark with
     * white text. If the stylesheet is missing, loaded late, or beaten by an
     * !important rule on the host page, the pill can end up transparent (reads
     * as white on a light page) or forced light — either way the white label
     * becomes invisible. Detect that and repaint it inline with !important.
     */
    function enforceLauncherBackground() {
      if (!dom.launcher) return;
      try {
        var bg = window.getComputedStyle(dom.launcher).backgroundColor;
        var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/.exec(
          bg || ""
        );

        var needsFix;
        if (!m) {
          /* no parseable colour at all (transparent, empty, or a keyword) */
          needsFix = !bg || bg === "transparent";
        } else {
          var r = +m[1], g = +m[2], b = +m[3];
          var alpha = m[4] === undefined ? 1 : +m[4];
          /* perceived brightness, 0 (black) .. 255 (white) */
          var luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          needsFix = alpha < 0.5 || luminance > 140;
        }

        if (needsFix) {
          dom.launcher.style.setProperty("background", LAUNCHER_FALLBACK_BG, "important");
          dom.launcher.style.setProperty("color", "#fff", "important");
        }
      } catch (e) {}
    }

    /* ====================================================================
       Global listeners
       ==================================================================== */

    function attachGlobals() {
      var mq = window.matchMedia("(max-width: " + (MOBILE_BREAKPOINT - 1) + "px)");
      var onMediaChange = function () {
        state.isMobile = window.innerWidth < MOBILE_BREAKPOINT;
        update();
      };
      mq.addEventListener("change", onMediaChange);

      var onResize = function () {
        if (state.open && state.mode === "expanded") syncTopOffset();
      };
      window.addEventListener("resize", onResize);

      var onVisibility = function () {
        if (document.hidden) hardStop();
      };
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("pagehide", hardStop);
    }

    /* ====================================================================
       Boot
       ==================================================================== */

    buildDom();
    enforceLauncherBackground();
    syncTopOffset();
    ensureAudio();
    attachGlobals();

    /* re-check once stylesheets have settled */
    requestAnimationFrame(enforceLauncherBackground);
    window.addEventListener("load", enforceLauncherBackground);

    /* keep the scroll pinned after every render */
    var baseRender = render;
    render = function () {
      baseRender();
      autoScroll();
    };

    render();
    runEffects();

    return {
      destroy: function () {
        hardStop();
        setBodyScrollLock(false);
      }
    };
  }

  /* ======================================================================
     11. Mount
     ====================================================================== */

  function mount() {
    var root = document.getElementById(CONTAINER_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = CONTAINER_ID;
      document.body.appendChild(root);
    }
    root.classList.add("agx-root");
    createWidget(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();