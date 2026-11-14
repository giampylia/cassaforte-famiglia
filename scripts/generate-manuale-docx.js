const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const PImage = require('pureimage');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ImageRun,
  TextDirection,
  HeightRule,
  VerticalAlign,
} = require('docx');

const logoPath = path.join(__dirname, '..', 'public', 'logo-associazione-qu3.png');
const outDocxPath = path.join(__dirname, '..', 'Manuale_Uso_Q3_Universita_Terza_Eta.docx');
const artifactDocxPath = '/Users/giampiero/.gemini/antigravity/brain/7c622b26-6eeb-4963-a401-9545434e7674/Manuale_Uso_Q3_Universita_Terza_Eta.docx';
const desktopDocxPath = '/Users/giampiero/Desktop/Manuale_Uso_Q3_Universita_Terza_Eta.docx';

let logoBuffer = null;
if (fs.existsSync(logoPath)) {
  logoBuffer = fs.readFileSync(logoPath);
}

// Stili colori
const COLOR_PRIMARY = '065F46'; // Emerald scuro
const COLOR_SECONDARY = '047857'; // Emerald medio
const COLOR_GOLD = 'B45309'; // Oro caldo
const COLOR_TEXT = '1E293B'; // Slate 800
const COLOR_MUTED = '64748B'; // Slate 500
const COLOR_BG_LIGHT = 'F1F5F9';

// Setup font per pureimage (rendering testo verticale 90° ad alta risoluzione)
const fontPath = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
let fontLoaded = false;
try {
  const font = PImage.registerFont(fontPath, 'ArialBold');
  font.loadSync();
  fontLoaded = true;
} catch (e) {
  console.warn('Avviso caricamento font:', e.message);
}

const roleImages = {};
async function generateRotatedHeaderPng(role) {
  // Dimensioni canvas ad alta risoluzione per caratteri grandi e nitidi in Word e Pages
  const width = 96;
  const height = 480;
  const img = PImage.make(width, height);
  // Sfondo trasparente per integrarsi perfettamente nella cella di Pages e Word
  for (let i = 0; i < img.data.length; i++) img.data[i] = 0;

  const ctx = img.getContext('2d');
  ctx.save();
  // Traslazione in basso e rotazione di 90° in senso antiorario (-Math.PI / 2)
  // In questo modo il testo si legge dal basso verso l'alto con baseline a destra
  ctx.translate(width / 2, height - 20);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '42pt ArialBold';
  ctx.fillStyle = '#0F172A'; // Slate scuro molto marcato e leggibile
  ctx.fillText(role, 0, 14);
  ctx.restore();

  const stream = new PassThrough();
  const chunks = [];
  stream.on('data', (c) => chunks.push(c));
  await PImage.encodePNGToStream(img, stream);
  return Buffer.concat(chunks);
}

async function initRoleImages() {
  const roles = [
    'CD',
    'SOCIO',
    'SEGRETERIA',
    'AMMINISTRATIVO',
    'DIDATTICA',
    'VIAGGI',
    'AMMINISTRATORE',
    'PRESIDENZA',
    'LEZIONI SUL CAMPO',
  ];
  for (const role of roles) {
    roleImages[role] = await generateRotatedHeaderPng(role);
  }
}

function createTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        size: 38, // 19pt
        bold: true,
        color: COLOR_PRIMARY,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createSubtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360 },
    children: [
      new TextRun({
        text,
        size: 26, // 13pt
        italics: true,
        color: COLOR_GOLD,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
    children: [
      new TextRun({
        text,
        size: 30, // 15pt
        bold: true,
        color: COLOR_PRIMARY,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({
        text,
        size: 24, // 12pt
        bold: true,
        color: COLOR_SECONDARY,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createHeading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text,
        size: 22, // 11pt
        bold: true,
        color: COLOR_TEXT,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createParagraph(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: { before: 80, after: 80, line: 276 }, // 1.15 interlinea
    children: [
      new TextRun({
        text,
        size: options.size || 21, // 10.5pt
        bold: options.bold || false,
        italics: options.italics || false,
        color: options.color || COLOR_TEXT,
        font: 'Segoe UI',
      }),
    ],
  });
}

function createBullet(text, boldPrefix = '') {
  const children = [];
  if (boldPrefix) {
    children.push(
      new TextRun({
        text: boldPrefix,
        bold: true,
        size: 21,
        color: COLOR_PRIMARY,
        font: 'Segoe UI',
      })
    );
  }
  children.push(
    new TextRun({
      text,
      size: 21,
      color: COLOR_TEXT,
      font: 'Segoe UI',
    })
  );

  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40, line: 260 },
    children,
  });
}

function createCallout(title, text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: 'ECFDF5' }, // Verde chiarissimo
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 24, color: COLOR_PRIMARY },
            },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: `📌 ${title}`,
                    bold: true,
                    size: 21,
                    color: COLOR_PRIMARY,
                    font: 'Segoe UI',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text,
                    size: 20,
                    color: COLOR_TEXT,
                    font: 'Segoe UI',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createPermissionsMatrixTable() {
  const roles = [
    'CD',
    'SOCIO',
    'SEGRETERIA',
    'AMMINISTRATIVO',
    'DIDATTICA',
    'VIAGGI',
    'AMMINISTRATORE',
    'PRESIDENZA',
    'LEZIONI SUL CAMPO',
  ];

  const rowsData = [
    { label: 'ANAGRAFICA', perms: ['🟡', '🔴', '🟢', '🟡', '🔴', '🔴', '🟢', '🟡', '🔴'] },
    { label: 'TIMBRATURE', perms: ['🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢'] },
    { label: 'GESTIONE AULE', perms: ['🔴', '🔴', '🟡', '🟡', '🟢', '🔴', '🟢', '🟡', '🔴'] },
    { label: 'BIBLIOTECA', perms: ['🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢'] },
    { label: 'LEZIONI SUL CAMPO', perms: ['🟡', '🔴', '🟡', '🟡', '🟡', '🟢', '🟢', '🟡', '🟢'] },
    { label: 'PRENOTAZIONI', perms: ['🟢', '🟡', '🟢', '🟢', '🟡', '🟢', '🟢', '🟢', '🟡'] },
    { label: 'AVVISI VIDEO', perms: ['🟢', '🔴', '🔴', '🔴', '🔴', '🔴', '🟢', '🟡', '🔴'] },
    { label: 'ELIMINA CODE', perms: ['🔴', '🔴', '🟢', '🔴', '🔴', '🔴', '🟢', '🟡', '🔴'] },
    { label: 'PICCOLA CASSA', perms: ['🟢', '🔴', '🔴', '🟢', '🔴', '🔴', '🟢', '🟡', '🔴'] },
    { label: '', perms: ['', '', '', '', '', '', '', '', ''], isSeparator: true },
    { label: 'BOLLETTE', perms: ['🟡', '🔴', '🟡', '🟢', '🔴', '🔴', '🟢', '🟡', '🔴'] },
    { label: 'BILANCIO', perms: ['🟡', '🔴', '🟡', '🟢', '🔴', '🔴', '🟢', '🟡', '🔴'] },
    { label: 'REPORT', perms: ['🟢', '🔴', '🟢', '🟢', '🟡', '🟡', '🟢', '🟢', '🟡'] },
    { label: 'AUTORIZZAZIONI', perms: ['🔴', '🔴', '🔴', '🔴', '🔴', '🔴', '🟢', '🟡', '🔴'] },
    { label: 'SITO WEB', perms: ['🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢'] },
  ];

  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
    left: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
    right: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  };

  const headerCells = [
    new TableCell({
      width: { size: 28, type: WidthType.PERCENTAGE },
      shading: { fill: 'CBD5E1' },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: 'FUNZIONE',
              bold: true,
              size: 20,
              color: '0F172A',
              font: 'Segoe UI',
            }),
          ],
        }),
      ],
    }),
    ...roles.map(
      (role) =>
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: 'CBD5E1' },
          verticalAlign: VerticalAlign.BOTTOM,
          margins: { top: 40, bottom: 40, left: 10, right: 10 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: roleImages[role],
                  transformation: {
                    width: 34,
                    height: 170,
                  },
                }),
              ],
            }),
          ],
        })
    ),
  ];

  const headerRow = new TableRow({
    height: { value: 2700, rule: HeightRule.ATLEAST },
    tableHeader: true,
    children: headerCells,
  });

  const tableRows = [headerRow];

  rowsData.forEach((row, idx) => {
    if (row.isSeparator) {
      tableRows.push(
        new TableRow({
          height: { value: 140, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              shading: { fill: 'E2E8F0' },
              children: [new Paragraph({})],
            }),
            ...row.perms.map(
              () =>
                new TableCell({
                  width: { size: 8, type: WidthType.PERCENTAGE },
                  shading: { fill: 'E2E8F0' },
                  children: [new Paragraph({})],
                })
            ),
          ],
        })
      );
      return;
    }

    const rowCells = [
      new TableCell({
        width: { size: 28, type: WidthType.PERCENTAGE },
        shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 100, right: 60 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: row.label,
                bold: true,
                size: 18,
                color: '1E293B',
                font: 'Segoe UI',
              }),
            ],
          }),
        ],
      }),
      ...row.perms.map(
        (dot) =>
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: dot,
                    size: 20,
                  }),
                ],
              }),
            ],
          })
      ),
    ];

    tableRows.push(
      new TableRow({
        height: { value: 380, rule: HeightRule.ATLEAST },
        children: rowCells,
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: tableRows,
  });
}

function createSectionPermissionStrip(permsArray) {
  const roles = [
    'CD',
    'SOCIO',
    'SEGRETERIA',
    'AMMINISTRATIVO',
    'DIDATTICA',
    'VIAGGI',
    'AMMINISTRATORE',
    'PRESIDENZA',
    'LEZIONI SUL CAMPO',
  ];

  const headerCells = roles.map(
    (role) =>
      new TableCell({
        width: { size: 11.11, type: WidthType.PERCENTAGE },
        shading: { fill: 'CBD5E1' },
        verticalAlign: VerticalAlign.BOTTOM,
        margins: { top: 40, bottom: 40, left: 10, right: 10 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: roleImages[role],
                transformation: {
                  width: 36,
                  height: 170,
                },
              }),
            ],
          }),
        ],
      })
  );

  const dataCells = permsArray.map(
    (dot) =>
      new TableCell({
        width: { size: 11.11, type: WidthType.PERCENTAGE },
        shading: { fill: 'F8FAFC' },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: dot,
                size: 22,
              }),
            ],
          }),
        ],
      })
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
      left: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
      right: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    },
    rows: [
      new TableRow({
        height: { value: 2700, rule: HeightRule.ATLEAST },
        tableHeader: true,
        children: headerCells,
      }),
      new TableRow({
        height: { value: 420, rule: HeightRule.ATLEAST },
        children: dataCells,
      }),
    ],
  });

  return [
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({
          text: 'AUTORIZZAZIONI PER QUESTA VOCE DI MENU:',
          bold: true,
          size: 18,
          color: '065F46',
          font: 'Segoe UI',
        }),
      ],
    }),
    table,
    new Paragraph({
      spacing: { before: 40, after: 160 },
      children: [
        new TextRun({
          text: 'Legenda semaforo: 🟢 Lettura e Modifica  |  🟡 Solo Lettura  |  🔴 Non Disponibile / Accesso Interdetto',
          size: 16,
          italics: true,
          color: '64748B',
          font: 'Segoe UI',
        }),
      ],
    }),
  ];
}

// -------------------------------------------------------------
// COSTRUZIONE DEL DOCUMENTO
// -------------------------------------------------------------
async function main() {
  console.log('Inizializzazione rendering immagini ruoli verticali a 90°...');
  await initRoleImages();
  console.log('✓ Immagini ruoli pronte.');

  const children = [];

// ================= COPERTINA =================
children.push(new Paragraph({ spacing: { before: 400 } }));

if (logoBuffer) {
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [
        new ImageRun({
          data: logoBuffer,
          transformation: { width: 170, height: 170 },
        }),
      ],
    })
  );
}

