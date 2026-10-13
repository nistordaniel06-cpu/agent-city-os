# AGENT CITY OS v5 — Universal AI Agency HQ

**Un singur oraș interactiv pentru multe proiecte independente**, de la jocuri la e-commerce, aplicații, automatizări și proiecte freelance. Proiect separat, fără schimbări în Barbercraft, SalonOS sau alte repo-uri.

## Ce există în v4

- **Hunter AI — Oportunități:** citește la cerere feedul public JSON Remote OK și RSS We Work Remotely; separă mențiunile de contracte de angajări, calculează scor euristic, salvează shortlist, permite introducere manuală a anunțurilor și generează oferte-text prin AI cu confirmare umană. Nu aplică, nu contactează și nu trimite mesaje. Feedurile pot conține în special POSTURI, nu contracte freelance.
- Orașul interactiv și gestionarea locală a proiectelor, misiunilor și agenților, cu backup JSON.
- Agenți text prin OpenAI API la cerere (planificare, cercetare, marketing, QA, Developer etc.).
- **Developer → GitHub (MVP funcțional la configurare):** selectezi un proiect cu un repo GitHub, creezi o misiune cu rol `Developer`, specifici 1–3 fișiere existente, agentul citește DOAR acele fișiere, AI propune conținutul complet schimbat, tu examinezi propunerea și trebuie să apeși **Aprob și creez draft PR**, apoi să confirmi dialogul. Serverul creează un branch nou, un commit, apoi un **draft pull request**. Nu schimbă `main`, nu face merge și nu face deploy.
- Înainte de publicare, serverul verifică dacă branch-ul de bază a rămas la același commit; în caz contrar respinge propunerea.
- Teste `node --test`, inclusiv simularea completă prepare → explicit approve → draft PR.

**Limită actuală:** Nu rulează proiectul, nu instalează dependențe și nu execută teste ale codului generat pe server. După draft PR, rulează GitHub Actions din repo-ul țintă (dacă există) și verifică manual review-ul/CI. Nu generează automat site-uri întregi în acest flux; editează 1–3 fișiere text existente, până la 16 KB per fișier-sursă. Creația de proiecte complet noi din brief și trimiterea controlată a ofertelor ar necesita fluxuri separate (trimiterea nu este implementată).

## Start — demo fără chei

Deschide `index.html` în browser sau folosește `node server.js`. Proiectele/misiunile sunt salvate doar în `localStorage` al acelui browser; nu se sincronizează între dispozitive. Demo-ul HTML funcționează fără backend, dar nu poate apela AI, GitHub sau feedurile live Hunter. Poți adăuga oportunități manual și salva schițe.

### Hunter AI (read-only)

1. Din interfață apasă **🔎 Hunter AI** sau clădirile **Research Lab / Trading Hub**.
2. Apasă **Caută anunțuri publice**, alege domeniul și cuvintele de interes. Pentru căutări reale pornește serverul (necesită numai `AGENT_CITY_ACCESS_TOKEN`; OPENAI_API_KEY este necesară doar pentru drafturi AI).
3. Deschide anunțul **direct la sursa originală** pentru verificarea bugetului, datei, eligibilității și statutului contract/freelance.
4. **Salvează oportunitatea**, apoi **Pregătește oferta** pentru unul dintre proiectele tale. Pentru AI folosește profilul proiectului; nu inventa experiență în descriere. Alternativ folosește un șablon editabil fără AI.
5. Editează și aprobă textul, apoi **copiază-l** și aplică TU pe site-ul sursei. Aprobarea internă NU expediază nimic.

