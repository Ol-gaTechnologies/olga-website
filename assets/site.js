/* Ol-ga — form handling for a static site.
 *
 * ONE THING TO EDIT: put your form endpoint below.
 *   - Google Apps Script  →  "https://script.google.com/macros/s/AKfy.../exec"
 *   - Formspree           →  "https://formspree.io/f/xxxxxxxx"
 * Leave it empty and every form falls back to an email to hello@ol-ga.com,
 * so the site is never broken while you set the backend up.
 */
window.OLGA_FORM_ENDPOINT = window.OLGA_FORM_ENDPOINT || "";

(function () {
  "use strict";

  var CONTACT = "hello@ol-ga.com";
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function serialise(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = typeof value === "string" ? value.trim() : value;
    });
    data.page = location.pathname;
    data.submitted_at = new Date().toISOString();
    return data;
  }

  function mailtoFallback(form, data) {
    var subject = encodeURIComponent(form.dataset.subject || "Ol-ga enquiry");
    var lines = Object.keys(data).map(function (k) { return k + ": " + data[k]; });
    return "mailto:" + CONTACT + "?subject=" + subject + "&body=" + encodeURIComponent(lines.join("\n"));
  }

  function setStatus(box, state, html) {
    if (!box) return;
    box.hidden = false;
    box.dataset.state = state;
    box.innerHTML = html;
  }

  /* ---- validation: our own messages, so they read like the rest of the site ---- */

  function messageFor(input) {
    var name = (input.labels && input.labels[0] ? input.labels[0].textContent : "This field").trim();
    if (input.value.trim() === "") return name + " is needed.";
    if (input.type === "email" && !EMAIL.test(input.value.trim())) return "That does not look like an email address.";
    return "";
  }

  function clearError(input) {
    input.removeAttribute("aria-invalid");
    var id = input.id + "-error";
    var node = document.getElementById(id);
    if (node) node.remove();
    var described = (input.getAttribute("aria-describedby") || "")
      .split(" ").filter(function (t) { return t && t !== id; }).join(" ");
    if (described) input.setAttribute("aria-describedby", described);
    else input.removeAttribute("aria-describedby");
  }

  function showError(input, message) {
    clearError(input);
    var id = input.id + "-error";
    var node = document.createElement("p");
    node.className = "field-error";
    node.id = id;
    node.textContent = message;
    input.insertAdjacentElement("afterend", node);
    input.setAttribute("aria-invalid", "true");
    var described = (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
    described.push(id);
    input.setAttribute("aria-describedby", described.join(" "));
  }

  function validate(form) {
    var first = null;
    form.querySelectorAll("input, textarea, select").forEach(function (input) {
      if (!input.required && !(input.type === "email" && input.value.trim())) {
        clearError(input);
        return;
      }
      var message = messageFor(input);
      if (message) {
        showError(input, message);
        if (!first) first = input;
      } else {
        clearError(input);
      }
    });
    if (first) first.focus();
    return !first;
  }

  function handle(form) {
    form.setAttribute("novalidate", "");
    var box = form.querySelector(".form-status");
    var button = form.querySelector("button[type=submit]");
    var original = button ? button.textContent : "";

    form.querySelectorAll("input, textarea, select").forEach(function (input) {
      input.addEventListener("input", function () {
        if (input.getAttribute("aria-invalid") === "true" && !messageFor(input)) clearError(input);
      });
      input.addEventListener("blur", function () {
        if (input.required || (input.type === "email" && input.value.trim())) {
          var message = messageFor(input);
          if (message && input.value.trim() !== "") showError(input, message);
        }
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (box) box.hidden = true;
      if (!validate(form)) {
        setStatus(box, "info", "Check the fields marked above and send again.");
        return;
      }

      var data = serialise(form);
      var endpoint = window.OLGA_FORM_ENDPOINT;

      if (!endpoint) {
        setStatus(box, "info",
          'Almost there — send this to <a href="' + mailtoFallback(form, data) + '">' + CONTACT +
          "</a> and we will come back to you.");
        return;
      }

      if (button) { button.disabled = true; button.textContent = "Sending…"; }

      // Formspree wants a JSON content type. Google Apps Script must be sent as
      // text/plain, otherwise the browser fires a CORS preflight it cannot answer.
      var isFormspree = endpoint.indexOf("formspree.io") !== -1;
      var headers = isFormspree
        ? { "Content-Type": "application/json", "Accept": "application/json" }
        : { "Content-Type": "text/plain;charset=utf-8" };

      fetch(endpoint, { method: "POST", headers: headers, body: JSON.stringify(data) })
        .then(function (response) {
          if (!response.ok) throw new Error("Request failed: " + response.status);
          form.reset();
          setStatus(box, "ok", form.dataset.success || "You are on the list. We will be in touch before we open access.");
        })
        .catch(function () {
          setStatus(box, "info",
            'That did not go through. Email <a href="' + mailtoFallback(form, data) + '">' + CONTACT +
            "</a> and we will add you by hand.");
        })
        .then(function () {
          if (button) { button.disabled = false; button.textContent = original; }
        });
    });
  }

  document.querySelectorAll("form[data-olga-form]").forEach(handle);

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
