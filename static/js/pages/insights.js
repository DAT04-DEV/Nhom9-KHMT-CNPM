import { getJson } from "../api.js";

async function init() {
  const res = await getJson("/api/ai-insights");
  const container = document.getElementById("insightCards");
  res.insights.forEach((text) => {
    const card = document.createElement("article");
    card.className = "glass";
    card.innerHTML = `<h3>Insight</h3><p>${text}</p>`;
    container.appendChild(card);
  });
}

init();
