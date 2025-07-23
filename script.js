const URL = 'https://script.google.com/macros/s/AKfycbziAVax2FUM_xF1Ve0ooUlE52SbBR18B6pQYuh9gz2GHPzfdkUP1L2_fjW2CSYapzRXIQ/exec';

document.addEventListener("DOMContentLoaded", () => {
  chargerZones();
  chargerMateriels();

  const form = document.getElementById("mouvementForm");
  const message = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      feuilleCible: document.getElementById("feuille").value,
      type: document.getElementById("type").value,
      zone: document.getElementById("zone").value,
      date: new Date().toISOString().split("T")[0],
      items: [
        {
          materiel: document.getElementById("materiel").value,
          quantite: parseInt(document.getElementById("quantite").value, 10)
        }
      ]
    };

    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const text = await res.text();
    message.textContent = text;
    form.reset();
    chargerZones();
    chargerMateriels();
  });

  document.getElementById("chargerBtn").addEventListener("click", async () => {
    const zone = document.getElementById("zoneSelect").value;
    const res = await fetch(`${URL}?etat=1&zone=${encodeURIComponent(zone)}`);
    const json = await res.json();
    afficherEtat(json);
  });
});

async function chargerZones() {
  const res = await fetch(`${URL}?get=zones`);
  const zones = await res.json();
  const list = document.getElementById("zonesList");
  const select = document.getElementById("zoneSelect");
  list.innerHTML = "";
  select.innerHTML = "";
  zones.forEach(zone => {
    const opt1 = document.createElement("option");
    opt1.value = zone;
    list.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = zone;
    opt2.textContent = zone;
    select.appendChild(opt2);
  });
}

async function chargerMateriels() {
  const res = await fetch(`${URL}?get=materiels`);
  const materiels = await res.json();
  const list = document.getElementById("materielsList");
  list.innerHTML = "";
  materiels.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    list.appendChild(opt);
  });
}

function afficherEtat(data) {
  const div = document.getElementById("etatStocks");
  div.innerHTML = "";
  if (data.length <= 1) {
    div.textContent = "Aucune donnée.";
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>${data[0][0]}</th><th>${data[0][1]}</th></tr>`;
  const tbody = document.createElement("tbody");
  for (let i = 1; i < data.length; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${data[i][0]}</td><td>${data[i][1]}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(thead);
  table.appendChild(tbody);
  div.appendChild(table);
}
