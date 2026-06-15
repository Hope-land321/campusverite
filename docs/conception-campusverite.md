# CampusVerite - Note de conception

Cette note resume le cahier des charges du projet CampusVerite et propose une conception realiste pour un sprint de 2 heures.

> Important : le cahier des charges interdit l'utilisation de l'IA pendant la competition. Ce document doit servir de preparation et de comprehension avant l'epreuve, pas de livrable genere pendant l'epreuve.

## Lecture du besoin

CampusVerite est une plateforme web anonyme ou les etudiants publient des avis sur la vie de l'ecole. Le point central n'est pas seulement le formulaire : c'est la confiance. L'application doit donc eviter tout champ identifiant, rester simple, lisible, et rendre les problemes visibles.

Fonctionnalites obligatoires :

- Soumettre un avis sans nom, prenom, email ou compte.
- Choisir une categorie : Pedagogie, Infrastructure, Administration, Equipements.
- Choisir un type : Coup de Gueule ou Suggestion.
- Afficher un fil public du plus recent au plus ancien.
- Voter "Utile" sans connexion.
- Filtrer par categorie et par type.

Bonus interessants :

- Top 3 ou Top 5 des avis les plus votes.
- Marquage "petition" a partir d'un seuil de votes.
- Radar Campus avec indice de tension par categorie.
- Charte d'utilisation avant publication.
- Signalement d'abus.
- Interface responsive.

## Avis sur le projet

Le sujet est bien adapte a une competition courte : les fonctionnalites sont claires, utiles, et la valeur est visible rapidement. Le piege principal est de vouloir ajouter trop de choses. Pour gagner des points, il vaut mieux livrer un coeur solide : formulaire, stockage, affichage, votes, filtres, README propre, puis seulement ajouter 2 ou 3 bonus simples.

La difficulte technique la plus sensible est le vote sans connexion. Sans compte et sans collecte d'identite, on ne peut pas garantir parfaitement "un visiteur = un vote". Pour respecter l'anonymat, le meilleur compromis de sprint est :

- cote serveur : stocker seulement le nombre de votes ;
- cote navigateur : utiliser `localStorage` pour retenir les avis deja votes sur ce navigateur ;
- ne jamais stocker nom, email, matricule ou IP dans l'interface ou dans la base.

## Stack recommandee

Stack principale recommandee :

- Backend : Python Flask.
- Base de donnees : SQLite locale.
- Frontend : HTML Jinja, CSS simple, JavaScript vanilla.
- Lancement : `flask --app app run` ou `python app.py`.

Pourquoi cette stack :

- rapide a developper en 2 heures ;
- pas de build frontend ;
- base locale facile a versionner ou initialiser ;
- routes tres lisibles pour le jury ;
- README simple ;
- possible a deployer ensuite sur Render/Railway si besoin.

Alternative si tu es plus a l'aise en PHP :

- PHP 8 + SQLite + HTML/CSS/JS vanilla.

## Architecture proposee

Pages principales :

- `/` : fil public, filtres, top avis, formulaire ou lien vers formulaire.
- `/submit` : formulaire de soumission anonyme.
- `/posts` en `POST` : creation d'un avis.
- `/posts/<id>/vote` en `POST` : vote utile.
- `/posts/<id>/report` en `POST` : signalement d'abus.

Structure de projet possible :

```text
campusverite/
  app.py
  schema.sql
  campusverite.db
  templates/
    base.html
    index.html
    submit.html
  static/
    css/style.css
    js/app.js
  README.md
```

## Modele de donnees

Tables minimales :

- `categories(id, name, slug)`
- `posts(id, category_id, type, content, useful_votes, report_count, status, created_at)`

Valeurs utiles :

- `type` : `rant` pour Coup de Gueule, `suggestion` pour Suggestion.
- `status` : `published`, `petition`, `hidden`.
- seuil petition : 10 votes utiles.

## Diagramme de cas d'utilisation

```plantuml
@startuml
left to right direction

actor "Utilisateur anonyme" as User
actor "Administration / Jury" as Viewer

rectangle "CampusVerite" {
  usecase "Consulter le fil d'avis" as UC1
  usecase "Filtrer par categorie" as UC2
  usecase "Filtrer par type" as UC3
  usecase "Soumettre un avis anonyme" as UC4
  usecase "Choisir une categorie" as UC5
  usecase "Choisir un type" as UC6
  usecase "Voter utile" as UC7
  usecase "Voir les avis populaires" as UC8
  usecase "Lire la charte" as UC9
  usecase "Signaler un abus" as UC10
  usecase "Marquer comme petition" as UC11
}

User --> UC1
User --> UC2
User --> UC3
User --> UC4
User --> UC7
User --> UC8
User --> UC10
Viewer --> UC1
Viewer --> UC8

UC4 ..> UC5 : <<include>>
UC4 ..> UC6 : <<include>>
UC4 ..> UC9 : <<include>>
UC7 ..> UC11 : <<extend>>
@enduml
```

