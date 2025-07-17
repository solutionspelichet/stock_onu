const webAppUrl = 'https://script.google.com/macros/s/AKfycbwp8hlOeo_pmX_ijkNS7ByFVRvzCOJqKURs7q6K5g6PouSCfq3dLV52iwAafP2J5-fWAg/exec';

const zones = [
  "Voie Creuse",
  "Bibliotheque",
  "Reading Room 1",
  "Reading Room 3",
  "Compactus",
  "B26",
  "Batiment E",
  "Tampon"
];

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if (tabId === 'visualisation') drawAllCharts();
}

google.charts.load('current', { packages: ['corechart'] });

function drawAllCharts() {
  zones.forEach(zone => drawChart(zone));
}

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
  }).then(res => res.text())
    .then(() => {
      alert("✅ Donnée enregistrée !");
      form.reset();
      if (document.getElementById("visualisation").classList.contains("active")) {
        drawAllCharts();
      }
    });
}

function toChartId(zone) {
  return "chart_" + zone.replaceAll(" ", "_").replaceAll("é", "e").replaceAll("è", "e").replaceAll("ê", "e");
}

function drawChart(zone) {
  fetch(webAppUrl + "?etat=1&zone=" + encodeURIComponent(zone))
    .then(res => res.json())
    .then(json => {
      if (json.length <= 1) return; // rien à afficher
      const data = google.visualization.arrayToDataTable(json);
      const options = {
        title: "Stock – " + zone,
        pieHole: 0.4,
        height: 300
      };
      const chartDiv = document.getElementById(toChartId(zone));
      if (chartDiv) {
        const chart = new google.visualization.PieChart(chartDiv);
        chart.draw(data, options);
      }
    });
}