children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 60 },
    children: [
      new TextRun({
        text: "UNIVERSITÀ DELLA TERZA ETÀ",
        size: 32,
        bold: true,
        color: COLOR_GOLD,
        font: 'Segoe UI',
      }),
    ],
  })
);

children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
    children: [
      new TextRun({
        text: "QUARTU SANT'ELENA & SOLEMINIS",
        size: 24,
        bold: true,
        color: COLOR_MUTED,
        font: 'Segoe UI',
      }),
    ],
  })
);

children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 },
    children: [
      new TextRun({
        text: "Q3 — MANUALE D'USO E GUIDA OPERATIVA",
        size: 40,
        bold: true,
        color: COLOR_PRIMARY,
        font: 'Segoe UI',
      }),
    ],
  })
);

children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 400 },
    children: [
      new TextRun({
        text: "Piattaforma Web & Gestionale Integrato per la Didattica, i Servizi e i Soci",
        size: 24,
        italics: true,
        color: COLOR_TEXT,
        font: 'Segoe UI',
      }),
    ],
  })
);

// Riquadro info copertina
children.push(
  new Table({
    width: { size: 85, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: COLOR_BG_LIGHT },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' },
            },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: "Documento Ufficiale di Istruzione e Funzionamento",
                    bold: true,
                    size: 21,
                    color: COLOR_PRIMARY,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Versione Applicazione: v66 · Anno Accademico: 2026/2027\nSedi Operative: Quartu Sant'Elena (Via Cilea / Via Palestrina) & Soleminis\nPiattaforma Online: https://qu3.onrender.com",
                    size: 19,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
);

// Interruzione di pagina per iniziare l'indice
children.push(new Paragraph({ pageBreakBefore: true }));

// ================= INDICE GENERALE =================
children.push(createTitle("INDICE GENERALE DEI CONTENUTI"));
children.push(createSubtitle("Mappa completa delle sezioni e delle funzionalità"));

const tocItems = [
  { num: "★", title: "Matrice Sinottica dei Ruoli e delle Autorizzazioni", sub: "Prospetto generale delle funzioni e dei permessi (Pallini 🔴 🟡 🟢)" },
  { num: "1", title: "Introduzione e Architettura di Sistema", sub: "Tecnologia PWA, sincronizzazione cloud multi-dispositivo e funzionamento ibrido" },
  { num: "2", title: "Accesso al Portale e Riconoscimento Utente", sub: "Login socio con numero tessera, tastierino touch e assegnazione automatica ruolo" },
  { num: "3", title: "Barra Superiore di Accessibilità e Comandi Rapidi", sub: "Ingrandimento testi, contrasto visivo elevato, tema scuro e sintesi vocale" },
  { num: "4", title: "Guida Dettagliata per Singola Voce di Menu", sub: "Disamina analitica di ciascuna funzionalità accessibile dall'applicazione" },
  { num: "   4.1", title: "Anagrafica Soci", sub: "Schede soci, gestione email/telefoni, import CSV/Excel e preservazione ruoli" },
  { num: "   4.2", title: "Timbrature e Corsi", sub: "Ingresso aule, timbratura della presenza e orario delle lezioni" },
  { num: "   4.3", title: "Gestione Aule", sub: "Monitoraggio presenze live, riscontri aule, appelli e orario docenti" },
  { num: "   4.4", title: "Biblioteca", sub: "Catalogo volumi, collocazione, disponibilità, prestiti e importazione" },
  { num: "   4.5", title: "Lezioni sul Campo", sub: "Escursioni, preventivazione costi, quote soci, acconti e ripartizione" },
  { num: "   4.6", title: "Prenotazioni", sub: "Cinema, gite, conferenze, timer di messa in onda e conferme email" },
  { num: "   4.7", title: "Avvisi Video", sub: "Proiezione su monitor di sede, annunci a scorrimento (ticker) e slide" },
  { num: "   4.8", title: "Elimina Code", sub: "Chiamata vocale numerata per sportello, monitor pubblico e telecomando" },
  { num: "   4.9", title: "Piccola Cassa", sub: "Entrate, uscite, scontrini, rimborsi, categorie e quadratura del saldo" },
  { num: "   4.10", title: "Bollette", sub: "Monitoraggio fatture energetiche e ripartizione tra Qu3 e Alveas" },
  { num: "   4.11", title: "Bilancio", sub: "Consuntivo ETS, Preventivo, Gestione Liquidità e fascicoli assembleari" },
  { num: "   4.12", title: "Report", sub: "Cruscotto riepilogativo, esportazioni Excel e PDF ufficiali con logo" },
  { num: "   4.13", title: "Autorizzazioni", sub: "Matrice granulare dei permessi (view/edit/none) per ciascun ruolo" },
  { num: "   4.14", title: "Sito Web", sub: "Collegamento al portale istituzionale ufficiale (www.univerquartu.it)" },
  { num: "5", title: "Procedure Operative Quotidiane", sub: "Guida rapida per la segreteria, i docenti, gli amministratori e i soci" },
  { num: "6", title: "Sicurezza, Backup e Integrità dei Dati", sub: "Politiche di salvataggio automatico e tutela delle informazioni" },
];

tocItems.forEach((item) => {
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 40 },
      children: [
        new TextRun({
          text: `${item.num}  ${item.title}`,
          bold: true,
          size: 22,
          color: COLOR_PRIMARY,
        }),
        new TextRun({
          text: ` — ${item.sub}`,
          size: 20,
          color: COLOR_MUTED,
        }),
      ],
    })
  );
});

// Interruzione di pagina per la Matrice dei Ruoli (subito dopo l'indice!)
children.push(new Paragraph({ pageBreakBefore: true }));

children.push(createTitle("MATRICE GENERALE DEI RUOLI E DELLE AUTORIZZAZIONI"));
children.push(createSubtitle("Prospetto sinottico dei permessi operativi per ciascuna funzione di Q3"));

