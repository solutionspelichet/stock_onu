// Remplacez 'YOUR_WEB_APP_URL_HERE' par l'URL de déploiement de votre application web Google Apps Script
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz_Sm9L_5P1dj5J3YKe7auymUEhZIaVzZoz--xXEYIHAcln9o3rsK6Uxxfz-a6ckAZfyg/exec';


document.addEventListener('DOMContentLoaded', () => {
    const mouvementForm = document.getElementById('mouvementForm');
    const mouvementMessage = document.getElementById('mouvementMessage');
    const dateMouvementInput = document.getElementById('dateMouvement');
    const feuilleCibleSelect = document.getElementById('feuilleCible');
    const typeMouvementSelect = document.getElementById('typeMouvement');
    const zoneMouvementInput = document.getElementById('zoneMouvement');
    const zonesDatalist = document.getElementById('zonesList');
    const materielsDatalist = document.getElementById('materielsList');
    const zoneInputFieldGroup = document.getElementById('zoneInputFieldGroup'); 

    const materiauxContainer = document.getElementById('materiaux-container');
    const addMateriauBtn = document.getElementById('addMateriauBtn');

    const selectZoneVisualisation = document.getElementById('selectZoneVisualisation');
    const chargerStockBtn = document.getElementById('chargerStockBtn');
    const stockDisplayArea = document.getElementById('stockDisplayArea');
    const visualisationMessage = document.getElementById('visualisationMessage');

    let materiauItemId = 1; // Compteur pour les IDs uniques des champs matériel/quantité

    // --- Initialisation et pré-remplissage ---
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateMouvementInput.value = `${yyyy}-${mm}-${dd}`;

    loadAllZonesForDatalist();
    loadAllMaterielsForDatalist(); // Charge la liste pour tous les champs matériels
    loadAvailableZonesForVisualization();

    // --- Mappings pour la PWA (facilite la gestion des noms de zones vs noms de feuilles) ---
    const NOM_FEUILLE_TO_NOM_ZONE_FRONTEND = {
        "Stock Voie Creuse": "Voie Creuse",
        "Stock Bibliothèque": "Bibliothèque",
    };

    // --- Fonctions de gestion des champs Matériel/Quantité dynamiques ---
    function addMateriauField() {
        materiauItemId++;
        const newItemDiv = document.createElement('div');
        newItemDiv.classList.add('materiau-item', 'form-group');
        newItemDiv.dataset.id = materiauItemId;
        newItemDiv.innerHTML = `
            <label for="materiel_${materiauItemId}">Matériel:</label>
            <input list="materielsList" id="materiel_${materiauItemId}" class="materiel-input" name="materiel_${materiauItemId}" placeholder="Sélectionner ou Saisir un Matériel" required>
            <label for="quantite_${materiauItemId}">Quantité:</label>
            <input type="number" id="quantite_${materiauItemId}" class="quantite-input" name="quantite_${materiauItemId}" required min="1">
            <button type="button" class="remove-materiau-btn">Supprimer</button>
        `;
        materiauxContainer.appendChild(newItemDiv);

        // Afficher les boutons supprimer si plus d'un élément
        document.querySelectorAll('.remove-materiau-btn').forEach(btn => btn.style.display = 'inline-block');
        if (materiauxContainer.children.length === 1) {
             document.querySelector('.remove-materiau-btn').style.display = 'none';
        }
    }

    function removeMateriauField(button) {
        const itemToRemove = button.closest('.materiau-item');
        if (materiauxContainer.children.length > 1) { // Empêcher de supprimer le dernier champ
            itemToRemove.remove();
        }
        // Cacher les boutons supprimer si seulement un élément
        if (materiauxContainer.children.length === 1) {
            document.querySelector('.remove-materiau-btn').style.display = 'none';
        }
    }

    addMateriauBtn.addEventListener('click', addMateriauField);
    materiauxContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-materiau-btn')) {
            removeMateriauField(event.target);
        }
    });

    // --- Gestion de la visibilité des champs et textes des labels (inchangée) ---
    function updateFormLabelsAndVisibility() {
        const typeSelected = typeMouvementSelect.value;
        const feuilleCible = feuilleCibleSelect.value;
        const zoneLabel = zoneInputFieldGroup.querySelector('label');

        if (typeSelected === "Transfert") {
            feuilleCibleSelect.querySelector('option[value="Stock Voie Creuse"]').disabled = false;
            feuilleCibleSelect.querySelector('option[value="Stock Bibliothèque"]').disabled = false;
            feuilleCibleSelect.querySelector('option[value="Répartition Journalière"]').disabled = true;
            feuilleCibleSelect.querySelector('option[value="Restes Zones"]').disabled = true;
            zoneLabel.textContent = 'Zone de Destination du Transfert:';
            if (!['Stock Voie Creuse', 'Stock Bibliothèque'].includes(feuilleCible)) {
                feuilleCibleSelect.value = 'Stock Voie Creuse'; 
            }
        } else if (typeSelected === "Entrée" || typeSelected === "Sortie") {
            feuilleCibleSelect.querySelector('option[value="Stock Voie Creuse"]').disabled = false;
            feuilleCibleSelect.querySelector('option[value="Stock Bibliothèque"]').disabled = false;
            feuilleCibleSelect.querySelector('option[value="Répartition Journalière"]').disabled = true;
            feuilleCibleSelect.querySelector('option[value="Restes Zones"]').disabled = true; 
            if (typeSelected === "Entrée") {
                zoneLabel.textContent = 'Zone de Destination (où le matériel est ajouté):';
            } else { 
                zoneLabel.textContent = 'Zone d\'Origine (d\'où le matériel est retiré):';
            }
            // La "Zone" dans le formulaire doit correspondre à la zone logique de la feuille cible
            // si l'utilisateur ne la change pas.
            zoneMouvementInput.value = NOM_FEUILLE_TO_NOM_ZONE_FRONTEND[feuilleCible] || '';
            
        } else if (feuilleCible === "Répartition Journalière") {
            zoneLabel.textContent = 'Zone de Distribution:';
            typeMouvementSelect.value = "Entrée"; 
            typeMouvementSelect.disabled = true; 
        } else if (feuilleCible === "Restes Zones") {
            zoneLabel.textContent = 'Zone d\'Inventaire:';
            typeMouvementSelect.value = "Entrée"; 
            typeMouvementSelect.disabled = true;
        }

        if (feuilleCible !== "Répartition Journalière" && feuilleCible !== "Restes Zones") {
            typeMouvementSelect.disabled = false;
        }
        zoneMouvementInput.required = true; 
    }

    typeMouvementSelect.addEventListener('change', updateFormLabelsAndVisibility);
    feuilleCibleSelect.addEventListener('change', updateFormLabelsAndVisibility);
    updateFormLabelsAndVisibility();


    // --- Gestion du formulaire d'enregistrement de mouvement ---
    mouvementForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        mouvementMessage.textContent = 'Enregistrement en cours...';
        mouvementMessage.className = 'message info';

        // Collecter tous les articles (matériel et quantité)
        const items = [];
        const materiauItems = document.querySelectorAll('.materiau-item');
        let isValidItems = true;

        materiauItems.forEach(itemDiv => {
            const materielInput = itemDiv.querySelector('.materiel-input');
            const quantiteInput = itemDiv.querySelector('.quantite-input');

            if (materielInput.value.trim() === '' || parseInt(quantiteInput.value) <= 0) {
                isValidItems = false;
                mouvementMessage.textContent = 'Erreur: Tous les champs Matériel et Quantité doivent être remplis et la quantité doit être supérieure à 0.';
                mouvementMessage.className = 'message error';
                return; // Sortir de la boucle forEach
            }
            items.push({
                materiel: materielInput.value.trim(),
                quantite: parseInt(quantiteInput.value)
            });
        });

        if (!isValidItems || items.length === 0) {
            if (items.length === 0) {
                mouvementMessage.textContent = 'Erreur: Veuillez ajouter au moins un matériel.';
                mouvementMessage.className = 'message error';
            }
            return; // Arrêter la soumission si les articles ne sont pas valides
        }


        const formData = {
            feuilleCible: feuilleCibleSelect.value,
            date: dateMouvementInput.value,
            type: typeMouvementSelect.value,
            zone: zoneMouvementInput.value.trim(), // La zone de destination/origine réelle
            items: items // Le tableau des articles
        };
        console.log("Données envoyées:", formData);

        try {
            const response = await fetch(APP_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json' // Indique que le corps est du JSON
                },
                body: JSON.stringify(formData) // Convertit les données en JSON
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erreur HTTP! Statut: ${response.status} - ${errorText}`);
            }

            const result = await response.text(); 
            mouvementMessage.textContent = 'Mouvement(s) enregistré(s) avec succès: ' + result;
            mouvementMessage.className = 'message success';
            mouvementForm.reset();
            dateMouvementInput.value = `${yyyy}-${mm}-${dd}`; 

            // Réinitialiser les champs matériel/quantité à un seul champ vide
            materiauxContainer.innerHTML = '';
            materiauItemId = 0; // Réinitialiser l'ID pour recommencer à 1 avec addMateriauField
            addMateriauField(); // Ajouter un champ vide initial
            
            // Recharger toutes les listes et la visualisation
            loadAllZonesForDatalist();
            loadAllMaterielsForDatalist();
            loadAvailableZonesForVisualization(); 
            
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement du mouvement:', error);
            mouvementMessage.textContent = 'Erreur lors de l\'enregistrement: ' + error.message;
            mouvementMessage.className = 'message error';
        }
    });

    // --- Fonctions pour peupler les datalist (zones et matériels) ---

    async function loadAllZonesForDatalist() {
        try {
            const response = await fetch(`${APP_SCRIPT_URL}?get=zones`);
            if (!response.ok) {
                throw new Error(`Erreur HTTP! Statut: ${response.status}`);
            }
            const zones = await response.json();
            zonesDatalist.innerHTML = '';
            zones.forEach(zone => {
                const option = document.createElement('option');
                option.value = zone;
                zonesDatalist.appendChild(option);
            });
        } catch (error) {
            console.error('Erreur lors du chargement des zones pour la datalist:', error);
        }
    }

    async function loadAllMaterielsForDatalist() {
        try {
            const response = await fetch(`${APP_SCRIPT_URL}?get=materiels`);
            if (!response.ok) {
                throw new Error(`Erreur HTTP! Statut: ${response.status}`);
            }
            const materiels = await response.json();
            materielsDatalist.innerHTML = '';
            materiels.forEach(materiel => {
                const option = document.createElement('option');
                option.value = materiel;
                materielsDatalist.appendChild(option);
            });
        } catch (error) {
            console.error('Erreur lors du chargement des matériels pour la datalist:', error);
        }
    }


    // --- Fonctions de Visualisation des Stocks ---

    async function loadAvailableZonesForVisualization() {
        visualisationMessage.textContent = 'Chargement des zones disponibles...';
        visualisationMessage.className = 'message info';
        selectZoneVisualisation.innerHTML = '<option value="">Chargement...</option>';

        try {
            const response = await fetch(`${APP_SCRIPT_URL}?get=zones`);
            if (!response.ok) {
                throw new Error(`Erreur HTTP! Statut: ${response.status}`);
            }
            const zones = await response.json();
            
            selectZoneVisualisation.innerHTML = '<option value="">-- Sélectionner une zone --</option>';
            zones.forEach(zone => {
                const option = document.createElement('option');
                option.value = zone;
                option.textContent = zone;
                selectZoneVisualisation.appendChild(option);
            });
            visualisationMessage.textContent = '';
            visualisationMessage.className = 'message';

            if (zones.length > 0) {
                 selectZoneVisualisation.value = zones[0];
                 loadStockData(zones[0]);
            }

        } catch (error) {
            console.error('Erreur lors du chargement des zones pour la visualisation:', error);
            visualisationMessage.textContent = 'Erreur lors du chargement des zones: ' + error.message;
            visualisationMessage.className = 'message error';
            selectZoneVisualisation.innerHTML = '<option value="">Erreur de chargement</option>';
        }
    }

    chargerStockBtn.addEventListener('click', () => {
        const selectedZone = selectZoneVisualisation.value;
        if (selectedZone) {
            loadStockData(selectedZone);
        } else {
            visualisationMessage.textContent = 'Veuillez sélectionner une zone.';
            visualisationMessage.className = 'message warning';
        }
    });

    async function loadStockData(zone) {
        visualisationMessage.textContent = `Chargement du stock pour "${zone}"...`;
        visualisationMessage.className = 'message info';
        stockDisplayArea.innerHTML = '';

        const visualizationUrl = `${APP_SCRIPT_URL}?etat=1&zone=${encodeURIComponent(zone)}`;

        try {
            const response = await fetch(visualizationUrl);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erreur HTTP! Statut: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            console.log(`Données de stock pour ${zone}:`, data);

            displayStockData(data, zone);

        } catch (error) {
            console.error('Erreur lors du chargement des données de stock:', error);
            visualisationMessage.textContent = 'Erreur lors du chargement des données de stock: ' + error.message;
            visualisationMessage.className = 'message error';
        }
    }

    function displayStockData(data, zoneName) {
        stockDisplayArea.innerHTML = '';
        visualisationMessage.textContent = '';

        const title = document.createElement('h3');
        title.textContent = `État des stocks pour ${zoneName}:`;
        stockDisplayArea.appendChild(title);

        if (data && data.length > 1) {
            const table = document.createElement('table');
            table.classList.add('stock-table');

            let html = '<thead><tr>';
            data[0].forEach(header => {
                html += `<th>${header}</th>`;
            });
            html += '</tr></thead><tbody>';

            for (let i = 1; i < data.length; i++) {
                html += '<tr>';
                data[i].forEach(cell => {
                    html += `<td>${cell}</td>`;
                });
                html += '</tr>';
            }
            html += '</tbody>';
            table.innerHTML = html;
            stockDisplayArea.appendChild(table);
            visualisationMessage.textContent = `Affichage de ${data.length - 1} articles.`;
            visualisationMessage.className = 'message info';
        } else {
            stockDisplayArea.innerHTML += '<p>Aucune donnée de stock trouvée pour cette zone ou le stock est vide.</p>';
            visualisationMessage.textContent = 'Aucune donnée de stock trouvée.';
            visualisationMessage.className = 'message warning';
        }
    }

    // Initialiser un premier champ matériel/quantité au chargement
    addMateriauField(); 
});