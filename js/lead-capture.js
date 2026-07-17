// Lead capture — mirrors every form submission into Firestore before the
// native Formspree POST goes out. Never blocks the visitor: the Firestore
// write races a 3s timeout and the form submits either way.
(function () {
  "use strict";

  if (typeof firebase === "undefined") return;

  firebase.initializeApp({
    apiKey: "AIzaSyAgPCps_tJ5tUtCD5GPfDknCpsISym2HoA",
    projectId: "my-nimni",
    appId: "1:728066755188:web:f3800f0883f57779791f21",
  });
  var db = firebase.firestore();

  function fieldValue(form, name) {
    var el = form.elements[name];
    return el && el.value ? el.value.trim() : "";
  }

  document.querySelectorAll("form.form-ui").forEach(function (form) {
    if (form.dataset.leadCapture) return;
    form.dataset.leadCapture = "1";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var notes = fieldValue(form, "message");
      var items = fieldValue(form, "itemsList");
      if (items) notes = (notes ? notes + "\n" : "") + "רשימת פריטים: " + items;

      var lead = {
        name: fieldValue(form, "name"),
        phone: fieldValue(form, "phone"),
        email: fieldValue(form, "email"),
        source: "website1",
        status: "new",
        serviceTypes: [],
        notes: notes,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      var finish = function () {
        form.submit();
      };
      Promise.race([
        db.collection("leads").add(lead),
        new Promise(function (resolve) {
          setTimeout(resolve, 3000);
        }),
      ]).then(finish, finish);
    });
  });
})();
