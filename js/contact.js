$(document).ready(function () {
  const pattern = /^\b[A-Z0-9._%-]+@[A-Z0-9.-]+\.[A-Z]{2,4}\b$/i;

  $("#contact").on("submit", function (e) {
    e.preventDefault();
    if (document.getElementById("email").value !== "" || document.getElementById("phone").value !== "") {
      if (!pattern.test(document.getElementById("email").value)) {
        document.getElementById("successSender").innerText = "כתובת אימייל לא תקינה";
        setTimeout(() => {
          document.getElementById("successSender").innerText = "";
        }, 3000);
      } else if (document.getElementById("phone").value.length < 9 || document.getElementById("phone").value.length > 10) {
        document.getElementById("successSender").innerText = "מספר טלפון לא תקין";
        setTimeout(() => {
          document.getElementById("successSender").innerText = "";
        }, 3000);
      } else {
        let formData = new FormData(this);
        let settings = {
          url: "./send.php",
          method: "POST",
          timeout: 0,
          crossOrigin: null,
          data: formData,
        };

        let file_data = $("#files").prop("files")[0];
        let form_data = new FormData();
        form_data.append("files", file_data);
        form_data.append("email", $("#email").val());
        form_data.append("name", $("#name").val());
        form_data.append("message", $("#message").val());
        form_data.append("phone", $("#phone").val());
        form_data.append("itemsList", $("#itemsList").val());

        console.log(form_data);
        $.ajax({
          url: "./send.php",
          dataType: "text",
          cache: false,
          contentType: false,
          processData: false,
          data: form_data,
          type: "post",
          success: function (result) {
            document.getElementById("email").value = "";
            document.getElementById("name").value = "";
            document.getElementById("message").value = "";
            document.getElementById("phone").value = "";
            document.getElementById("files").value = "";
            document.getElementById("itemsList").value = "";
            document.getElementById("successSender").innerText = "הטופס נשלח בהצלחה";
            setTimeout(() => {
              document.getElementById("successSender").innerText = "";
            }, 3000);
          },
        });
      }
    } else {
      document.getElementById("successSender").innerText = "אנא רשום טלפון או אימייל";
      setTimeout(() => {
        document.getElementById("successSender").innerText = "";
      }, 3000);
    }
  });
});
