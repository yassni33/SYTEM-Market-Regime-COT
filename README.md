# YASSNI.edge

Ton espace de trading personnel : Market Regime & COT, calendrier des news, journal, stratégie ACR et calculateur de risque.

- **Site** : Next.js, hébergé gratuitement sur **Vercel**.
- **Données** : Yahoo Finance (prix), CFTC (COT), ForexFactory (news), téléchargées par le serveur Vercel. Le site marche donc aussi quand ton PC est éteint.
- **Cloud** : **Supabase** (gratuit) garde ton login, ton journal, tes captures et la dernière copie des données de marché.

---

## Mise en route, étape par étape (environ 20 minutes)

Tu vas créer 3 comptes gratuits : **GitHub** (pour stocker le code), **Supabase** (base de données) et **Vercel** (hébergement).

### Étape 1 : Supabase (base de données et login)

1. Va sur <https://supabase.com> et clique sur **Start your project**. Inscris-toi avec ton compte GitHub ou ton e-mail.
2. Clique sur **New project** :
   - **Name** : `trading-hub`
   - **Database Password** : clique sur **Generate a password** et garde-le dans un endroit sûr.
   - **Region** : `West EU (Paris)` ou `Central EU (Frankfurt)`, plus proches du Maroc.
   - Clique sur **Create new project** et attends environ 2 minutes.
3. **Créer les tables** : dans le menu de gauche, ouvre **SQL Editor** puis **New query**. Ouvre le fichier [`supabase/schema.sql`](supabase/schema.sql) de ce dossier, copie **tout** son contenu, colle-le et clique sur **Run**. Tu dois voir « Success. No rows returned ».
4. **Créer ton utilisateur** : menu **Authentication** puis **Users**, bouton **Add user**, puis **Create new user**.
   - Mets ton e-mail et un mot de passe solide.
   - Coche **Auto Confirm User**.
   - Clique sur **Create user**.
5. **Fermer les inscriptions** (tu es le seul utilisateur) : **Authentication**, puis **Sign In / Providers** (ou **Settings**). Désactive **Allow new users to sign up** et clique sur **Save**.
6. **Récupérer les clés** : **Project Settings** (roue crantée), puis **API Keys** (ou **Data API**). Note :
   - le **Project URL**, qui ressemble à `https://abcdefgh.supabase.co` ;
   - la **Publishable key**, qui commence par `sb_publishable_…`. Sur un ancien projet, prends la clé **anon public**.

   ⚠️ Ne copie **jamais** la clé `secret` ou `service_role` dans le site.

### Étape 2 : GitHub (stocker le code)

