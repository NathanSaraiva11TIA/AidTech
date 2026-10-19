// POST /api/contato  <- formulario "Fale conosco" da pagina Sobre nos.
// Corpo: { nome, email, assunto?, telefone?, mensagem, site? }  ("site" e um campo isca anti-spam)
const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITES = { nome: 100, email: 150, assunto: 150, telefone: 30, mensagem: 5000 };

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

// tira quebras de linha para nao deixarem o assunto/cabecalhos quebrados
const umaLinha = s => s.replace(/[\r\n]+/g, ' ');

function validar(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return 'corpo invalido';
  for (const k of Object.keys(LIMITES)) {
    if (b[k] === undefined || b[k] === null) b[k] = '';
    if (typeof b[k] !== 'string') return 'valor invalido em ' + k;
    b[k] = b[k].trim();
    if (b[k].length > LIMITES[k]) return 'campo muito longo: ' + k;
  }
  if (!b.nome) return 'informe seu nome';
  if (!EMAIL_RE.test(b.email)) return 'e-mail invalido';
  if (!b.mensagem) return 'escreva uma mensagem';
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'metodo nao permitido' });
  }

  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch (e) { b = null; }
  }

  // bots costumam preencher todos os campos; finge sucesso e descarta
  if (b && b.site) return res.status(200).json({ ok: true });

  const erro = validar(b);
  if (erro) return res.status(400).json({ erro });

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP_USER/SMTP_PASS nao configurados');
    return res.status(500).json({ erro: 'envio indisponivel' });
  }

  const texto = [
    'Nome: ' + b.nome,
    'E-mail: ' + b.email,
    'Telefone: ' + (b.telefone || '-'),
    'Assunto: ' + (b.assunto || '-'),
    '',
    b.mensagem
  ].join('\n');

  try {
    await getTransporter().sendMail({
      from: '"Site AGROSENSE" <' + process.env.SMTP_USER + '>',
      to: process.env.CONTATO_DESTINO || process.env.SMTP_USER,
      replyTo: { name: umaLinha(b.nome), address: b.email },
      subject: '[Contato AGROSENSE] ' + umaLinha(b.assunto || 'Nova mensagem de ' + b.nome),
      text: texto
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('erro ao enviar contato:', e.code || e.message);
    return res.status(502).json({ erro: 'falha ao enviar' });
  }
};