children.push(
  createCallout(
    "LEGENDA DEI LIVELLI DI AUTORIZZAZIONE",
    "🔴 Pallino Rosso = NON DISPONIBILE (funzione non visibile o interdetta al ruolo)\n🟡 Pallino Giallo = SOLO LETTURA (consultazione dei dati e dei registri senza facoltà di modifica)\n🟢 Pallino Verde = LETTURA E MODIFICA (pieni poteri operativi di gestione, inserimento e cancellazione)"
  )
);

children.push(new Paragraph({ spacing: { before: 180, after: 120 } }));
children.push(createPermissionsMatrixTable());
children.push(new Paragraph({ spacing: { after: 200 } }));

// Interruzione di pagina per il contenuto effettivo
children.push(new Paragraph({ pageBreakBefore: true }));

// ================= SEZIONE 1 =================
children.push(createHeading1("1. INTRODUZIONE E ARCHITETTURA DI SISTEMA"));
children.push(
  createParagraph(
    "La piattaforma software Q3 rappresenta la soluzione gestionale e informativa integrata sviluppata specificamente per le esigenze dell'Università della Terza Età di Quartu Sant'Elena e della sede collegata di Soleminis. L'obiettivo primario del sistema è semplificare, velocizzare e digitalizzare tutte le attività quotidiane legate alla vita associativa: dalla rilevazione delle presenze alle lezioni, alla gestione contabile, fino al catalogo della biblioteca, alle prenotazioni di eventi e alle comunicazioni visive."
  )
);
children.push(
  createParagraph(
    "Il sistema è stato ingegnerizzato come Progressive Web App (PWA) di ultima generazione. Ciò significa che l'applicazione è accessibile da qualsiasi dispositivo (computer desktop Windows/Mac, tablet iPad/Android, smartphone, e persino postazioni totem touch-screen) tramite un comune browser web, con la possibilità di essere 'installata' come applicazione autonoma con icona sulla schermata iniziale."
  )
);

children.push(createHeading2("1.1 Caratteristiche Fondamentali"));
children.push(createBullet(" L'applicazione non richiede installazioni complesse; si aggiorna automaticamente ad ogni avvio alla versione più recente.", "Accessibilità Universale:"));
children.push(createBullet(" Grazie a un'architettura ibrida con archiviazione locale (LocalStorage / IndexedDB) e sincronizzazione Server-Sent Events (SSE), il sistema garantisce continuità operativa anche in caso di instabilità della connessione internet.", "Resilienza Offline e Realtime:"));
children.push(createBullet(" Quando un operatore esegue un'operazione (ad esempio una chiamata eliminacode o una timbratura), tutti gli altri schermi collegati si aggiornano istantaneamente senza dover ricaricare la pagina.", "Sincronizzazione Immediata Multi-Schermo:"));
children.push(createBullet(" Ogni socio accede digitando semplicemente il proprio numero di tessera, senza dover memorizzare password complesse.", "Semplicità d'Uso:"));

children.push(createCallout(
  "Nota sulla Sicurezza e Riservatezza dei Dati",
  "Tutti i dati dell'Anagrafica Soci, i ruoli del Consiglio Direttivo, le registrazioni di cassa e le presenze sono memorizzati in conformità con le normative vigenti sulla privacy (GDPR). Nessun dato sensibile viene divulgato all'esterno."
));

// ================= SEZIONE 2 =================
children.push(createHeading1("2. ACCESSO AL PORTALE E RICONOSCIMENTO UTENTE"));
children.push(
  createParagraph(
    "All'avvio dell'applicazione viene presentata la schermata di login pulita e ad alto contrasto. Al centro si trova il campo per l'inserimento del numero di tessera socio, accompagnato da un tastierino numerico touch-screen virtuale ideale per tablet o monitor interattivi."
  )
);

children.push(createHeading2("2.1 Modalità di Accesso Socio e Operatore"));
children.push(createBullet(" Il socio digita le cifre del proprio tesserino (es. 9580, 7433, ecc.) e preme 'Entra come Socio'. Il sistema carica immediatamente il suo profilo personalizzato, mostrando i corsi a cui è iscritto nella giornata corrente e consentendo la timbratura.", "Accesso Standard Socio:"));
children.push(createBullet(" I membri del Consiglio Direttivo, la Segreteria, i responsabili della Didattica, dei Viaggi, della Biblioteca e gli Amministratori digitano la propria tessera (oppure i codici dedicati di segreteria/ufficio come 000, 9999, 9998, 7726). Il sistema riconosce istantaneamente i ruoli associati e attiva i menu corrispondenti.", "Accesso Operatore con Ruolo:"));
children.push(createBullet(" In qualsiasi momento è possibile terminare la sessione premendo il pulsante 'Esci' in alto a destra o nella barra laterale.", "Disconnessione (Logout):"));

children.push(createHeading2("2.2 Ruoli e Livelli di Privilegio"));
children.push(createParagraph("I principali ruoli gestiti dal sistema comprendono:"));
children.push(createBullet(" Accesso alla propria tessera, visualizzazione orario lezioni, timbratura presenza, catalogo biblioteca e prenotazione eventi.", "Socio:"));
children.push(createBullet(" Gestione presenze, riscontri aule, registri docenti, calendario materie e report didattici.", "Didattica:"));
children.push(createBullet(" Gestione delle escursioni, lezioni sul campo, preventivi di viaggio e quote partecipanti.", "Viaggi & LsC:"));
children.push(createBullet(" Gestione del catalogo libri, classificazione volumi, inserimento e monitoraggio prestiti.", "Biblioteca:"));
children.push(createBullet(" Gestione dell'eliminacode, sportello informativo e avvisi ai soci.", "Segreteria / Presidenza:"));
children.push(createBullet(" Gestione della cassa, scontrini, fatture e bilanci dell'Associazione.", "Amministrativo / Cassa:"));
children.push(createBullet(" Accesso completo a tutte le funzioni, gestione matrice permessi e anagrafica generale.", "Amministratore (Super Admin):"));

// ================= SEZIONE 3 =================
children.push(createHeading1("3. BARRA SUPERIORE DI ACCESSIBILITÀ E COMANDI RAPIDI"));
children.push(
  createParagraph(
    "In alto su ogni pagina è sempre visibile la barra di accessibilità 'AccessibilityTopBar', progettata secondo i più avanzati criteri di ergonomia visiva per persone anziane o ipovedenti."
  )
);

