// Vercel Serverless Function per la sincronizzazione cloud della Cassaforte Cifrata
let memoryVault = null;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json(memoryVault || {});
  }

  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      memoryVault = data;
      return res.status(200).json({ success: true, updatedAt: new Date().toISOString() });
    } catch (e) {
      return res.status(400).json({ error: 'Payload non valido: ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Metodo non consentito' });
};
