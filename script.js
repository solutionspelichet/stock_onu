
const webAppUrl = 'https://script.google.com/macros/s/AKfycbwp8hlOeo_pmX_ijkNS7ByFVRvzCOJqKURs7q6K5g6PouSCfq3dLV52iwAafP2J5-fWAg/exec';

function showTab(id) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
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
      alert("✅ Enregistré !");
      form.reset();
      drawChart(); // mettre à jour
    });
}

google.charts.load('current', {'packages':['corechart']});
google.charts.setOnLoadCallback(drawChart);

function drawChart() {
  fetch(webAppUrl + "?chart=1")
    .then(res => res.json())
    .then(json => {
      const data = google.visualization.arrayToDataTable(json);
      const options = { title: 'Quantité par matériel (Voie Creuse)', pieHole: 0.4 };
      const chart = new google.visualization.PieChart(document.getElementById('chart_div'));
      chart.draw(data, options);
    });
}
