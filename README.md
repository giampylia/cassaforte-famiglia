# 🏠 Note di Famiglia (FamilyMemo)

Una webapp e sito web moderno, responsive e **installabile come app (PWA)** sul telefono di tuo figlio e di tua moglie, per lasciare loro memo, promemoria, liste di cose da fare e messaggi speciali con accesso immediato tramite icone sulla schermata iniziale.

---

## 🌟 Funzionalità Principali

- **Icone Famiglia sulla Home Page**: Grandi icone avatar per **Mio Figlio 👦**, **Mia Moglie ❤️**, **Famiglia 🏠** e **Tutti i Memo 👨**, con badge che indicano il numero di promemoria attivi per ciascuno.
- **Installabile come Vera App (PWA)**: Grazie a `manifest.json` e al Service Worker, tua moglie e tuo figlio possono installarla direttamente sulla schermata principale del loro smartphone con la sua icona dedicata.
- **Link Diretti per Ciascuno**:
  - `/#figlio` apre direttamente la bacheca del figlio con i suoi compiti e promemoria.
  - `/#moglie` apre direttamente i messaggi e le note per la moglie.
- **Post-It & Checklist Interattive**: Possibilità di creare memo colorati (giallo, rosa, azzurro, verde, viola), appuntare checklist spuntabili in tempo reale, fissare le note importanti in alto (📌) e impostare date di scadenza.
- **Sincronizzazione in Tempo Reale**: Quando scrivi una nota dal tuo computer o telefono, compare automaticamente anche sui loro telefoni connessi al Wi-Fi.
- **Funziona anche Offline**: Se manca la connessione o se la usi fuori casa, le note rimangono sempre consultabili grazie alla cache locale.
- **Condivisione Rapida**: Pulsante per inviare qualsiasi nota o il link all'app direttamente su WhatsApp.
- **Zero Dipendenze Esterne**: Il server Node.js è nativo al 100%, non necessita di installare pacchetti pesanti né build complesse.

---

## 🚀 Come Avviare l'App

Apri il terminale nella cartella del progetto:

```bash
cd /Users/giampiero/.gemini/antigravity/scratch/family-memos
npm start
```
*(oppure semplicemente: `node server.js`)*

Nel terminale vedrai comparire un messaggio chiaro come questo:
```
=================================================================
   🏠 NOTE DI FAMIGLIA (FamilyMemo) - WebApp Online!
=================================================================

💻 Sul tuo computer:
   👉 http://localhost:3000

📱 Sui telefoni di tua moglie e tuo figlio (stesso Wi-Fi):
   👉 http://192.168.1.xxx:3000

🔗 Link diretti per schermata Home:
   👦 Figlio:  http://192.168.1.xxx:3000/#figlio
   👩 Moglie:  http://192.168.1.xxx:3000/#moglie
=================================================================
```

---

## 📱 Come Installare l'Icona sui Telefoni di Moglie e Figlio

Tua moglie e tuo figlio devono essere connessi alla stessa rete Wi-Fi di casa:

### Opzione A: Con il QR Code (La più rapida)
1. Dal tuo computer, clicca sul pulsante **"Collega Telefoni"** in alto a destra nell'app.
2. Fai inquadrare il **QR Code** con la fotocamera del loro smartphone.
3. Clicca sulla notifica per aprire l'app nel browser del telefono.

### Opzione B: Con WhatsApp
1. Sempre dalla finestra "Collega Telefoni", tocca **"Invia su WhatsApp"** accanto al profilo del figlio o della moglie.
2. Verrà generato un messaggio con il link diretto già pronto da inviare loro.

### 📲 Mettere l'App sulla Schermata Home:
- **Su iPhone / iPad (Safari)**:
  1. Apri la pagina in Safari.
  2. Tocca l'icona di **Condivisione** in basso al centro (il quadrato con la freccia rivolta verso l'alto `⎋`).
  3. Scorri verso il basso e tocca **"Aggiungi alla schermata Home"**.
  4. Clicca su **"Aggiungi"** in alto a destra: comparirà l'icona dell'app come fosse un'app nativa!

- **Su Android (Chrome)**:
  1. Apri la pagina in Google Chrome.
  2. Tocca i tre puntini verticali **⋮** in alto a destra.
  3. Tocca **"Aggiungi a schermata Home"** oppure **"Installa app"**.

---

## 📂 Struttura dei File

```
family-memos/
├── server.js               # Server HTTP & REST API Node.js (zero dipendenze)
├── package.json            # Configurazione e comandi di avvio
├── data/
│   └── memos.json          # Archivio persistente delle note
├── public/
│   ├── index.html          # Interfaccia grafica con icone, filtri e dialoghi
│   ├── styles.css          # Design mobile-first, responsive e temi colorati
│   ├── app.js              # Logica sincronizzazione, filtri, PWA e azioni
│   ├── sw.js               # Service Worker per il funzionamento offline
│   ├── manifest.json       # Configurazione PWA per l'installazione su smartphone
│   └── icons/              # Icone grafiche SVG per app e profili
└── README.md               # Questa guida
```
