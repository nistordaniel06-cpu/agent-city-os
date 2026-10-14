# AGENT CITY OS v5 — Universal AI Agency HQ

**Un singur oraș interactiv pentru multe proiecte independente**, de la jocuri la e-commerce, aplicații, automatizări și proiecte freelance. Proiect separat, fără schimbări în Barbercraft, SalonOS sau alte repo-uri.

## 🛡️ Agent Code Reviewer — OpenCodeReview + Groq

**OpenCodeReview** este un utilitar specializat în analiza codului, nu un model AI suplimentar. Acest proiect folosește versiunea din fork-ul `nistordaniel06-cpu/open-code-review` (GitHub Action fixată la SHA) cu `@alibaba-group/open-code-review` fixat la versiunea `1.13.0`, iar **Groq** furnizează modelul de analiză `openai/gpt-oss-20b`.

- Workflow: [Code Reviewer (OpenCodeReview + Groq)](https://github.com/nistordaniel06-cpu/agent-city-os/actions/workflows/code-review-groq.yml), fișier `.github/workflows/code-review-groq.yml`.
- Evenimente: PR nou, actualizat, redeschis sau scos din draft, numai pentru branch-uri **din același repository** (nu din fork-uri). Nu rulează codul propus de PR și nu execută merge.
- Rezultat: observații de revizuire și rezumat pe PR, în GitHub. Nu considera `success` drept confirmarea că nu există defecte; verifică observațiile manual.
- În aplicația Agent City OS apare un agent suplimentar **OpenCodeReview** → `PR Reviews` cu PR-urile deschise și ultimele rulări GitHub Actions, numai pentru `agent-city-os` momentan. Datele sunt publice, citite din GitHub API, și se pot limita de rate limiting.

### Pas obligatoriu — cheia Groq pentru GitHub Actions

Cheia Groq din **Vercel** este disponibilă aplicației web, dar **nu și GitHub Actions**. Adaugă manual un secret separat, fără a-l partaja în chat:

1. Deschide [GitHub → agent-city-os → Actions Secrets](https://github.com/nistordaniel06-cpu/agent-city-os/settings/secrets/actions).
2. Apasă **New repository secret** și creează `OCR_GROQ_API_KEY` cu cheia Groq din contul tău. Folosește o cheie separată dacă dorești să poți revoca accesul doar acestui reviewer.
3. La următorul PR eligibil, workflow-ul rulează OpenCodeReview și lasă observații pe PR. Fără secret, workflow-ul **eșuează explicit**, fără a expune sau încerca automat cheia OpenAI.
4. Modelul și bugetul sunt configurate în workflow: un singur review la un moment dat per PR, `max_tokens_budget: 8000`, fără retry automat către un furnizor cu plată. Cotele și disponibilitatea Groq pot limita sau opri temporar analiza.

### Aprobarea înainte de merge

**Nici agentul și nici workflow-ul nu fac merge automat**. O persoană verifică observațiile și apasă manual `Merge pull request` numai după ce acceptă schimbările.

Pentru a **impune tehnic** această regulă și altor colaboratori/integrări, activează în [GitHub Rulesets](https://github.com/nistordaniel06-cpu/agent-city-os/settings/rules) o regulă pe `main`: Require a pull request; Require status checks (`test` și Code Reviewer, după prima rulare); Require approvals (1+ când există alt reviewer autorizat); restricționează bypass-urile. Această politică **nu este configurată automat** de integrare. Un utilizator GitHub nu poate aproba propriul PR cu funcția standard de review, deci planifică separat cine aprobă, dacă impui 1+ aprobări.

**Limită MVP:** integrarea nu instalează workflow-uri și pe Barbercraft, SalonOS sau alte repo-uri. Nu citește depozite private în interfața publică.

## Groq AI — motor principal fără dependență de creditele OpenAI

Agent City OS suportă **Groq** și **OpenAI** printr-un adaptor comun pentru misiunile AI și ofertele Hunter. Developer AI folosește același furnizor pe serverul local, dar crearea PR-urilor rămâne **dezactivată pe Vercel** până la stocarea persistentă a aprobărilor. Agenții nu trimit mesaje sau aplicații automat.

### Activează Groq în Vercel (echipa 4-men, proiect agent-city-os)

1. Creează o cheie în [Groq Console — API Keys](https://console.groq.com/keys). **Nu trimite cheia în chat și nu o include în repo.**
2. În Vercel → Project → Settings → Environment Variables → **Production**, adaugă:
   - `AI_PROVIDER=groq` — alegerea explicită a motorului (fără fallback către OpenAI).
   - `GROQ_API_KEY` — valoarea cheii tale Groq, **Sensitive**.
   - Opțional `GROQ_MODEL=openai/gpt-oss-20b` — modelul implicit; alege numai modele disponibile în contul tău.
3. Fă **Redeploy** la producție după ce ai salvat toate variabilele. Cheia OpenAI rămâne separată și nu este apelată când alegi Groq. `AGENT_CITY_ACCESS_TOKEN` rămâne obligatoriu pentru a proteja operațiunile private.
4. Deschide `/api/health`: trebuie să vezi `aiProvider:"groq"` și `aiConfigured:true`. Endpointul verifică doar configurarea, **nu validitatea cheii**. Pentru test real, execută manual o misiune sau un draft Hunter.
5. Contul gratuit Groq are limite de cereri/tokenuri; la 429 aplicația arată un mesaj despre limită și **nu încearcă OpenAI**. Un apel real necesită cheia și un model activ, iar planul/limitele se pot schimba.

Poți reveni la OpenAI numai când alegi explicit `AI_PROVIDER=openai` și configurezi billing API. Nu există comutare automată către modele cu plată.

Documentație Groq: [compatibilitate API](https://console.groq.com/docs/openai), [modele](https://console.groq.com/docs/models), [limite](https://console.groq.com/docs/rate-limits).


## Ce există în v4

- **Hunter AI — Oportunități:** citește la cerere feedul public JSON Remote OK și RSS We Work Remotely; separă mențiunile de contracte de angajări, calculează scor euristic, salvează shortlist, permite introducere manuală a anunțurilor și generează oferte-text prin AI cu confirmare umană. Nu aplică, nu contactează și nu trimite mesaje. Feedurile pot conține în special POSTURI, nu contracte freelance.
- Orașul interactiv și gestionarea locală a proiectelor, misiunilor și agenților, cu backup JSON.
- Agenți text prin Groq / OpenAI API la cerere (planificare, cercetare, marketing, QA, Developer etc.).
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


## Agent City Hunter — client discovery (V6)

New **Hunter daily client signals** action runs automatically once a day (07:17 UTC) or when scouting source code/workflow changes are pushed to `main`. It reads fixed public sources: Reddit r/forhire RSS **[Hiring]/[Task]/[Paid]** posts and Hacker News search via the documented Algolia HN API. No scraping private accounts, mass messaging, AI key, or Freelancer credentials. Candidates are **unverified leads**, not signed contracts.

- Results: `public/leads-daily.json` (a **public** report in this **public** GitHub repository). Excerpted email addresses are redacted.
- In the UI, open **Hunter AI → 🎯 Caută clienți (zilnic)** to filter/sort and save relevant signals.
- În versiunea Vercel, interfața încearcă întâi raportul public actualizat de pe `raw.githubusercontent.com/nistordaniel06-cpu/agent-city-os/main/public/leads-daily.json`. Dacă GitHub este indisponibil sau raportul e invalid, folosește copia din deployment și o etichetează ca posibil veche. Așa, commiturile automate nesemnate nu împiedică afișarea raportului proaspăt, chiar dacă Vercel le anulează. Repo-ul trebuie să rămână public pentru acest flux fără autentificare.
- Github Actions: `.github/workflows/hunter-daily.yml` (`workflow_dispatch` is supported). If the Action cannot commit, enable `Workflow permissions: Read and write` in repository Settings → Actions → General; do not supply tokens to the chat.
- If all providers fail, the previous report is preserved and Actions reports a failure. Partial upstream errors are included in the digest.
- **Nobody is contacted automatically.** Every lead must be checked at the source and the owner must approve any offer.
- The daily workflow does not run AI generation: this is intentionally low-cost, read-only discovery. Freelancer.com remains optional via OAuth on the private server.

**Business strategy:** use client projects for near-term revenue, and turn repeated verified client pain points into subscription products. No guaranteed clients or income. Vercel Hobby is not licensed for commercial production use: review the hosting plan before taking payments.

## Hunter Sales Pipeline v1 — din lead public în ofertă urmărită

- În **Hunter AI → Sales Pipeline**, salvezi o oportunitate publică sau introduci manual un anunț verificat.
- Butonul **📋 Pipeline / următorul pas** deschide etapa, prioritatea (ridicată/normală/scăzută), data următoarei acțiuni și notițele tale.
- Etape: **Salvat → Calificat → Ofertă în lucru → Aprobat pentru trimitere manuală → Trimis manual → De urmărit → Câștigat/Pierdut/Respins**. Sunt actualizate exclusiv de utilizator; aplicația cere confirmare pentru etapele care presupun acțiuni reale.
- În dashboard poți filtra după etapă, vedea acțiunile restante și prioritiza leadurile după data de urmărit, prioritatea manuală și scorul euristic.
- **Niciun mesaj sau ofertă nu se expediază automat**. Stările nu confirmă independent un contract. Datele salvate, notițele și termenele sunt în `localStorage` pe dispozitivul curent; exportă JSON pentru backup. Nu există încă sincronizare, notificări push sau inbox conectat.
- Pentru verificări: `npm test` și `node --check hunter-ui.js`. Nu este necesară o cheie AI pentru pipeline-ul manual.

## Misiuni globale vs. misiuni pe proiect (Agency Mission Board)

- Butonul **+ MISIUNE NOUĂ** pornește cu domeniul **🌐 Agenția AI — misiune globală**: cercetare generală, selecție clienți, strategie și operațiuni, fără asociere forțată cu proiectul selectat în bara de sus.
- În formular poți alege explicit **📁 Doar proiectul selectat**. Pentru misiuni începute din pagina unui proiect, acesta este contextul implicit. Proiectele rămân izolate.
- **Misiunile agenției** și **Misiunile proiectului** au file separate în Mission Board. Misiunile deja create nu își schimbă automat proiectul.
- O misiune de proiect în așteptare sau eșuată poate fi mutată manual la agenție, fără să afecteze celelalte misiuni. Pentru misiunile globale poți activa sau dezactiva partajarea datelor Hunter.
- **Hunter nu este sincronizat automat cu AI-ul**: numai dacă bifezi «Include oportunitățile Hunter salvate» sau activezi opțiunea din detalii, se trimite la următoarea execuție un sumar de maximum 10 anunțuri din acest browser (titlu, descriere scurtă, sursă, etapă, scor). Nu se trimit notițe private, tokenuri sau toate datele brute.
- Dacă nu atașezi date Hunter, agentului i se comunică explicit că nu le poate vedea. Rezultatele sunt propuneri text, nu analize confirmate ale unor leaduri inaccesibile.
- Back-upurile JSON schema 2 exportă și reimportă misiunile globale fără a le atribui proiectelor demo.

## Admin panel + HyAgent (Tencent Hy-MT2)

Agent City OS include un **Admin Control Center** separat la [`/admin`](https://agent-city-os-4-men.vercel.app/admin). Este pentru proprietarul agenției, nu pentru vizitatori. Tokenul `AGENT_CITY_ACCESS_TOKEN` este introdus explicit, verificat pe server la `GET /api/admin/status` și păstrat **doar în memoria paginii**; nu se salvează în `localStorage`, fișier sau URL. Fără token, pagina statică de autentificare este vizibilă, însă API-ul administrativ răspunde HTTP 401.

Panoul oferă: status real pentru Groq / OpenAI, configurare HyAgent, limite orientative, listă și actualizare manuală a stării proiectelor, misiuni și aprobare individuală a **livrabilelor text** din browser, agenți locali marcați DEMO, linkuri GitHub/Vercel și export JSON local (fără chei). **Nu face merge, nu trimite oferte, nu acceptă contracte și nu modifică automat repository-uri.**

**Limitare:** proiectele și misiunile sunt stocate în browser (`localStorage`), nu într-o bază de date. Admin-ul vede doar datele din acel browser și de pe acel domeniu. Nu există încă conturi multiple, sincronizare între dispozitive, RBAC sau rapoarte centralizate de consum. Contoarele API din Vercel serverless sunt pe instanța curentă. Pentru producție multi-user trebuie introdus un storage persistent și auth distinct pentru rolurile owner/staff.

### Ce este HyAgent

Repository-ul [`nistordaniel06-cpu/hyagent`](https://github.com/nistordaniel06-cpu/hyagent) conține **Tencent Hy-MT2**, o familie de modele pentru traduceri (1.8B, 7B și 30B-A3B), nu un agent general sau un API gratuit gata de utilizat. Un proiect GitHub conține cod și documentație, **nu înseamnă că modelul este instalat și găzduit**.

Am integrat un adaptor separat `hyagent.js` cu validarea cererilor și un tab Admin → **HyAgent · traducere**. În Vercel nu se descarcă modelul și nu pornim infrastructură GPU costisitoare. Pentru traduceri reale trebuie să rulezi Hy-MT2 pe un serviciu de inferență extern compatibil OpenAI Chat Completions (vLLM/alt gateway configurat corect), care permite apeluri la `/v1/chat/completions`. Atenție la limite de memorie și licența modelului.

### Configurarea HyAgent în Vercel

Adaugă în proiectul `4-men/agent-city-os` → Settings → Environment Variables → Production:

- `HYAGENT_API_BASE_URL` — URL HTTPS public al serviciului tău de inferență, până la `/v1` (de exemplu **schematic**, nu serviciu activ: `https://inference.example/v1`). Nu sunt permise adrese locale / private și credențiale în URL.
- `HYAGENT_MODEL` — numele modelului expus de server, implicit `tencent/Hy-MT2-1.8B` (poate diferi de numele din API-ul furnizorului).
- `HYAGENT_API_KEY` — dacă serviciul cere autentificare; configurează valoarea ca **Sensitive**, fără să o trimiți în chat sau să o publici în GitHub.

Salvează și fă Redeploy, apoi intră în `/admin`, autentifică-te cu tokenul existent și testează traducerea. Dacă nu ai încă serverul Hy-MT2, statusul trebuie să arate **Neconfigurat**. Nu există comutare automată către Groq sau OpenAI: erorile modelului Hy sunt afișate fără costuri ascunse pe alți furnizori. `MAX_TRANSLATIONS_PER_DAY` poate limita numărul de traduceri reușite pe instanță (implicit 15), dar nu constituie un control de cost global pe toate instanțele Vercel.

### Code Reviewer este separat

OpenCodeReview + Groq este în [PR #9](https://github.com/nistordaniel06-cpu/agent-city-os/pull/9), care **nu este integrat automat** prin această modificare. Nu există auto-merge; aprobarea unui livrabil în admin nu aprobă un GitHub PR. Workflow-urile de GitHub Actions și Ruleset-urile de protecție necesită configurări specifice.
