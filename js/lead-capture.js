// Lead capture — the main pipeline: uploads media to Firebase Storage,
// then sends one JSON POST to the newLead endpoint. Submit is always
// intercepted (preventDefault); a parallel fire-and-forget copy also
// goes to Formspree via fetch (fields only, no file upload).
(function () {
  "use strict";

  var API =
    "https://europe-west1-my-nimni.cloudfunctions.net/newLead?key=nimni2026lead";
  var BIZ_PHONE = "0542-426-661";
  // הוואטסאפ העסקי - אותו מספר של כפתורי הוואטסאפ באתר
  var BIZ_WA = "972542426661";
  var MAX_FILE = 300 * 1024 * 1024; // עד 300MB - כמו טופס הסקר

  // המשך בוואטסאפ (26.09.2026): אחרי שהטופס נקלט, הלקוח עובר
  // לוואטסאפ של נימני עם ההודעה כבר כתובה. ברגע שהוא לוחץ "שלח"
  // שם, המערכת מקבלת את הוואטסאפ שלו ויכולה לענות לו אוטומטית -
  // מטופס לבד אי אפשר לפתוח שיחת וואטסאפ. השורה הראשונה היא
  // הסימון שהשרת מזהה ("פנייה מהאתר").
  function whatsappUrl(payload) {
    var lines = ["🌐 פנייה מהאתר"];
    if (payload.name) lines.push("שם: " + payload.name);
    if (payload.phone) lines.push("טלפון: " + payload.phone);
    if (payload.message) lines.push(payload.message);
    if (payload.itemsList) lines.push("רשימת פריטים: " + payload.itemsList);
    return (
      "https://wa.me/" + BIZ_WA + "?text=" +
      encodeURIComponent(lines.join("\n")));
  }

  // כפתור "המשך בוואטסאפ" ליד הודעת התודה - למקרה שהמעבר האוטומטי
  // נחסם או שהלקוח חזר לדף
  function showWhatsappButton(form, url) {
    var old = form.querySelector(".wa-continue");
    if (old) old.remove();
    var a = document.createElement("a");
    a.className = "btn btn-custom wa-continue";
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.style.marginTop = "10px";
    a.style.display = "inline-block";
    a.textContent = "המשך בוואטסאפ";
    form.appendChild(a);
  }

  // סימון האתר על כפתורי הוואטסאפ (26.09.2026): כל קישור וואטסאפ
  // באתר (כפתור צף, כותרת, פוטר) מקבל שורה ראשונה "🌐 פנייה מהאתר"
  // מעל הטקסט הקיים, כדי שהמערכת תדע שהלקוח הגיע מהאתר גם כשלא
  // מילא טופס. הטקסט שהלקוח רואה נשאר, רק עם השורה הזאת מעליו.
  var SITE_MARKER = "🌐 פנייה מהאתר";
  var DEFAULT_WA_TEXT = "היי😀 אשמח לברר לגבי הובלה";
  function markWhatsappLinks() {
    var links = document.querySelectorAll(
      'a[href*="api.whatsapp.com/send"], a[href*="wa.me/"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href") || "";
      var m = /[?&]text=([^&#]*)/.exec(href);
      var text = "";
      if (m) {
        try {
          text = decodeURIComponent(m[1].replace(/\+/g, " "));
        } catch (err) {
          text = "";
        }
      }
      if (text.indexOf(SITE_MARKER) === 0) continue;
      var marked = SITE_MARKER + "\n" + (text || DEFAULT_WA_TEXT);
      var base = href.replace(/[?&]text=[^&#]*/, "");
      if (base.indexOf("?") === -1) base = base.replace("&", "?");
      var sep = base.indexOf("?") === -1 ? "?" : "&";
      links[i].setAttribute(
        "href", base + sep + "text=" + encodeURIComponent(marked));
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markWhatsappLinks);
  } else {
    markWhatsappLinks();
  }

  var storage = null;
  if (typeof firebase !== "undefined") {
    firebase.initializeApp({
      apiKey: "AIzaSyAgPCps_tJ5tUtCD5GPfDknCpsISym2HoA",
      projectId: "my-nimni",
      appId: "1:728066755188:web:f3800f0883f57779791f21",
      storageBucket: "my-nimni.firebasestorage.app",
    });
    if (firebase.storage) storage = firebase.storage();
  }

  function fieldValue(form, name) {
    var el = form.elements[name];
    return el && el.value ? el.value.trim() : "";
  }

  function pageId() {
    var p = window.location.pathname.split("/").pop() || "index.html";
    return p.replace(/\.html?$/i, "") || "index";
  }

  function setStatus(form, text) {
    var el = form.querySelector("#successSender");
    if (!el) {
      el = document.createElement("span");
      form.appendChild(el);
    }
    el.textContent = text;
  }

  // אותה קונבנציה כמו העלאת הסקר: leads/{timestamp}_{filename}
  function uploadFile(f) {
    var name =
      "leads/" +
      Date.now() +
      "_" +
      (f.name || "video").replace(/[^\w.\-]/g, "_");
    return storage
      .ref()
      .child(name)
      .put(f)
      .then(function (snap) {
        return snap.ref.getDownloadURL();
      });
  }

  // שליחה מקבילה ל-Formspree, fire-and-forget: כשל או איטיות כאן
  // לא משפיעים על מסלול newLead, על העלאת המדיה או על הודעת ההצלחה.
  // קבצים מצורפים לא נשלחים - רק שם הקובץ כטקסט בשדה file.
  function sendToFormspree(form, fileName) {
    try {
      var fd = new FormData(form);
      fd.delete("file");
      if (fileName) fd.set("file", fileName);
      fetch("https://formspree.io/f/xzblzkye", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
        keepalive: true,
      }).catch(function () {});
    } catch (err) {
      /* מבודד במכוון */
    }
  }

  function send(payload) {
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
    });
  }

  document.querySelectorAll("form.form-ui").forEach(function (form) {
    if (form.dataset.leadCapture) return;
    form.dataset.leadCapture = "1";

    form.addEventListener("submit", function (e) {
      e.preventDefault(); // תמידי - Formspree נשלח ב-fetch מקביל, לא ב-submit רגיל
      var btn = form.querySelector(
        'input[type="submit"], button[type="submit"]');
      if (btn) btn.disabled = true;

      var payload = {
        name: fieldValue(form, "name"),
        phone: fieldValue(form, "phone"),
        email: fieldValue(form, "email"),
        message: fieldValue(form, "message"),
        itemsList: fieldValue(form, "itemsList"),
        source: "website1",
        pageId: pageId(),
      };

      var filesEl = form.elements["file"];
      var files =
        filesEl && filesEl.files
          ? Array.prototype.slice.call(filesEl.files)
          : [];
      files = files.filter(function (f) {
        if (f.size > MAX_FILE) {
          alert("קובץ גדול מדי (עד 300MB): " + f.name);
          return false;
        }
        return true;
      });

      // מסלול מקביל ל-Formspree - לא ממתינים לו ולא תלויים בו
      sendToFormspree(
        form,
        files
          .map(function (f) {
            return f.name;
          })
          .join(", "));

      var uploads = Promise.resolve([]);
      if (files.length && storage) {
        setStatus(form, "מעלה סרטון... נא להמתין");
        uploads = Promise.all(files.map(uploadFile));
      }

      var waUrl = whatsappUrl(payload);
      var done = function () {
        if (btn) btn.disabled = false;
        form.reset();
        setStatus(form,
          "תודה! הפרטים התקבלו — ממשיכים בוואטסאפ, לחצו שם על שלח.");
        showWhatsappButton(form, waUrl);
        // מעבר אוטומטי לוואטסאפ עם ההודעה המוכנה: בסלולר נפתחת
        // האפליקציה, במחשב וואטסאפ ווב
        setTimeout(function () {
          window.location.href = waUrl;
        }, 600);
      };
      var failed = function () {
        if (btn) btn.disabled = false;
        setStatus(
          form,
          "השליחה נכשלה. אפשר להתקשר אלינו: " + BIZ_PHONE);
      };

      uploads
        .then(function (urls) {
          if (urls && urls.length) payload.mediaUrls = urls;
          return send(payload);
        })
        .then(done, function () {
          // ההעלאה או השליחה נכשלו - ניסיון שני בלי המדיה
          delete payload.mediaUrls;
          send(payload).then(done, failed);
        });
    });
  });
})();