children.push(createHeading2("3.1 Funzionalità della Barra Superiore"));
children.push(createBullet(" I pulsanti A- e A+ permettono di rimpicciolire o ingrandire istantaneamente le dimensioni di tutti i caratteri dell'applicazione, facilitando la lettura senza deformare il layout.", "Controllo Zoom del Testo (A- / A+):"));
children.push(createBullet(" Attiva una visualizzazione ad elevato contrasto cromatico con bordi marcati, ideale per chi ha difficoltà di percezione visiva.", "Contrasto Elevato:"));
children.push(createBullet(" Commuta l'interfaccia su sfondo scuro con testo chiaro, riducendo l'affaticamento oculare in ambienti con luce attenuata.", "Tema Notte (Dark Mode):"));
children.push(createBullet(" Consente di abilitare o disattivare la lettura vocale automatica dei messaggi (utilizzata nell'eliminacode) e i segnali acustici di conferma timbratura.", "Feedback Audio e Sintesi Vocale:"));
children.push(createBullet(" Un selettore rapido consente agli operatori di passare con un click dalla sede principale di Quartu Sant'Elena alla sede di Soleminis, filtrando orari e aule.", "Selettore Sede Operativa:"));

// ================= SEZIONE 4 =================
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading1("4. GUIDA DETTAGLIATA PER SINGOLA VOCE DI MENU"));
children.push(
  createParagraph(
    "Nel menu laterale (su computer desktop) o nel menu a tendina (su smartphone e tablet) sono elencate tutte le sezioni applicative. Per ciascuna voce viene riportato in cima il semaforo con le autorizzazioni assegnate ai singoli ruoli, seguito dalla descrizione dettagliata delle funzionalità operative."
  )
);

// 4.1
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.1 👥 Anagrafica Soci (anagrafica_soci)"));
children.push(...createSectionPermissionStrip(['🟡', '🔴', '🟢', '🟡', '🔴', '🔴', '🟢', '🟡', '🔴']));
children.push(
  createParagraph(
    "Il cuore anagrafico dell'Associazione. Gestisce l'intero archivio soci (oltre 2.080 iscritti) con strumenti avanzati di ricerca, modifica e importazione."
  )
);
children.push(createBullet(" Barra di ricerca istantanea che filtra per numero di tessera, cognome, nome, email o ruolo, con evidenziazione immediata dei risultati.", "Ricerca Intelligente:"));
children.push(createBullet(" Ogni socio possiede una scheda con numero tessera, cognome, nome, sede (Quartu o Soleminis), ruoli ricoperti (Socio, Didattica, Viaggi, Biblioteca, Segreteria, Amministratore, CD), indirizzo email e recapito telefonico.", "Dati di Dettaglio:"));
children.push(createBullet(" Gli amministratori possono assegnare o revocare ruoli speciali con un semplice menu a tendina.", "Modifica Ruoli:"));
children.push(createBullet(" Permette di caricare elenchi di soci da file CSV o fogli Excel (.xlsx). Il sistema dispone di un algoritmo intelligente che riconosce automaticamente le colonne anche senza intestazione (es. Tessera; Cognome; Nome; Email) e soprattutto PRESERVA AL 100% i ruoli speciali già assegnati in precedenza, evitando declassamenti involontari.", "Importazione Massiva Protetta:"));
children.push(createBullet(" Possibilità di scaricare l'intero archivio in formato Excel/CSV oppure in formato PDF ufficiale impaginato con logo dorato.", "Esportazione Dati:"));

// 4.2
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.2 🕒 Timbrature (presenze)"));
children.push(...createSectionPermissionStrip(['🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢']));
children.push(
  createParagraph(
    "È la schermata principale utilizzata quotidianamente dai soci per certificare la propria presenza a lezione e consultare l'orario delle attività formative."
  )
);
children.push(createBullet(" All'accesso, la schermata mostra in primo piano le lezioni in programma per la giornata odierna, suddivise per orario, aula e docente.", "Visualizzazione Corsi Odierni:"));
children.push(createBullet(" Il socio seleziona la materia che sta per frequentare e preme il pulsante verde 'TIMBRA PRESENZA'. Il sistema emette un segnale acustico armonico di conferma e visualizza un messaggio visivo di avvenuta registrazione.", "Procedura di Timbratura:"));
children.push(createBullet(" Il sistema memorizza timestamp, data, materia, aula e numero di tessera. Se il socio prova a timbrare due volte per la stessa lezione, l'applicazione lo informa con delicatezza che la presenza è già stata acquisita.", "Prevenzione Doppie Timbrature:"));
children.push(createBullet(" Un'apposita scheda permette di visualizzare il prospetto orario dell'intera settimana per pianificare la frequenza alle lezioni.", "Orario Settimanale Completo:"));

// 4.3
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.3 📋 Gestione Aule (admin_dashboard)"));
children.push(...createSectionPermissionStrip(['🔴', '🔴', '🟡', '🟡', '🟢', '🔴', '🟢', '🟡', '🔴']));
children.push(
  createParagraph(
    "Strumento strategico a disposizione della Didattica, del Consiglio Direttivo e della Direzione per monitorare in tempo reale il flusso delle persone nelle singole aule."
  )
);
children.push(createBullet(" Una panoramica a schede mostra tutte le aule attive (es. Aula Biblioteca, Ferrini, Gialla, Polifunzionale, Rocchitta, Rossa, San Benedetto, Verde) indicando per ciascuna il docente presente, la materia in svolgimento e il numero esatto di soci attualmente seduti.", "Mappa Aule Live:"));
children.push(createBullet(" Consente all'operatore di visualizzare la lista nominale degli studenti presenti in aula, aggiungere manualmente un socio sprovvisto di tessera o correggere eventuali timbrature errate.", "Appello Elettronico:"));
children.push(createBullet(" Genera grafici e percentuali di occupazione per materia e fascia oraria, consentendo di valutare quali corsi riscuotono maggior interesse.", "Statistiche di Frequenza:"));
children.push(createBullet(" Permette di esportare il foglio presenze ufficiale in PDF con l'intestazione e il logo dorato dell'Associazione, pronto per essere firmato e archiviato.", "Stampa Registro Ufficiale:"));