## Diagramme d'activite - Soumission d'un avis

```plantuml
@startuml
start
:Ouvrir le formulaire;
:Afficher la charte d'utilisation;
if (Charte acceptee ?) then (oui)
  :Choisir categorie;
  :Choisir type;
  :Saisir le message;
  if (Formulaire valide ?) then (oui)
    :Enregistrer l'avis sans identite;
    :Afficher l'avis dans le fil public;
  else (non)
    :Afficher les erreurs;
  endif
else (non)
  :Annuler la soumission;
endif
stop
@enduml
```

## Diagramme d'activite - Vote utile

```plantuml
@startuml
start
:Utilisateur consulte le fil;
:Cliquer sur "Utile";
if (Avis deja vote sur ce navigateur ?) then (oui)
  :Bloquer le nouveau vote;
  :Afficher un message discret;
else (non)
  :Incrementer useful_votes;
  :Sauvegarder l'id de l'avis dans localStorage;
  if (Votes >= 10 ?) then (oui)
    :Marquer l'avis comme petition;
  endif
endif
stop
@enduml
```

## Diagramme de classes

```plantuml
@startuml
class Category {
  +int id
  +string name
  +string slug
}

class Post {
  +int id
  +PublicationType type
  +string content
  +int usefulVotes
  +int reportCount
  +PostStatus status
  +datetime createdAt
  +voteUseful()
  +report()
  +markAsPetition()
}

enum PublicationType {
  RANT
  SUGGESTION
}

enum PostStatus {
  PUBLISHED
  PETITION
  HIDDEN
}

class FeedbackService {
  +createPost(categoryId, type, content)
  +listPosts(categorySlug, type)
  +voteUseful(postId)
  +reportPost(postId)
  +getTopPosts(limit)
}

class PostRepository {
  +insert(post)
  +findAll(filters)
  +incrementVotes(postId)
  +incrementReports(postId)
  +findTop(limit)
}

class LocalVoteStore {
  +hasVoted(postId)
  +rememberVote(postId)
}

Category "1" -- "*" Post
FeedbackService --> PostRepository
FeedbackService --> Post
LocalVoteStore ..> Post : vote cote navigateur
Post --> PublicationType
Post --> PostStatus
@enduml
```

## Diagramme de sequence - Creation d'un avis

```plantuml
@startuml
actor "Utilisateur anonyme" as User
participant "Navigateur" as Browser
participant "Application Flask" as App
database "SQLite" as DB

User -> Browser : Remplit le formulaire
Browser -> App : POST /posts
App -> App : Valider categorie, type, contenu
App -> DB : INSERT post
DB --> App : post_id
App --> Browser : Redirection vers /
Browser --> User : Affiche le fil mis a jour
@enduml
```

## Diagramme de composants

```plantuml
@startuml
package "Client" {
  [HTML/CSS]
  [JavaScript localStorage]
}

package "Serveur Flask" {
  [Routes]
  [FeedbackService]
  [Templates Jinja]
}

database "SQLite locale" as DB

[HTML/CSS] --> [Routes]
[JavaScript localStorage] --> [Routes]
[Routes] --> [FeedbackService]
[FeedbackService] --> DB
[Routes] --> [Templates Jinja]
@enduml
```

## Plan de realisation en 2 heures

- 0-15 min : initialiser projet, README, structure, base SQLite.
- 15-40 min : formulaire anonyme et insertion des avis.
- 40-60 min : fil public trie par date.
- 60-75 min : categories, types et filtres.
- 75-90 min : vote utile avec compteur et `localStorage`.
- 90-105 min : bonus simples : top avis, badge petition, responsive.
- 105-120 min : correction UI, captures si possible, README et push GitHub.

## Priorite de developpement

Ordre conseille :

1. Faire fonctionner le stockage et le fil public.
2. Ajouter formulaire avec validation.
3. Ajouter filtres.
4. Ajouter votes.
5. Soigner l'interface.
6. Ajouter bonus seulement si le coeur est stable.

Pour la presentation devant le jury, il faut insister sur trois idees : anonymat respecte, utilite sociale du canal de feedback, et visibilite des problemes les plus importants.

Innovation conseillee : presenter le Radar Campus comme un tableau de bord decisionnel. Il transforme les avis anonymes en priorites d'action sans identifier les auteurs.
