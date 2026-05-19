import { getJson } from "../api.js";
import { formatQueryString } from "../utils.js";

export function getSharedElements() {
  return {
    locationFilter: document.getElementById("locationFilter"),
    timeGranularity: document.getElementById("timeGranularity"),
    dashboardMessage: document.getElementById("dashboardMessage"),
  };
}

export function setMessage(elements, message, variant = "info") {
  elements.dashboardMessage.textContent = message;
  elements.dashboardMessage.classList.toggle("error", variant === "error");
}

export function getFilters(elements) {
  return {
    location: elements.locationFilter?.value || "",
    timeGranularity: elements.timeGranularity?.value || "month",
  };
}

export async function populateFilters(elements) {
  const data = await getJson("/api/filters");
  data.locations.forEach((value) => appendOption(elements.locationFilter, value));
}

function appendOption(selectEl, value) {
  if (!selectEl) return;
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  selectEl.appendChild(option);
}

export function bindFilterEvents(elements, callback) {
  [elements.locationFilter, elements.timeGranularity]
    .filter(Boolean)
    .forEach((node) => node.addEventListener("change", callback));
}

export function toQueryString(elements) {
  return formatQueryString(getFilters(elements));
}