// 4.4
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.4 📚 Biblioteca (biblioteca)"));
children.push(...createSectionPermissionStrip(['🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢']));
children.push(
  createParagraph(
    "Gestione del patrimonio librario dell'Università della Terza Età, a disposizione di tutti i soci per consultazione e prestito."
  )
);
children.push(createBullet(" Ricerca rapida per titolo, autore, genere letterario (es. Narrativa Sarda, Storia, Poesia, Arte), anno di pubblicazione e codice di collocazione a scaffale.", "Catalogo Libri:"));
children.push(createBullet(" Indicazione chiara se il libro è attualmente 'Disponibile' oppure 'In Prestito', con data di consegna e nome del socio che lo ha richiesto.", "Stato di Disponibilità e Prestiti:"));
children.push(createBullet(" Gli addetti alla biblioteca possono registrare nuovi volumi donati o acquistati, modificare le schede o importare cataloghi massivi da file CSV.", "Gestione Patrimonio:"));

// 4.5
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.5 🧭 Lezioni sul Campo (lezioni_campo)"));
children.push(...createSectionPermissionStrip(['🟡', '🔴', '🟡', '🟡', '🟡', '🟢', '🟢', '🟡', '🟢']));
children.push(
  createParagraph(
    "Modulo specializzato per il comitato viaggi ed escursioni didattiche (archeologiche, naturalistiche, storiche e culturali)."
  )
);
children.push(createBullet(" Per ciascuna uscita è possibile preventivare i costi del noleggio pullman, delle guide turistiche, degli ingressi ai musei, dell'assicurazione e dei pasti.", "Preventivo Analitico:"));
children.push(createBullet(" Registrazione delle iscrizioni con tracciamento degli acconti versati, dei saldi e delle eventuali disdette con rimborso.", "Gestione Quote Partecipanti:"));
children.push(createBullet(" Genera il rendiconto economico consuntivo dell'uscita, evidenziando il pareggio o l'eventuale avanzo/disavanzo.", "Rendiconto Economico:"));

// 4.6
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.6 🎟️ Prenotazioni (prenotazione_eventi)"));
children.push(...createSectionPermissionStrip(['🟢', '🟡', '🟢', '🟢', '🟡', '🟢', '🟢', '🟢', '🟡']));
children.push(
  createParagraph(
    "Uno dei moduli più innovativi e richiesti: permette la gestione completa delle prenotazioni a manifestazioni speciali, cicli di cinema, conferenze a tema e gite naturalistiche."
  )
);
children.push(createBullet(" È possibile definire liberamente nuove categorie di eventi (Cinema, Conferenze, Gite, Mostre, Corsi Speciali).", "Tipologie Flessibili:"));
children.push(createBullet(" Titolo, data evento, orario, numero di posti totali, numero di posti riservati alla prenotazione online, costo eventuale del biglietto ed eventuale necessità di conferma con pagamento in sede.", "Scheda Evento Dettagliata:"));
children.push(createBullet(" Ogni evento possiede una data e ora di inizio e una data e ora di fine per le prenotazioni, con un conto alla rovescia (timer) che apre e chiude automaticamente la possibilità di iscriversi.", "Timer di Messa in Onda:"));
children.push(createBullet(" L'amministratore può decidere se ciascun socio può prenotare solo per sé (1 posto, associato in automatico alla sua tessera) o anche per il coniuge/un altro socio (fino a 2 posti indicando la seconda tessera o nominativo).", "Regola Posti per Socio:"));
children.push(createBullet(" Al momento della conferma, il socio riceve in automatico un'email con il riepilogo della prenotazione, il codice univoco e le istruzioni per l'evento.", "Notifica Email Automatica:"));
children.push(createBullet(" Se i posti disponibili si esauriscono, i successivi soci possono iscriversi alla lista d'attesa; in caso di cancellazione, il primo in graduatoria viene promosso automaticamente.", "Lista d'Attesa Dinamica:"));

// 4.7
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.7 📺 Avvisi Video (avvisi_video)"));
children.push(...createSectionPermissionStrip(['🟢', '🔴', '🔴', '🔴', '🔴', '🔴', '🟢', '🟡', '🔴']));
children.push(
  createParagraph(
    "Sistema di digital signage per la trasmissione di comunicazioni istituzionali, locandine e messaggi di pubblica utilità sui monitor installati nelle aule e nella sala d'attesa."
  )
);
children.push(createBullet(" Permette di caricare locandine in formato immagine (es. locandina Lectio Magistralis, avvisi per gite o chiusura sede) che vengono proiettate a rotazione a schermo intero.", "Slide e Locandine:"));
children.push(createBullet(" Un testo scorrevole in basso sullo schermo trasmette avvisi urgenti in tempo reale a tutti i presenti.", "Ticker Scorrevole:"));
children.push(createBullet(" Regolazione del tempo di permanenza di ciascuna slide e programmazione delle date di inizio e fine visualizzazione.", "Temporizzazione Automatica:"));

// 4.8
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.8 🎫 Elimina Code (eliminacode)"));
children.push(...createSectionPermissionStrip(['🔴', '🔴', '🟢', '🔴', '🔴', '🔴', '🟢', '🟡', '🔴']));
children.push(
  createParagraph(
    "Sistema avanzato per la regolazione dell'afflusso dei soci agli sportelli di segreteria e presidenza nei periodi di rinnovo iscrizioni o tesseramento."
  )
);
children.push(createBullet(" Interfaccia elegante con grandi cifre ad alto contrasto, logo dell'Associazione e ora corrente, ottimizzata per essere proiettata su TV o monitor sala.", "Display di Chiamata Pubblico:"));
children.push(createBullet(" Il personale di sportello dispone di una pulsantiera virtuale per chiamare il numero successivo ('AVANTI'), richiamare il numero corrente ('RIPETI') o azzerare la sequenza giornaliera.", "Telecomando Operatore:"));
children.push(createBullet(" All'avanzamento del turno, una voce chiara in italiano sintetizza l'annuncio sonoro: 'Numero 42 allo sportello 1'.", "Annuncio Vocale Italiano:"));

