/* Click routing for the time tree. Kept separate so tests can exercise
   the real decision path (including nested targets and leftover data-person). */
(function (root) {
  "use strict";

  function getAttr(el, name) {
    if (!el) return null;
    if (typeof el.getAttribute === "function") {
      var v = el.getAttribute(name);
      return v == null ? null : v;
    }
    if (el.attrs && Object.prototype.hasOwnProperty.call(el.attrs, name)) return el.attrs[name];
    return null;
  }

  function tagName(el) {
    return String((el && el.tagName) || "").toLowerCase();
  }

  function isActionNode(el) {
    if (!el) return false;
    var tag = tagName(el);
    if (tag === "button" || tag === "a") return true;
    if (getAttr(el, "data-kind") != null) return true;
    if (getAttr(el, "data-card") != null) return true;
    if (getAttr(el, "data-person") != null) return true;
    if (getAttr(el, "data-view") != null) return true;
    if (getAttr(el, "data-close-card") != null) return true;
    if (getAttr(el, "data-start-one") != null) return true;
    var id = el.id || getAttr(el, "id");
    if (id === "treeFab") return true;
    return false;
  }

  function closestActionNode(el) {
    var n = el;
    while (n) {
      if (isActionNode(n)) return n;
      n = n.parentNode || n.parentElement || null;
    }
    return null;
  }

  function interactionFromElement(el, ev) {
    ev = ev || {};
    var act = closestActionNode(el);
    if (!act) return { type: "dismiss" };
    if ((act.id || getAttr(act, "id")) === "treeFab") return { type: "ignore" };
    if (getAttr(act, "data-close-card") != null) return { type: "dismiss" };
    var kind = getAttr(act, "data-kind");
    var id = getAttr(act, "data-id");
    // data-kind always wins, even if a flower still carries data-person.
    if (kind) return { type: "select", kind: kind, id: id };
    if (getAttr(act, "data-scroll")) return { type: "ignore" };
    if (getAttr(act, "data-filter")) return { type: "filter", id: getAttr(act, "data-filter") };
    var person = getAttr(act, "data-person");
    if (person) return { type: "goPerson", id: person };
    if (getAttr(act, "data-view")) return { type: "view", id: getAttr(act, "data-view") };
    if (getAttr(act, "data-start-one")) return { type: "quiz", id: getAttr(act, "data-start-one") };
    if (getAttr(act, "data-quiz-mode")) return { type: "quizMode", id: getAttr(act, "data-quiz-mode") };
    if (getAttr(act, "data-reveal")) return { type: "reveal" };
    if (getAttr(act, "data-rate")) return { type: "rate", id: getAttr(act, "data-rate") };
    return { type: "ignore" };
  }

  var api = {
    getAttr: getAttr,
    isActionNode: isActionNode,
    closestActionNode: closestActionNode,
    interactionFromElement: interactionFromElement
  };
  root.ArchitectTreeInteraction = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
