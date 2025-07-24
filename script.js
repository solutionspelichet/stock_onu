// URL de votre API Google Apps Script
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzQrltt-idECi0_Z7zgocc4gIddmcU9TbgSm-UeeM5PPpHwSyiTCKbVxOzrmH1jH1hp/exec';

// Variables globales pour la gestion des matériels multiples
let materielCounter = 0;

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
    const addMaterielBtn = document.getElementById('addMaterielBtn');

    const selectZoneVisualisation = document.getElementById('selectZoneVisualisation');
    const chargerStockBtn = document.getElementById('chargerStockBtn');
    const stockDisplayArea = document.getElementById('stockDisplayArea');
    const visualisationMessage = document.getElementById('visualisationMessage');

    // --- Initialisation et pré-remplissage ---
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateMouvementInput.value = `${yyyy}-${mm}-${dd}`;

    loadAllZonesForDatalist();
    loadAllMaterielsForDatalist();
    loadAvailableZonesForVisualization();

    // Ajouter le premier champ matériel
    addMaterielItem();

    // Mapping pour la PWA
    const NOM_FEUILLE_TO_NOM_ZONE_FRONTEND = {
        "Stock Voie Creuse": "Voie Creuse",
        "Stock Bibliothèque": "Bibliothèque",
    };

    // --- Gestion de la visibilité des champs et textes des labels ---
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

    // --- Gestion des matériels multiples ---
    function addMaterielItem() {
        materielCounter++;
        const container = document.getElementById('materielsContainer');
        
        const materielDiv = document.createElement('div');
        materielDiv.className = 'materiel-item';
        materielDiv.dataset.id = materielCounter;
        
        materielDiv.innerHTML = `
            <input list="materielsList" 
                   placeholder="Sélectionner ou saisir un matériel" 
                   class="materiel-input" 
                   required>
            <input type="number" 
                   placeholder="Quantité" 
                   class="quantite-input" 
                   min="1" 
                   required>
            <button type="button" class="remove-materiel-btn">Supprimer</button>
        `;
        
        container.appendChild(materielDiv);
        
        // Event listener pour le bouton supprimer
        const removeBtn = materielDiv.querySelector('.remove-materiel-btn');
        removeBtn.addEventListener('click', () => removeMaterielItem(materielDiv));
        
        updateMaterielCounter();
    }

    function removeMaterielItem(materielDiv) {
        const container = document.getElementById('materielsContainer');
        if (container.children.length > 1) {
            materielDiv.remove();
            updateMaterielCounter();
        } else {
            showMessage('Au moins un matériel est requis.', 'error');
        }
    }

    function updateMaterielCounter() {
        const count = document.getElementById('materielsContainer').children.length;
        document.getElementById('materielCount').textContent = count;
    }

    function showMessage(message, type) {
        mouvementMessage.textContent = message;
        mouvementMessage.className = `message ${type}`;
    }

    // Écoute les changements sur le type de mouvement et la feuille cible
    typeMouvementSelect.addEventListener('change', updateFormLabelsAndVisibility);
    feuilleCibleSelect.addEventListener('change', updateFormLabelsAndVisibility);
    addMaterielBtn.addEventListener('click', addMaterielItem);

    // Appeler une première fois pour initialiser l'affichage
    updateFormLabelsAndVisibility();

    // --- Gestion du formulaire d'enregistrement de mouvement (APPROCHE SIMPLIFIÉE) ---
    mouvementForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        mouvementMessage.textContent = 'Enregistrement en cours...';
        mouvementMessage.className = 'message info';

        try {
            // Collecter les données de base du formulaire
            const formData = {
                feuilleCible: feuilleCibleSelect.value,
                date: dateMouvementInput.value,
                type: typeMouvementSelect.value,
                zone: zoneMouvementInput.value,
                items: []
            };

            // Collecter tous les matériels et quantités
            const materielItems = document.querySelectorAll('.materiel-item');
            for (const item of materielItems) {
                const materiel = item.querySelector('.materiel-input').value.trim();
                const quantite = item.querySelector('.quantite-input').value;
                
                if (!materiel || !quantite) {
                    throw new Error('Tous les matériels doivent avoir un nom et une quantité.');
                }
                
                if (parseInt(quantite) <= 0) {
                    throw new Error('La quantité doit être un nombre positif.');
                }
                
                formData.items.push({
                    materiel: materiel,
                    quantite: parseInt(quantite)
                });
            }

            if (formData.items.length === 0) {
                throw new Error('Au moins un matériel est requis.');
            }

            // Validation côté client
            if (formData.type === "Transfert") {
                const feuilleSource = formData.feuilleCible;
                const zoneDestination = formData.zone;
                if (!feuilleSource || !zoneDestination) {
                    throw new Error('Pour un Transfert, la Feuille de Journalisation (Source) et la Zone de Destination sont obligatoires.');
                }
                const zoneSourceLogique = NOM_FEUILLE_TO_NOM_ZONE_FRONTEND[feuilleSource];
                if (!zoneSourceLogique || zoneSourceLogique === zoneDestination) {
                    throw new Error('Pour un Transfert, la Feuille de Journalisation doit être un Stock principal (Voie Creuse/Bibliothèque) et la Zone de Destination doit être différente de la source.');
                }
            }

            // **NOUVELLE APPROCHE : Envoyer chaque matériel individuellement**
            let totalMouvements = 0;
            const resultats = [];

            for (let i = 0; i < formData.items.length; i++) {
                const item = formData.items[i];
                
                mouvementMessage.textContent = `Enregistrement ${i + 1}/${formData.items.length}: ${item.materiel}...`;
                
                try {
                    // Construire l'URL pour un seul matériel
                    const params = new URLSearchParams({
                        action: 'addSingleMovement',
                        feuilleCible: formData.feuilleCible,
                        date: formData.date,
                        type: formData.type,
                        zone: formData.zone,
                        materiel: item.materiel,
                        quantite: item.quantite.toString()
                    });

                    console.log(`Envoi matériel ${i + 1}:`, params.toString());

                    const response = await fetch(`${APP_SCRIPT_URL}?${params.toString()}`);

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
                    }

                    const result = await response.text();
                    resultats.push(`${item.materiel}: ${result}`);
                    totalMouvements++;
                    
                    // Petit délai entre les requêtes pour éviter la surcharge
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                } catch (error) {
                    console.error(`Erreur pour ${item.materiel}:`, error);
                    resultats.push(`${item.materiel}: ERREUR - ${error.message}`);
                }
            }

            // Afficher le résultat final
            if (totalMouvements > 0) {
                mouvementMessage.textContent = `Succès: ${totalMouvements}/${formData.items.length} matériels enregistrés.`;
                mouvementMessage.className = 'message success';
                
                // Reset du formulaire
                resetForm();

                // Recharger les données
                loadAllZonesForDatalist();
                loadAllMaterielsForDatalist();
                loadAvailableZonesForVisualization();
            } else {
                mouvementMessage.textContent = 'Aucun matériel n\'a pu être enregistré. Vérifiez les erreurs ci-dessus.';
                mouvementMessage.className = 'message error';
            }
            
            // Afficher les détails dans la console
            console.log('Résultats détaillés:', resultats);
            
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement:', error);
            mouvementMessage.textContent = 'Erreur lors de l\'enregistrement: ' + error.message;
            mouvementMessage.className = 'message error';
        }
    });

    function resetForm() {
        mouvementForm.reset();
        dateMouvementInput.value = `${yyyy}-${mm}-${dd}`; 

        // Réinitialiser les matériels (garder seulement le premier)
        const container = document.getElementById('materielsContainer');
        container.innerHTML = '';
        materielCounter = 0;
        addMaterielItem();
        
        updateFormLabelsAndVisibility();
    }

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
            visualisationMessage.className = 'message error';
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
            visualisationMessage.className = 'message error';
        }
    }
});