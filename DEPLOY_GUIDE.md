# 🛡️ Guida di Avvio e Pubblicazione Cloud: "Cassaforte di Famiglia"

Una webapp protetta con **crittografia forte AES-256-GCM**, design **Neumorfico a 2 colori** (ispirato all'immagine di riferimento) e tasti dedicati a **PW**, **BANCA**, **INFO CASE** più slot pronti per future sezioni.

---

## 1. Provala subito sul tuo Mac

Il server locale è attivo e in ascolto:
👉 **[http://localhost:3002](http://localhost:3002)**

### Al primo avvio:
1. Ti verrà chiesto di scegliere la **Master Password di Famiglia** (che conoscerete solo tu, tua moglie e tuo figlio).
2. L'app genererà le chiavi crittografiche nel tuo browser e aprirà la bacheca neumorfica con:
   - 🔑 **PW**: credenziali (SPID, email, PIN) con valore oscurato e tasto rapido **"Copia"**.
   - 🏛️ **BANCA**: conti correnti, **IBAN con tasto "Copia"**, intestatari e istruzioni di accesso.
   - 🏠 **INFO CASE**: utenze (luce, gas, acqua, internet), codici cliente/fornitore e dove trovare contratti e chiavi fisiche a Cagliari.
   - ➕ **AGGIUNGI**: per inserire nuove voci in qualsiasi momento.
   - **5 Slot pronti**: pozzetti neumorfici predisposti per future sezioni ("in un secondo momento").

---

## 2. Come renderla disponibile su Internet per tuo figlio a Milano e tua moglie (Gratis in 2 Minuti)

Dato che tuo figlio vive a Milano e tu a Cagliari, per non dipendere dal tuo computer di casa l'app deve essere online su un indirizzo web sicuro HTTPS permanente (accessibile 24 ore su 24, 7 giorni su 7 su rete cellulare 4G/5G o Wi-Fi).

Il progetto è già configurato con `vercel.json` e la funzione serverless `api/vault.js`.

### Metodo più rapido e gratuito (Vercel):
1. Vai su [vercel.com](https://vercel.com) e accedi gratis (anche con account Google o GitHub).
2. Trascina semplicemente la cartella `/Users/giampiero/.gemini/antigravity/scratch/family-memos` oppure installa la riga di comando:
   ```bash
   npx vercel
   ```
3. In meno di un minuto otterrai un vero indirizzo pubblico sicuro, ad esempio:  
   👉 **`https://cassaforte-famiglia.vercel.app`**

*(Anche se il sito è pubblico su Internet, **tutti i dati sono cifrati matematicamente in locale con AES-256**: nessuno, compresi i server di Vercel, può leggere una sola password o IBAN senza la vostra Master Password).*

---

## 3. Come metterla sul Telefono di Figlio e Moglie (Schermata Home)

Invia loro l'indirizzo web. Appena lo aprono:
- **Su iPhone (Safari)**:
  1. Toccare l'icona di **Condivisione** in basso (quadrato con freccia verso l'alto `⎋`).
  2. Scegliere **"Aggiungi alla schermata Home"**.
  3. Cliccare **"Aggiungi"**: comparirà l'icona dell'app come fosse un'applicazione nativa.
- **Su Android (Chrome)**:
  1. Toccare i tre puntini verticali `⋮` in alto a destra.
  2. Scegliere **"Aggiungi a schermata Home"** o **"Installa app"**.

---

## 4. Esportazione Backup Offline
In qualsiasi momento, premendo il pulsante **"Esporta Backup"** in basso a destra nella schermata principale della cassaforte, puoi scaricare il file JSON contenente tutti i dati cifrati da conservare su una chiavetta USB o archivio personale.
