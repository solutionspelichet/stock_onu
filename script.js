
const apiURL = 'https://script.google.com/macros/s/AKfycbwp8hlOeo_pmX_ijkNS7ByFVRvzCOJqKURs7q6K5g6PouSCfq3dLV52iwAafP2J5-fWAg/exec';

function envoyerMouvement(e, feuille) {
  e.preventDefault();
  const form = e.target;
  const data = {
    type: form.type?.value || "",
    materiel: form.materiel.value,
    quantite: parseInt(form.quantite.value),
    feuille: feuille
  };

  fetch(apiURL, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  }).then(res => {
    if (res.ok) {
      alert("Enregistré !");
      form.reset();
    } else {
      alert("Erreur lors de l'envoi !");
    }
  });
}

function envoyerRepartition(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    zone: form.zone.value,
    materiel: form.materiel.value,
    quantite: parseInt(form.quantite.value),
    feuille: 'Répartition Journalière'
  };
  fetch(apiURL, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  }).then(res => {
    if (res.ok) {
      alert("Répartition enregistrée !");
      form.reset();
    } else {
      alert("Erreur lors de l'envoi !");
    }
  });
}

function envoyerRestes(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    zone: form.zone.value,
    materiel: form.materiel.value,
    quantite: parseInt(form.quantite.value),
    retour: form.retour?.value || "",
    feuille: 'Restes Zones'
  };
  fetch(apiURL, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  }).then(res => {
    if (res.ok) {
      alert("Restes enregistrés !");
      form.reset();
    } else {
      alert("Erreur lors de l'envoi !");
    }
  });
}

function showTab(id) {
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab-button[onclick*="${id}"]`).classList.add('active');
  document.getElementById(id).classList.add('active');
}
