const apiURL = 'https://script.google.com/macros/s/AKfycbx2mxxFMi3Cqf3Ohf7iWVQdXcKm_YZEviGjKtyDbPaP7w2UbDqZSLU-qKW2MqItqKsDoQ/exec';

function envoyerMouvement(e, feuille) {
  e.preventDefault();
  const form = e.target;
  const data = {
    type: form.type.value,
    materiel: form.materiel.value,
    quantite: parseInt(form.quantite.value),
    feuille: feuille
  };

  fetch(apiURL, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  }).then(() => {
    alert("Enregistré !");
    form.reset();
  });
}

function showTab(id) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