// 4.9
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.9 💰 Piccola Cassa (piccola_cassa)"));
children.push(...createSectionPermissionStrip(['🟢', '🔴', '🔴', '🟢', '🔴', '🔴', '🟢', '🟡', '🔴']));
children.push(
  createParagraph(
    "Modulo dedicato alla gestione della cassa contanti dell'Associazione per le spese correnti e minute (cancelleria, materiali didattici, rimborsi spese, marche da bollo, rinfreschi, ecc.)."
  )
);
children.push(createBullet(" Maschera intuitiva per inserire data, causale, importo, categoria di spesa, beneficiario e tipologia (Entrata / Uscita).", "Registrazione Movimento:"));
children.push(createBullet(" Possibilità di allegare una foto o una scansione della pezza giustificativa (scontrino, ricevuta fiscale, fattura).", "Archivio Giustificativi:"));
children.push(createBullet(" Il sistema calcola in tempo reale il saldo disponibile della cassa contanti, segnalando eventuali discrepanze rispetto al fondo iniziale stabilito.", "Saldi e Riconciliazione:"));
children.push(createBullet(" Esportazione con un solo click del Libro Cassa in PDF con logo e firma per i revisori dei conti.", "Verbale di Verifica Cassa:"));

// 4.10
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.10 ⚡ Bollette (bollette)"));
children.push(...createSectionPermissionStrip(['🟡', '🔴', '🟡', '🟢', '🔴', '🔴', '🟢', '🟡', '🔴']));
children.push(
  createParagraph(
    "Gestione trasparente e automatizzata delle spese per l'energia elettrica della sede associativa, condivisa storicamente con l'ente co-locatario (Alveas)."
  )
);
children.push(createBullet(" Archiviazione delle bollette bimestrali con periodo di competenza, kWh consumati, spesa totale e scadenza.", "Archivio Bollette:"));
children.push(createBullet(" Applicazione della percentuale concordata per determinare l'esatta quota a carico di Qu3 e quella di competenza Alveas.", "Algoritmo di Ripartizione Quote:"));
children.push(createBullet(" Grafico dell'evoluzione dei consumi energetici nel corso dell'anno per individuare tempestivamente eventuali sprechi o anomalie.", "Analisi Consumi nel Tempo:"));

// 4.11
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.11 ⚖️ Bilancio (bilancio)"));
children.push(...createSectionPermissionStrip(['🟡', '🔴', '🟡', '🟢', '🔴', '🔴', '🟢', '🟡', '🔴']));
children.push(
  createParagraph(
    "Strumento contabile completo conforme alle linee guida del Ministero del Lavoro e delle Politiche Sociali per gli Enti del Terzo Settore (ETS)."
  )
);
children.push(createBullet(" Redazione del rendiconto per cassa suddiviso per aree di attività statutaria (attività didattiche, uscite sul campo, manifestazioni, quote associative).", "Bilancio Consuntivo Ufficiale:"));
children.push(createBullet(" Programmazione delle entrate e uscite attese per l'anno sociale successivo con confronto in tempo reale degli scostamenti.", "Bilancio Preventivo:"));
children.push(createBullet(" Monitoraggio costante dei conti bancari, postali e della liquidità in cassa contanti.", "Quadro Liquidità e Disponibilità:"));
children.push(createBullet(" Generazione automatica del fascicolo di bilancio completo di tabelle e note per la presentazione all'Assemblea Ordinaria dei Soci.", "Fascicolo per l'Assemblea:"));

// 4.12
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.12 📈 Report (report)"));
children.push(...createSectionPermissionStrip(['🟢', '🔴', '🟢', '🟢', '🟡', '🟡', '🟢', '🟢', '🟡']));
children.push(
  createParagraph(
    "Il centro di analisi dei dati associativi, che aggrega informazioni da tutti gli altri moduli per fornire quadri di sintesi immediati ed esportazioni professionali."
  )
);
children.push(createBullet(" Totale ore di docenza svolte, elenco presenze per ciascuna materia e prospetto orario compilato.", "Report Docenti e Lezioni:"));
children.push(createBullet(" Elenco soci più assidui, medie di presenze per giorno della settimana e tasso di frequenza per sede.", "Report Affluenza Soci:"));
children.push(createBullet(" Sintesi aggregata di cassa, bilancio, quote escursioni e consumi energetici.", "Report Economico Globale:"));
children.push(createBullet(" Tutti i report possono essere esportati istantaneamente in fogli di calcolo Excel (.xlsx) per ulteriori analisi o in documenti PDF ufficiali ad alta risoluzione con intestazione e logo dorato QU3.", "Esportazione Excel e PDF:"));

// 4.13
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.13 🔐 Autorizzazioni (autorizzazioni)"));
children.push(...createSectionPermissionStrip(['🔴', '🔴', '🔴', '🔴', '🔴', '🔴', '🟢', '🟡', '🔴']));
children.push(
  createParagraph(
    "La plancia di comando per l'Amministratore di sistema, dove è possibile regolare visibilità e facoltà operative per ciascuna figura associativa."
  )
);
children.push(createBullet(" Una matrice bidimensionale incrocia ogni ruolo (Socio, Didattica, Viaggi, Biblioteca, Segreteria, Amministrativo, Amministratore, Consiglio Direttivo, Presidenza) con ciascuna delle sezioni del menu.", "Matrice Permessi:"));
children.push(createBullet(" Per ogni combinazione è possibile impostare: 'Nessun Accesso' (la voce scompare dal menu), 'Sola Lettura' (l'utente visualizza ma non modifica) o 'Modifica Completa' (pieni poteri operativi).", "Tre Livelli di Permesso:"));
children.push(createBullet(" I permessi dei ruoli protetti e degli amministratori non possono essere rimossi accidentalmente.", "Protezione Ruoli Critici:"));