1. Crée un compte sur <https://github.com>.
2. Clique sur **+** puis **New repository** :
   - **Name** : `trading-hub`
   - Coche **Private** (important : c'est ton code privé).
   - Ne coche rien d'autre, puis **Create repository**.
3. Envoie ce dossier sur GitHub. La façon la plus simple est **GitHub Desktop** (<https://desktop.github.com>) :
   - **File**, puis **Add local repository**, et choisis ce dossier. Il te propose de « create a repository » : accepte.
   - Écris un message comme `Première version` puis clique sur **Commit to main**.
   - Clique sur **Publish repository**, garde **Keep this code private** coché, puis **Publish**.

   *(En ligne de commande : `git init`, `git add .`, `git commit -m "Première version"`, puis les commandes affichées par GitHub.)*

   Le fichier `.gitignore` empêche d'envoyer `node_modules` et tes clés `.env.local`.

### Étape 3 : Vercel (mettre le site en ligne)

1. Va sur <https://vercel.com>, puis **Sign Up**, choisis **Hobby** (gratuit) et **Continue with GitHub**.
2. Clique sur **Add New…**, puis **Project**, et importe le dépôt `trading-hub`. Autorise l'accès à ce dépôt si Vercel le demande.
3. Avant de cliquer sur Deploy, ouvre **Environment Variables** et ajoute :

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ton Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ta Publishable key (`sb_publishable_…`) |

4. Clique sur **Deploy** et attends 1 à 2 minutes. Vercel te donne une adresse du type `https://trading-hub-xxxx.vercel.app`.
5. Ouvre cette adresse, connecte-toi avec l'e-mail et le mot de passe créés à l'étape 1.4. C'est fini.
6. Sur ton téléphone, ouvre la même adresse, puis :
   - iPhone : bouton **Partager**, puis **Sur l'écran d'accueil** ;
   - Android : menu **⋮**, puis **Ajouter à l'écran d'accueil**.

   Le site s'ouvre alors comme une application.

**Mises à jour du code** : chaque fois que tu publies une modification sur GitHub (Commit puis Push), Vercel remet le site à jour tout seul.

---

## Comment les données se mettent à jour

| Donnée | Source | Quand |
|---|---|---|
| Prix (6 mois en journalier, 15 ans en mensuel) | Yahoo Finance | À l'ouverture de la page si les prix ont plus de 4 h, ou avec le bouton **Refresh** |
| COT (3 ans) | CFTC, rapport Legacy futures only | Si le dernier rapport a plus de 6,5 jours (nouveau rapport chaque vendredi soir) |
| News de la semaine | ForexFactory | Toutes les heures au maximum |

- La pastille **Live** veut dire que les prix ont moins de 4 h. **Snapshot** veut dire que Yahoo n'a pas répondu et que tu vois la dernière copie enregistrée dans Supabase.
- Les paires croisées (EURJPY, GBPAUD…) sont calculées à partir des 7 paires USD.

## Les règles de calcul, en bref

- **Régime** : 6 tests (S&P et Nasdaq au-dessus de leur moyenne 20 jours, AUD/JPY au-dessus de sa moyenne 20 jours, VIX sous 20, VIX en baisse sur 5 jours, DXY en baisse sur 20 jours). 4 ou plus = RISK-ON, 2 ou moins = RISK-OFF, sinon MIXTE.
- **Force** : 50 % × 1 semaine + 30 % × 1 mois + 20 % × 3 mois, puis ramenée sur une échelle de 0 à 10.
- **Notes** : 5 signaux de +1, 0 ou −1. A = 4 ou 5 alignés, B = 3, C = 2.
- **Index COT** : (net − plus bas) / (plus haut − plus bas) × 100, sur 156 semaines (3 ans) et 26 semaines (6 mois).

Deux choix d'interprétation, faciles à changer dans [`lib/analysis.ts`](lib/analysis.ts) :

1. **Signal Force** : le seuil ±0,15 s'applique à l'écart de force **brut en %** (base − quote), pas à l'échelle 0–10. Sur l'échelle 0–10, un écart de 0,15 serait presque toujours franchi.
2. **NR4/NR7 sur les paires croisées** : Yahoo ne donne pas le plus haut et le plus bas des croisées. Le range est donc estimé avec la somme des ranges relatifs des deux paires USD. Pour les paires USD et les indices, c'est le vrai range.

## Lancer le site sur ton PC (facultatif)

1. Installe Node.js 20 ou plus récent (<https://nodejs.org>).
2. Copie `.env.example` en `.env.local` et remplis les 2 valeurs Supabase.
3. Dans ce dossier, lance `npm install`, puis `npm run dev`, et ouvre <http://localhost:3000>.

## Si quelque chose ne marche pas

- **« Prix Yahoo indisponibles »** : Yahoo bloque parfois les serveurs cloud pendant quelques minutes. Le site affiche alors le Snapshot. Réessaie **Refresh** un peu plus tard.
- **« ForexFactory : réponse illisible »** : ForexFactory limite le nombre d'appels. Le calendrier se recharge tout seul plus tard.
- **Impossible de se connecter** : vérifie que l'utilisateur est bien « Confirmed » dans Supabase > Authentication > Users, et que les 2 variables d'environnement Vercel sont correctes. Après une modification des variables, va dans **Deployments**, puis **⋯**, puis **Redeploy**.
- **Projet Supabase en pause** : sur l'offre gratuite, un projet sans aucune visite pendant 7 jours est mis en pause. Clique sur **Restore project** dans Supabase.

---

*Ce site est un filtre pour ton analyse, pas un signal pour trader à l'aveugle.*
