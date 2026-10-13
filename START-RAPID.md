# AGENT CITY OS v5 — Start rapid pe Android / Termux sau PC

1. Dezarhivează `agent-city-os-v5.zip`. Intră în folderul `agent-city-os`.
2. Verifică `node --version` (Node 20.6+; 22+ recomandat).
3. Rulează `cp .env.example .env`, apoi editează `.env` **local** (`nano .env`).
4. Schimbă `AGENT_CITY_ACCESS_TOKEN` cu un secret unic de minimum 32 caractere. NU-l scrie în chat. Pentru căutarea Remote OK și We Work Remotely nu ai nevoie de altă cheie.
5. Rulează `node --env-file=.env server.js` și deschide `http://127.0.0.1:3000` în browserul **aceluiași dispozitiv**.
6. În Hunter AI → **Caută anunțuri reale**, alege sursa și domeniul. Dacă vrei doar proiecte freelance, activează filtrul de contracte.
7. Pentru Freelancer.com ai nevoie de propriul token OAuth din portalul https://developer.freelancer.com/ — setează-l **doar** în `.env` ca `FLN_OAUTH_TOKEN` și repornește serverul. Fără token, Freelancer.com rămâne inactiv și nu pretindem că e conectat.
8. Pentru AI text, configurează `OPENAI_API_KEY` în `.env` (cost suplimentar). Pentru GitHub draft PR, configurează și `GITHUB_TOKEN` selectiv, conform README.

În mod demo, deschide fișierul separat `agent-city-os-v5-demo.html` (din pachet sau linkul conversației). Butoanele de căutare live și generare AI nu funcționează fără server.

**Atenție:** serverul rulează local, fără expunere publică; nu-l publica pe internet fără autentificare web adecvată. Nu există aplicare sau licitare automată, semnare, încasări și nici verificare live a anunțurilor în acest mediu de test. Datele proiectelor se salvează în browserul local; fă backup regulat.
