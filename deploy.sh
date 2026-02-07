#!/bin/bash
# Aller dans le dossier du projet
cd /Volumes/SSD/SynologyDrive/AI/Matomo

# Ajouter les modifications
git add .

# Demander le message de commit ou en mettre un par défaut
if [ -z "$1" ]; then
    msg="Mise à jour automatique dashboard $(date +'%d/%m/%Y')"
else
    msg="$1"
fi

git commit -m "$msg"
git push

echo "🚀 Déploiement terminé avec succès !"