// 4.14
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading2("4.14 🌐 Sito Web (sito_qu3)"));
children.push(...createSectionPermissionStrip(['🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢', '🟢']));
children.push(
  createParagraph(
    "Posizionato rigorosamente come ultima voce del menu laterale e mobile, questo pulsante apre in una nuova scheda del browser il sito web istituzionale dell'Associazione (www.univerquartu.it), consentendo ai soci e agli operatori di accedere rapidamente al calendario accademico pubblico, alle gallerie fotografiche e ai comunicati stampa."
  )
);

// ================= SEZIONE 5 =================
children.push(new Paragraph({ pageBreakBefore: true }));
children.push(createHeading1("5. PROCEDURE OPERATIVE QUOTIDIANE PASSO-PASSO"));
children.push(
  createParagraph(
    "Di seguito vengono illustrate le tre procedure operative più frequenti, descritte in maniera chiara per facilitare l'operatività del personale di segreteria e dei volontari."
  )
);

children.push(createHeading2("Procedura A: Accoglienza e Timbratura Presenza"));
children.push(createBullet(" Il socio si avvicina alla postazione tablet o apre l'app sul proprio smartphone.", "Passo 1:"));
children.push(createBullet(" Digita il proprio numero di tessera tramite il tastierino numerico a schermo e tocca 'Entra come Socio'.", "Passo 2:"));
children.push(createBullet(" Sullo schermo compaiono le lezioni del giorno: tocca il nome del corso che intende frequentare.", "Passo 3:"));
children.push(createBullet(" Preme il pulsante verde 'TIMBRA PRESENZA'. Un suono armonioso e un messaggio di spunta verde confermano che la presenza è registrata.", "Passo 4:"));

children.push(createHeading2("Procedura B: Chiamata Sportello con Eliminacode"));
children.push(createBullet(" L'operatore di segreteria accede al menu 'Eliminacode' con il proprio account.", "Passo 1:"));
children.push(createBullet(" Nella postazione dell'ufficio tiene aperto il 'Telecomando Operatore', mentre sul televisore della sala d'attesa è proiettato il 'Monitor Pubblico'.", "Passo 2:"));
children.push(createBullet(" Al momento di servire un nuovo socio, preme il grande tasto verde 'CHIAMA PROSSIMO NUMERO'.", "Passo 3:"));
children.push(createBullet(" Il televisore si aggiorna con un'animazione grafica e la voce sintetica scandisce chiaramente il numero e lo sportello.", "Passo 4:"));

children.push(createHeading2("Procedura C: Apertura e Gestione di un Nuovo Evento"));
children.push(createBullet(" L'amministratore entra nella sezione 'Prenotazione Eventi' e seleziona 'Crea Nuovo Evento'.", "Passo 1:"));
children.push(createBullet(" Compila la scheda: sceglie la tipologia (es. Cinema), indica titolo, data di svolgimento, capienza (es. 50 posti) e fissa il timer di apertura (es. martedì ore 09:00).", "Passo 2:"));
children.push(createBullet(" Salva l'evento. Allo scoccare dell'ora stabilita dal timer, il pulsante 'Prenota' diventa attivo per tutti i soci.", "Passo 3:"));
children.push(createBullet(" I soci prenotano e ricevono all'istante l'email di conferma con il proprio codice univoco.", "Passo 4:"));

// ================= SEZIONE 6 =================
children.push(createHeading1("6. SICUREZZA, BACKUP E INTEGRITÀ DEI DATI"));
children.push(
  createParagraph(
    "La piattaforma Q3 adotta una strategia di protezione dati a più livelli per garantire che nessuna informazione possa mai andare perduta:"
  )
);
children.push(createBullet(" Ad ogni modifica rilevante (aggiunta soci, timbrature, registrazioni contabili), il sistema genera un'istantanea crittografata sul server cloud Render.", "Backup Cloud Automatico:"));
children.push(createBullet(" Qualora venisse re-importato un file anagrafico contenente dati parziali o vecchi, il sistema rileva la discrepanza e impedisce la sovrascrittura distruttiva dei ruoli o dei permessi del Consiglio Direttivo.", "Meccanismi Anti-Sovrascrittura:"));
children.push(createBullet(" L'amministratore può in ogni istante scaricare l'intero database in formato JSON o CSV come copia di sicurezza da custodire su supporto esterno o pen drive.", "Esportazione di Emergenza:"));

// Creazione e salvataggio del documento DOCX
const doc = new Document({
  creator: "Università della Terza Età Quartu Sant'Elena & Soleminis",
  title: "Q3 — Manuale d'Uso e Guida Operativa",
  description: "Manuale ufficiale per l'utilizzo della piattaforma web Q3",
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "Q3 · Università della Terza Età Quartu Sant'Elena & Soleminis",
                  size: 16,
                  color: COLOR_MUTED,
                  font: 'Segoe UI',
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Manuale d'Uso Ufficiale v66 — Pagina ",
                  size: 16,
                  color: COLOR_MUTED,
                  font: 'Segoe UI',
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 16,
                  color: COLOR_PRIMARY,
                  bold: true,
                  font: 'Segoe UI',
                }),
                new TextRun({
                  text: " di ",
                  size: 16,
                  color: COLOR_MUTED,
                  font: 'Segoe UI',
                }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  size: 16,
                  color: COLOR_MUTED,
                  font: 'Segoe UI',
                }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outDocxPath, buffer);
  console.log('✓ Creato con successo il file Word a:', outDocxPath);
  try {
    fs.writeFileSync(artifactDocxPath, buffer);
    console.log('✓ Copiato anche nella cartella artifacts a:', artifactDocxPath);
  } catch (e) {
    console.error('Nota su artifact path:', e.message);
  }
  try {
    fs.writeFileSync(desktopDocxPath, buffer);
    console.log('✓ Copiato con successo sul Desktop a:', desktopDocxPath);
  } catch (e) {
    console.warn('Nota su desktop path:', e.message);
  }
}

main().catch((err) => {
  console.error('Errore durante la generazione del manuale:', err);
  process.exit(1);
});