Sursele documentate permit redistribuirea feedurilor cu atribuire: [Remote OK FAQ](https://remoteok.com/faq), [We Work Remotely RSS](https://weworkremotely.com/remote-job-rss-feed). Nu colectăm anunțuri din platforme cu acces privat, nu încercăm ocolirea controalelor anti-bot. Dacă sursele nu răspund, sistemul raportează eroarea și nu inventează rezultate. Rezultatele nu dovedesc disponibilitatea contractului.


## Start — agenți reali și GitHub

1. Instalează **Node.js 20+** (22 recomandat). Nu necesită `npm install`.
2. Copiază `.env.example` în `.env` și configurează:
   - `OPENAI_API_KEY` — cheia pentru generarea de propuneri Developer/Hunter; poate genera costuri API. **Opțională** dacă vrei doar să cauți feedurile Hunter.
   - `AGENT_CITY_ACCESS_TOKEN` — token unic, ales de tine, de minimum 32 de caractere (nu folosi aceeași cheie ca la OpenAI).
   - `GITHUB_OWNER=nistordaniel06-cpu` — numai repo-uri ale acestui owner pot fi țintă.
   - `GITHUB_TOKEN` — fine-grained Personal Access Token de pe GitHub. Selectează **numai repo-urile** pe care vrei să lucreze agentul; permisiuni `Contents: Read and write`, `Pull requests: Read and write`, `Metadata: Read`. Nu acorda acces la repo-uri pe care nu vrei să le poată edita. Tokenul GitHub este folosit doar de server.
3. Pornește din folderul proiectului:

   ```bash
   node --env-file=.env server.js
   ```

4. Accesează `http://127.0.0.1:3000` pe același calculator/telefon.
5. Creează **un proiect**, completează URL-ul `https://github.com/nistordaniel06-cpu/nume-repo` și salvează-l.
6. Creează misiune cu rol **Developer**: de ex. „În README, explică instalarea aplicației pe Android”.
7. Apasă **Pregătește patch GitHub** și introdu `README.md` sau până la trei căi **existente**, câte una pe linie.
8. Verifică fiecare fișier generat. Dacă nu îți convine, NU publica. Poți regenera o propunere.
9. Numai dacă ești de acord, apasă **Aprob și creez draft PR**, apoi confirmă. Deschide PR-ul pentru review și verificări CI. **Niciodată merge automat.**

**Nu pune cheile în interfață**, în descrierea misiunii sau în repository. Dialogul browserului solicită doar `AGENT_CITY_ACCESS_TOKEN`, temporar în memoria tabului. `.env` este inclus în `.gitignore`.

## Siguranță și limite

- Serverul ascultă implicit doar pe `127.0.0.1`. Nu îl expune public, nu folosi `HOST=0.0.0.0` fără HTTPS, identitate, protecții pentru utilizatori și rate limiting distribuit. Un bearer token nu echivalează cu autentificare web completă.
- Numai repo-uri ale `GITHUB_OWNER`; tokenul este limitat de permisiunile pe care le-ai acordat pe GitHub.
- Numai fișiere text existente `.js`, `.jsx`, `.ts`, `.tsx`, `.css`, `.html`, `.json`, `.md`, `.txt`, `.py`, `.sql`, `.yml`, `.yaml`; blocăm `.github`, `.git`, `.env`, `package.json`, lockfile-uri, build și căi periculoase.
- O propunere rămâne valabilă doar **30 de minute** și se pierde la restartarea serverului; aprobarea este explicită și de unică folosință.
- Fără execuție shell, fără acces la SSH, fără `git push` către `main`, fără tranzacții, fără trimitere de mesaje, fără candidaturi, fără deploy.
- Conținutul din GitHub este transmis modelului AI pentru generarea propunerii; **nu include date confidențiale/chei în fișierele selectate**. Agentul poate greși: verifică modificările înainte și după crearea PR-ului.
- `OPENAI_API_KEY` este facturat separat de ChatGPT. `MAX_RUNS_PER_DAY` limitează drafturile text; pregătirile GitHub sunt limitate separat la 5/zi per proces, nu reprezintă un plafon în lei.
- Dacă o operație GitHub eșuează după crearea unui branch, acesta poate rămâne pe GitHub fără un PR. Verifică branch-urile `agent-city/*` înainte să reîncerci.

- Feedurile publice sunt consultate numai la cerere și păstrate în cache 20 de minute; 80 rezultate maxime per cerere. Nu este un crawler sau o rețea de scraping.
- **Fără cheie AI**, se pot salva oportunități și redacta manual propuneri. **Cu cheie AI**, maximum 8 drafturi Hunter pe zi pentru procesul server.
- Profilurile și textul anunțurilor sunt trimise API-ului modelului doar la apăsarea butonului de generare ofertă.
- Stocarea oportunităților este locală în browser, separat de backupul proiectelor; folosește **Exportă oportunități** înainte de resetarea browserului.

## Verificări

```bash
npm test
node --check server.js
node --check github-developer.js
node --check multiproject.js
node --check hunter.js
node --check hunter-ui.js
```

## Publicare în repo separat

1. În GitHub creează un repo privat nou `agent-city-os` (nu în `salon-os`, `barber-booking`, `nearcut` etc.).
2. În folderul extras al acestui ZIP, fără `.env`, rulează:

```bash
git init -b main
git add .
git commit -m "feat: agent city os v4 with hunter feed and approved developer"
git remote add origin https://github.com/nistordaniel06-cpu/agent-city-os.git
git push -u origin main
```

3. GitHub Actions rulează testele din `.github/workflows/tests.yml` la commituri și PR-uri în acel repo.

**Notă:** conectarea contului GitHub la ChatGPT nu oferă automat serverului local un GITHUB_TOKEN; tokenul trebuie creat în GitHub și păstrat numai în `.env`. Nu trimite tokenul în chat.

## Roadmap

- Worker de test într-un sandbox izolat + PR cu diff complet, comentarii și limite de cost.
- Extinderea Hunter cu surse specializate în proiecte **contract/freelance**, numai unde există API/permisiuni clare.
- Relevanță în funcție de portofoliul real, estimări de efort documentate și registrul ofertelor trimise manual.
- DB online cu utilizatori, permisiuni, audit și acces mobil multi-dispozitiv.
- Mai multe repo-uri și agenți pe proiect, dashboard de costuri, rulări programate.

## Agent City OS v5 — Conectori de oportunități

### Conectări pe care le-am implementat

- Remote OK: feed public `GET https://remoteok.com/api`, fără cheie, doar de pe server.
- We Work Remotely: RSS public `GET https://weworkremotely.com/categories/remote-programming-jobs.rss`, fără cheie, doar de pe server.
- **Freelancer.com (opțional):** API oficial `GET /api/projects/0.1/projects/active/` cu interogare text și token OAuth2. Tokenul se păstrează în `.env` în `FLN_OAUTH_TOKEN` și **nu** se introduce în browser sau în chat. Fără token, opțiunea Freelancer.com este dezactivată și afișată explicit drept neconectată; celelalte feeduri pot funcționa fără el.
- Filtru „doar proiecte/contracte”, salvare și estimare cost. Estimările folosesc DOAR valorile introduse de utilizator; moneda nu se convertește automat.

Documentație oficială pentru autorizare și API:

- https://developer.freelancer.com/ — developer portal
- https://github.com/freelancer/freelancer-sdk-python — SDK oficial; utilizează headerul `Freelancer-OAuth-V1` și endpointul `projects/active`.
- https://remoteok.com/faq — feedul public gratuit.
- https://weworkremotely.com/remote-job-rss-feed — RSS public cu atribuire.

### Ce mai trebuie făcut pe dispozitivul tău

1. Rulează `node --env-file=.env server.js` din folderul extras. `AGENT_CITY_ACCESS_TOKEN` trebuie să fie setat pentru cererile Hunter; folosește un șir unic de minimum 32 caractere.
2. Accesează `http://127.0.0.1:3000` **de pe același dispozitiv**. Mergi la Hunter AI → „Caută anunțuri reale”.
3. Pentru Freelancer.com, obține acces în portalul developer Freelancer.com și un token OAuth valabil, introdu-l local în `.env` ca `FLN_OAUTH_TOKEN`, apoi repornește serverul. Nu dezvălui tokenul în chat.
4. Pentru drafturi AI completează `OPENAI_API_KEY`, dar acesta poate genera costuri suplimentare. Fără cheia OpenAI poți folosi șablonul manual și estimările.
5. Pentru draft PR prin Developer AI, configurează tokenul GitHub strict pentru repository-urile selectate, conform instrucțiunilor v4. Conectarea GitHub din ChatGPT nu se propagă automat serverului din ZIP.

**Stare:** implementare și teste locale finalizate, fără credentiale reale în arhivă, fără deploy public și fără transmiterea de oferte. Conectarea contului Freelancer.com are nevoie de aprobarea și autentificarea ta. Nu promitem că anunțurile sunt încă deschise; verifică întotdeauna site-ul sursă. Backend-ul nu are worker permanent și nu monitorizează de la sine în fundal.
