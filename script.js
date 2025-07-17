const webAppUrl = 'https://script.google.com/macros/s/AKfycbwp8hlOeo_pmX_ijkNS7ByFVRvzCOJqKURs7q6K5g6PouSCfq3dLV52iwAafP2J5-fWAg/exec';

const zones = [
  "Voie Creuse",
  "Bibliothèque",
  "Reading Room 1",
  "Reading Room 3",
  "Compactus",
  "B26",
  "Bâtiment E",
  "Tampon"
];

// Affichage des sections par onglet
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if (tabId === 'visualisation') {
    google.charts.setOnLoadCallback(drawAllCharts);  // Triggere le rendu une fois Charts chargé
  }
}

// Chargement Google Charts
google.charts.load('current', { packages: ['corechart'] });

// Dessiner tous les graphiques
function drawAllCharts() {
  zones.forEach(zone => drawChart(zone));
}

// Dessiner un camembert pour une zone
function drawChart(zone) {
  fetch(`${webAppUrl}?etat=1&zone=${encodeURIComponent(zone)}`)
    .then(res => res.json())
    .then(json => {
      const data = google.visualization.arrayToDataTable(json);
      const options = {
        title: "Stock actuel – " + zone,
        pieHole: 0.4,
        height: 300
      };
      const zoneId = "chart_" + zone.replace(/ /g, "_").replace(/[^\w]/g, "_");
      const chartDiv = document.getElementById(zoneId);
      if (chartDiv) {
        const chart = new google.visualization.PieChart(chartDiv);
        chart.draw(data, options);
      }
    })
    .catch(err => {
      console.error("Erreur fetch pour la zone", zone, err);
    });
}

// Envoi d’un mouvement de stock
function envoyerMouvement(e, feuille) {
  e.preventDefault();
  const form = e.target;
  const params = new URLSearchParams();
  params.append("feuille", feuille);
  params.append("date", form.date.value);
  if (form.type) params.append("type", form.type.value);
  if (form.zone) params.append("zone", form.zone.value);
  params.append("materiel", form.materiel.value);
  params.append("quantite", form.quantite.value);

  fetch(webAppUrl, {
    method: "POST",
    body: params
  })
    .then(res => res.text())
    .then(() => {
      alert("✅ Donnée enregistrée !");
      form.reset();
    })
    .catch(err => alert("❌ Erreur : " + err));
}
