#!/bin/bash
# Aller dans le dossier du projet
cd /Volumes/SSD/SynologyDrive/AI/Matomo

# Ajouter les modifications
git add .

# Demander le message de commit ou en mettre un par défaut
if [ -z "$1" ]; then
    # Modification ici : ajout de "à %H:%M"
    msg="Mise à jour automatique dashboard $(date +'%d/%m/%Y à %H:%M')"
else
    msg="$1"
fi

git commit -m "$msg"
git push

# Petit bonus : j'ai aussi ajouté l'heure dans le message de confirmation
echo "🚀 Déploiement terminé avec succès à $(date +'%H:%M') !"